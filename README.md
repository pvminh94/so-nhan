# Sổ Nhân

HRMS thương mại cho quy mô khoảng **5.000 nhân sự**. Không phải microservice.

## Quyết định

5.000 người tạo ra vài triệu dòng công mỗi năm và một job lương vài chục giây. PostgreSQL một máy xử lý được. Cái làm hỏng sản phẩm là sai luật và mất backup, không phải thiếu Kubernetes.

Một codebase, ba tiến trình:

| VPS | Chạy | Cỡ máy |
|---|---|---|
| Web | Caddy + Next.js | 2 vCPU, 4 GB |
| API | NestJS + worker + Redis | 4 vCPU, 8 GB |
| Dữ liệu | PostgreSQL | 4 vCPU, 16 GB NVMe |

Redis không cần VPS riêng. Hồ sơ scan để object storage. Keycloak chỉ thêm khi khách bắt SAML.

Engine lương là thư viện thuần `packages/payroll-engine`. API và worker gọi vào, không viết công thức trong giao diện.

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

Mở http://localhost:3000

Tài khoản demo, mật khẩu `Sonhan@2026`:

- `payroll@sonhan.vn` — tính và khóa lương
- `hr@sonhan.vn` — hồ sơ, duyệt phép
- `quanly@sonhan.vn` — duyệt phép cấp dưới
- `nhanvien@sonhan.vn` — đơn của mình, phiếu của mình
- `admin@sonhan.vn` — quản trị

Đổi mật khẩu trước khi đưa dữ liệu thật lên. Không commit file `.env`.

## Triển khai 3 VPS

`deploy/docker-compose.yml` gộp đủ dịch vụ để thử trên một máy. Không tự seed lại, vì seed xóa dữ liệu. Lần đầu, vào container API chạy `npm run db:seed -w @so-nhan/api` nếu muốn dữ liệu demo. Tách production bằng cách chạy web, API và Postgres trên ba VPS, trỏ `DATABASE_URL` và `API_INTERNAL_URL`. Postgres và Redis chỉ nghe mạng nội bộ, không mở ra internet.

Backup PostgreSQL mỗi đêm ra máy khác. Thử phục hồi trước khi go-live.
