export const RULE_VERSION = "vn-2026.07";

export type WageRegion = "I" | "II" | "III" | "IV";

export type Period = { year: number; month: number };

/** Lương tối thiểu vùng từ 01/01/2026, Nghị định 293/2025. Tham số có ngày, không phải hằng số vĩnh viễn. */
export const REGIONAL_MINIMUM_VND = {
  I: 5_310_000,
  II: 4_730_000,
  III: 4_140_000,
  IV: 3_700_000,
} as const;

export const PERSONAL_DEDUCTION_VND = 15_500_000;
export const DEPENDENT_DEDUCTION_VND = 6_200_000;
export const EMPLOYEE_SI_RATE = 0.105;
export const EMPLOYER_SI_RATE = 0.215;
export const UNPAID_DAYS_SI_CUTOFF = 14;

export const OT_MULTIPLIER = {
  weekday: 1.5,
  weekend: 2,
  holiday: 3,
  nightPremium: 0.3,
} as const;

export function periodKey(period: Period): number {
  return period.year * 100 + period.month;
}

/** Trần đóng BHXH = 20 lần mức tham chiếu. Đổi mốc 01/07/2026. */
export function insuranceCeiling(period: Period): number {
  return periodKey(period) >= 202607 ? 50_600_000 : 46_800_000;
}

export type PitBracket = { upTo: number; rate: number; quickDeduction: number };

export const PIT_BRACKETS_2026: PitBracket[] = [
  { upTo: 10_000_000, rate: 0.05, quickDeduction: 0 },
  { upTo: 30_000_000, rate: 0.1, quickDeduction: 500_000 },
  { upTo: 60_000_000, rate: 0.2, quickDeduction: 3_500_000 },
  { upTo: 100_000_000, rate: 0.3, quickDeduction: 9_500_000 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.35, quickDeduction: 14_500_000 },
];

export function roundVnd(value: number): number {
  return Math.round(value);
}

export function pitOnAssessable(assessable: number): number {
  if (assessable <= 0) return 0;
  const bracket = PIT_BRACKETS_2026.find((item) => assessable <= item.upTo);
  if (!bracket) return 0;
  return Math.max(0, roundVnd(assessable * bracket.rate - bracket.quickDeduction));
}

export function annualLeaveEntitlement(yearsOfService: number, band: "normal" | "heavy" | "extreme" = "normal"): number {
  const base = band === "extreme" ? 16 : band === "heavy" ? 14 : 12;
  return base + Math.floor(Math.max(0, yearsOfService) / 5);
}

export function overtimeCaps(yearlyCap: 200 | 300 = 200) {
  return { monthly: yearlyCap === 300 ? 60 : 40, yearly: yearlyCap };
}

export function statutorySnapshot(period: Period) {
  return {
    ruleVersion: RULE_VERSION,
    period,
    regionalMinimum: REGIONAL_MINIMUM_VND,
    insuranceCeiling: insuranceCeiling(period),
    employeeRate: EMPLOYEE_SI_RATE,
    employerRate: EMPLOYER_SI_RATE,
    personalDeduction: PERSONAL_DEDUCTION_VND,
    dependentDeduction: DEPENDENT_DEDUCTION_VND,
    pitBrackets: PIT_BRACKETS_2026.filter((item) => Number.isFinite(item.upTo)),
    otMultiplier: OT_MULTIPLIER,
    unpaidDaysCutoff: UNPAID_DAYS_SI_CUTOFF,
    note: "Tham số đối chiếu công khai tại 09/2026. Đổi luật thì thêm phiên bản, không sửa kỳ đã chốt.",
  };
}
