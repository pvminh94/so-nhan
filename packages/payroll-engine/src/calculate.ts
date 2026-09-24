import {
  overtimeCaps,
  pitOnAssessable,
  resolveRulePack,
  roundVnd,
  type Period,
  type RulePack,
  type WageRegion,
} from "./statutory";

export type PitTreatment = "taxable" | "exempt" | "deduction" | "info";

export type PayslipLine = {
  code: string;
  name: string;
  amount: number;
  formula: string;
  pitTreatment: PitTreatment;
  sort: number;
};

export type PayrollInput = {
  period: Period;
  region: WageRegion;
  baseSalary: number;
  insuranceSalary: number;
  dependents: number;
  standardDays: number;
  workedDays: number;
  unpaidDays: number;
  otWeekdayHours?: number;
  otWeekendHours?: number;
  otHolidayHours?: number;
  nightHours?: number;
  allowances?: Array<{ code: string; name: string; amount: number; taxable: boolean }>;
  yearlyOtHours?: number;
  yearlyOtCap?: 200 | 300;
  rules?: RulePack;
  packs?: RulePack[];
};

export type PayrollResult = {
  ruleVersion: string;
  lines: PayslipLine[];
  gross: number;
  insuranceBase: number;
  insuranceEmployee: number;
  insuranceEmployer: number;
  pit: number;
  net: number;
  taxableEarnings: number;
  assessableIncome: number;
  warnings: string[];
};

function resolveInsuranceBase(input: PayrollInput, pack: RulePack): { base: number; formula: string } {
  if (input.unpaidDays >= pack.unpaidDaysCutoff) {
    return {
      base: 0,
      formula: `Nghỉ không lương ${input.unpaidDays} ngày ≥ ${pack.unpaidDaysCutoff} → không đóng BHXH tháng này`,
    };
  }
  const floor = pack.regionalMinimum[input.region];
  const ceiling = pack.referenceWage * pack.insuranceMultiple;
  const raw = input.insuranceSalary > 0 ? input.insuranceSalary : input.baseSalary;
  if (raw < floor) {
    return { base: floor, formula: `Lương hợp đồng ${raw.toLocaleString("vi-VN")} < sàn vùng ${input.region} ${floor.toLocaleString("vi-VN")} → lấy sàn` };
  }
  if (raw > ceiling) {
    return { base: ceiling, formula: `Lương hợp đồng ${raw.toLocaleString("vi-VN")} > trần ${ceiling.toLocaleString("vi-VN")} → lấy trần` };
  }
  return { base: raw, formula: `Lương làm căn cứ đóng BHXH ${raw.toLocaleString("vi-VN")} đồng` };
}

export function calculatePayslip(input: PayrollInput): PayrollResult {
  if (input.standardDays <= 0) {
    throw new Error("standardDays phải lớn hơn 0");
  }
  const pack = input.rules ?? resolveRulePack(input.period, input.packs);
  const warnings: string[] = [];
  const lines: PayslipLine[] = [];
  const hourly = input.baseSalary / input.standardDays / 8;
  const workedDays = Math.max(0, input.workedDays);
  const prorated = roundVnd((input.baseSalary * workedDays) / input.standardDays);

  lines.push({
    code: "BASE",
    name: "Lương theo ngày công",
    amount: prorated,
    formula: `${input.baseSalary.toLocaleString("vi-VN")} × ${workedDays}/${input.standardDays} ngày`,
    pitTreatment: "taxable",
    sort: 10,
  });

  let allowanceTaxable = 0;
  let allowanceTotal = 0;
  for (const [index, allowance] of (input.allowances ?? []).entries()) {
    allowanceTotal += allowance.amount;
    if (allowance.taxable) allowanceTaxable += allowance.amount;
    lines.push({
      code: allowance.code,
      name: allowance.name,
      amount: allowance.amount,
      formula: allowance.taxable ? "Phụ cấp chịu thuế" : "Phụ cấp không chịu thuế",
      pitTreatment: allowance.taxable ? "taxable" : "exempt",
      sort: 20 + index,
    });
  }

  const otWeekday = roundVnd((input.otWeekdayHours ?? 0) * hourly * pack.otMultiplier.weekday);
  const otWeekend = roundVnd((input.otWeekendHours ?? 0) * hourly * pack.otMultiplier.weekend);
  const otHoliday = roundVnd((input.otHolidayHours ?? 0) * hourly * pack.otMultiplier.holiday);
  const night = roundVnd((input.nightHours ?? 0) * hourly * pack.otMultiplier.nightPremium);

  if (otWeekday) {
    lines.push({
      code: "OT_WEEKDAY",
      name: "Làm thêm ngày thường",
      amount: otWeekday,
      formula: `${input.otWeekdayHours} giờ × đơn giá giờ × 150%. Miễn TNCN nếu có bảng công và đăng ký tăng ca`,
      pitTreatment: "exempt",
      sort: 30,
    });
  }
  if (otWeekend) {
    lines.push({
      code: "OT_WEEKEND",
      name: "Làm thêm ngày nghỉ hằng tuần",
      amount: otWeekend,
      formula: `${input.otWeekendHours} giờ × đơn giá giờ × 200%. Miễn TNCN nếu đủ hồ sơ`,
      pitTreatment: "exempt",
      sort: 31,
    });
  }
  if (otHoliday) {
    lines.push({
      code: "OT_HOLIDAY",
      name: "Làm thêm ngày lễ",
      amount: otHoliday,
      formula: `${input.otHolidayHours} giờ × đơn giá giờ × 300%. Miễn TNCN nếu đủ hồ sơ`,
      pitTreatment: "exempt",
      sort: 32,
    });
  }
  if (night) {
    lines.push({
      code: "NIGHT",
      name: "Phụ cấp làm đêm",
      amount: night,
      formula: `${input.nightHours} giờ × đơn giá giờ × 30%. Khoản làm đêm được tách để xét miễn TNCN`,
      pitTreatment: "exempt",
      sort: 33,
    });
  }

  const insurance = resolveInsuranceBase(input, pack);
  const insuranceEmployee = roundVnd(insurance.base * pack.employeeRate);
  const insuranceEmployer = roundVnd(insurance.base * pack.employerRate);

  lines.push({
    code: "SI_EE",
    name: "BHXH, BHYT, BHTN người lao động",
    amount: insuranceEmployee,
    formula: `${insurance.formula}. ${(pack.employeeRate * 100).toLocaleString("vi-VN")}% × ${insurance.base.toLocaleString("vi-VN")}`,
    pitTreatment: "deduction",
    sort: 80,
  });
  lines.push({
    code: "SI_ER",
    name: "BHXH, BHYT, BHTN doanh nghiệp",
    amount: insuranceEmployer,
    formula: `${(pack.employerRate * 100).toLocaleString("vi-VN")}% × ${insurance.base.toLocaleString("vi-VN")}. Chi phí công ty, không trừ vào lương`,
    pitTreatment: "info",
    sort: 81,
  });

  const taxableEarnings = prorated + allowanceTaxable;
  const deduction = pack.personalDeduction + input.dependents * pack.dependentDeduction;
  const assessable = Math.max(0, taxableEarnings - insuranceEmployee - deduction);
  const pit = pitOnAssessable(assessable, pack.pitBrackets);

  lines.push({
    code: "PIT",
    name: "Thuế thu nhập cá nhân",
    amount: pit,
    formula: `Thu nhập chịu thuế ${taxableEarnings.toLocaleString("vi-VN")} − bảo hiểm ${insuranceEmployee.toLocaleString("vi-VN")} − giảm trừ ${deduction.toLocaleString("vi-VN")} = ${assessable.toLocaleString("vi-VN")}. Biểu 5 bậc ${pack.version}`,
    pitTreatment: "deduction",
    sort: 90,
  });

  const gross = prorated + allowanceTotal + otWeekday + otWeekend + otHoliday + night;
  const net = gross - insuranceEmployee - pit;
  const monthlyOt = (input.otWeekdayHours ?? 0) + (input.otWeekendHours ?? 0) + (input.otHolidayHours ?? 0);
  const caps = overtimeCaps(input.yearlyOtCap ?? 200);
  if (monthlyOt > caps.monthly) {
    warnings.push(`Tăng ca tháng ${monthlyOt} giờ vượt trần ${caps.monthly} giờ. Cần căn cứ ngành nghề trước khi duyệt.`);
  }
  if ((input.yearlyOtHours ?? monthlyOt) > caps.yearly) {
    warnings.push(`Tăng ca năm vượt trần ${caps.yearly} giờ.`);
  }

  return {
    ruleVersion: pack.version,
    lines: lines.sort((a, b) => a.sort - b.sort),
    gross,
    insuranceBase: insurance.base,
    insuranceEmployee,
    insuranceEmployer,
    pit,
    net,
    taxableEarnings,
    assessableIncome: assessable,
    warnings,
  };
}
