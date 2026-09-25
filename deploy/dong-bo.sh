#!/usr/bin/env bash
# VPS tự kéo GitHub rồi build lại. Không seed. Không đụng cổng 3000 / Postgres khác.
# Cài timer: sudo bash deploy/cai-dat-vps.sh   (một lần)
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  exec sudo bash "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG="/var/log/so-nhan-dong-bo.log"
mkdir -p /var/log
exec >>"${LOG}" 2>&1
echo "===== $(date -Iseconds) ====="

APP_USER="$(systemctl show -p User --value so-nhan-web 2>/dev/null || true)"
if [[ -z "${APP_USER}" || "${APP_USER}" == "root" ]]; then
  APP_USER="$(stat -c %U "${REPO_DIR}" 2>/dev/null || echo bvqy4)"
fi

chown -R "${APP_USER}:${APP_USER}" "${REPO_DIR}/.git" "${REPO_DIR}" 2>/dev/null || true
sudo -u "${APP_USER}" git config --global --add safe.directory "${REPO_DIR}" 2>/dev/null || true

cd "${REPO_DIR}"
sudo -u "${APP_USER}" git fetch origin
LOCAL="$(sudo -u "${APP_USER}" git rev-parse HEAD)"
REMOTE="$(sudo -u "${APP_USER}" git rev-parse origin/main 2>/dev/null || true)"
if [[ -z "${REMOTE}" ]]; then
  echo "Không thấy origin/main"
  exit 1
fi
if [[ "${LOCAL}" == "${REMOTE}" ]]; then
  echo "Đã mới ${LOCAL:0:7}. Không build lại."
  exit 0
fi

echo "Cập nhật ${LOCAL:0:7} → ${REMOTE:0:7}"
sudo -u "${APP_USER}" git reset --hard origin/main
sudo -u "${APP_USER}" git clean -fd -e node_modules -e .next -e apps/web/.next -e apps/api/.env -e .env

echo ">> npm ci"
sudo -u "${APP_USER}" -H npm ci
echo ">> Prisma"
cd "${REPO_DIR}/apps/api"
sudo -u "${APP_USER}" -H npx prisma generate
sudo -u "${APP_USER}" -H npx prisma db push
echo ">> Build web"
cd "${REPO_DIR}/apps/web"
sudo -u "${APP_USER}" -H npx next build

systemctl restart so-nhan-api so-nhan-worker so-nhan-web
sleep 3
echo "api=$(systemctl is-active so-nhan-api) web=$(systemctl is-active so-nhan-web) worker=$(systemctl is-active so-nhan-worker)"
echo "XONG ${REMOTE:0:7}"
