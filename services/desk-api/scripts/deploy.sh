#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${1:-}}"
REGION="${CLOUD_RUN_REGION:-asia-northeast3}"
SERVICE="${CLOUD_RUN_SERVICE:-desk-portal-api}"
FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-${PROJECT_ID}}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://sedubanpo.github.io}"
RUNTIME_SERVICE_ACCOUNT_NAME="${RUNTIME_SERVICE_ACCOUNT_NAME:-desk-portal-api-runtime}"
BUILD_SERVICE_ACCOUNT_NAME="${BUILD_SERVICE_ACCOUNT_NAME:-desk-portal-api-build}"
LEGACY_RTDB_PROJECT_ID="${LEGACY_RTDB_PROJECT_ID:-sedu-portal}"
LEGACY_RTDB_URL="${LEGACY_RTDB_URL:-https://sedu-portal-default-rtdb.firebaseio.com}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "GOOGLE_CLOUD_PROJECT 또는 첫 번째 인자로 프로젝트 ID를 지정하세요." >&2
  exit 2
fi

RUNTIME_SERVICE_ACCOUNT="${RUNTIME_SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
BUILD_SERVICE_ACCOUNT="${BUILD_SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com \
  identitytoolkit.googleapis.com \
  sheets.googleapis.com \
  calendar-json.googleapis.com \
  --project "${PROJECT_ID}" \
  --quiet

gcloud services enable firestore.googleapis.com \
  --project "${FIREBASE_PROJECT_ID}" \
  --quiet

if ! gcloud iam service-accounts describe "${RUNTIME_SERVICE_ACCOUNT}" \
  --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${RUNTIME_SERVICE_ACCOUNT_NAME}" \
    --project "${PROJECT_ID}" \
    --display-name "Desk Portal Cloud Run API" \
    --quiet
fi

if ! gcloud iam service-accounts describe "${BUILD_SERVICE_ACCOUNT}" \
  --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${BUILD_SERVICE_ACCOUNT_NAME}" \
    --project "${PROJECT_ID}" \
    --display-name "Desk Portal Cloud Run Builder" \
    --quiet
fi

for attempt in {1..12}; do
  if gcloud iam service-accounts describe "${RUNTIME_SERVICE_ACCOUNT}" \
    --project "${PROJECT_ID}" >/dev/null 2>&1 && \
    gcloud iam service-accounts describe "${BUILD_SERVICE_ACCOUNT}" \
      --project "${PROJECT_ID}" >/dev/null 2>&1; then
    break
  fi
  if [[ "${attempt}" -eq 12 ]]; then
    echo "런타임 서비스 계정이 IAM에 전파되지 않았습니다." >&2
    exit 1
  fi
  sleep 5
done

for attempt in {1..6}; do
  if gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SERVICE_ACCOUNT}" \
    --project "${PROJECT_ID}" \
    --member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
    --role roles/iam.serviceAccountTokenCreator \
    --condition=None \
    --quiet >/dev/null; then
    break
  fi
  if [[ "${attempt}" -eq 6 ]]; then
    echo "런타임 서비스 계정의 Workspace 토큰 발급 권한을 설정하지 못했습니다." >&2
    exit 1
  fi
  sleep 5
done

for attempt in {1..6}; do
  if gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${BUILD_SERVICE_ACCOUNT}" \
    --role roles/run.builder \
    --condition=None \
    --quiet >/dev/null; then
    break
  fi
  if [[ "${attempt}" -eq 6 ]]; then
    echo "빌드 서비스 계정에 Cloud Run Builder 역할을 부여하지 못했습니다." >&2
    exit 1
  fi
  sleep 5
done

for attempt in {1..6}; do
  if gcloud projects add-iam-policy-binding "${LEGACY_RTDB_PROJECT_ID}" \
    --member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
    --role roles/firebasedatabase.admin \
    --condition=None \
    --quiet >/dev/null; then
    break
  fi
  if [[ "${attempt}" -eq 6 ]]; then
    echo "런타임 서비스 계정에 Realtime Database 역할을 부여하지 못했습니다." >&2
    exit 1
  fi
  sleep 5
done

for attempt in {1..6}; do
  if gcloud projects add-iam-policy-binding "${FIREBASE_PROJECT_ID}" \
    --member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
    --role roles/datastore.user \
    --condition=None \
    --quiet >/dev/null; then
    break
  fi
  if [[ "${attempt}" -eq 6 ]]; then
    echo "런타임 서비스 계정에 Firestore 역할을 부여하지 못했습니다." >&2
    exit 1
  fi
  sleep 5
done

for attempt in {1..6}; do
  if gcloud projects add-iam-policy-binding "${FIREBASE_PROJECT_ID}" \
    --member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
    --role roles/firebaseauth.viewer \
    --condition=None \
    --quiet >/dev/null; then
    break
  fi
  if [[ "${attempt}" -eq 6 ]]; then
    echo "런타임 서비스 계정에 Firebase Authentication 조회 역할을 부여하지 못했습니다." >&2
    exit 1
  fi
  sleep 5
done

gcloud run deploy "${SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --source "${ROOT_DIR}" \
  --build-service-account "projects/${PROJECT_ID}/serviceAccounts/${BUILD_SERVICE_ACCOUNT}" \
  --allow-unauthenticated \
  --ingress all \
  --service-account "${RUNTIME_SERVICE_ACCOUNT}" \
  --execution-environment gen2 \
  --cpu 1 \
  --memory 512Mi \
  --concurrency 40 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 30s \
  --set-env-vars "^|^NODE_ENV=production|FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}|LEGACY_RTDB_URL=${LEGACY_RTDB_URL}|ALLOWED_ORIGINS=${ALLOWED_ORIGINS}|CHECK_REVOKED_TOKENS=true|PAYROLL_SPREADSHEET_ID=1RelndJgXn0yMNSg41Pyy1yDV6zjehG2ljMuue5pod1E|DESK_CALENDAR_ID=1c960de1d4c701250e80f19416579958fc3e58d3b04effe3678a6b8643b0acbd@group.calendar.google.com|GOOGLE_WORKSPACE_SERVICE_ACCOUNT=${RUNTIME_SERVICE_ACCOUNT}" \
  --quiet

SERVICE_URL="$(gcloud run services describe "${SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format='value(status.url)')"

curl --fail --silent --show-error "${SERVICE_URL}/health"
printf '\n%s\n' "${SERVICE_URL}"
