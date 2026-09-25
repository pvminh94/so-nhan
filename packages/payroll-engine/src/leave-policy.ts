import { roundVnd } from "./statutory";

export type AbsenceKind = "ANNUAL" | "UNPAID" | "SICK" | "MATERNITY" | "OTHER";
export type LeavePayer = "COMPANY" | "BHXH" | "NONE";

export type LeavePolicy = {
  label: string;
  payer: LeavePayer;
  payerLabel: string;
  bhxhRate: number;
  usesAnnualBalance: boolean;
  hint: string;
};

export const LEAVE_POLICY: Record<AbsenceKind, LeavePolicy> = {
  ANNUAL: {
    label: "Phép năm",
    payer: "COMPANY",
    payerLabel: "Công ty trả lương",
    bhxhRate: 0,
    usesAnnualBalance: true,
    hint: "Nghỉ phép năm vẫn hưởng lương. Trừ vào quỹ phép năm, không trừ ngày công.",
  },
  UNPAID: {
    label: "Nghỉ không lương",
    payer: "NONE",
    payerLabel: "Không ai trả",
    bhxhRate: 0,
    usesAnnualBalance: false,
    hint: "Không lương những ngày này. Nghỉ không lương từ 14 ngày trong tháng thì không đóng BHXH tháng đó.",
  },
  SICK: {
    label: "Ốm đau",
    payer: "BHXH",
    payerLabel: "Quỹ BHXH trả",
    bhxhRate: 0.75,
    usesAnnualBalance: false,
    hint: "Công ty không trả lương những ngày ốm. Quỹ BHXH trợ cấp 75% lương đóng, chia 24 ngày.",
  },
  MATERNITY: {
    label: "Thai sản",
    payer: "BHXH",
    payerLabel: "Quỹ BHXH trả",
    bhxhRate: 1,
    usesAnnualBalance: false,
    hint: "Công ty không trả lương. Quỹ BHXH trợ cấp 100% bình quân lương đóng 6 tháng liền kề (tạm tính theo lương đóng hiện tại).",
  },
  OTHER: {
    label: "Nghỉ việc riêng",
    payer: "COMPANY",
    payerLabel: "Theo nội quy",
    bhxhRate: 0,
    usesAnnualBalance: false,
    hint: "Nghỉ việc riêng theo nội quy. Không trừ quỹ phép năm trừ khi ghi rõ.",
  },
};

export function leaveDaysInPeriod(
  start: Date,
  end: Date,
  totalDays: number,
  year: number,
  month: number,
): number {
  const periodStart = Date.UTC(year, month - 1, 1);
  const periodEnd = Date.UTC(year, month, 0);
  const s = Math.max(utcDay(start), periodStart);
  const e = Math.min(utcDay(end), periodEnd);
  if (e < s) return 0;
  const span = Math.max(1, Math.round((utcDay(end) - utcDay(start)) / 86400000) + 1);
  const overlap = Math.round((e - s) / 86400000) + 1;
  return Math.round(((totalDays * overlap) / span) * 1000) / 1000;
}

export function summarizeAbsences(
  requests: Array<{ type: AbsenceKind; startDate: Date; endDate: Date; days: number; status: string }>,
  year: number,
  month: number,
) {
  const out = { unpaidDays: 0, sickDays: 0, maternityDays: 0, annualDays: 0 };
  for (const request of requests) {
    if (request.status !== "APPROVED") continue;
    const days = leaveDaysInPeriod(request.startDate, request.endDate, request.days, year, month);
    if (request.type === "UNPAID") out.unpaidDays += days;
    if (request.type === "SICK") out.sickDays += days;
    if (request.type === "MATERNITY") out.maternityDays += days;
    if (request.type === "ANNUAL") out.annualDays += days;
  }
  return out;
}

export function bhxhBenefit(kind: AbsenceKind, days: number, insuranceSalary: number): number {
  const policy = LEAVE_POLICY[kind];
  if (!policy || policy.payer !== "BHXH" || !(days > 0)) return 0;
  const divisor = kind === "MATERNITY" ? 30 : 24;
  return roundVnd((insuranceSalary / divisor) * policy.bhxhRate * days);
}

function utcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}
