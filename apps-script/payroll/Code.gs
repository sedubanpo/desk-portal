/** Retired Apps Script endpoint. Business requests use the authenticated Cloud Run API. */
const DESK_PORTAL_URL = 'https://sedubanpo.github.io/desk-portal/';

function retiredResponse_() {
  return ContentService.createTextOutput(JSON.stringify({
    ok: false,
    error: 'legacy_retired',
    message: '이전 데스크 포털 API는 종료되었습니다. 데스크 포털에서 로그인해 주세요.',
    portalUrl: DESK_PORTAL_URL
  })).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const params = e && e.parameter || {};
  if (params.mode === 'api') return retiredResponse_();
  return HtmlService.createHtmlOutputFromFile('payroll_portal')
    .setTitle('데스크 포털 이전 안내');
}

function doPost() {
  return retiredResponse_();
}
