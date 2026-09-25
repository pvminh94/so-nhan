#!/usr/bin/env bash
# Cài Sổ Nhân trên Ubuntu Server, không đụng dự án đang chiếm cổng.
# bao_cao_tuan giữ 3000 + Postgres thì script tránh / dùng lại database riêng.
#
#   sudo bash deploy/cai-dat-vps.sh
#   sudo bash deploy/cai-dat-vps.sh --seed
#   sudo bash deploy/cai-dat-vps.sh --fix     # chỉ sửa systemd + khởi động lại
set -euo pipefail

WEB_WANT="${WEB_WANT:-3000}"
API_WANT="${API_WANT:-4000}"
SEED=0
FIX=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed) SEED=1; shift ;;
    --fix) FIX=1; shift ;;
    --web-port) WEB_WANT="$2"; shift 2 ;;
    --api-port) API_WANT="$2"; shift 2 ;;
    -h|--help)
      echo "sudo bash deploy/cai-dat-vps.sh [--seed] [--fix] [--web-port N] [--api-port N]"
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
  echo "Không thấy repo Sổ Nhân. Chạy trong thư mục git clone."
  exit 1
fi

APP_USER="${SUDO_USER:-}"
if [[ -z "${APP_USER}" || "${APP_USER}" == "root" ]]; then
  APP_USER="sonhan"
  id sonhan >/dev/null 2>&1 || useradd --system --home /var/lib/so-nhan --shell /usr/sbin/nologin sonhan
  mkdir -p /var/lib/so-nhan
  chown sonhan:sonhan /var/lib/so-nhan
fi
APP_HOME="$(getent passwd "${APP_USER}" | cut -d: -f6)"
APP_HOME="${APP_HOME:-/var/lib/so-nhan}"
mkdir -p "${APP_HOME}"

# Lần cài cũ chown sonhan cả ~/so-nhan → git pull bị Permission denied. Trả về user đang cài.
if [[ "${APP_USER}" != "root" ]]; then
  echo ">> Trả quyền repo cho ${APP_USER} (không để sonhan giữ .git)"
  chown -R "${APP_USER}:${APP_USER}" "${REPO_DIR}"
  sudo -u "${APP_USER}" git config --global --add safe.directory "${REPO_DIR}" 2>/dev/null || true
fi

LOG="/var/log/so-nhan-cai-dat.log"
mkdir -p /var/log /etc/so-nhan
exec > >(tee -a "${LOG}") 2>&1
echo "===== $(date -Iseconds) user=${APP_USER} repo=${REPO_DIR} ====="

port_busy() {
  ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE ":${1}$"
}

port_who() {
  ss -tlnp 2>/dev/null | awk -v p=":${1}" '$4 ~ p"$" {print; found=1} END {if (!found) print "không rõ tiến trình"}'
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
  echo "Không còn cổng trống: $*" >&2
  exit 1
}

echo ">> Kiểm tra cổng"
if port_busy 3000; then
  echo "  3000 đang chạy — giữ nguyên (bao_cao_tuan)."
  port_who 3000 | sed 's/^/    /'
fi
if port_busy 5432; then
  echo "  5432 đang chạy — không cài đè Postgres."
  port_who 5432 | sed 's/^/    /'
fi

if port_busy "${WEB_WANT}"; then
  WEB_PORT="$(first_free 3001 3002 3080 8080 3010)"
else
  WEB_PORT="${WEB_WANT}"
fi
if port_busy "${API_WANT}"; then
  API_PORT="$(first_free 4001 4010 4100 8081)"
else
  API_PORT="${API_WANT}"
fi
echo "  Web → ${WEB_PORT}   API → ${API_PORT} (chỉ 127.0.0.1)"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg build-essential python3 openssl

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
NODE="$(command -v node)"
echo "  Node $(node -v)"

can_peer() {
  command -v psql >/dev/null 2>&1 && id postgres >/dev/null 2>&1 && sudo -u postgres psql -Atqc 'select 1' >/dev/null 2>&1
}

ensure_hba_tcp() {
  local port="$1"
  local hba
  hba="$(sudo -u postgres psql -Atqc 'SHOW hba_file;' | tr -d '[:space:]')"
  if [[ -n "${hba}" && -f "${hba}" ]] && ! grep -qE '^host[[:space:]]+hrms[[:space:]]+hrms' "${hba}"; then
    echo "host hrms hrms 127.0.0.1/32 scram-sha-256" >> "${hba}"
    echo "host hrms hrms ::1/128 scram-sha-256" >> "${hba}"
    sudo -u postgres psql -c "SELECT pg_reload_conf();" >/dev/null || true
  fi
  echo "  pg_hba TCP cho role hrms trên cổng ${port}"
}

create_hrms_db() {
  local extra=( )
  [[ -n "${1:-}" ]] && extra+=( -p "$1" )
  sudo -u postgres env PGPORT="${1:-}" psql "${extra[@]}" -v ON_ERROR_STOP=1 <<SQL
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
}

DB_PASS=""
if [[ -f /etc/so-nhan/so-nhan.env ]]; then
  DB_PASS="$(sed -n 's|^DATABASE_URL=postgresql://hrms:\([^@]*\)@.*|\1|p' /etc/so-nhan/so-nhan.env | head -1)"
fi
[[ -n "${DB_PASS}" ]] || DB_PASS="$(openssl rand -base64 18 | tr -d '/+=' | head -c 24)"

PG_HOST="127.0.0.1"
PG_PORT="5432"
PG_MODE=""

if can_peer; then
  echo ">> Dùng Postgres hiện có (peer). Database hrms riêng."
  PG_PORT="$(sudo -u postgres psql -Atqc 'SHOW port;' | tr -d '[:space:]')"
  PG_PORT="${PG_PORT:-5432}"
  create_hrms_db "${PG_PORT}"
  ensure_hba_tcp "${PG_PORT}"
  PG_MODE="peer-hrms-db:${PG_PORT}"
elif port_busy 5432; then
  echo ">> 5432 bận, không peer được. Cụm Postgres riêng."
  apt-get install -y -qq postgresql postgresql-contrib
  PG_PORT="$(first_free 5433 5434 55432)"
  VER="$(psql --version | grep -oE '[0-9]+' | head -1)"
  if ! pg_lsclusters | awk '{print $2}' | grep -qx sonhan; then
    pg_createcluster "${VER}" sonhan --port="${PG_PORT}" --start
  else
    pg_ctlcluster "${VER}" sonhan start || true
    PG_PORT="$(pg_lsclusters | awk '$2=="sonhan"{print $3; exit}')"
  fi
  create_hrms_db "${PG_PORT}"
  ensure_hba_tcp "${PG_PORT}"
  PG_MODE="cluster-sonhan:${PG_PORT}"
else
  echo ">> Cài PostgreSQL."
  apt-get install -y -qq postgresql postgresql-contrib
  pg_lsclusters | awk 'NR>1 && $4=="down"{system("pg_ctlcluster "$1" "$2" start")}'
  sleep 1
  PG_PORT="$(sudo -u postgres psql -Atqc 'SHOW port;' | tr -d '[:space:]')"
  PG_PORT="${PG_PORT:-5432}"
  create_hrms_db "${PG_PORT}"
  ensure_hba_tcp "${PG_PORT}"
  PG_MODE="moi:${PG_PORT}"
fi

if ! PGPASSWORD="${DB_PASS}" psql -h 127.0.0.1 -p "${PG_PORT}" -U hrms -d hrms -Atqc 'select 1' >/dev/null 2>&1; then
  echo "Không kết nối được hrms@127.0.0.1:${PG_PORT}. Kiểm tra pg_hba và listen_addresses."
  exit 1
fi
echo "  TCP hrms@127.0.0.1:${PG_PORT} OK"

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
HOME=${APP_HOME}
NPM_CONFIG_CACHE=${APP_HOME}/.npm
PATH=/usr/local/bin:/usr/bin:/bin:${REPO_DIR}/node_modules/.bin
EOF
chmod 640 /etc/so-nhan/so-nhan.env
chown root:"${APP_USER}" /etc/so-nhan/so-nhan.env
cp /etc/so-nhan/so-nhan.env "${REPO_DIR}/apps/api/.env"
chown "${APP_USER}:${APP_USER}" "${REPO_DIR}/apps/api/.env"

if [[ ${FIX} -eq 0 ]]; then
  echo ">> npm ci"
  cd "${REPO_DIR}"
  sudo -u "${APP_USER}" -H npm ci
  sudo -u "${APP_USER}" -H npm test
  echo ">> Prisma"
  cd "${REPO_DIR}/apps/api"
  sudo -u "${APP_USER}" -H npx prisma generate
  sudo -u "${APP_USER}" -H npx prisma db push
  if [[ ${SEED} -eq 1 ]]; then
    echo "  --seed: xóa dữ liệu HRMS rồi nạp demo"
    sudo -u "${APP_USER}" -H npx tsx prisma/seed.ts
  else
    echo "  Bỏ seed. Demo: sudo bash deploy/cai-dat-vps.sh --seed"
  fi
fi

echo ">> Prisma generate + db push"
cd "${REPO_DIR}/apps/api"
sudo -u "${APP_USER}" -H npx prisma generate
sudo -u "${APP_USER}" -H npx prisma db push
echo ">> Build web"
cd "${REPO_DIR}/apps/web"
sudo -u "${APP_USER}" -H npx next build

TSX="${REPO_DIR}/node_modules/tsx/dist/cli.mjs"
[[ -f "${TSX}" ]] || TSX="${REPO_DIR}/apps/api/node_modules/tsx/dist/cli.mjs"
NEXT="${REPO_DIR}/node_modules/next/dist/bin/next"
[[ -f "${NEXT}" ]] || NEXT="${REPO_DIR}/apps/web/node_modules/next/dist/bin/next"
if [[ ! -f "${TSX}" ]]; then
  echo "Thiếu tsx. Chạy lại KHÔNG có --fix: sudo bash deploy/cai-dat-vps.sh"
  exit 1
fi
if [[ ! -f "${NEXT}" ]]; then
  echo "Thiếu next."
  exit 1
fi
if [[ ! -d "${REPO_DIR}/apps/web/.next" ]]; then
  echo "Chưa có apps/web/.next — build lại."
  cd "${REPO_DIR}/apps/web"
  sudo -u "${APP_USER}" -H npx next build
fi

echo ">> Chạy thử API 8 giây (bắt lỗi thật, không qua systemd)"
set +e
timeout 12s sudo -u "${APP_USER}" -H bash -c "set -a; . /etc/so-nhan/so-nhan.env; set +a; cd '${REPO_DIR}/apps/api'; '${NODE}' '${TSX}' src/main.ts" > /tmp/so-nhan-api-try.log 2>&1
TRY=$?
set -e
echo "--- /tmp/so-nhan-api-try.log (exit ${TRY}) ---"
tail -n 40 /tmp/so-nhan-api-try.log || true
if ! grep -q "successfully started\|Nest application" /tmp/so-nhan-api-try.log; then
  echo "API không start được khi chạy tay. Sửa lỗi trên rồi chạy lại."
  echo "Gợi ý: sudo -u ${APP_USER} -H bash -c 'cd ${REPO_DIR}/apps/api && npx prisma generate'"
  exit 1
fi
echo "  API chạy tay được. Viết systemd…"

write_unit() {
  local name="$1" dir="$2"
  shift 2
  cat > "/etc/systemd/system/${name}.service" <<EOF
[Unit]
Description=${name}
After=network.target
[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${dir}
EnvironmentFile=/etc/so-nhan/so-nhan.env
ExecStart=${NODE} $*
Restart=on-failure
RestartSec=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${name}
[Install]
WantedBy=multi-user.target
EOF
}

write_unit so-nhan-api "${REPO_DIR}/apps/api" "${TSX}" src/main.ts
write_unit so-nhan-worker "${REPO_DIR}/apps/api" "${TSX}" src/worker.ts
write_unit so-nhan-web "${REPO_DIR}/apps/web" "${NEXT}" start -H 0.0.0.0 -p "${WEB_PORT}"
sed -i "/EnvironmentFile=/a Environment=HOSTNAME=0.0.0.0\\nEnvironment=PORT=${WEB_PORT}" /etc/systemd/system/so-nhan-web.service

systemctl daemon-reload
systemctl reset-failed so-nhan-api so-nhan-worker so-nhan-web 2>/dev/null || true
systemctl enable so-nhan-api so-nhan-worker so-nhan-web
systemctl restart so-nhan-api so-nhan-worker so-nhan-web
sleep 2
echo "  api=$(systemctl is-active so-nhan-api) web=$(systemctl is-active so-nhan-web) worker=$(systemctl is-active so-nhan-worker)"

echo ">> Chờ health"
API_OK="000"
WEB_OK="000"
for _ in $(seq 1 15); do
  API_OK="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${API_PORT}/api/health" 2>/dev/null || echo 000)"
  WEB_OK="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${WEB_PORT}/login" 2>/dev/null || echo 000)"
  if [[ "${API_OK}" == "200" && "${WEB_OK}" =~ ^(200|307|308)$ ]]; then
    break
  fi
  sleep 1
done

if [[ "${API_OK}" != "200" || ! "${WEB_OK}" =~ ^(200|307|308)$ ]]; then
  echo
  echo "===== LỖI: systemd chưa nghe cổng ====="
  echo "API health=${API_OK}  Web http=${WEB_OK}  active api=$(systemctl is-active so-nhan-api) web=$(systemctl is-active so-nhan-web)"
  echo "--- journal so-nhan-api ---"
  journalctl -u so-nhan-api -n 50 --no-pager || true
  echo "--- journal so-nhan-web ---"
  journalctl -u so-nhan-web -n 50 --no-pager || true
  echo "Chạy tay: sudo systemctl status so-nhan-api so-nhan-web --no-pager"
  exit 1
fi

if command -v ufw >/dev/null 2>&1; then
  ufw allow "${WEB_PORT}/tcp" comment "So Nhan web" || true
fi

echo
echo "===== XONG ====="
echo "Mở trình duyệt ĐÚNG địa chỉ này (có cổng ${WEB_PORT}, không phải 80, không phải 3000):"
echo
echo "    http://${HOST_IP}:${WEB_PORT}"
echo
echo "User     : ${APP_USER}"
echo "Postgres : ${PG_MODE}  database hrms"
echo "API      : chỉ 127.0.0.1:${API_PORT} — không mở trên LAN, web proxy hộ"
echo "Web bind : 0.0.0.0:${WEB_PORT}  health=${WEB_OK}"
if [[ "${WEB_PORT}" != "3000" ]]; then
  echo "Cổng 3000 vẫn là bao_cao_tuan. Sổ Nhân là ${WEB_PORT}."
fi
echo "Bí mật   : /etc/so-nhan/so-nhan.env"
echo "Firewall : sudo ufw allow ${WEB_PORT}/tcp"
echo "Kiểm tra : ss -tlnp | grep ${WEB_PORT}"
if [[ ${SEED} -eq 1 ]]; then
  echo "Demo     : admin@sonhan.vn  /  Sonhan@2026"
fi
echo "Sổ tay   : ${REPO_DIR}/docs/van-hanh.md"
