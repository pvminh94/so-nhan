import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { calculatePayslip, statutorySnapshot, type WageRegion } from "@so-nhan/payroll-engine";
import type { AuthUser } from "./common";
import { SALARY_ROLES } from "./common";
import { PrismaService } from "./prisma.service";

@Injectable()
export class PayrollService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  statutory(period = currentPeriod()) {
    return statutorySnapshot(period);
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

    const employees = await this.prisma.employee.findMany({
      where: { legalEntityId: entity.id, status: { not: "TERMINATED" } },
    });
    const times = await this.prisma.timeEntry.findMany({ where: { year, month } });
    const timeByEmployee = new Map(times.map((item) => [item.employeeId, item]));

    const slips = employees.map((employee) => {
      const time = timeByEmployee.get(employee.id);
      const result = calculatePayslip({
        period: { year, month },
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
      });
      return { employee, result };
    });

    const run = await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.payrollRun.update({
            where: { id: existing.id },
            data: { ruleVersion: slips[0]?.result.ruleVersion ?? "vn-2026.07", status: "CALCULATED" },
          })
        : await tx.payrollRun.create({
            data: {
              legalEntityId: entity.id,
              year,
              month,
              ruleVersion: slips[0]?.result.ruleVersion ?? "vn-2026.07",
              status: "CALCULATED",
            },
          });
      await tx.payslip.deleteMany({ where: { runId: saved.id } });
      for (const slip of slips) {
        await tx.payslip.create({
          data: {
            runId: saved.id,
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
      return saved;
    });
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: "CALCULATE_PAYROLL", entity: "PayrollRun", entityId: run.id, meta: { year, month, count: slips.length } },
    });
    return this.run(user, run.id);
  }

  async lock(user: AuthUser, id: string) {
    this.requireRole(user, ["ADMIN", "PAYROLL"]);
    const run = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException("Không thấy kỳ lương");
    if (run.status === "LOCKED") return this.run(user, id);
    await this.prisma.payrollRun.update({ where: { id }, data: { status: "LOCKED", lockedAt: new Date() } });
    await this.prisma.timeEntry.updateMany({ where: { year: run.year, month: run.month }, data: { locked: true } });
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: "LOCK_PAYROLL", entity: "PayrollRun", entityId: id },
    });
    return this.run(user, id);
  }

  async bankCsv(user: AuthUser, id: string) {
    this.requireRole(user, ["ADMIN", "PAYROLL"]);
    const detail = await this.run(user, id);
    const employees = await this.prisma.employee.findMany({ where: { id: { in: detail.payslips.map((item) => item.employeeId) } } });
    const byId = new Map(employees.map((item) => [item.id, item]));
    const lines = ["Ma NV,Ho ten,Ngan hang,So tai khoan,So tien,Noi dung"];
    for (const slip of detail.payslips) {
      const employee = byId.get(slip.employeeId);
      lines.push(
        [slip.code, csv(slip.fullName), csv(employee?.bankName ?? ""), csv(employee?.bankAccount ?? ""), slip.net, csv(`Luong ${detail.month}/${detail.year}`)].join(","),
      );
    }
    lines.push(`TONG,,,,${detail.totals.net},`);
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: "EXPORT_BANK", entity: "PayrollRun", entityId: id },
    });
    return lines.join("\n");
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
