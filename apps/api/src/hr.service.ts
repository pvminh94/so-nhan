import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { LeaveStatus, LeaveType, Prisma, type Role } from "@prisma/client";
import { annualLeaveEntitlement, assertLeaveAvailable, attendanceLockDecision, attendanceTemplate, dependentWarning, LEAVE_POLICY, leaveBalanceFromLedger, parseAttendanceCsv, type AbsenceKind } from "@so-nhan/payroll-engine";
import type { DependentRelation } from "@prisma/client";
import { canSeeSalary, SALARY_ROLES, type AuthUser } from "./common";
import { PrismaService } from "./prisma.service";

const leaveLabel: Record<LeaveType, string> = {
  ANNUAL: LEAVE_POLICY.ANNUAL.label,
  UNPAID: LEAVE_POLICY.UNPAID.label,
  SICK: LEAVE_POLICY.SICK.label,
  MATERNITY: LEAVE_POLICY.MATERNITY.label,
  OTHER: LEAVE_POLICY.OTHER.label,
};

@Injectable()
export class HrService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async dashboard(user: AuthUser) {
    const soon = new Date();
    soon.setDate(soon.getDate() + 60);
    const scope = await this.scopeIds(user);
    const inScope = scope ? { id: { in: scope } } : {};
    const salaryView = SALARY_ROLES.includes(user.role);
    const [headcount, pending, runs, departments, expiring, mine] = await Promise.all([
      this.prisma.employee.count({ where: { status: { not: "TERMINATED" }, ...inScope } }),
      this.prisma.leaveRequest.count({
        where: { status: "PENDING", ...(scope ? { employeeId: { in: scope } } : {}) },
      }),
      salaryView
        ? this.prisma.payrollRun.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }], take: 3, include: { legalEntity: true } })
        : Promise.resolve([]),
      this.prisma.department.findMany({
        include: { _count: { select: { employees: { where: { status: { not: "TERMINATED" }, ...inScope } } } } },
        orderBy: { name: "asc" },
      }),
      this.prisma.employee.findMany({
        where: { status: { not: "TERMINATED" }, contractEnd: { lte: soon }, ...inScope },
        orderBy: { contractEnd: "asc" },
        take: 8,
        include: { department: true },
      }),
      user.employeeId
        ? this.prisma.payslip.findFirst({
            where: { employeeId: user.employeeId },
            orderBy: { run: { year: "desc" } },
            include: { run: true },
          })
        : Promise.resolve(null),
    ]);
    return {
      headcount,
      pendingLeave: pending,
      runs: runs.map((run) => ({
        id: run.id,
        label: `${String(run.month).padStart(2, "0")}/${run.year}`,
        status: run.status,
        company: run.legalEntity.name,
      })),
      departments: departments
        .filter((item) => !scope || item._count.employees > 0)
        .map((item) => ({ id: item.id, name: item.name, count: item._count.employees })),
      expiring: expiring.map((item) => ({
        id: item.id,
        fullName: item.fullName,
        department: item.department.name,
        contractEnd: item.contractEnd,
      })),
      myPayslip: mine ? { runId: mine.runId, label: `${String(mine.run.month).padStart(2, "0")}/${mine.run.year}`, net: canSeeSalary(user.role, user.employeeId, mine.employeeId) ? mine.net : null } : null,
      role: user.role,
    };
  }

  async departments() {
    const rows = await this.prisma.department.findMany({ orderBy: { name: "asc" } });
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }

  async employees(user: AuthUser, q?: string) {
    const scope = await this.scopeIds(user);
    const rows = await this.prisma.employee.findMany({
      where: {
        ...(scope ? { id: { in: scope } } : {}),
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
                { jobTitle: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { department: true },
      orderBy: { code: "asc" },
    });
    return rows.map((row) => this.presentEmployee(user, row));
  }

  async team(user: AuthUser) {
    if (!user.employeeId) return [];
    const rows = await this.prisma.employee.findMany({
      where: { managerId: user.employeeId },
      include: { department: true, leaveRequests: { where: { status: "PENDING" } } },
      orderBy: { code: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      fullName: row.fullName,
      jobTitle: row.jobTitle,
      department: row.department.name,
      status: row.status,
      pendingLeave: row.leaveRequests.length,
    }));
  }

  async employee(user: AuthUser, id: string) {
    const row = await this.prisma.employee.findUnique({
      where: { id },
      include: { department: true, legalEntity: true, manager: true, leaveBalances: true, dependentPeople: { orderBy: { birthDate: "asc" } } },
    });
    if (!row) throw new NotFoundException("Không thấy nhân sự");
    await this.assertInScope(user, id);
    const year = new Date().getFullYear();
    await this.ensureLeaveLedger(this.prisma, id, year);
    const [balances, ledger] = await Promise.all([
      this.prisma.leaveBalance.findMany({ where: { employeeId: id }, orderBy: { year: "desc" } }),
      this.prisma.leaveLedger.findMany({ where: { employeeId: id }, orderBy: { createdAt: "asc" } }),
    ]);
    return {
      ...this.presentEmployee(user, row),
      legalEntity: row.legalEntity.name,
      taxCodeCompany: row.legalEntity.taxCode,
      manager: row.manager ? { id: row.manager.id, fullName: row.manager.fullName } : null,
      leaveBalances: balances,
      leaveLedger: ledger.map((item) => ({
        id: item.id,
        year: item.year,
        kind: item.kind,
        days: item.days,
        note: item.note,
        at: item.createdAt,
      })),
      contractEnd: row.contractEnd,
      dependentPeople: this.canEditDependents(user, row.id)
        ? row.dependentPeople.map((item) => ({
            id: item.id,
            fullName: item.fullName,
            relation: item.relation,
            birthDate: item.birthDate,
            warning: dependentWarning(item.relation, item.birthDate, new Date()),
          }))
        : [],
    };
  }

  async saveDependents(
    user: AuthUser,
    id: string,
    people: Array<{ fullName?: string; relation?: DependentRelation; birthDate?: string }>,
  ) {
    if (!this.canEditDependents(user, id)) throw new ForbiddenException("Không được sửa người phụ thuộc của người khác");
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException("Không thấy nhân sự");
    if (employee.status === "TERMINATED") throw new BadRequestException("Người đã nghỉ việc");
    if (!Array.isArray(people) || people.length > 10) throw new BadRequestException("Tối đa 10 người phụ thuộc");
    const relations = new Set(["CHILD", "SPOUSE", "PARENT", "OTHER"]);
    const rows = people.map((item) => {
      const fullName = item.fullName?.trim() ?? "";
      const birthDate = item.birthDate ? new Date(item.birthDate) : null;
      if (fullName.length < 2) throw new BadRequestException("Thiếu họ tên người phụ thuộc");
      if (!item.relation || !relations.has(item.relation)) throw new BadRequestException("Quan hệ không hợp lệ");
      if (!birthDate || Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
        throw new BadRequestException("Ngày sinh không hợp lệ");
      }
      return { employeeId: id, fullName, relation: item.relation, birthDate };
    });
    await this.prisma.$transaction([
      this.prisma.dependent.deleteMany({ where: { employeeId: id } }),
      ...rows.map((row) => this.prisma.dependent.create({ data: row })),
      this.prisma.employee.update({ where: { id }, data: { dependents: rows.length } }),
    ]);
    await this.audit(user, "UPDATE_DEPENDENTS", "Employee", id);
    return this.employee(user, id);
  }

  async createEmployee(user: AuthUser, body: Record<string, unknown>) {
    this.requireRole(user, ["ADMIN", "HR"]);
    const required = ["code", "fullName", "jobTitle", "departmentId", "baseSalary", "hireDate"] as const;
    for (const key of required) if (!body[key]) throw new BadRequestException(`Thiếu ${key}`);
    const department = await this.prisma.department.findUnique({ where: { id: String(body.departmentId) } });
    if (!department) throw new BadRequestException("Phòng ban không tồn tại");
    const salary = Number(body.baseSalary);
    const created = await this.prisma.employee.create({
      data: {
        code: String(body.code).trim().toUpperCase(),
        fullName: String(body.fullName).trim(),
        email: body.email ? String(body.email).trim().toLowerCase() : null,
        phone: body.phone ? String(body.phone) : null,
        jobTitle: String(body.jobTitle),
        departmentId: department.id,
        legalEntityId: department.legalEntityId,
        hireDate: new Date(String(body.hireDate)),
        contractStart: new Date(String(body.hireDate)),
        contractType: "DEFINITE",
        status: "PROBATION",
        baseSalary: salary,
        insuranceSalary: Number(body.insuranceSalary ?? salary),
        dependents: Number(body.dependents ?? 0),
        region: "I",
        bankName: body.bankName ? String(body.bankName) : null,
        bankAccount: body.bankAccount ? String(body.bankAccount) : null,
      },
      include: { department: true },
    });
    const years = 0;
    const year = new Date().getFullYear();
    const entitled = annualLeaveEntitlement(years);
    await this.prisma.leaveBalance.create({
      data: { employeeId: created.id, year, entitled, used: 0 },
    });
    await this.prisma.leaveLedger.create({
      data: { employeeId: created.id, year, kind: "ACCRUAL", days: entitled, note: "Mở quỹ năm" },
    });
    await this.audit(user, "CREATE_EMPLOYEE", "Employee", created.id);
    return this.presentEmployee(user, created);
  }

  async leaveRequests(user: AuthUser) {
    const where =
      user.role === "EMPLOYEE"
        ? { employeeId: user.employeeId ?? "__none__" }
        : user.role === "MANAGER"
          ? {
              OR: [
                { employeeId: user.employeeId ?? "__none__" },
                { employee: { managerId: user.employeeId ?? "__none__" } },
              ],
            }
          : {};
    const rows = await this.prisma.leaveRequest.findMany({
      where,
      include: { employee: { include: { department: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      typeLabel: leaveLabel[row.type],
      payer: LEAVE_POLICY[row.type as AbsenceKind]?.payerLabel ?? "",
      startDate: row.startDate,
      endDate: row.endDate,
      days: row.days,
      reason: row.reason,
      status: row.status,
      employee: { id: row.employee.id, fullName: row.employee.fullName, code: row.employee.code, department: row.employee.department.name },
    }));
  }

  async requestLeave(user: AuthUser, body: { type?: LeaveType; startDate?: string; endDate?: string; days?: number; reason?: string }) {
    if (!user.employeeId) throw new ForbiddenException("Tài khoản chưa gắn với hồ sơ nhân viên nên không gửi đơn được");
    const days = Number(body.days);
    if (!body.startDate || !body.endDate || !body.reason || !(days > 0)) throw new BadRequestException("Thiếu ngày nghỉ hoặc lý do");
    const type = body.type ?? "ANNUAL";
    if (!LEAVE_POLICY[type as AbsenceKind]) throw new BadRequestException("Loại nghỉ không hợp lệ");
    if (type === "ANNUAL") {
      const year = new Date(body.startDate).getFullYear();
      const snap = await this.ensureLeaveLedger(this.prisma, user.employeeId, year);
      try {
        assertLeaveAvailable(snap.remaining, days);
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : "Không còn đủ ngày phép năm");
      }
    }
    const created = await this.prisma.leaveRequest.create({
      data: {
        employeeId: user.employeeId,
        type,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        days,
        reason: body.reason.trim(),
      },
    });
    await this.audit(user, "REQUEST_LEAVE", "LeaveRequest", created.id);
    const employee = await this.prisma.employee.findUnique({
      where: { id: user.employeeId },
      include: { manager: { include: { user: true } } },
    });
    const hr = await this.prisma.user.findMany({ where: { role: { in: ["HR", "ADMIN"] } }, select: { id: true } });
    await this.notify(
      [...hr.map((item) => item.id), employee?.manager?.user?.id].filter((id): id is string => Boolean(id && id !== user.id)),
      `Đơn ${leaveLabel[type]} mới`,
      `${user.fullName} xin ${days} ngày ${leaveLabel[type].toLowerCase()}: ${body.reason.trim()}`,
      "/leave",
    );
    return created;
  }

  async decideLeave(user: AuthUser, id: string, status: "APPROVED" | "REJECTED") {
    this.requireRole(user, ["ADMIN", "HR", "MANAGER"]);
    const request = await this.prisma.leaveRequest.findUnique({ where: { id }, include: { employee: true } });
    if (!request || request.status !== "PENDING") throw new NotFoundException("Đơn không còn chờ duyệt");
    if (user.role === "MANAGER" && request.employee.managerId !== user.employeeId) {
      throw new ForbiddenException("Chỉ duyệt đơn của cấp dưới");
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.leaveRequest.update({
        where: { id },
        data: { status: status as LeaveStatus, approverId: user.employeeId, decidedAt: new Date() },
      });
      if (status === "APPROVED" && request.type === "ANNUAL") {
        const year = request.startDate.getFullYear();
        await this.ensureLeaveLedger(tx, request.employeeId, year);
        const entries = await tx.leaveLedger.findMany({ where: { employeeId: request.employeeId, year } });
        const snap = leaveBalanceFromLedger(entries);
        try {
          assertLeaveAvailable(snap.remaining, request.days);
        } catch (error) {
          throw new BadRequestException(error instanceof Error ? error.message : "Không còn đủ ngày phép năm");
        }
        await tx.leaveLedger.create({
          data: {
            employeeId: request.employeeId,
            year,
            kind: "USAGE",
            days: -request.days,
            note: "Duyệt phép năm",
            requestId: id,
          },
        });
        const next = leaveBalanceFromLedger([...entries, { kind: "USAGE", days: -request.days }]);
        await tx.leaveBalance.upsert({
          where: { employeeId_year: { employeeId: request.employeeId, year } },
          update: { entitled: next.entitled, used: next.used },
          create: { employeeId: request.employeeId, year, entitled: next.entitled, used: next.used },
        });
      }
      return saved;
    });
    await this.audit(user, `LEAVE_${status}`, "LeaveRequest", id);
    const owner = await this.prisma.user.findUnique({ where: { employeeId: request.employeeId } });
    if (owner && owner.id !== user.id) {
      await this.notify(
        [owner.id],
        status === "APPROVED" ? "Đơn nghỉ đã được duyệt" : "Đơn nghỉ bị từ chối",
        `${request.days} ngày từ ${request.startDate.toISOString().slice(0, 10)}`,
        "/leave",
      );
    }
    return updated;
  }

  async notifications(user: AuthUser) {
    const rows = await this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return {
      unread: rows.filter((row) => !row.readAt).length,
      items: rows.map((row) => ({ id: row.id, title: row.title, body: row.body, href: row.href, at: row.createdAt, read: Boolean(row.readAt) })),
    };
  }

  async readNotifications(user: AuthUser) {
    await this.prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    return this.notifications(user);
  }

  async attendance(user: AuthUser, month: string) {
    const [yearText, monthText] = month.split("-");
    const year = Number(yearText);
    const monthNumber = Number(monthText);
    const scope = await this.scopeIds(user);
    const rows = await this.prisma.timeEntry.findMany({
      where: { year, month: monthNumber, ...(scope ? { employeeId: { in: scope } } : {}) },
      include: { employee: { include: { department: true } } },
      orderBy: { employee: { code: "asc" } },
    });
    return rows.map((row) => ({
      id: row.id,
      employeeId: row.employeeId,
      code: row.employee.code,
      fullName: row.employee.fullName,
      department: row.employee.department.name,
      standardDays: row.standardDays,
      workedDays: row.workedDays,
      unpaidDays: row.unpaidDays,
      otWeekdayHours: row.otWeekdayHours,
      otWeekendHours: row.otWeekendHours,
      otHolidayHours: row.otHolidayHours,
      nightHours: row.nightHours,
      locked: row.locked,
    }));
  }

  async importAttendance(user: AuthUser, month: string, csvText: string) {
    this.requireRole(user, ["ADMIN", "HR", "PAYROLL"]);
    const [yearText, monthText] = month.split("-");
    const year = Number(yearText);
    const monthNumber = Number(monthText);
    if (!year || !monthNumber) throw new BadRequestException("Tháng không hợp lệ");
    const locked = await this.prisma.timeEntry.count({ where: { year, month: monthNumber, locked: true } });
    if (locked) throw new BadRequestException("Kỳ công đã khóa theo kỳ lương, không nhập lại");
    let rows;
    try {
      rows = parseAttendanceCsv(csvText);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "File không đọc được");
    }
    const employees = await this.prisma.employee.findMany({ where: { code: { in: rows.map((row) => row.code) } } });
    const byCode = new Map(employees.map((item) => [item.code, item]));
    const missing = rows.filter((row) => !byCode.has(row.code)).map((row) => row.code);
    if (missing.length) throw new BadRequestException(`Không thấy mã: ${missing.join(", ")}`);
    for (const row of rows) {
      const employee = byCode.get(row.code)!;
      await this.prisma.timeEntry.upsert({
        where: { employeeId_year_month: { employeeId: employee.id, year, month: monthNumber } },
        update: {
          standardDays: row.standardDays,
          workedDays: row.workedDays,
          unpaidDays: row.unpaidDays,
          otWeekdayHours: row.otWeekdayHours,
          otWeekendHours: row.otWeekendHours,
          otHolidayHours: row.otHolidayHours,
          nightHours: row.nightHours,
        },
        create: {
          employeeId: employee.id,
          year,
          month: monthNumber,
          standardDays: row.standardDays,
          workedDays: row.workedDays,
          unpaidDays: row.unpaidDays,
          otWeekdayHours: row.otWeekdayHours,
          otWeekendHours: row.otWeekendHours,
          otHolidayHours: row.otHolidayHours,
          nightHours: row.nightHours,
        },
      });
    }
    await this.audit(user, "IMPORT_ATTENDANCE", "TimeEntry", month);
    return { imported: rows.length };
  }

  template() {
    return attendanceTemplate();
  }

  async attendancePeriod(month: string) {
    const { year, monthNumber } = parseMonth(month);
    const [employees, entries, run] = await Promise.all([
      this.prisma.employee.findMany({ where: { status: { not: "TERMINATED" } }, select: { code: true } }),
      this.prisma.timeEntry.findMany({ where: { year, month: monthNumber }, include: { employee: true } }),
      this.prisma.payrollRun.findFirst({ where: { year, month: monthNumber } }),
    ]);
    return {
      month,
      payrollStatus: run?.status ?? null,
      ...attendanceLockDecision({
        activeCodes: employees.map((item) => item.code),
        entries: entries.map((item) => ({ code: item.employee.code, locked: item.locked })),
        payrollLocked: run?.status === "LOCKED",
      }),
    };
  }

  async lockAttendance(user: AuthUser, month: string) {
    this.requireRole(user, ["ADMIN", "HR", "PAYROLL"]);
    const period = await this.attendancePeriod(month);
    if (period.payrollLocked) throw new BadRequestException("Kỳ lương đã khóa, không sửa công");
    if (period.missing.length) throw new BadRequestException(`Thiếu công: ${period.missing.join(", ")}`);
    if (period.periodLocked) return period;
    const { year, monthNumber } = parseMonth(month);
    await this.prisma.timeEntry.updateMany({ where: { year, month: monthNumber }, data: { locked: true } });
    await this.audit(user, "LOCK_ATTENDANCE", "TimeEntry", month);
    return this.attendancePeriod(month);
  }

  async unlockAttendance(user: AuthUser, month: string) {
    this.requireRole(user, ["ADMIN", "HR", "PAYROLL"]);
    const period = await this.attendancePeriod(month);
    if (period.payrollLocked) throw new BadRequestException("Kỳ lương đã khóa, không mở công");
    if (!period.periodLocked) return period;
    const { year, monthNumber } = parseMonth(month);
    await this.prisma.timeEntry.updateMany({ where: { year, month: monthNumber }, data: { locked: false } });
    await this.audit(user, "UNLOCK_ATTENDANCE", "TimeEntry", month);
    return this.attendancePeriod(month);
  }

  async remindContractsFor(user: AuthUser) {
    this.requireRole(user, ["ADMIN", "HR"]);
    return this.remindContracts();
  }

  async remindContracts() {
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 60);
    const past = new Date(now);
    past.setDate(past.getDate() - 30);
    const [employees, hr] = await Promise.all([
      this.prisma.employee.findMany({
        where: { status: { not: "TERMINATED" }, contractEnd: { gte: past, lte: soon } },
        include: { department: true },
      }),
      this.prisma.user.findMany({ where: { role: { in: ["HR", "ADMIN"] } }, select: { id: true } }),
    ]);
    const since = new Date(now.getTime() - 7 * 86_400_000);
    let sent = 0;
    for (const employee of employees) {
      if (!employee.contractEnd) continue;
      const href = `/employees/${employee.id}`;
      const existing = await this.prisma.notification.findFirst({
        where: { href, title: { in: ["Hợp đồng sắp hết", "Hợp đồng đã hết hạn"] }, createdAt: { gte: since } },
      });
      if (existing) continue;
      const daysLeft = Math.ceil((employee.contractEnd.getTime() - now.getTime()) / 86_400_000);
      await this.notify(
        hr.map((item) => item.id),
        daysLeft < 0 ? "Hợp đồng đã hết hạn" : "Hợp đồng sắp hết",
        `${employee.fullName} (${employee.code}) · ${employee.department.name} · ${daysLeft} ngày`,
        href,
      );
      sent += 1;
    }
    return { due: employees.length, sent };
  }

  async contracts(user: AuthUser) {
    const scope = await this.scopeIds(user);
    const rows = await this.prisma.employee.findMany({
      where: { status: { not: "TERMINATED" }, ...(scope ? { id: { in: scope } } : {}) },
      include: { department: true },
      orderBy: { contractEnd: "asc" },
    });
    const now = Date.now();
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      fullName: row.fullName,
      department: row.department.name,
      contractType: row.contractType,
      contractStart: row.contractStart,
      contractEnd: row.contractEnd,
      daysLeft: row.contractEnd ? Math.ceil((row.contractEnd.getTime() - now) / 86_400_000) : null,
    }));
  }

  async offboard(user: AuthUser, id: string, body: { lastDay?: string; reason?: string }) {
    this.requireRole(user, ["ADMIN", "HR"]);
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException("Không thấy nhân sự");
    if (employee.status === "TERMINATED") throw new BadRequestException("Người này đã nghỉ việc");
    if (!body.lastDay || !body.reason) throw new BadRequestException("Cần ngày nghỉ và lý do");
    const lastDay = new Date(body.lastDay);
    const year = lastDay.getFullYear();
    const snap = await this.ensureLeaveLedger(this.prisma, id, year);
    const updated = await this.prisma.employee.update({
      where: { id },
      data: { status: "TERMINATED", contractEnd: lastDay },
    });
    if (snap.remaining > 0) {
      await this.prisma.leaveLedger.create({
        data: {
          employeeId: id,
          year,
          kind: "PAYOUT",
          days: -snap.remaining,
          note: `Quyết toán phép khi nghỉ: ${body.reason}`,
        },
      });
      await this.syncLeaveBalance(this.prisma, id, year);
    }
    await this.audit(user, "OFFBOARD", "Employee", id);
    return { id: updated.id, status: updated.status, leavePayout: snap.remaining };
  }

  async listAudit(user: AuthUser) {
    this.requireRole(user, ["ADMIN", "AUDITOR", "HR"]);
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { user: true },
    });
    return rows.map((row) => ({
      id: row.id,
      at: row.createdAt,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      actor: row.user?.fullName ?? "Hệ thống",
    }));
  }

  private presentEmployee(
    user: AuthUser,
    row: {
      id: string;
      code: string;
      fullName: string;
      email: string | null;
      phone: string | null;
      jobTitle: string;
      status: string;
      contractType: string;
      hireDate: Date;
      contractStart: Date;
      baseSalary: number;
      insuranceSalary: number;
      dependents: number;
      region: string;
      bankName: string | null;
      bankAccount: string | null;
      citizenId: string | null;
      department: { name: string };
    },
  ) {
    const salary = canSeeSalary(user.role, user.employeeId, row.id);
    return {
      id: row.id,
      code: row.code,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      jobTitle: row.jobTitle,
      status: row.status,
      contractType: row.contractType,
      hireDate: row.hireDate,
      contractStart: row.contractStart,
      department: row.department.name,
      dependents: salary ? row.dependents : null,
      region: row.region,
      baseSalary: salary ? row.baseSalary : null,
      insuranceSalary: salary ? row.insuranceSalary : null,
      bankName: salary ? row.bankName : null,
      bankAccount: salary ? maskAccount(row.bankAccount) : null,
      citizenId: salary ? maskId(row.citizenId) : null,
    };
  }

  private async ensureLeaveLedger(db: Prisma.TransactionClient | PrismaService, employeeId: string, year: number) {
    const existing = await db.leaveLedger.findMany({ where: { employeeId, year }, orderBy: { createdAt: "asc" } });
    if (existing.length) return leaveBalanceFromLedger(existing);
    const balance = await db.leaveBalance.findUnique({ where: { employeeId_year: { employeeId, year } } });
    if (!balance) return { entitled: 0, used: 0, remaining: 0 };
    await db.leaveLedger.create({ data: { employeeId, year, kind: "ACCRUAL", days: balance.entitled, note: "Mở quỹ năm" } });
    if (balance.used > 0) {
      await db.leaveLedger.create({
        data: { employeeId, year, kind: "USAGE", days: -balance.used, note: "Số đã dùng trước sổ cái" },
      });
    }
    return this.syncLeaveBalance(db, employeeId, year);
  }

  private async syncLeaveBalance(db: Prisma.TransactionClient | PrismaService, employeeId: string, year: number) {
    const entries = await db.leaveLedger.findMany({ where: { employeeId, year } });
    const snap = leaveBalanceFromLedger(entries);
    await db.leaveBalance.upsert({
      where: { employeeId_year: { employeeId, year } },
      update: { entitled: snap.entitled, used: snap.used },
      create: { employeeId, year, entitled: snap.entitled, used: snap.used },
    });
    return snap;
  }

  private async scopeIds(user: AuthUser): Promise<string[] | null> {
    if (user.role === "ADMIN" || user.role === "HR" || user.role === "PAYROLL" || user.role === "AUDITOR") return null;
    if (!user.employeeId) return [];
    if (user.role === "EMPLOYEE") return [user.employeeId];
    const reports = await this.descendantIds(user.employeeId);
    return [user.employeeId, ...reports];
  }

  private async descendantIds(managerId: string): Promise<string[]> {
    const found: string[] = [];
    let frontier = [managerId];
    const seen = new Set<string>([managerId]);
    while (frontier.length) {
      const rows = await this.prisma.employee.findMany({ where: { managerId: { in: frontier } }, select: { id: true } });
      frontier = [];
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        found.push(row.id);
        frontier.push(row.id);
      }
    }
    return found;
  }

  private async assertInScope(user: AuthUser, employeeId: string) {
    const scope = await this.scopeIds(user);
    if (scope && !scope.includes(employeeId)) throw new ForbiddenException("Không có quyền xem hồ sơ này");
  }

  private canEditDependents(user: AuthUser, employeeId: string) {
    if (user.role === "ADMIN" || user.role === "HR" || user.role === "PAYROLL") return true;
    return user.employeeId === employeeId;
  }

  private requireRole(user: AuthUser, roles: Role[]) {
    if (!roles.includes(user.role)) throw new ForbiddenException("Không đủ quyền");
  }

  private notify(userIds: string[], title: string, body: string, href: string) {
    const unique = [...new Set(userIds)];
    if (!unique.length) return Promise.resolve();
    return this.prisma.notification.createMany({ data: unique.map((userId) => ({ userId, title, body, href })) });
  }

  private audit(user: AuthUser, action: string, entity: string, entityId: string) {
    return this.prisma.auditLog.create({ data: { userId: user.id, action, entity, entityId } });
  }
}

function parseMonth(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (!year || monthNumber < 1 || monthNumber > 12) throw new BadRequestException("Tháng không hợp lệ");
  return { year, monthNumber };
}

function maskAccount(value: string | null): string | null {
  if (!value) return null;
  if (value.length < 4) return "••••";
  return `${"•".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function maskId(value: string | null): string | null {
  if (!value) return null;
  return `${value.slice(0, 3)}••••${value.slice(-3)}`;
}
