export type JournalSlip = {
  gross: number;
  net: number;
  pit: number;
  insuranceEmployee: number;
  insuranceEmployer: number;
};

export type JournalLine = {
  account: string;
  name: string;
  debit: number;
  credit: number;
};

export function buildJournal(periodLabel: string, slips: JournalSlip[]): JournalLine[] {
  const sum = slips.reduce(
    (acc, slip) => {
      acc.gross += slip.gross;
      acc.net += slip.net;
      acc.pit += slip.pit;
      acc.insuranceEmployee += slip.insuranceEmployee;
      acc.insuranceEmployer += slip.insuranceEmployer;
      return acc;
    },
    { gross: 0, net: 0, pit: 0, insuranceEmployee: 0, insuranceEmployer: 0 },
  );
  const lines: JournalLine[] = [
    { account: "642", name: `Chi phí lương ${periodLabel}`, debit: sum.gross, credit: 0 },
    { account: "334", name: "Phải trả người lao động", debit: 0, credit: sum.net },
    { account: "3335", name: "Thuế TNCN khấu trừ", debit: 0, credit: sum.pit },
    { account: "3383", name: "BHXH, BHYT, BHTN người lao động", debit: 0, credit: sum.insuranceEmployee },
    { account: "642", name: `Chi phí BHXH doanh nghiệp ${periodLabel}`, debit: sum.insuranceEmployer, credit: 0 },
    { account: "3383", name: "BHXH, BHYT, BHTN doanh nghiệp", debit: 0, credit: sum.insuranceEmployer },
  ];
  const debit = lines.reduce((total, line) => total + line.debit, 0);
  const credit = lines.reduce((total, line) => total + line.credit, 0);
  if (debit !== credit) {
    throw new Error(`Bút toán không cân: nợ ${debit} có ${credit}`);
  }
  return lines.filter((line) => line.debit || line.credit);
}
