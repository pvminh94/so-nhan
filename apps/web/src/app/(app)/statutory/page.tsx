import { api, requireMe, vnd } from "@/lib/api";

type Statutory = {
  ruleVersion: string;
  insuranceCeiling: number;
  employeeRate: number;
  employerRate: number;
  personalDeduction: number;
  dependentDeduction: number;
  unpaidDaysCutoff: number;
  referenceWage: number;
  validFrom: number;
  validTo: number;
  regionalMinimum: Record<string, number>;
  holidays: string[];
  versions: Array<{ version: string; validFrom: number; validTo: number; note: string }>;
  note: string;
};

function ym(value: number) {
  return `${String(value).slice(4)}/${String(value).slice(0, 4)}`;
}

export default async function StatutoryPage() {
  await requireMe();
  const data = await api<Statutory>("/api/statutory?year=2026&month=9");
  if (!data) return null;
  return (
    <>
      <div className="top">
        <div>
          <h1>Tham số luật {data.ruleVersion}</h1>
          <p className="sub">{data.note}</p>
        </div>
      </div>
      <div className="grid">
        <article className="card"><div className="k">Trần BHXH</div><div className="num" style={{ fontSize: 22 }}>{vnd(data.insuranceCeiling)}</div></article>
        <article className="card"><div className="k">NLĐ / DN</div><div className="num" style={{ fontSize: 22 }}>{data.employeeRate * 100}% / {data.employerRate * 100}%</div></article>
        <article className="card"><div className="k">Giảm trừ bản thân</div><div className="num" style={{ fontSize: 22 }}>{vnd(data.personalDeduction)}</div></article>
        <article className="card"><div className="k">Mỗi phụ thuộc</div><div className="num" style={{ fontSize: 22 }}>{vnd(data.dependentDeduction)}</div></article>
      </div>
      <article className="card" style={{ marginTop: 12 }}>
        <h2>Phiên bản theo ngày</h2>
        <table>
          <thead><tr><th>Gói</th><th>Hiệu lực</th><th></th></tr></thead>
          <tbody>
            {data.versions?.map((item) => (
              <tr key={item.version}>
                <td>{item.version}</td>
                <td>{ym(item.validFrom)} – {ym(item.validTo)}</td>
                <td className="muted">{item.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Đổi luật thì thêm gói mới. Kỳ lương đã chốt giữ nguyên phiên bản lúc tính.</p>
      </article>
      <article className="card" style={{ marginTop: 12 }}>
        <h2>Lương tối thiểu vùng · mức tham chiếu {vnd(data.referenceWage)}</h2>
        <table>
          <tbody>
            {Object.entries(data.regionalMinimum).map(([region, amount]) => (
              <tr key={region}><td>Vùng {region}</td><td className="money">{vnd(amount)}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Nghỉ không lương từ {data.unpaidDaysCutoff} ngày thì tháng đó không đóng BHXH. Ngày lễ trong gói: {data.holidays?.join(", ") || "—"}.</p>
      </article>
    </>
  );
}
