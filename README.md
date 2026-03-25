# Desk Portal Starter

`데스크포털`을 GitHub 원본 구조로 이주하기 위한 작업용 스타터입니다.

## 추천 운영 원칙

1. GitHub repo를 원본으로 사용합니다.
2. Apps Script에 배포할 파일은 `apps-script/payroll/Code.gs`, `apps-script/payroll/Index.html`로 관리합니다.
3. 현재처럼 Google Apps Script 편집기에서 직접 붙여넣어 반영할 수 있습니다.
4. 나중에 필요하면 `clasp`를 연결해 `push` 배포로 전환합니다.

## 폴더 구조

```text
desk-portal/
  apps-script/
    payroll/
      Code.gs
      Index.html
  scripts/
    sync_from_canonical.sh
    sync_to_canonical.sh
  .gitignore
  README.md
```

## 현재 기준 파일

- canonical server:
  `/Users/anjongseong/Documents/프로그램/에스에듀 개발/payroll/code.gs`
- canonical frontend:
  `/Users/anjongseong/Documents/프로그램/에스에듀 개발/payroll/payroll_portal.html`

## 권장 이주 순서

1. 이 폴더를 별도 위치의 새 repo로 복사합니다.
2. `git init` 후 첫 커밋을 만듭니다.
3. GitHub 원격 저장소를 연결합니다.
4. 이후 수정은 `apps-script/payroll/Code.gs`, `Index.html`만 기준으로 진행합니다.
5. Apps Script 편집기 반영이 필요할 때 `scripts/sync_to_canonical.sh` 또는 수동 복사로 반영합니다.

## 첫 GitHub 업로드 예시

```bash
cd ~/Documents
cp -R "/Users/anjongseong/Documents/New project/desk-portal-starter" desk-portal
cd desk-portal

git init
git add .
git commit -m "Initial import of desk portal payroll app"

git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## 이후 작업 흐름

### 1. canonical -> repo 복사

```bash
bash scripts/sync_from_canonical.sh
```

### 2. repo 수정

- `apps-script/payroll/Code.gs`
- `apps-script/payroll/Index.html`

### 3. repo -> canonical 반영

```bash
bash scripts/sync_to_canonical.sh
```

### 4. GAS 편집기 반영

- `Code.gs` 내용 붙여넣기
- `Index.html` 내용 붙여넣기
- 저장
- 웹앱 새 버전 배포가 필요하면 새 배포 실행

## 나중에 clasp를 붙일 때

실제 운영 GAS 프로젝트 폴더에 아래 파일을 두는 구조를 추천합니다.

```text
desk-portal/
  apps-script/
    payroll/
      .clasp.json
      appsscript.json
      Code.gs
      Index.html
```

그 뒤에는 보통 아래 순서로 진행합니다.

```bash
clasp status
clasp push
clasp deployments
```

현재는 payroll을 GAS 편집기에서 직접 반영하고 있으므로, 우선은 GitHub 원본화부터 하는 것이 가장 안전합니다.
