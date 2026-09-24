import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { LeaveStatus, LeaveType, type Role } from "@prisma/client";
import { annualLeaveEntitlement } from "@so-nhan/payroll-engine";
import { canSeeSalary, type AuthUser } from "./common";
import { PrismaService } from "./prisma.service";

const leaveLabel: Record<LeaveType, string> = {
  ANNUAL: "Phép năm",
  UNPAID: "Không lương",
  SICK: "Ốm đau",
  OTHER: "Khác",
};

@Injectable()
export class HrService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async dashboard(user: AuthUser) {
    const [headcount, pending, runs, departments] = await Promise.all([
      this.prisma.employee.count({ where: { status: { not: "TERMINATED" } } }),
      this.prisma.leaveRequest.count({ where: { status: "PENDING" } }),
      this.prisma.payrollRun.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }], take: 3, include: { legalEntity: true } }),
      this.prisma.department.findMany({ include: { _count: { select: { employees: true } } }, orderBy: { name: "asc" } }),
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
      departments: departments.map((item) => ({ id: item.id, name: item.name, count: item._count.employees })),
      role: user.role,
    };
  }

  async departments() {
    const rows = await this.prisma.department.findMany({ orderBy: { name: "asc" } });
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }

  async employees(user: AuthUser, q?: string) {
    const rows = await this.prisma.employee.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { jobTitle: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: { department: true },
      orderBy: { code: "asc" },
    });
    return rows.map((row) => this.presentEmployee(user, row));
  }

  async employee(user: AuthUser, id: string) {
    const row = await this.prisma.employee.findUnique({
      where: { id },
      include: { department: true, legalEntity: true, manager: true, leaveBalances: true },
    });
    if (!row) throw new NotFoundException("Không thấy nhân sự");
    if (user.role === "EMPLOYEE" && user.employeeId !== id) throw new ForbiddenException("Không có quyền xem hồ sơ này");
    return {
      ...this.presentEmployee(user, row),
      legalEntity: row.legalEntity.name,
      taxCodeCompany: row.legalEntity.taxCode,
      manager: row.manager ? { id: row.manager.id, fullName: row.manager.fullName } : null,
      leaveBalances: row.leaveBalances,
      contractEnd: row.contractEnd,
    };
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
    await this.prisma.leaveBalance.create({
      data: { employeeId: created.id, year: new Date().getFullYear(), entitled: annualLeaveEntitlement(years), used: 0 },
    });
    await this.audit(user, "CREATE_EMPLOYEE", "Employee", created.id);
    return this.presentEmployee(user, created);
  }

  async leaveRequests(user: AuthUser) {
    const where =
      user.role === "EMPLOYEE"
        ? { employeeId: user.employeeId ?? "__none__" }
        : user.role === "MANAGER"
          ? { employee: { managerId: user.employeeId ?? "__none__" } }
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
      startDate: row.startDate,
      endDate: row.endDate,
      days: row.days,
      reason: row.reason,
      status: row.status,
      employee: { id: row.employee.id, fullName: row.employee.fullName, code: row.employee.code, department: row.employee.department.name },
    }));
  }

  async requestLeave(user: AuthUser, body: { type?: LeaveType; startDate?: string; endDate?: string; days?: number; reason?: string }) {
    if (!user.employeeId) throw new ForbiddenException("Tài khoản này không gắn hồ sơ nhân sự");
    const days = Number(body.days);
    if (!body.startDate || !body.endDate || !body.reason || !(days > 0)) throw new BadRequestException("Thiếu ngày hoặc lý do");
    const created = await this.prisma.leaveRequest.create({
      data: {
        employeeId: user.employeeId,
        type: body.type ?? "ANNUAL",
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        days,
        reason: body.reason.trim(),
      },
    });
    await this.audit(user, "REQUEST_LEAVE", "LeaveRequest", created.id);
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
        await tx.leaveBalance.updateMany({
          where: { employeeId: request.employeeId, year: request.startDate.getFullYear() },
          data: { used: { increment: request.days } },
        });
      }
      return saved;
    });
    await this.audit(user, `LEAVE_${status}`, "LeaveRequest", id);
    return updated;
  }

  async attendance(month: string) {
    const [yearText, monthText] = month.split("-");
    const year = Number(yearText);
    const monthNumber = Number(monthText);
    const rows = await this.prisma.timeEntry.findMany({
      where: { year, month: monthNumber },
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

  private requireRole(user: AuthUser, roles: Role[]) {
    if (!roles.includes(user.role)) throw new ForbiddenException("Không đủ quyền");
  }

  private audit(user: AuthUser, action: string, entity: string, entityId: string) {
    return this.prisma.auditLog.create({ data: { userId: user.id, action, entity, entityId } });
  }
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
