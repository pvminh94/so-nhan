export type AttendanceImportRow = {
  code: string;
  standardDays: number;
  workedDays: number;
  unpaidDays: number;
  otWeekdayHours: number;
  otWeekendHours: number;
  otHolidayHours: number;
  nightHours: number;
};

const columns = [
  "code",
  "standardDays",
  "workedDays",
  "unpaidDays",
  "otWeekdayHours",
  "otWeekendHours",
  "otHolidayHours",
  "nightHours",
] as const;

export function attendanceTemplate(): string {
  return `${columns.join(",")}\nNV001,22,22,0,0,0,0,0\n`;
}

export function parseAttendanceCsv(text: string): AttendanceImportRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (lines.length < 2) throw new Error("File cần dòng tiêu đề và ít nhất một nhân sự");
  const header = lines[0].split(",").map((cell) => cell.trim());
  const index = Object.fromEntries(columns.map((name) => [name, header.indexOf(name)]));
  if (columns.some((name) => index[name] < 0)) {
    throw new Error(`Thiếu cột. Đúng định dạng: ${columns.join(",")}`);
  }
  return lines.slice(1).map((line, row) => {
    const cells = line.split(",").map((cell) => cell.trim());
    const code = cells[index.code];
    if (!code) throw new Error(`Dòng ${row + 2} thiếu mã nhân sự`);
    const num = (name: (typeof columns)[number]) => {
      const raw = cells[index[name]] || "0";
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) throw new Error(`Dòng ${row + 2}, cột ${name} không hợp lệ`);
      return value;
    };
    return {
      code: code.toUpperCase(),
      standardDays: num("standardDays"),
      workedDays: num("workedDays"),
      unpaidDays: num("unpaidDays"),
      otWeekdayHours: num("otWeekdayHours"),
      otWeekendHours: num("otWeekendHours"),
      otHolidayHours: num("otHolidayHours"),
      nightHours: num("nightHours"),
    };
  });
}
