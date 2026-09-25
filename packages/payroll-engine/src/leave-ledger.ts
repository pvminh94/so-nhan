export type LeaveLedgerKind = "ACCRUAL" | "USAGE" | "ADJUSTMENT" | "PAYOUT" | "CARRY";

export type LeaveLedgerEntry = {
  kind: LeaveLedgerKind;
  days: number;
};

export type LeaveLedgerSnapshot = {
  entitled: number;
  used: number;
  remaining: number;
};

export function leaveBalanceFromLedger(entries: LeaveLedgerEntry[]): LeaveLedgerSnapshot {
  let entitled = 0;
  let used = 0;
  let remaining = 0;
  for (const entry of entries) {
    remaining += entry.days;
    if (entry.kind === "ACCRUAL" || entry.kind === "CARRY") entitled += entry.days;
    else if (entry.kind === "USAGE" || entry.kind === "PAYOUT") used += Math.abs(entry.days);
    else if (entry.days > 0) entitled += entry.days;
    else used += Math.abs(entry.days);
  }
  return {
    entitled: roundDays(entitled),
    used: roundDays(used),
    remaining: roundDays(remaining),
  };
}

export function assertLeaveAvailable(remaining: number, days: number) {
  if (!(days > 0)) throw new Error("Số ngày nghỉ phải lớn hơn 0");
  if (days - remaining > 1e-6) throw new Error("Không còn đủ ngày phép năm");
}

function roundDays(value: number) {
  return Math.round(value * 1000) / 1000;
}
