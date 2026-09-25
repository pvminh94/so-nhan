import { PrismaClient, type WageRegion } from "@prisma/client";
import { hash } from "bcryptjs";
import { annualLeaveEntitlement, calculatePayslip, rulePackPayload, summarizeAbsences, VN_RULE_PACKS } from "@so-nhan/payroll-engine";

const prisma = new PrismaClient();
const password = "Sonhan@2026";

async function main() {
  await prisma.payslipLine.deleteMany();
  await prisma.payslip.deleteMany();
  await prisma.payrollRun.deleteMany();
  await prisma.payrollAdjustment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.dependent.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveLedger.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.statutoryRule.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();
  await prisma.legalEntity.deleteMany();

  const company = await prisma.legalEntity.create({
    data: {
      name: "Công ty TNHH Sổ Nhân",
      taxCode: "0312345678",
      region: "I",
      address: "12 Nguyễn Văn Trỗi, Phú Nhuận, TP. Hồ Chí Minh",
    },
  });

  const board = await prisma.department.create({ data: { name: "Điều hành", legalEntityId: company.id } });
  const hr = await prisma.department.create({ data: { name: "Nhân sự", legalEntityId: company.id, parentId: board.id } });
  const finance = await prisma.department.create({ data: { name: "Kế toán", legalEntityId: company.id, parentId: board.id } });
  const ops = await prisma.department.create({ data: { name: "Vận hành", legalEntityId: company.id, parentId: board.id } });

  const people = [
    person("NV001", "Nguyễn Minh Khoa", "Giám đốc", board.id, "2016-03-01", 90_000_000, 0, "ACTIVE", "INDEFINITE"),
    person("NV002", "Trần Thị Lan", "Trưởng phòng nhân sự", hr.id, "2019-07-15", 28_000_000, 1, "ACTIVE", "INDEFINITE"),
    person("NV003", "Lê Hoàng Nam", "Chuyên viên lương", finance.id, "2021-02-01", 32_000_000, 0, "ACTIVE", "INDEFINITE"),
    person("NV005", "Đỗ Văn Khôi", "Quản lý vận hành", ops.id, "2018-11-20", 35_000_000, 2, "ACTIVE", "INDEFINITE"),
    person("NV004", "Phạm Thu Hà", "Nhân viên vận hành", ops.id, "2023-04-10", 18_000_000, 0, "ACTIVE", "DEFINITE"),
    person("NV006", "Ngô Thị Mai", "Kế toán tổng hợp", finance.id, "2022-01-05", 22_000_000, 1, "ACTIVE", "DEFINITE"),
    person("NV007", "Bùi Quang Huy", "Nhân viên kho", ops.id, "2024-06-01", 15_000_000, 0, "ACTIVE", "DEFINITE"),
    person("NV008", "Võ Thị Kim", "Nhân viên hành chính", hr.id, "2024-09-01", 12_500_000, 1, "ACTIVE", "DEFINITE"),
    person("NV009", "Hoàng Anh Tú", "Kỹ thuật ca", ops.id, "2020-08-12", 20_000_000, 0, "ACTIVE", "INDEFINITE"),
    person("NV010", "Lý Thị Ngọc", "Thử việc tuyển dụng", hr.id, "2026-09-01", 14_000_000, 0, "PROBATION", "PROBATION"),
    person("NV011", "Phan Đức Trí", "Trưởng nhóm kế toán", finance.id, "2017-05-20", 45_000_000, 1, "ACTIVE", "INDEFINITE"),
    person("NV012", "Mai Thanh Sơn", "Giám đốc vận hành", board.id, "2015-01-08", 70_000_000, 2, "ACTIVE", "INDEFINITE"),
  ];

  const created = new Map<string, string>();
  for (const item of people) {
    const row = await prisma.employee.create({
      data: {
        ...item,
        legalEntityId: company.id,
        region: "I" as WageRegion,
        insuranceSalary: item.baseSalary,
        email: `${item.code.toLowerCase()}@sonhan.vn`,
        phone: "0901000000",
        bankName: "Vietcombank",
        bankAccount: `007100${item.code.slice(2)}1234`,
        citizenId: `079200${item.code.slice(2)}123`,
      },
    });
    created.set(item.code, row.id);
    const years = yearsBetween(item.hireDate, new Date("2026-09-01"));
    const entitled = annualLeaveEntitlement(years);
    const used = item.code === "NV007" ? 1 : 0;
    await prisma.leaveBalance.create({
      data: { employeeId: row.id, year: 2026, entitled, used },
    });
    await prisma.leaveLedger.create({
      data: { employeeId: row.id, year: 2026, kind: "ACCRUAL", days: entitled, note: "Mở quỹ năm" },
    });
    if (used) {
      await prisma.leaveLedger.create({
        data: { employeeId: row.id, year: 2026, kind: "USAGE", days: -used, note: "Đã dùng" },
      });
    }
  }

  await prisma.employee.update({ where: { id: created.get("NV004") }, data: { managerId: created.get("NV005") } });
  await prisma.employee.update({ where: { id: created.get("NV007") }, data: { managerId: created.get("NV005") } });
  await prisma.employee.update({ where: { id: created.get("NV009") }, data: { managerId: created.get("NV005") } });
  await prisma.employee.update({ where: { id: created.get("NV010") }, data: { managerId: created.get("NV002") } });

  const passwordHash = await hash(password, 10);
  const accounts = [
    ["admin@sonhan.vn", "ADMIN", "Quản trị hệ thống", null],
    ["hr@sonhan.vn", "HR", "Trần Thị Lan", "NV002"],
    ["payroll@sonhan.vn", "PAYROLL", "Lê Hoàng Nam", "NV003"],
    ["quanly@sonhan.vn", "MANAGER", "Đỗ Văn Khôi", "NV005"],
    ["nhanvien@sonhan.vn", "EMPLOYEE", "Phạm Thu Hà", "NV004"],
  ] as const;
  for (const [email, role, fullName, code] of accounts) {
    await prisma.user.create({
      data: { email, role, fullName, passwordHash, employeeId: code ? created.get(code) : null },
    });
  }

  for (const item of people) {
    const id = created.get(item.code)!;
    const special = item.code === "NV009" ? { otWeekdayHours: 10, nightHours: 6 } : item.code === "NV008" ? { unpaidDays: 2, workedDays: 20 } : {};
    await prisma.timeEntry.create({
      data: {
        employeeId: id,
        year: 2026,
        month: 9,
        standardDays: 22,
        workedDays: 22,
        unpaidDays: 0,
        ...special,
        locked: true,
      },
    });
  }

  await prisma.leaveRequest.create({
    data: {
      employeeId: created.get("NV004")!,
      type: "ANNUAL",
      startDate: new Date("2026-09-28"),
      endDate: new Date("2026-09-29"),
      days: 2,
      reason: "Việc gia đình",
      status: "PENDING",
    },
  });
  await prisma.leaveRequest.create({
    data: {
      employeeId: created.get("NV007")!,
      type: "ANNUAL",
      startDate: new Date("2026-09-08"),
      endDate: new Date("2026-09-08"),
      days: 1,
      reason: "Khám sức khỏe",
      status: "APPROVED",
      approverId: created.get("NV005"),
      decidedAt: new Date("2026-09-05"),
    },
  });
  await prisma.leaveRequest.create({
    data: {
      employeeId: created.get("NV008")!,
      type: "SICK",
      startDate: new Date("2026-09-10"),
      endDate: new Date("2026-09-12"),
      days: 3,
      reason: "Ốm, có giấy của trạm y tế",
      status: "APPROVED",
      approverId: created.get("NV002"),
      decidedAt: new Date("2026-09-10"),
    },
  });
  await prisma.payrollAdjustment.create({
    data: {
      employeeId: created.get("NV004")!,
      year: 2026,
      month: 9,
      kind: "ADVANCE",
      amount: 1_500_000,
      reason: "Ứng lương ngày 15/09",
    },
  });

  const employees = await prisma.employee.findMany({ where: { status: { not: "TERMINATED" } } });
  const times = await prisma.timeEntry.findMany({ where: { year: 2026, month: 9 } });
  const timeById = new Map(times.map((item) => [item.employeeId, item]));
  const leaveRows = await prisma.leaveRequest.findMany({ where: { status: "APPROVED" } });
  const adjRows = await prisma.payrollAdjustment.findMany({ where: { year: 2026, month: 9 } });
  const run = await prisma.payrollRun.create({
    data: { legalEntityId: company.id, year: 2026, month: 9, status: "CALCULATED", ruleVersion: "vn-2026.07" },
  });
  for (const employee of employees) {
    const time = timeById.get(employee.id);
    const absences = summarizeAbsences(
      leaveRows.filter((item) => item.employeeId === employee.id).map((item) => ({
        type: item.type,
        startDate: item.startDate,
        endDate: item.endDate,
        days: item.days,
        status: item.status,
      })),
      2026,
      9,
    );
    const mine = adjRows.filter((item) => item.employeeId === employee.id);
    const result = calculatePayslip({
      period: { year: 2026, month: 9 },
      region: "I",
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
      advance: mine.filter((item) => item.kind === "ADVANCE").reduce((sum, item) => sum + item.amount, 0),
      otherDeductions: mine.filter((item) => item.kind === "DEDUCTION").reduce((sum, item) => sum + item.amount, 0),
      retros: mine.filter((item) => item.kind === "RETRO").map((item) => ({ name: "Truy lĩnh", amount: item.amount, reason: item.reason })),
    });
    await prisma.payslip.create({
      data: {
        runId: run.id,
        employeeId: employee.id,
        gross: result.gross,
        insuranceBase: result.insuranceBase,
        insuranceEmployee: result.insuranceEmployee,
        insuranceEmployer: result.insuranceEmployer,
        pit: result.pit,
        net: result.net,
        taxableEarnings: result.taxableEarnings,
        assessableIncome: result.assessableIncome,
        warnings: result.warnings,
        lines: { create: result.lines },
      },
    });
  }

  for (const rule of VN_RULE_PACKS) {
    await prisma.statutoryRule.create({
      data: {
        version: rule.version,
        validFrom: rule.validFrom,
        validTo: rule.validTo,
        note: rule.note,
        payload: rulePackPayload(rule),
      },
    });
  }

  console.log("Seed xong. Mật khẩu demo:", password);
}

function person(
  code: string,
  fullName: string,
  jobTitle: string,
  departmentId: string,
  hireDate: string,
  baseSalary: number,
  dependents: number,
  status: "ACTIVE" | "PROBATION",
  contractType: "DEFINITE" | "INDEFINITE" | "PROBATION",
) {
  return {
    code,
    fullName,
    jobTitle,
    departmentId,
    hireDate: new Date(hireDate),
    contractStart: new Date(hireDate),
    contractEnd: contractType === "INDEFINITE" ? null : contractType === "PROBATION" ? new Date("2026-11-15") : new Date("2027-09-30"),
    baseSalary,
    dependents,
    status,
    contractType,
  };
}

function yearsBetween(from: Date, to: Date) {
  return Math.max(0, to.getFullYear() - from.getFullYear() - (to < new Date(to.getFullYear(), from.getMonth(), from.getDate()) ? 1 : 0));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
