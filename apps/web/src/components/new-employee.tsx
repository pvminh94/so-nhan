"use client";

export function NewEmployeeForm({ departments }: { departments: Array<{ id: string; name: string }> }) {
  return (
    <form
      className="form"
      style={{ marginTop: 16 }}
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const response = await fetch("/backend/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: data.get("code"),
            fullName: data.get("fullName"),
            jobTitle: data.get("jobTitle"),
            departmentId: data.get("departmentId"),
            hireDate: data.get("hireDate"),
            baseSalary: Number(data.get("baseSalary")),
            email: data.get("email"),
          }),
        });
        if (!response.ok) {
          alert("Không tạo được hồ sơ. Mã có thể đã tồn tại.");
          return;
        }
        window.location.reload();
      }}
    >
      <h2>Thêm nhân sự</h2>
      <div className="row">
        <input name="code" placeholder="Mã NV" required style={{ width: 110 }} />
        <input name="fullName" placeholder="Họ tên" required style={{ width: 220 }} />
        <input name="jobTitle" placeholder="Chức danh" required style={{ width: 180 }} />
      </div>
      <div className="row">
        <select name="departmentId" required style={{ width: 180 }}>
          {departments.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <input name="hireDate" type="date" required style={{ width: 160 }} />
        <input name="baseSalary" type="number" min="0" step="1000" placeholder="Lương hợp đồng" required style={{ width: 180 }} />
        <input name="email" type="email" placeholder="Email" style={{ width: 220 }} />
        <button className="btn">Lưu</button>
      </div>
    </form>
  );
}
