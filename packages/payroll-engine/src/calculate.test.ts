import { describe, expect, it } from "vitest";
import { annualLeaveEntitlement, assertLeaveAvailable, assertPackRange, attendanceLockDecision, attendanceTemplate, buildBankFile, buildJournal, calculatePayslip, comparePayroll, dependentWarning, insuranceCeiling, leaveBalanceFromLedger, parseAttendanceCsv, reconcileBankFile, resolveRulePack, VN_RULE_PACKS } from "./index";

const sep = { year: 2026, month: 9 };
const fullMonth = { standardDays: 22, workedDays: 22, unpaidDays: 0 };

describe("trần và phép", () => {
  it("trần BHXH đổi vào tháng 7/2026", () => {
    expect(insuranceCeiling({ year: 2026, month: 6 })).toBe(46_800_000);
    expect(insuranceCeiling({ year: 2026, month: 7 })).toBe(50_600_000);
    expect(resolveRulePack({ year: 2026, month: 6 }).version).toBe("vn-2026.01");
    expect(resolveRulePack({ year: 2026, month: 9 }).version).toBe("vn-2026.07");
  });

  it("phép năm 12 ngày cộng thâm niên mỗi 5 năm", () => {
    expect(annualLeaveEntitlement(4)).toBe(12);
    expect(annualLeaveEntitlement(5)).toBe(13);
    expect(annualLeaveEntitlement(11, "heavy")).toBe(16);
  });
});

describe("phiếu lương Việt Nam", () => {
  it("lương 20 triệu, không người phụ thuộc, tháng 9/2026", () => {
    const result = calculatePayslip({
      period: sep,
      region: "I",
      baseSalary: 20_000_000,
      insuranceSalary: 20_000_000,
      dependents: 0,
      ...fullMonth,
    });
    expect(result.insuranceEmployee).toBe(2_100_000);
    expect(result.insuranceEmployer).toBe(4_300_000);
    expect(result.assessableIncome).toBe(2_400_000);
    expect(result.pit).toBe(120_000);
    expect(result.net).toBe(17_780_000);
    expect(result.lines.find((line) => line.code === "PIT")?.formula).toContain("2.400.000");
  });

  it("lương 30 triệu ra thuế 635.000", () => {
    const result = calculatePayslip({
      period: sep,
      region: "I",
      baseSalary: 30_000_000,
      insuranceSalary: 30_000_000,
      dependents: 0,
      ...fullMonth,
    });
    expect(result.insuranceEmployee).toBe(3_150_000);
    expect(result.pit).toBe(635_000);
  });

  it("một người phụ thuộc làm giảm thu nhập tính thuế", () => {
    const result = calculatePayslip({
      period: sep,
      region: "I",
      baseSalary: 30_000_000,
      insuranceSalary: 30_000_000,
      dependents: 1,
      ...fullMonth,
    });
    expect(result.assessableIncome).toBe(5_150_000);
    expect(result.pit).toBe(257_500);
  });

  it("cắt trần 50,6 triệu từ tháng 7/2026 và 46,8 triệu trước đó", () => {
    const after = calculatePayslip({
      period: sep,
      region: "I",
      baseSalary: 80_000_000,
      insuranceSalary: 80_000_000,
      dependents: 0,
      ...fullMonth,
    });
    const before = calculatePayslip({
      period: { year: 2026, month: 6 },
      region: "I",
      baseSalary: 80_000_000,
      insuranceSalary: 80_000_000,
      dependents: 0,
      ...fullMonth,
    });
    expect(after.insuranceBase).toBe(50_600_000);
    expect(after.insuranceEmployee).toBe(5_313_000);
    expect(before.insuranceBase).toBe(46_800_000);
    expect(before.insuranceEmployee).toBe(4_914_000);
  });

  it("lương đóng dưới sàn vùng I thì lấy sàn", () => {
    const result = calculatePayslip({
      period: sep,
      region: "I",
      baseSalary: 8_000_000,
      insuranceSalary: 4_000_000,
      dependents: 0,
      ...fullMonth,
    });
    expect(result.insuranceBase).toBe(5_310_000);
    expect(result.insuranceEmployee).toBe(557_550);
  });

  it("nghỉ không lương đủ 14 ngày thì không đóng bảo hiểm tháng đó", () => {
    const result = calculatePayslip({
      period: sep,
      region: "I",
      baseSalary: 20_000_000,
      insuranceSalary: 20_000_000,
      dependents: 0,
      standardDays: 22,
      workedDays: 8,
      unpaidDays: 14,
    });
    expect(result.insuranceBase).toBe(0);
    expect(result.insuranceEmployee).toBe(0);
    expect(result.gross).toBe(Math.round((20_000_000 * 8) / 22));
  });

  it("tiền tăng ca không làm tăng thuế", () => {
    const base = calculatePayslip({
      period: sep,
      region: "I",
      baseSalary: 20_000_000,
      insuranceSalary: 20_000_000,
      dependents: 0,
      ...fullMonth,
    });
    const withOt = calculatePayslip({
      period: sep,
      region: "I",
      baseSalary: 20_000_000,
      insuranceSalary: 20_000_000,
      dependents: 0,
      ...fullMonth,
      otWeekdayHours: 8,
    });
    expect(withOt.pit).toBe(base.pit);
    expect(withOt.gross).toBeGreaterThan(base.gross);
    expect(withOt.net - base.net).toBe(withOt.gross - base.gross);
    expect(withOt.lines.find((line) => line.code === "OT_WEEKDAY")?.pitTreatment).toBe("exempt");
  });

  it("đọc file công và ra bút toán cân", () => {
    const rows = parseAttendanceCsv(attendanceTemplate() + "NV009,22,22,0,8,0,0,2\n");
    expect(rows).toHaveLength(2);
    expect(rows[1].otWeekdayHours).toBe(8);
    const journal = buildJournal("09/2026", [
      { gross: 20_000_000, net: 17_780_000, pit: 120_000, insuranceEmployee: 2_100_000, insuranceEmployer: 4_300_000 },
    ]);
    const debit = journal.reduce((sum, line) => sum + line.debit, 0);
    const credit = journal.reduce((sum, line) => sum + line.credit, 0);
    expect(debit).toBe(credit);
    expect(debit).toBe(24_300_000);
  });

  it("vượt trần giờ tăng ca thì có cảnh báo, vẫn ra số", () => {
    const result = calculatePayslip({
      period: sep,
      region: "II",
      baseSalary: 15_000_000,
      insuranceSalary: 15_000_000,
      dependents: 0,
      ...fullMonth,
      otWeekdayHours: 50,
    });
    expect(result.warnings[0]).toContain("50");
    expect(result.net).toBeGreaterThan(0);
  });
});

describe("người phụ thuộc", () => {
  const asOf = new Date("2026-09-01");

  it("con dưới 18 tuổi không cảnh báo", () => {
    expect(dependentWarning("CHILD", new Date("2012-01-01"), asOf)).toBeNull();
  });

  it("con đủ 18 tuổi cần hồ sơ", () => {
    expect(dependentWarning("CHILD", new Date("2008-09-01"), asOf)).toContain("18");
  });

  it("cha mẹ dưới 60 tuổi cần hồ sơ", () => {
    expect(dependentWarning("PARENT", new Date("1980-01-01"), asOf)).toContain("60");
  });
});

describe("khóa kỳ công", () => {
  it("thiếu công thì không khóa và không tính lương", () => {
    const decision = attendanceLockDecision({
      activeCodes: ["NV001", "NV002"],
      entries: [{ code: "NV001", locked: false }],
      payrollLocked: false,
    });
    expect(decision.missing).toEqual(["NV002"]);
    expect(decision.canLock).toBe(false);
    expect(decision.canCalculate).toBe(false);
  });

  it("đủ công đang mở thì được khóa, chưa được tính", () => {
    const decision = attendanceLockDecision({
      activeCodes: ["NV001"],
      entries: [{ code: "NV001", locked: false }],
      payrollLocked: false,
    });
    expect(decision.canLock).toBe(true);
    expect(decision.canCalculate).toBe(false);
  });

  it("đã khóa hết thì tính được, lương đã khóa thì không mở lại", () => {
    const openPayroll = attendanceLockDecision({
      activeCodes: ["NV001"],
      entries: [{ code: "NV001", locked: true }],
      payrollLocked: false,
    });
    expect(openPayroll.canCalculate).toBe(true);
    expect(openPayroll.canUnlock).toBe(true);
    const closedPayroll = attendanceLockDecision({
      activeCodes: ["NV001"],
      entries: [{ code: "NV001", locked: true }],
      payrollLocked: true,
    });
    expect(closedPayroll.canUnlock).toBe(false);
  });
});

describe("đối chiếu hai kỳ", () => {
  const base = { fullName: "A", net: 10_000_000, workedDays: 22, otHours: 0, dependents: 0, baseSalary: 12_000_000 };

  it("cùng số liệu thì không có biến động chưa giải thích", () => {
    const result = comparePayroll([{ code: "NV001", ...base }], [{ code: "NV001", ...base }]);
    expect(result.unexplained).toBe(0);
    expect(result.changed).toBe(0);
  });

  it("đổi ngày công thì giải thích được, không tính là chưa rõ", () => {
    const result = comparePayroll(
      [{ code: "NV001", ...base, workedDays: 20, net: 9_000_000 }],
      [{ code: "NV001", ...base }],
    );
    expect(result.unexplained).toBe(0);
    expect(result.rows[0]?.reasons[0]).toContain("Ngày công");
  });

  it("thực nhận đổi mà đầu vào không đổi thì đánh dấu chưa giải thích", () => {
    const result = comparePayroll([{ code: "NV001", ...base, net: 9_500_000 }], [{ code: "NV001", ...base }]);
    expect(result.unexplained).toBe(1);
  });

  it("công đổi mà phiếu không đổi thì bắt tính lại", () => {
    const result = comparePayroll([{ code: "NV001", ...base, workedDays: 20 }], [{ code: "NV001", ...base }]);
    expect(result.unexplained).toBe(1);
    expect(result.rows[0]?.reasons.join(" ")).toContain("tính lại");
  });
});

describe("sổ cái phép", () => {
  it("cộng dồn cộng trừ, không sửa một ô số dư", () => {
    const snap = leaveBalanceFromLedger([
      { kind: "ACCRUAL", days: 12 },
      { kind: "USAGE", days: -2 },
      { kind: "ADJUSTMENT", days: 1 },
    ]);
    expect(snap.entitled).toBe(13);
    expect(snap.used).toBe(2);
    expect(snap.remaining).toBe(11);
  });

  it("không cho dùng quá phép tồn", () => {
    expect(() => assertLeaveAvailable(1, 2)).toThrow(/phép tồn/);
    expect(() => assertLeaveAvailable(2, 2)).not.toThrow();
  });
});

describe("gói luật có ngày", () => {
  it("thêm gói mới không sửa gói cũ", () => {
    const extra = { ...VN_RULE_PACKS[1]!, version: "vn-2027.01", validFrom: 202_701, validTo: 202_712, referenceWage: 3_000_000 };
    assertPackRange(VN_RULE_PACKS, extra);
    const packs = [...VN_RULE_PACKS, extra];
    expect(insuranceCeiling({ year: 2026, month: 9 }, packs)).toBe(50_600_000);
    expect(insuranceCeiling({ year: 2027, month: 1 }, packs)).toBe(60_000_000);
    expect(() => assertPackRange(VN_RULE_PACKS, { version: "vn-2026.08", validFrom: 202_609, validTo: 202_612 })).toThrow(/Trùng/);
  });

  it("kỳ 9/2026 gắn vn-2026.07 trên phiếu", () => {
    const result = calculatePayslip({
      period: sep,
      region: "I",
      baseSalary: 20_000_000,
      insuranceSalary: 20_000_000,
      dependents: 0,
      ...fullMonth,
    });
    expect(result.ruleVersion).toBe("vn-2026.07");
  });
});

describe("file ngân hàng", () => {
  it("tổng file phải bằng tổng thực nhận", () => {
    const file = buildBankFile(
      [
        { code: "NV001", fullName: "A", bankName: "VCB", bankAccount: "001", amount: 10_000_000, content: "Luong" },
        { code: "NV002", fullName: "B", bankName: "TCB", bankAccount: "002", amount: 8_000_000, content: "Luong" },
      ],
      "09/2026",
    );
    expect(file.total).toBe(18_000_000);
    expect(file.missingAccounts).toEqual([]);
    const check = reconcileBankFile(file.csv, 18_000_000);
    expect(check.matched).toBe(true);
    expect(check.rows).toBe(2);
  });

  it("lệch tổng hoặc thiếu tài khoản thì bắt", () => {
    const file = buildBankFile(
      [{ code: "NV001", fullName: "A", bankName: "", bankAccount: "", amount: 1_000_000, content: "" }],
      "09/2026",
    );
    expect(file.missingAccounts).toEqual(["NV001"]);
    expect(() => reconcileBankFile(file.csv, 2_000_000)).toThrow(/thực nhận/);
  });
});
