import { api, requireMe, vnd } from "@/lib/api";

type Statutory = {
  ruleVersion: string;
  insuranceCeiling: number;
  employeeRate: number;
  employerRate: number;
  personalDeduction: number;
  dependentDeduction: number;
  unpaidDaysCutoff: number;
  regionalMinimum: Record<string, number>;
  note: string;
};

export default async function StatutoryPage() {
  await requireMe();
  const data = await api<Statutory>("/api/statutory");
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
        <h2>Lương tối thiểu vùng</h2>
        <table>
          <tbody>
            {Object.entries(data.regionalMinimum).map(([region, amount]) => (
              <tr key={region}><td>Vùng {region}</td><td className="money">{vnd(amount)}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Nghỉ không lương từ {data.unpaidDaysCutoff} ngày thì tháng đó không đóng BHXH. Đây là tham số engine, đổi luật là thêm phiên bản.</p>
      </article>
    </>
  );
}
