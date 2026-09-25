import { AdjustmentForm } from "@/components/adjustment-form";
import { api, requireMe, vnd } from "@/lib/api";

type Row = {
  id: string;
  code: string;
  fullName: string;
  department: string;
  kind: "ADVANCE" | "RETRO" | "DEDUCTION";
  amount: number;
  reason: string;
};
type Person = { id: string; code: string; fullName: string };

const kindLabel = { ADVANCE: "Tạm ứng", RETRO: "Truy lĩnh", DEDUCTION: "Khấu trừ" };

export default async function AdjustmentsPage() {
  const me = await requireMe();
  const canEdit = me.role === "ADMIN" || me.role === "PAYROLL";
  const rows = await api<Row[]>("/api/payroll/adjustments?year=2026&month=9");
  const people = canEdit ? await api<Person[]>("/api/employees") : [];
  return (
    <>
      <div className="top">
        <div>
          <p className="hello">Kỳ lương 09/2026</p>
          <h1>Tạm ứng và truy lĩnh</h1>
          <p className="sub">
            Tạm ứng trừ khi trả lương, không tính thuế. Truy lĩnh cộng vào lương chịu thuế — dùng khi kỳ trước đã khóa, không được sửa đè.
            Ghi xong phải tính lại kỳ lương thì phiếu mới có dòng này.
          </p>
        </div>
      </div>
      {canEdit && people ? (
        <article className="card" style={{ marginBottom: 12 }}>
          <AdjustmentForm people={people} />
        </article>
      ) : null}
      <article className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Mã</th><th>Họ tên</th><th>Loại</th><th>Số tiền</th><th>Lý do</th></tr>
            </thead>
            <tbody>
              {rows?.map((row) => (
                <tr key={row.id}>
                  <td className="muted">{row.code}</td>
                  <td>{row.fullName}<div className="muted">{row.department}</div></td>
                  <td><span className={row.kind === "RETRO" ? "tag wait" : "tag no"}>{kindLabel[row.kind]}</span></td>
                  <td className="money">{vnd(row.amount)}</td>
                  <td>{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows?.length ? <p className="empty">Chưa có tạm ứng hay truy lĩnh trong kỳ này.</p> : null}
      </article>
    </>
  );
}
