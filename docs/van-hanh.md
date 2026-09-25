# Hướng dẫn vận hành Sổ Nhân

Cập nhật theo `main`. Đây là sổ tay chạy hệ thống, không thay file kiến trúc `hrms-kien-truc.html`.

## Cấu trúc

Một codebase, ba tiến trình, không microservice.

| Thành phần | Thư mục | Việc |
|---|---|---|
| Web | `apps/web` | Next.js. ESS / MSS / HR. Không giữ dữ liệu. |
| API | `apps/api` | NestJS. Hồ sơ, phép, công, lương, thông báo. |
| Worker | `apps/api/src/worker.ts` | Tính lương, nhắc hợp đồng mỗi giờ. |
| Engine | `packages/payroll-engine` | Luật, phiếu lương, sổ phép, file ngân hàng. Test vàng chạy ở đây. |

PostgreSQL là sổ cái. Redis trong compose chỉ để sau này; worker hiện hỏi database.

## Tài khoản demo

Mật khẩu `Sonhan@2026`. Đổi trước khi có dữ liệu thật.

- `admin@sonhan.vn` — quản trị
- `hr@sonhan.vn` — hồ sơ, phép, hợp đồng, gói luật
- `payroll@sonhan.vn` — tính lương, khóa kỳ, file ngân hàng
- `quanly@sonhan.vn` — nhóm cấp dưới, không thấy lương team
- `nhanvien@sonhan.vn` — hồ sơ mình, xin phép, phiếu mình

Không commit `.env`. Không dán PAT vào remote URL.

## Lịch tháng

1. Nhập công CSV khi kỳ còn mở. Thiếu mã thì không nhập.
2. Khóa kỳ công. Thiếu dòng công của người đang làm thì không khóa. Kỳ lương đã khóa thì không mở công.
3. Tính lương: API chỉ xếp hàng, worker tính. Phiếu có công thức và phiên bản luật.
4. Đối chiếu kỳ trước. Cổng go-live: hai kỳ song song, không còn dòng chưa giải thích.
5. Khóa kỳ lương. Phiếu không sửa đè. Muốn sửa thì tính đợt điều chỉnh (chưa làm).
6. Tải file ngân hàng. Tổng file phải bằng tổng thực nhận. Thiếu số tài khoản thì không xuất. Dòng `# CONTROL` giữ số dòng, tổng, SHA-256.
7. Tải bút toán. Nợ phải bằng có.

## Phép

Quỹ phép là sổ cái: cộng quỹ, dùng, quyết toán khi nghỉ. Xin quá tồn thì bị từ chối. Duyệt phép năm ghi dòng `USAGE`. Không sửa một ô số dư.

Ốm đau / thai sản tách người trả (công ty hay quỹ BHXH) chưa làm.

## Phạm vi xem

- Nhân viên: hồ sơ và phiếu của mình.
- Quản lý: cấp dưới, trang `/team`, không thấy lương team.
- Nhân sự / lương / quản trị: cả pháp nhân demo.

## Hợp đồng

Nhân sự nhận tin khi hợp đồng hết trong 60 ngày hoặc quá hạn chưa quá 30 ngày. Không gửi lại cùng hồ sơ trong 7 ngày. Worker nhắc mỗi giờ.

## Gói luật

Bảng `StatutoryRule`. `vn-2026.01` đến 06/2026 (trần 46,8 triệu). `vn-2026.07` từ 07/2026 (trần 50,6 triệu). Đổi luật thì thêm gói, không sửa gói cũ. Trùng thời hạn thì API từ chối. Kỳ đã chốt giữ `ruleVersion` lúc tính.

## Seed

`npm run db:seed -w @so-nhan/api` xóa dữ liệu. Compose không tự seed. Chỉ seed một lần cho demo. Đừng seed lại môi trường đang có kỳ khóa.

## Backup

Postgres mỗi đêm ra máy khác. Thử restore trước go-live. Hồ sơ scan không để trên đĩa web.

## VPS Ubuntu (cổng 3000 và Postgres đã có dự án khác)

`bao_cao_tuan` đang giữ **3000** và Postgres **5432** thì **không** tắt chúng.

```bash
cd /opt
sudo git clone https://github.com/pvminh94/so-nhan.git
cd so-nhan
sudo bash deploy/cai-dat-vps.sh
```

Script tự:

- Nếu 3000 bận → web Sổ Nhân 3001 (hoặc 3002, 3080…)
- Nếu 5432 bận → dùng đúng Postgres đó, **tạo database `hrms` riêng**, không đụng database kia. Peer không được thì cụm mới cổng 5433.
- Nếu 4000 bận → API 4001. API chỉ nghe `127.0.0.1`.
- systemd: `so-nhan-web`, `so-nhan-api`, `so-nhan-worker`

Không seed mặc định (seed xóa dữ liệu HRMS). Demo một lần:

```bash
sudo bash deploy/cai-dat-vps.sh --seed
```

Nếu `git pull` báo *dubious ownership* hoặc `Permission denied` trên `.git/FETCH_HEAD`: lần cài cũ đã `chown sonhan` cả thư mục. Trả quyền rồi kéo code:

```bash
sudo chown -R bvqy4:bvqy4 /home/bvqy4/so-nhan
cd /home/bvqy4/so-nhan
git pull
sudo bash deploy/cai-dat-vps.sh --fix
```

`--fix` cũng tự `chown` lại user đang cài, rồi viết systemd.

## Chạy local

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run db:push
npm run db:seed
npm test
npm run dev:api
npm run worker -w @so-nhan/api
npm run dev:web
```

Web: http://localhost:3000

## Việc còn lại (P0)

- Tạm ứng, truy lĩnh, đợt điều chỉnh kỳ đã khóa
- Ca kíp, giờ gốc từ máy chấm công
- Tách Person / Employment, phụ lục HĐLĐ
- MFA / SSO, mã hóa CCCD và số tài khoản
- Ốm / thai sản tách người trả
- Hồ sơ số (file CCCD, hợp đồng)
- Cổng BHXH / thuế có người duyệt trước khi nộp
