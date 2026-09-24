export type VarianceSlip = {
  code: string;
  fullName: string;
  net: number;
  workedDays: number;
  otHours: number;
  dependents: number;
  baseSalary: number;
};

export type VarianceRow = {
  code: string;
  fullName: string;
  previousNet: number;
  currentNet: number;
  delta: number;
  reasons: string[];
  unexplained: boolean;
};

export function comparePayroll(current: VarianceSlip[], previous: VarianceSlip[]) {
  const prev = new Map(previous.map((item) => [item.code, item]));
  const curr = new Map(current.map((item) => [item.code, item]));
  const codes = [...new Set([...prev.keys(), ...curr.keys()])].sort();
  const rows: VarianceRow[] = codes.map((code) => {
    const before = prev.get(code);
    const after = curr.get(code);
    const reasons: string[] = [];
    if (!before) reasons.push("Mới vào kỳ");
    else if (!after) reasons.push("Không còn trong kỳ");
    else {
      if (before.workedDays !== after.workedDays) reasons.push(`Ngày công ${before.workedDays} → ${after.workedDays}`);
      if (before.otHours !== after.otHours) reasons.push(`Giờ tăng ca/đêm ${before.otHours} → ${after.otHours}`);
      if (before.dependents !== after.dependents) reasons.push(`Người phụ thuộc ${before.dependents} → ${after.dependents}`);
      if (before.baseSalary !== after.baseSalary) reasons.push("Lương hợp đồng thay đổi");
      if (before.net !== after.net && reasons.length === 0) reasons.push("Thực nhận đổi nhưng công, phụ thuộc và lương hợp đồng không đổi");
      if (before.net === after.net && reasons.length > 0) reasons.push("Đầu vào đã đổi nhưng phiếu chưa đổi — cần tính lại kỳ");
    }
    const previousNet = before?.net ?? 0;
    const currentNet = after?.net ?? 0;
    const delta = currentNet - previousNet;
    const stale = reasons.some((reason) => reason.includes("cần tính lại"));
    const unexplained = stale || reasons.some((reason) => reason.startsWith("Thực nhận đổi"));
    return {
      code,
      fullName: after?.fullName ?? before?.fullName ?? code,
      previousNet,
      currentNet,
      delta,
      reasons,
      unexplained,
    };
  });
  const visible = rows.filter((row) => row.delta !== 0 || row.unexplained);
  return {
    previousNet: previous.reduce((sum, item) => sum + item.net, 0),
    currentNet: current.reduce((sum, item) => sum + item.net, 0),
    delta: current.reduce((sum, item) => sum + item.net, 0) - previous.reduce((sum, item) => sum + item.net, 0),
    changed: rows.filter((row) => row.delta !== 0).length,
    unexplained: visible.filter((row) => row.unexplained).length,
    rows: visible,
  };
}
