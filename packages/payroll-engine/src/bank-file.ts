import { createHash } from "crypto";

export type BankRow = {
  code: string;
  fullName: string;
  bankName: string;
  bankAccount: string;
  amount: number;
  content: string;
};

export type BankFileResult = {
  csv: string;
  rows: number;
  total: number;
  sha256: string;
  missingAccounts: string[];
};

export function buildBankFile(rows: BankRow[], periodLabel: string): BankFileResult {
  const missingAccounts = rows.filter((row) => !row.bankAccount.trim()).map((row) => row.code);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const lines = ["Ma NV,Ho ten,Ngan hang,So tai khoan,So tien,Noi dung"];
  for (const row of rows) {
    lines.push(
      [
        row.code,
        csv(row.fullName),
        csv(row.bankName),
        csv(row.bankAccount),
        row.amount,
        csv(row.content || `Luong ${periodLabel}`),
      ].join(","),
    );
  }
  lines.push(`TONG,,,,${total},`);
  const csvText = lines.join("\n");
  const sha256 = createHash("sha256").update(csvText).digest("hex");
  lines.push(`# CONTROL,rows,${rows.length},net,${total},sha256,${sha256}`);
  const withControl = lines.join("\n");
  return {
    csv: withControl,
    rows: rows.length,
    total,
    sha256: createHash("sha256").update(withControl).digest("hex"),
    missingAccounts,
  };
}

export function parseBankFile(csvText: string): { rows: BankRow[]; total: number; statedTotal: number | null } {
  const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows: BankRow[] = [];
  let statedTotal: number | null = null;
  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("Ma NV")) continue;
    const parts = splitCsv(line);
    if (parts[0] === "TONG") {
      statedTotal = Number(parts[4] ?? 0);
      continue;
    }
    rows.push({
      code: parts[0] ?? "",
      fullName: parts[1] ?? "",
      bankName: parts[2] ?? "",
      bankAccount: parts[3] ?? "",
      amount: Number(parts[4] ?? 0),
      content: parts[5] ?? "",
    });
  }
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return { rows, total, statedTotal };
}

export function reconcileBankFile(csvText: string, expectedNet: number) {
  const parsed = parseBankFile(csvText);
  if (parsed.statedTotal != null && parsed.statedTotal !== parsed.total) {
    throw new Error(`Dòng TONG ${parsed.statedTotal} khác tổng các dòng ${parsed.total}`);
  }
  if (parsed.total !== expectedNet) {
    throw new Error(`Tổng file ${parsed.total} khác tổng thực nhận ${expectedNet}`);
  }
  const missing = parsed.rows.filter((row) => !row.bankAccount.trim()).map((row) => row.code);
  return {
    matched: true,
    rows: parsed.rows.length,
    total: parsed.total,
    expectedNet,
    missingAccounts: missing,
  };
}

function csv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out;
}
