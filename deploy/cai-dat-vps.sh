#!/usr/bin/env bash
# Cài Sổ Nhân trên Ubuntu Server, không đụng dự án đang chiếm cổng.
# bao_cao_tuan đang giữ 3000 và Postgres 5432 thì script tự tránh / dùng lại.
# Chạy:  sudo bash deploy/cai-dat-vps.sh
# Seed demo (xóa dữ liệu HRMS):  sudo bash deploy/cai-dat-vps.sh --seed
set -euo pipefail

WEB_WANT="${WEB_WANT:-3000}"
API_WANT="${API_WANT:-4000}"
PG_WANT="${PG_WANT:-5432}"
SEED=0
IN_PLACE=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed) SEED=1; shift ;;
    --web-port) WEB_WANT="$2"; shift 2 ;;
    --api-port) API_WANT="$2"; shift 2 ;;
    --pg-port) PG_WANT="$2"; shift 2 ;;
    --prefix) IN_PLACE=0; PREFIX="$2"; shift 2 ;;
    -h|--help)
      echo "sudo bash deploy/cai-dat-vps.sh [--seed] [--web-port N] [--api-port N] [--pg-port N]"
      exit 0
      ;;
    *) echo "Không hiểu $1"; exit 1 ;;
  esac
done

if [[ ${EUID} -ne 0 ]]; then
  echo "Cần sudo. Chạy: sudo bash deploy/cai-dat-vps.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
if [[ ! -f "${REPO_DIR}/apps/api/package.json" ]]; then
  echo "Không thấy repo Sổ Nhân. Chạy script từ trong git clone so-nhan."
  exit 1
fi
if [[ ${IN_PLACE} -eq 0 ]]; then
  mkdir -p "${PREFIX}"
  rsync -a --delete --exclude node_modules --exclude .git --exclude apps/api/.env "${REPO_DIR}/" "${PREFIX}/"
  REPO_DIR="${PREFIX}"
fi

LOG="/var/log/so-nhan-cai-dat.log"
mkdir -p /var/log /etc/so-nhan
exec > >(tee -a "${LOG}") 2>&1
echo "===== $(date -Iseconds) cài Sổ Nhân từ ${REPO_DIR} ====="

port_busy() {
  local p="$1"
  ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE ":${p}$"
}

port_who() {
  local p="$1"
  ss -tlnp 2>/dev/null | awk -v p=":${p}" '$4 ~ p"$" {print; found=1} END {if (!found) print "không rõ tiến trình"}'
}

first_free() {
  local p
  for p in "$@"; do
    if ! port_busy "${p}"; then
      echo "${p}"
      return 0
    fi
    echo "  Cổng ${p} đang bị chiếm:" >&2
    port_who "${p}" | sed 's/^/    /' >&2
  done
  echo "Không còn cổng trống trong danh sách: $*" >&2
  exit 1
}

echo ">> Kiểm tra cổng (bao_cao_tuan thường giữ 3000 và Postgres 5432)"
if port_busy 3000; then
  echo "  3000 đang chạy — giữ nguyên dự án kia, Sổ Nhân không bind 3000."
  port_who 3000 | sed 's/^/    /'
fi
if port_busy 5432; then
  echo "  5432 đang chạy — không cài đè Postgres, không đổi mật khẩu cụm cũ."
  port_who 5432 | sed 's/^/    /'
fi
if port_busy 4000; then
  echo "  4000 đang bị chiếm."
  port_who 4000 | sed 's/^/    /'
fi

if port_busy "${WEB_WANT}"; then
  WEB_PORT="$(first_free 3001 3002 3080 8080 3010)"
  echo "  Web Sổ Nhân → ${WEB_PORT}"
else
  WEB_PORT="${WEB_WANT}"
  echo "  Web Sổ Nhân → ${WEB_PORT} (cổng mặc định trống)"
fi

if port_busy "${API_WANT}"; then
  API_PORT="$(first_free 4001 4010 4100 8081)"
  echo "  API Sổ Nhân → ${API_PORT}"
else
  API_PORT="${API_WANT}"
  echo "  API Sổ Nhân → ${API_PORT}"
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg build-essential python3 rsync openssl

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]]; then
  echo ">> Cài Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
echo "  Node $(node -v)  npm $(npm -v)"

id sonhan >/dev/null 2>&1 || useradd --system --home /opt/so-nhan --shell /usr/sbin/nologin sonhan

PG_HOST="127.0.0.1"
PG_PORT="${PG_WANT}"
DB_PASS="$(openssl rand -base64 18 | tr -d '/+=' | head -c 24)"
PG_MODE=""

can_peer() {
  command -v psql >/dev/null 2>&1 && id postgres >/dev/null 2>&1 && sudo -u postgres psql -Atqc 'select 1' >/dev/null 2>&1
}

setup_db_peer() {
  echo ">> Dùng Postgres hiện có (peer). Không đụng database khác."
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hrms') THEN
    CREATE ROLE hrms LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE hrms WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE hrms OWNER hrms'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hrms')\\gexec
GRANT ALL PRIVILEGES ON DATABASE hrms TO hrms;
SQL
  PG_PORT="$(sudo -u postgres psql -Atqc "SHOW port;" | tr -d '[:space:]')"
  PG_PORT="${PG_PORT:-5432}"
  PG_MODE="peer-hrms-db"
}

setup_db_new_cluster() {
  echo ">> 5432 bận và không peer được. Cụm Postgres riêng cho Sổ Nhân."
  apt-get install -y -qq postgresql postgresql-contrib
  PG_PORT="$(first_free 5433 5434 55432)"
  local ver
  ver="$(psql --version | grep -oE '[0-9]+' | head -1)"
  if ! pg_lsclusters | awk '{print $1,$2,$3}' | grep -q "sonhan"; then
    pg_createcluster "${ver}" sonhan --port="${PG_PORT}" --start
  else
    pg_ctlcluster "${ver}" sonhan start || true
    PG_PORT="$(pg_lsclusters | awk '$2=="sonhan"{print $3}')"
  fi
  sudo -u postgres env PGPORT="${PG_PORT}" psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hrms') THEN
    CREATE ROLE hrms LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE hrms WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE hrms OWNER hrms'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hrms')\\gexec
GRANT ALL PRIVILEGES ON DATABASE hrms TO hrms;
SQL
  PG_MODE="cluster-sonhan:${PG_PORT}"
}

if can_peer; then
  setup_db_peer
elif port_busy 5432; then
  setup_db_new_cluster
else
  echo ">> Cài PostgreSQL vì chưa có."
  apt-get install -y -qq postgresql postgresql-contrib
  pg_lsclusters | awk 'NR>1 && $4=="down"{system("pg_ctlcluster "$1" "$2" start")}'
  sleep 1
  setup_db_peer
fi

HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
HOST_IP="${HOST_IP:-127.0.0.1}"
DATABASE_URL="postgresql://hrms:${DB_PASS}@${PG_HOST}:${PG_PORT}/hrms"

umask 077
cat > /etc/so-nhan/so-nhan.env <<EOF
DATABASE_URL=${DATABASE_URL}
PORT=${API_PORT}
BIND_HOST=127.0.0.1
WEB_ORIGIN=http://${HOST_IP}:${WEB_PORT}
API_INTERNAL_URL=http://127.0.0.1:${API_PORT}
WEB_PORT=${WEB_PORT}
NODE_ENV=production
EOF
chmod 600 /etc/so-nhan/so-nhan.env
cp /etc/so-nhan/so-nhan.env "${REPO_DIR}/apps/api/.env"
chown sonhan:sonhan "${REPO_DIR}/apps/api/.env" 2>/dev/null || true

echo ">> npm ci (có thể vài phút)"
cd "${REPO_DIR}"
npm ci
npm test

echo ">> Prisma đồng bộ schema (không seed trừ khi --seed)"
cd "${REPO_DIR}/apps/api"
npx prisma generate
npx prisma db push
if [[ ${SEED} -eq 1 ]]; then
  echo "  --seed: xóa dữ liệu HRMS rồi nạp demo"
  npx tsx prisma/seed.ts
else
  echo "  Bỏ seed. Muốn demo: sudo bash deploy/cai-dat-vps.sh --seed"
fi

echo ">> Build web"
cd "${REPO_DIR}/apps/web"
npx next build

chown -R sonhan:sonhan "${REPO_DIR}"

NPX="$(command -v npx)"
NODE="$(command -v node)"

cat > /etc/systemd/system/so-nhan-api.service <<EOF
[Unit]
Description=So Nhan API
After=network.target postgresql.service
[Service]
Type=simple
User=sonhan
WorkingDirectory=${REPO_DIR}/apps/api
EnvironmentFile=/etc/so-nhan/so-nhan.env
ExecStart=${NPX} tsx src/main.ts
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/so-nhan-worker.service <<EOF
[Unit]
Description=So Nhan worker luong
After=so-nhan-api.service
[Service]
Type=simple
User=sonhan
WorkingDirectory=${REPO_DIR}/apps/api
EnvironmentFile=/etc/so-nhan/so-nhan.env
ExecStart=${NPX} tsx src/worker.ts
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/so-nhan-web.service <<EOF
[Unit]
Description=So Nhan web
After=so-nhan-api.service
[Service]
Type=simple
User=sonhan
WorkingDirectory=${REPO_DIR}/apps/web
EnvironmentFile=/etc/so-nhan/so-nhan.env
Environment=PORT=${WEB_PORT}
ExecStart=${NPX} next start -H 0.0.0.0 -p ${WEB_PORT}
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now so-nhan-api so-nhan-worker so-nhan-web

sleep 2
API_OK="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${API_PORT}/api/health" || true)"
WEB_OK="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${WEB_PORT}/login" || true)"

if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow "${WEB_PORT}/tcp" comment "So Nhan web" || true
  echo "  UFW đã mở ${WEB_PORT}. Không mở 5432 hay ${API_PORT} ra internet."
fi

echo
echo "===== XONG ====="
echo "Postgres : cổng ${PG_PORT}  chế độ ${PG_MODE}  database hrms (không đụng DB khác)"
echo "API      : 127.0.0.1:${API_PORT}  health=${API_OK}  (không public)"
echo "Web      : http://${HOST_IP}:${WEB_PORT}  http=${WEB_OK}"
if [[ "${WEB_PORT}" != "3000" ]]; then
  echo "Cổng 3000 giữ cho bao_cao_tuan / dịch vụ cũ. Sổ Nhân chạy ${WEB_PORT}."
fi
echo "Bí mật   : /etc/so-nhan/so-nhan.env"
echo "Log cài  : ${LOG}"
echo "Lệnh     : systemctl status so-nhan-web so-nhan-api so-nhan-worker"
echo "Tắt      : systemctl stop so-nhan-web so-nhan-api so-nhan-worker"
if [[ ${SEED} -eq 1 ]]; then
  echo "Demo     : admin@sonhan.vn  mật khẩu Sonhan@2026 — đổi ngay."
fi
echo "Sổ tay   : ${REPO_DIR}/docs/van-hanh.md"
