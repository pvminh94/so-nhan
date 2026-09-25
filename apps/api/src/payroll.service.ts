import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { attendanceLockDecision, assertPackRange, buildBankFile, buildJournal, calculatePayslip, comparePayroll, parseRulePack, reconcileBankFile, resolveRulePack, rulePackPayload, statutorySnapshot, summarizeAbsences, VN_RULE_PACKS, type AbsenceKind, type RulePack, type VarianceSlip, type WageRegion } from "@so-nhan/payroll-engine";
import type { AuthUser } from "./common";
import { SALARY_ROLES } from "./common";
import { PrismaService } from "./prisma.service";

@Injectable()
export class PayrollService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async statutory(period = currentPeriod()) {
    const packs = await this.loadPacks();
    return statutorySnapshot(period, packs);
  }

  async addRule(user: AuthUser, body: Partial<RulePack>) {
    this.requireRole(user, ["ADMIN", "HR", "PAYROLL"]);
    if (!body.version || !body.validFrom || !body.validTo) throw new BadRequestException("Thiếu phiên bản hoặc ngày hiệu lực");
    const packs = await this.loadPacks();
    try {
      assertPackRange(packs, { version: body.version, validFrom: body.validFrom, validTo: body.validTo });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Gói luật không hợp lệ");
    }
    const base = packs[packs.length - 1] ?? VN_RULE_PACKS[VN_RULE_PACKS.length - 1]!;
    const rule: RulePack = {
      ...base,
      ...body,
      version: body.version,
      validFrom: body.validFrom,
      validTo: body.validTo,
      note: body.note ?? `Gói ${body.version}`,
    };
    await this.prisma.statutoryRule.create({
      data: {
        version: rule.version,
        validFrom: rule.validFrom,
        validTo: rule.validTo,
        note: rule.note,
        payload: rulePackPayload(rule),
      },
    });
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: "ADD_STATUTORY_RULE", entity: "StatutoryRule", entityId: rule.version },
    });
    return this.statutory({ year: Math.floor(rule.validFrom / 100), month: rule.validFrom % 100 });
  }

  async runs() {
    const rows = await this.prisma.payrollRun.findMany({
      include: { legalEntity: true, _count: { select: { payslips: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return rows.map((row) => ({
      id: row.id,
      year: row.year,
      month: row.month,
      status: row.status,
      ruleVersion: row.ruleVersion,
      error: row.error,
      company: row.legalEntity.name,
      payslips: row._count.payslips,
      lockedAt: row.lockedAt,
    }));
  }

  async run(user: AuthUser, id: string) {
    this.requirePayrollReader(user);
    const row = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: {
        legalEntity: true,
        payslips: { include: { employee: true, lines: { orderBy: { sort: "asc" } } }, orderBy: { employee: { code: "asc" } } },
      },
    });
    if (!row) throw new NotFoundException("Không thấy kỳ lương");
    if (row.status === "CALCULATED" || row.status === "LOCKED") {
      await this.prisma.auditLog.create({
        data: { userId: user.id, action: "VIEW_PAYSLIP", entity: "PayrollRun", entityId: id },
      });
    }
    const ownOnly = !SALARY_ROLES.includes(user.role);
    const payslips = row.payslips
      .filter((slip) => !ownOnly || slip.employeeId === user.employeeId)
      .map((slip) => ({
        id: slip.id,
        employeeId: slip.employeeId,
        code: slip.employee.code,
        fullName: slip.employee.fullName,
        gross: slip.gross,
        insuranceEmployee: slip.insuranceEmployee,
        insuranceEmployer: slip.insuranceEmployer,
        pit: slip.pit,
        net: slip.net,
        insuranceBase: slip.insuranceBase,
        taxableEarnings: slip.taxableEarnings,
        assessableIncome: slip.assessableIncome,
        warnings: slip.warnings,
        lines: slip.lines,
      }));
    const totals = payslips.reduce(
      (acc, slip) => {
        acc.gross += slip.gross;
        acc.net += slip.net;
        acc.pit += slip.pit;
        acc.insuranceEmployee += slip.insuranceEmployee;
        acc.insuranceEmployer += slip.insuranceEmployer;
        return acc;
      },
      { gross: 0, net: 0, pit: 0, insuranceEmployee: 0, insuranceEmployer: 0 },
    );
    return {
      id: row.id,
      year: row.year,
      month: row.month,
      status: row.status,
      ruleVersion: row.ruleVersion,
      error: row.error,
      company: row.legalEntity.name,
      lockedAt: row.lockedAt,
      totals,
      payslips,
    };
  }

  async calculate(user: AuthUser, year: number, month: number) {
    this.requireRole(user, ["ADMIN", "PAYROLL"]);
    if (!year || !month || month < 1 || month > 12) throw new BadRequestException("Kỳ lương không hợp lệ");
    const entity = await this.prisma.legalEntity.findFirst();
    if (!entity) throw new BadRequestException("Chưa có pháp nhân");
    const existing = await this.prisma.payrollRun.findUnique({
      where: { legalEntityId_year_month: { legalEntityId: entity.id, year, month } },
    });
    if (existing?.status === "LOCKED") throw new BadRequestException("Kỳ lương đã khóa, không tính lại");
    await this.assertAttendanceLocked(entity.id, year, month);
    if (existing?.status === "QUEUED" || existing?.status === "CALCULATING") return this.run(user, existing.id);
    const queued = existing
      ? await this.prisma.payrollRun.update({ where: { id: existing.id }, data: { status: "QUEUED", error: null } })
      : await this.prisma.payrollRun.create({
          data: {
            legalEntityId: entity.id,
            year,
            month,
            status: "QUEUED",
            ruleVersion: resolveRulePack({ year, month }, await this.loadPacks()).version,
          },
        });
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: "QUEUE_PAYROLL", entity: "PayrollRun", entityId: queued.id, meta: { year, month } },
    });
    return this.run(user, queued.id);
  }

  async claimAndCalculate(): Promise<string | null> {
    const next = await this.prisma.payrollRun.findFirst({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" } });
    if (!next) return null;
    const claimed = await this.prisma.payrollRun.updateMany({
      where: { id: next.id, status: "QUEUED" },
      data: { status: "CALCULATING" },
    });
    if (claimed.count !== 1) return null;
    try {
      await this.execute(next.id);
      return next.id;
    } catch (error) {
      await this.prisma.payrollRun.update({
        where: { id: next.id },
        data: { status: "FAILED", error: error instanceof Error ? error.message : "Lỗi tính lương" },
      });
      return next.id;
    }
  }

  private async execute(runId: string) {
    const run = await this.prisma.payrollRun.findUniqueOrThrow({ where: { id: runId } });
    const employees = await this.prisma.employee.findMany({
      where: { legalEntityId: run.legalEntityId, status: { not: "TERMINATED" } },
    });
    const times = await this.prisma.timeEntry.findMany({ where: { year: run.year, month: run.month } });
    const timeByEmployee = new Map(times.map((item) => [item.employeeId, item]));
    const leaves = await this.prisma.leaveRequest.findMany({
      where: { status: "APPROVED", employeeId: { in: employees.map((item) => item.id) } },
    });
    const leavesByEmployee = new Map<string, typeof leaves>();
    for (const row of leaves) {
      const list = leavesByEmployee.get(row.employeeId) ?? [];
      list.push(row);
      leavesByEmployee.set(row.employeeId, list);
    }
    const adjustments = await this.prisma.payrollAdjustment.findMany({
      where: { year: run.year, month: run.month, employeeId: { in: employees.map((item) => item.id) } },
    });
    const adjByEmployee = new Map<string, typeof adjustments>();
    for (const row of adjustments) {
      const list = adjByEmployee.get(row.employeeId) ?? [];
      list.push(row);
      adjByEmployee.set(row.employeeId, list);
    }
    const packs = await this.loadPacks();
    const slips = employees.map((employee) => {
      const time = timeByEmployee.get(employee.id);
      const absences = summarizeAbsences(
        (leavesByEmployee.get(employee.id) ?? []).map((item) => ({
          type: item.type as AbsenceKind,
          startDate: item.startDate,
          endDate: item.endDate,
          days: item.days,
          status: item.status,
        })),
        run.year,
        run.month,
      );
      const mine = adjByEmployee.get(employee.id) ?? [];
      const advance = mine.filter((item) => item.kind === "ADVANCE").reduce((sum, item) => sum + item.amount, 0);
      const otherDeductions = mine.filter((item) => item.kind === "DEDUCTION").reduce((sum, item) => sum + item.amount, 0);
      const retros = mine
        .filter((item) => item.kind === "RETRO")
        .map((item) => ({ name: "Truy lĩnh", amount: item.amount, reason: item.reason }));
      const warningsExtra: string[] = [];
      if (absences.unpaidDays > (time?.unpaidDays ?? 0)) {
        warningsExtra.push(
          `Đơn nghỉ không lương ${absences.unpaidDays} ngày, bảng công chỉ ghi ${time?.unpaidDays ?? 0} ngày. Nhập lại công cho khớp.`,
        );
      }
      return {
        employee,
        result: (() => {
          const result = calculatePayslip({
            period: { year: run.year, month: run.month },
            packs,
            region: employee.region as WageRegion,
            baseSalary: employee.baseSalary,
            insuranceSalary: employee.insuranceSalary,
            dependents: employee.dependents,
            standardDays: time?.standardDays ?? 22,
            workedDays: time?.workedDays ?? 22,
            unpaidDays: time?.unpaidDays ?? 0,
            otWeekdayHours: time?.otWeekdayHours ?? 0,
            otWeekendHours: time?.otWeekendHours ?? 0,
            otHolidayHours: time?.otHolidayHours ?? 0,
            nightHours: time?.nightHours ?? 0,
            sickDays: absences.sickDays,
            maternityDays: absences.maternityDays,
            advance,
            otherDeductions,
            retros,
          });
          result.warnings.push(...warningsExtra);
          return result;
        })(),
      };
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.payslip.deleteMany({ where: { runId } });
      for (const slip of slips) {
        await tx.payslip.create({
          data: {
            runId,
            employeeId: slip.employee.id,
            gross: slip.result.gross,
            insuranceBase: slip.result.insuranceBase,
            insuranceEmployee: slip.result.insuranceEmployee,
            insuranceEmployer: slip.result.insuranceEmployer,
            pit: slip.result.pit,
            net: slip.result.net,
            taxableEarnings: slip.result.taxableEarnings,
            assessableIncome: slip.result.assessableIncome,
            warnings: slip.result.warnings,
            lines: {
              create: slip.result.lines.map((line) => ({
                code: line.code,
                name: line.name,
                amount: line.amount,
                formula: line.formula,
                pitTreatment: line.pitTreatment,
                sort: line.sort,
              })),
            },
          },
        });
      }
      await tx.payrollRun.update({
        where: { id: runId },
        data: { status: "CALCULATED", error: null, ruleVersion: slips[0]?.result.ruleVersion ?? resolveRulePack({ year: run.year, month: run.month }, packs).version },
      });
      await tx.auditLog.create({
        data: { action: "CALCULATE_PAYROLL", entity: "PayrollRun", entityId: runId, meta: { count: slips.length } },
      });
    });
  }

  async lock(user: AuthUser, id: string) {
    this.requireRole(user, ["ADMIN", "PAYROLL"]);
    const run = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException("Không thấy kỳ lương");
    if (run.status === "LOCKED") return this.run(user, id);
    if (run.status !== "CALCULATED") throw new BadRequestException("Chỉ khóa kỳ đã tính xong");
    await this.prisma.payrollRun.update({ where: { id }, data: { status: "LOCKED", lockedAt: new Date() } });
    await this.prisma.timeEntry.updateMany({ where: { year: run.year, month: run.month }, data: { locked: true } });
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: "LOCK_PAYROLL", entity: "PayrollRun", entityId: id },
    });
    return this.run(user, id);
  }

  async bankFile(user: AuthUser, id: string) {
    this.requireRole(user, ["ADMIN", "PAYROLL"]);
    const built = await this.buildBank(user, id);
    if (built.missingAccounts.length) {
      throw new BadRequestException(`Thiếu số tài khoản: ${built.missingAccounts.join(", ")}`);
    }
    if (built.total !== built.expectedNet) {
      throw new BadRequestException(`Tổng file ${built.total} khác tổng thực nhận ${built.expectedNet}`);
    }
    return built;
  }

  async bankCsv(user: AuthUser, id: string) {
    const built = await this.bankFile(user, id);
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: "EXPORT_BANK", entity: "PayrollRun", entityId: id, meta: { sha256: built.sha256, total: built.total } },
    });
    return built.csv;
  }

  async checkBankCsv(user: AuthUser, id: string, csvText: string) {
    this.requireRole(user, ["ADMIN", "PAYROLL"]);
    const detail = await this.readyRun(user, id);
    try {
      return reconcileBankFile(csvText, detail.totals.net);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "File không khớp");
    }
  }

  async journalCsv(user: AuthUser, id: string) {
    this.requireRole(user, ["ADMIN", "PAYROLL", "HR"]);
    const detail = await this.readyRun(user, id);
    const lines = buildJournal(`${String(detail.month).padStart(2, "0")}/${detail.year}`, detail.payslips);
    const csvLines = ["Tai khoan,Dien giai,No,Co", ...lines.map((line) => [line.account, csv(line.name), line.debit, line.credit].join(","))];
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: "EXPORT_JOURNAL", entity: "PayrollRun", entityId: id },
    });
    return csvLines.join("\n");
  }

  async variance(user: AuthUser, id: string) {
    this.requireRole(user, SALARY_ROLES);
    const row = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: { payslips: { include: { employee: true } } },
    });
    if (!row) throw new NotFoundException("Không thấy kỳ lương");
    const previousMonth = row.month === 1 ? 12 : row.month - 1;
    const previousYear = row.month === 1 ? row.year - 1 : row.year;
    const previous = await this.prisma.payrollRun.findFirst({
      where: {
        legalEntityId: row.legalEntityId,
        year: previousYear,
        month: previousMonth,
        status: { in: ["CALCULATED", "LOCKED"] },
      },
      include: { payslips: { include: { employee: true } } },
    });
    if (!previous) return { previous: null, unexplained: 0, changed: 0, delta: 0, rows: [] };
    const times = await this.prisma.timeEntry.findMany({
      where: { OR: [{ year: row.year, month: row.month }, { year: previousYear, month: previousMonth }] },
    });
    const snap = (run: typeof row, year: number, month: number): VarianceSlip[] =>
      run.payslips.map((slip) => {
        const time = times.find((item) => item.employeeId === slip.employeeId && item.year === year && item.month === month);
        return {
          code: slip.employee.code,
          fullName: slip.employee.fullName,
          net: slip.net,
          workedDays: time?.workedDays ?? 22,
          otHours: (time?.otWeekdayHours ?? 0) + (time?.otWeekendHours ?? 0) + (time?.otHolidayHours ?? 0) + (time?.nightHours ?? 0),
          dependents: slip.employee.dependents,
          baseSalary: slip.employee.baseSalary,
        };
      });
    return {
      previous: { id: previous.id, year: previousYear, month: previousMonth },
      ...comparePayroll(snap(row, row.year, row.month), snap(previous, previousYear, previousMonth)),
    };
  }

  async listAdjustments(user: AuthUser, year: number, month: number) {
    this.requireRole(user, ["ADMIN", "HR", "PAYROLL"]);
    const rows = await this.prisma.payrollAdjustment.findMany({
      where: { year, month },
      include: { employee: { include: { department: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      employeeId: row.employeeId,
      code: row.employee.code,
      fullName: row.employee.fullName,
      department: row.employee.department.name,
      year: row.year,
      month: row.month,
      kind: row.kind,
      amount: row.amount,
      reason: row.reason,
      at: row.createdAt,
    }));
  }

  async addAdjustment(
    user: AuthUser,
    body: { employeeId?: string; year?: number; month?: number; kind?: "ADVANCE" | "RETRO" | "DEDUCTION"; amount?: number; reason?: string },
  ) {
    this.requireRole(user, ["ADMIN", "PAYROLL"]);
    const year = Number(body.year);
    const month = Number(body.month);
    const amount = Math.round(Number(body.amount));
    const kind = body.kind;
    if (!body.employeeId || !kind || !body.reason?.trim() || !(amount > 0) || year < 2020 || month < 1 || month > 12) {
      throw new BadRequestException("Thiếu người, loại, số tiền hoặc lý do");
    }
    if (!["ADVANCE", "RETRO", "DEDUCTION"].includes(kind)) {
      throw new BadRequestException("Loại không hợp lệ");
    }
    const employee = await this.prisma.employee.findUnique({ where: { id: body.employeeId } });
    if (!employee || employee.status === "TERMINATED") throw new NotFoundException("Không thấy hồ sơ nhân viên");
    const locked = await this.prisma.payrollRun.findFirst({
      where: { legalEntityId: employee.legalEntityId, year, month, status: "LOCKED" },
    });
    if (locked) throw new BadRequestException("Kỳ lương này đã khóa. Ghi truy lĩnh vào kỳ sau, đừng sửa kỳ cũ.");
    const created = await this.prisma.payrollAdjustment.create({
      data: { employeeId: employee.id, year, month, kind, amount, reason: body.reason.trim() },
    });
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: "ADD_ADJUSTMENT", entity: "PayrollAdjustment", entityId: created.id, meta: { kind, amount } },
    });
    return created;
  }

  private async readyRun(user: AuthUser, id: string) {
    const detail = await this.run(user, id);
    if (detail.status !== "CALCULATED" && detail.status !== "LOCKED") {
      throw new BadRequestException("Kỳ lương chưa tính xong");
    }
    return detail;
  }

  private async assertAttendanceLocked(legalEntityId: string, year: number, month: number) {
    const [employees, entries, payroll] = await Promise.all([
      this.prisma.employee.findMany({ where: { legalEntityId, status: { not: "TERMINATED" } }, select: { code: true } }),
      this.prisma.timeEntry.findMany({ where: { year, month, employee: { legalEntityId } }, include: { employee: true } }),
      this.prisma.payrollRun.findFirst({ where: { legalEntityId, year, month } }),
    ]);
    const decision = attendanceLockDecision({
      activeCodes: employees.map((item) => item.code),
      entries: entries.map((item) => ({ code: item.employee.code, locked: item.locked })),
      payrollLocked: payroll?.status === "LOCKED",
    });
    if (!decision.canCalculate) {
      const detail = decision.missing.length ? ` Thiếu công: ${decision.missing.join(", ")}.` : "";
      throw new BadRequestException(`Chưa khóa kỳ công. Khóa bảng công trước khi tính lương.${detail}`);
    }
  }

  private async buildBank(user: AuthUser, id: string) {
    const detail = await this.readyRun(user, id);
    const employees = await this.prisma.employee.findMany({ where: { id: { in: detail.payslips.map((item) => item.employeeId) } } });
    const byId = new Map(employees.map((item) => [item.id, item]));
    const periodLabel = `${String(detail.month).padStart(2, "0")}/${detail.year}`;
    const file = buildBankFile(
      detail.payslips.map((slip) => {
        const employee = byId.get(slip.employeeId);
        return {
          code: slip.code,
          fullName: slip.fullName,
          bankName: employee?.bankName ?? "",
          bankAccount: employee?.bankAccount ?? "",
          amount: slip.net,
          content: `Luong ${periodLabel}`,
        };
      }),
      periodLabel,
    );
    return { ...file, expectedNet: detail.totals.net, periodLabel };
  }

  private async loadPacks(): Promise<RulePack[]> {
    await this.ensureRules();
    const rows = await this.prisma.statutoryRule.findMany({ orderBy: { validFrom: "asc" } });
    if (!rows.length) return VN_RULE_PACKS;
    return rows.map((row) => parseRulePack({ version: row.version, validFrom: row.validFrom, validTo: row.validTo, note: row.note, payload: row.payload }));
  }

  private async ensureRules() {
    for (const rule of VN_RULE_PACKS) {
      await this.prisma.statutoryRule.upsert({
        where: { version: rule.version },
        create: {
          version: rule.version,
          validFrom: rule.validFrom,
          validTo: rule.validTo,
          note: rule.note,
          payload: rulePackPayload(rule),
        },
        update: {},
      });
    }
  }

  private requirePayrollReader(user: AuthUser) {
    if (user.role === "AUDITOR" || SALARY_ROLES.includes(user.role) || user.employeeId) return;
    throw new ForbiddenException("Không đủ quyền xem lương");
  }

  private requireRole(user: AuthUser, roles: Array<AuthUser["role"]>) {
    if (!roles.includes(user.role)) throw new ForbiddenException("Không đủ quyền");
  }
}

function currentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function csv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
