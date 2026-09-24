export type WageRegion = "I" | "II" | "III" | "IV";

export type Period = { year: number; month: number };

export type PitBracket = { upTo: number; rate: number; quickDeduction: number };

export type RulePack = {
  version: string;
  validFrom: number;
  validTo: number;
  note: string;
  referenceWage: number;
  insuranceMultiple: number;
  regionalMinimum: Record<WageRegion, number>;
  employeeRate: number;
  employerRate: number;
  personalDeduction: number;
  dependentDeduction: number;
  unpaidDaysCutoff: number;
  otMultiplier: { weekday: number; weekend: number; holiday: number; nightPremium: number };
  pitBrackets: PitBracket[];
  holidays: string[];
  overtimeMonthlyCap: number;
  overtimeYearlyCap: number;
};

const PIT_5: PitBracket[] = [
  { upTo: 10_000_000, rate: 0.05, quickDeduction: 0 },
  { upTo: 30_000_000, rate: 0.1, quickDeduction: 500_000 },
  { upTo: 60_000_000, rate: 0.2, quickDeduction: 3_500_000 },
  { upTo: 100_000_000, rate: 0.3, quickDeduction: 9_500_000 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.35, quickDeduction: 14_500_000 },
];

const OT = { weekday: 1.5, weekend: 2, holiday: 3, nightPremium: 0.3 } as const;

const REGION_2026 = { I: 5_310_000, II: 4_730_000, III: 4_140_000, IV: 3_700_000 } as const;

const HOLIDAYS_2026 = [
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-02-19",
  "2026-02-20",
  "2026-04-30",
  "2026-05-01",
  "2026-09-02",
];

function pack(partial: Omit<RulePack, "employeeRate" | "employerRate" | "otMultiplier" | "pitBrackets" | "unpaidDaysCutoff" | "overtimeMonthlyCap" | "overtimeYearlyCap" | "personalDeduction" | "dependentDeduction" | "regionalMinimum" | "holidays" | "insuranceMultiple"> & Partial<RulePack>): RulePack {
  return {
    insuranceMultiple: 20,
    regionalMinimum: REGION_2026,
    employeeRate: 0.105,
    employerRate: 0.215,
    personalDeduction: 15_500_000,
    dependentDeduction: 6_200_000,
    unpaidDaysCutoff: 14,
    otMultiplier: OT,
    pitBrackets: PIT_5,
    holidays: HOLIDAYS_2026,
    overtimeMonthlyCap: 40,
    overtimeYearlyCap: 200,
    ...partial,
  };
}

/** Gói luật có ngày. Đổi luật = thêm phần tử, không sửa gói cũ. */
export const VN_RULE_PACKS: RulePack[] = [
  pack({
    version: "vn-2026.01",
    validFrom: 202_601,
    validTo: 202_606,
    note: "Đến 30/06/2026: trần 20 × lương cơ sở 2,34 triệu. Vùng theo NĐ 293/2025. Thuế 5 bậc Luật 109/2025 cho kỳ tính thuế 2026.",
    referenceWage: 2_340_000,
  }),
  pack({
    version: "vn-2026.07",
    validFrom: 202_607,
    validTo: 202_612,
    note: "Từ 01/07/2026: trần 20 × lương cơ sở 2,53 triệu (NĐ 161/2026). Không sửa gói vn-2026.01.",
    referenceWage: 2_530_000,
  }),
];

export function periodKey(period: Period): number {
  return period.year * 100 + period.month;
}

export function assertPackRange(packs: Array<Pick<RulePack, "version" | "validFrom" | "validTo">>, next: Pick<RulePack, "version" | "validFrom" | "validTo">) {
  if (next.validFrom > next.validTo) throw new Error("Ngày hiệu lực không hợp lệ");
  if (packs.some((item) => item.version === next.version)) throw new Error("Phiên bản luật đã tồn tại");
  const overlap = packs.find((item) => !(next.validTo < item.validFrom || next.validFrom > item.validTo));
  if (overlap) throw new Error(`Trùng thời hạn với ${overlap.version}`);
}

export function resolveRulePack(period: Period, packs: RulePack[] = VN_RULE_PACKS): RulePack {
  const key = periodKey(period);
  const hit = [...packs].sort((a, b) => b.validFrom - a.validFrom).find((item) => key >= item.validFrom && key <= item.validTo);
  if (!hit) throw new Error(`Không có gói luật cho ${period.year}-${String(period.month).padStart(2, "0")}`);
  return hit;
}

export function insuranceCeiling(period: Period, packs: RulePack[] = VN_RULE_PACKS): number {
  const rule = resolveRulePack(period, packs);
  return rule.referenceWage * rule.insuranceMultiple;
}

export function roundVnd(value: number): number {
  return Math.round(value);
}

export function pitOnAssessable(assessable: number, brackets: PitBracket[] = resolveRulePack({ year: 2026, month: 7 }).pitBrackets): number {
  if (assessable <= 0) return 0;
  const bracket = brackets.find((item) => assessable <= item.upTo);
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

export function statutorySnapshot(period: Period, packs: RulePack[] = VN_RULE_PACKS) {
  const rule = resolveRulePack(period, packs);
  return {
    ruleVersion: rule.version,
    period,
    validFrom: rule.validFrom,
    validTo: rule.validTo,
    referenceWage: rule.referenceWage,
    regionalMinimum: rule.regionalMinimum,
    insuranceCeiling: rule.referenceWage * rule.insuranceMultiple,
    employeeRate: rule.employeeRate,
    employerRate: rule.employerRate,
    personalDeduction: rule.personalDeduction,
    dependentDeduction: rule.dependentDeduction,
    pitBrackets: rule.pitBrackets.filter((item) => Number.isFinite(item.upTo)),
    otMultiplier: rule.otMultiplier,
    unpaidDaysCutoff: rule.unpaidDaysCutoff,
    holidays: rule.holidays,
    versions: packs
      .slice()
      .sort((a, b) => a.validFrom - b.validFrom)
      .map((item) => ({ version: item.version, validFrom: item.validFrom, validTo: item.validTo, note: item.note })),
    note: rule.note,
  };
}

export function rulePackPayload(rule: RulePack) {
  const { version: _version, validFrom: _from, validTo: _to, note: _note, ...payload } = rule;
  return {
    ...payload,
    pitBrackets: payload.pitBrackets.map((item) => ({
      ...item,
      upTo: Number.isFinite(item.upTo) ? item.upTo : null,
    })),
  };
}

export function parseRulePack(row: {
  version: string;
  validFrom: number;
  validTo: number;
  note: string;
  payload: unknown;
}): RulePack {
  const payload = row.payload as Omit<RulePack, "version" | "validFrom" | "validTo" | "note"> & {
    pitBrackets: Array<{ upTo: number | null; rate: number; quickDeduction: number }>;
  };
  return {
    version: row.version,
    validFrom: row.validFrom,
    validTo: row.validTo,
    note: row.note,
    ...payload,
    pitBrackets: payload.pitBrackets.map((item) => ({
      ...item,
      upTo: item.upTo == null ? Number.POSITIVE_INFINITY : item.upTo,
    })),
  };
}

const current = resolveRulePack({ year: 2026, month: 7 });
export const RULE_VERSION = current.version;
export const REGIONAL_MINIMUM_VND = current.regionalMinimum;
export const PERSONAL_DEDUCTION_VND = current.personalDeduction;
export const DEPENDENT_DEDUCTION_VND = current.dependentDeduction;
export const EMPLOYEE_SI_RATE = current.employeeRate;
export const EMPLOYER_SI_RATE = current.employerRate;
export const UNPAID_DAYS_SI_CUTOFF = current.unpaidDaysCutoff;
export const OT_MULTIPLIER = current.otMultiplier;
export const PIT_BRACKETS_2026 = current.pitBrackets;
