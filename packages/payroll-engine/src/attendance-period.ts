export type AttendanceLockInput = {
  activeCodes: string[];
  entries: Array<{ code: string; locked: boolean }>;
  payrollLocked: boolean;
};

export function attendanceLockDecision(input: AttendanceLockInput) {
  const active = new Set(input.activeCodes);
  const byCode = new Map(input.entries.filter((entry) => active.has(entry.code)).map((entry) => [entry.code, entry]));
  const missing = input.activeCodes.filter((code) => !byCode.has(code)).sort();
  const open = [...byCode.values()].filter((entry) => !entry.locked).map((entry) => entry.code).sort();
  const periodLocked = input.activeCodes.length > 0 && missing.length === 0 && open.length === 0;
  return {
    periodLocked,
    missing,
    open,
    payrollLocked: input.payrollLocked,
    canLock: !input.payrollLocked && !periodLocked && missing.length === 0,
    canUnlock: periodLocked && !input.payrollLocked,
    canCalculate: periodLocked,
  };
}
