import { describe, expect, it } from "vitest";
import { annualLeaveEntitlement, calculatePayslip, insuranceCeiling } from "./index";

const sep = { year: 2026, month: 9 };
const fullMonth = { standardDays: 22, workedDays: 22, unpaidDays: 0 };

describe("trần và phép", () => {
  it("trần BHXH đổi vào tháng 7/2026", () => {
    expect(insuranceCeiling({ year: 2026, month: 6 })).toBe(46_800_000);
    expect(insuranceCeiling({ year: 2026, month: 7 })).toBe(50_600_000);
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
