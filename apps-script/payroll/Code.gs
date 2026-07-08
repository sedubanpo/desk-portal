// [1] 구글 스프레드시트 ID
const TEACHER_SS_ID = '1ByPeH0bZZrZDvW_yPkCpQCIuk724_Gt7uudUj_Ue8Ho'; 
const ATTENDANCE_SS_ID = '1LukDneQLlU_F4s12V33z7gyhfIpZa47JVawKPY8xCfY'; 
const PAYROLL_SS_ID = '1RelndJgXn0yMNSg41Pyy1yDV6zjehG2ljMuue5pod1E';
const SEDU_LOGO_URL = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Cdefs%3E%3ClinearGradient id=%22g%22 x1=%220%22 y1=%220%22 x2=%221%22 y2=%221%22%3E%3Cstop offset=%220%25%22 stop-color=%2216a34a%22/%3E%3Cstop offset=%22100%25%22 stop-color=%220f766e%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x=%224%22 y=%224%22 width=%2256%22 height=%2256%22 rx=%2214%22 fill=%22url(%23g)%22/%3E%3Cpath d=%22M43 18h-9.3c-7.9 0-14.3 5.6-14.3 12.5 0 6 4.8 10.6 12.5 12.2l5.8 1.2c2.9.6 4.5 2.1 4.5 4.1 0 2.6-2.7 4.5-6.4 4.5H20.5v-6.6h14.6c1.9 0 3.2-.8 3.2-2.1 0-1-.8-1.8-2.3-2.1L30 40.4c-8.6-1.9-13.7-7-13.7-13.8C16.3 16.9 24 10.5 33.6 10.5H43V18z%22 fill=%22%23ffffff%22/%3E%3C/svg%3E';
const PAYROLL_CACHE_SCHEMA_VERSION = "v12";
const PAYROLL_TEACHER_SETTINGS_PROP = "PAYROLL_TEACHER_SETTINGS_V1";
const PAYROLL_SUSPICION_SETTINGS_KEY = "__suspicionRules";
const TUITION_FOLLOWUP_SHEET_NAME = "수강료_관리";
const TUITION_CONTACT_LOG_SHEET_NAME = "수강료_연락로그";
const TUITION_PORTAL_PAYMENT_SHEET_NAME = "수강료_포털수납";
const TUITION_FOLLOWUP_FIRESTORE_COLLECTION = "tuitionFollowups";
const TUITION_CONTACT_LOG_FIRESTORE_COLLECTION = "tuitionContactLogs";
const TUITION_PAYMENT_FIRESTORE_COLLECTION = "tuitionPayments";
const TUITION_FOLLOWUP_META_FIRESTORE_COLLECTION = "tuitionFollowupMeta";
const TUITION_PAYMENT_META_FIRESTORE_COLLECTION = "tuitionPaymentMeta";
const TUITION_STATUS_HISTORY_FIRESTORE_COLLECTION = "tuitionStatusChanges";
const TUITION_GUIDE_AMOUNT_HISTORY_FIRESTORE_COLLECTION = "tuitionGuideAmountChanges";
const TUITION_MONTH_SNAPSHOT_FIRESTORE_COLLECTION = "tuitionMonthSnapshots";
const TUITION_MONTH_CHARGE_FIRESTORE_COLLECTION = "tuitionMonthCharges";
const TUITION_MONTH_CHARGE_META_FIRESTORE_COLLECTION = "tuitionMonthChargeMeta";
const TUITION_MONTH_SNAPSHOT_SCHEMA_VERSION = "v3";
const TUITION_MONTH_NAMES_CACHE_KEY = "TUITION_MONTH_NAMES_V1";
const TUITION_MONTH_NAMES_CACHE_TTL_SECONDS = 180;
const TUITION_MONTH_SUMMARY_CACHE_PREFIX = "TUITION_MONTH_SUMMARY_V3_";
const TUITION_MONTH_SUMMARY_CACHE_TTL_SECONDS = 90;
const TUITION_SHEET_MIRROR_WRITES_PROP = "TUITION_SHEET_MIRROR_WRITES_ENABLED";
const DESK_SCHEDULE_ROOT_PATH = "desk_portal/monthly_schedule";
const DESK_DAILY_JOURNAL_ROOT_PATH = "desk_portal/daily_journal";
const DESK_DAILY_PENDING_TASKS_ROOT_PATH = "desk_portal/daily_pending_tasks";
const DESK_SUPPLIES_ROOT_PATH = "desk_portal/supplies";
const DESK_RECRUITING_ROOT_PATH = "desk_portal/hr_recruiting/applicants";
const DESK_REPORT_CALENDAR_ID = "1c960de1d4c701250e80f19416579958fc3e58d3b04effe3678a6b8643b0acbd@group.calendar.google.com";
const DESK_REPORT_CALENDAR_ID_PROP = "DESK_REPORT_CALENDAR_ID";
const DESK_REPORT_CALENDAR_ICS_BASE_URL = "https://calendar.google.com/calendar/ical/";
const DESK_IMPORTANT_CATEGORY_PREFIX = "__important__::";
const DESK_SHARED_CATEGORY_PREFIX = "__shared__::";
const DESK_SHARED_WORKER_NAME = "공동업무";
const DESK_RETIRED_SCHEDULE_WORKERS = ["인유빈", "유지연", "이창연"];
const DESK_HR_STATUSES = ["이력서 검토", "추천", "면접 조율", "면접 진행", "합격 안내", "불합격 안내"];
const DESK_HR_STATUS_ALIASES = {
  "미연락": "이력서 검토",
  "1차 연락": "추천",
  "재연락 필요": "면접 조율",
  "면접 조율중": "면접 조율",
  "면접 확정": "면접 진행",
  "종료": "불합격 안내"
};
const DESK_HR_REVIEW_DECISIONS = ["검토중", "추천", "보류", "제외"];

// [2] Firebase 설정
const FB_URL = "https://sedu-portal-default-rtdb.firebaseio.com/";
const FB_SECRET = "oMxZXZl73LPJ4cpGoo5pM1SHyhsmlqlXiBqyhOa3";
const PAYROLL_API_TOKEN_TTL_SECONDS = 60 * 60 * 8;
const PAYROLL_PORTAL_TOKEN_PREFIX = "desk_portal_portal_token:";
const PAYROLL_PRIVILEGED_TOKEN_PREFIX = "desk_portal_privileged_token:";
const PAYROLL_API_ALLOWED_METHODS = {
  getPayrollBootstrapData: true,
  getTuitionBootstrapData: true,
  getTuitionMonthSummary: true,
  getTuitionStudentMonthlyHistory: true,
  getTuitionGuideDashboard: true,
  getTuitionMonthlySalesOverview: true,
  backfillTuitionMonthSnapshots: true,
  backfillTuitionPaymentsToFirestore: true,
  backfillTuitionFollowupsToFirestore: true,
  backfillTuitionMonthChargesToFirestore: true,
  saveTuitionStatusOnly: true,
  saveTuitionFollowup: true,
  appendTuitionPaymentEntry: true,
  getDeskScheduleMonthData: true,
  getDeskCalendarEvents: true,
  saveDeskScheduleEntry: true,
  batchUpdateDeskScheduleEntries: true,
  deleteDeskScheduleEntry: true,
  getDeskDailyJournalData: true,
  getDeskDailyJournalPendingTasks: true,
  saveDeskDailyJournalTask: true,
  deleteDeskDailyJournalTask: true,
  saveDeskDailyJournalMemo: true,
  deleteDeskDailyJournalMemo: true,
  getDeskSuppliesData: true,
  adjustDeskSupplyConsumable: true,
  saveDeskSupplyConsumable: true,
  deleteDeskSupplyConsumable: true,
  saveDeskSupplyAsset: true,
  deleteDeskSupplyAsset: true,
  saveDeskSupplyPurchaseState: true,
  getDeskRecruitingApplicantsData: true,
  saveDeskRecruitingApplicant: true,
  deleteDeskRecruitingApplicant: true,
  getPayrollMonthSummary: true,
  getPayrollSettings: true,
  savePayrollSettings: true,
  savePayrollOverrides: true
};
const PAYROLL_API_PRIVILEGED_METHODS = {
  getPayrollBootstrapData: true,
  getPayrollMonthSummary: true,
  getPayrollSettings: true,
  savePayrollSettings: true,
  savePayrollOverrides: true
};

function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  if (String(params.mode || "").toLowerCase() === "api") {
    return handlePayrollApiRequest_(params);
  }
  var view = String(params.view || '').toLowerCase();
  var templateName = view === 'legacy' ? 'index' : 'payroll_portal';
  var title = view === 'legacy' ? 'SEDU Teacher Portal' : 'SEDU Desk Portal';

  return HtmlService.createTemplateFromFile(templateName).evaluate()
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function handlePayrollApiRequest_(params) {
  try {
    var fnName = String(params.fn || "").trim();
    if (!fnName) return jsonOutput_({ success: false, message: "API 함수명이 없습니다." }, params);

    var payload = parsePayrollApiPayload_(params.payload);
    if (fnName === "verifyPayrollPortalPassword") {
      return jsonOutput_(verifyPayrollPortalPassword(payload), params);
    }
    if (fnName === "verifyPayrollPrivilegedPassword") {
      if (!hasPayrollPortalAccess_(params.portalKey)) {
        return jsonOutput_({ success: false, message: "포털 비밀번호 인증이 필요합니다." }, params);
      }
      return jsonOutput_(verifyPayrollPrivilegedPassword(payload), params);
    }
    if (!PAYROLL_API_ALLOWED_METHODS[fnName]) {
      return jsonOutput_({ success: false, message: "허용되지 않은 API 요청입니다." }, params);
    }
    if (!hasPayrollPortalAccess_(params.portalKey)) {
      return jsonOutput_({ success: false, message: "포털 비밀번호 인증이 필요합니다." }, params);
    }
    if (PAYROLL_API_PRIVILEGED_METHODS[fnName] && !hasPayrollPrivilegedAccess_(params.privilegedKey)) {
      return jsonOutput_({ success: false, message: "관리 권한 비밀번호 인증이 필요합니다." }, params);
    }

    var handlers = {
      getPayrollBootstrapData: getPayrollBootstrapData,
      getTuitionBootstrapData: getTuitionBootstrapData,
      getTuitionMonthSummary: getTuitionMonthSummary,
      getTuitionStudentMonthlyHistory: getTuitionStudentMonthlyHistory,
      getTuitionGuideDashboard: getTuitionGuideDashboard,
      getTuitionMonthlySalesOverview: getTuitionMonthlySalesOverview,
      backfillTuitionMonthSnapshots: backfillTuitionMonthSnapshots,
      backfillTuitionPaymentsToFirestore: backfillTuitionPaymentsToFirestore,
      backfillTuitionFollowupsToFirestore: backfillTuitionFollowupsToFirestore,
      backfillTuitionMonthChargesToFirestore: backfillTuitionMonthChargesToFirestore,
      saveTuitionStatusOnly: saveTuitionStatusOnly,
      saveTuitionFollowup: saveTuitionFollowup,
      appendTuitionPaymentEntry: appendTuitionPaymentEntry,
      getDeskScheduleMonthData: getDeskScheduleMonthData,
      getDeskCalendarEvents: getDeskCalendarEvents,
      saveDeskScheduleEntry: saveDeskScheduleEntry,
      batchUpdateDeskScheduleEntries: batchUpdateDeskScheduleEntries,
      deleteDeskScheduleEntry: deleteDeskScheduleEntry,
      getDeskDailyJournalData: getDeskDailyJournalData,
      getDeskDailyJournalPendingTasks: getDeskDailyJournalPendingTasks,
      saveDeskDailyJournalTask: saveDeskDailyJournalTask,
      deleteDeskDailyJournalTask: deleteDeskDailyJournalTask,
      saveDeskDailyJournalMemo: saveDeskDailyJournalMemo,
      deleteDeskDailyJournalMemo: deleteDeskDailyJournalMemo,
      getDeskSuppliesData: getDeskSuppliesData,
      adjustDeskSupplyConsumable: adjustDeskSupplyConsumable,
      saveDeskSupplyConsumable: saveDeskSupplyConsumable,
      deleteDeskSupplyConsumable: deleteDeskSupplyConsumable,
      saveDeskSupplyAsset: saveDeskSupplyAsset,
      deleteDeskSupplyAsset: deleteDeskSupplyAsset,
      saveDeskSupplyPurchaseState: saveDeskSupplyPurchaseState,
      getDeskRecruitingApplicantsData: getDeskRecruitingApplicantsData,
      saveDeskRecruitingApplicant: saveDeskRecruitingApplicant,
      deleteDeskRecruitingApplicant: deleteDeskRecruitingApplicant,
      getPayrollMonthSummary: getPayrollMonthSummary,
      getPayrollSettings: getPayrollSettings,
      savePayrollSettings: savePayrollSettings,
      savePayrollOverrides: savePayrollOverrides
    };
    var handler = handlers[fnName];
    if (typeof handler !== "function") {
      return jsonOutput_({ success: false, message: "서버 메서드를 찾을 수 없습니다." }, params);
    }
    var result = typeof payload === "undefined" ? handler() : handler(payload);
    return jsonOutput_(result, params);
  } catch (e) {
    return jsonOutput_({ success: false, message: "API 처리 오류: " + e.message }, params);
  }
}

function parsePayrollApiPayload_(raw) {
  var text = String(raw || "");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}

function jsonOutput_(obj, params) {
  var callback = String((params && params.callback) || "").trim();
  if (callback) {
    var safeCallback = callback.replace(/[^\w.$]/g, "");
    var body = safeCallback + "(" + JSON.stringify(obj) + ");";
    return ContentService
      .createTextOutput(body)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function hasPayrollPortalAccess_(inputPassword) {
  var text = String(inputPassword || "").trim();
  if (!text) return false;
  if (hasPayrollToken_(PAYROLL_PORTAL_TOKEN_PREFIX, text)) return true;
  var allow = {
    'qksvhtjch': true,
    '반포서초': true,
    'tjchqksvh': true,
    '서초반포': true
  };
  return !!allow[text];
}

function hasPayrollPrivilegedAccess_(inputPassword) {
  var text = String(inputPassword || "").trim();
  if (!text) return false;
  if (hasPayrollToken_(PAYROLL_PRIVILEGED_TOKEN_PREFIX, text)) return true;
  return text === "에스학원12" || text === "dptmgkrdnjs12";
}

function verifyPayrollPortalPassword(inputPassword) {
  if (!hasPayrollPortalAccess_(inputPassword)) return { success: false };
  return {
    success: true,
    token: issuePayrollToken_("portal")
  };
}

function verifyPayrollPrivilegedPassword(inputPassword) {
  if (!hasPayrollPrivilegedAccess_(inputPassword)) return { success: false };
  return {
    success: true,
    token: issuePayrollToken_("privileged")
  };
}

function issuePayrollToken_(scope) {
  var prefix = scope === "privileged" ? PAYROLL_PRIVILEGED_TOKEN_PREFIX : PAYROLL_PORTAL_TOKEN_PREFIX;
  var token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "").slice(0, 8);
  CacheService.getScriptCache().put(prefix + token, "1", PAYROLL_API_TOKEN_TTL_SECONDS);
  return token;
}

function hasPayrollToken_(prefix, token) {
  try {
    return !!CacheService.getScriptCache().get(prefix + token);
  } catch (e) {
    return false;
  }
}

function getPayrollSettings() {
  try {
    var settings = loadPayrollTeacherSettings_();
    return { success: true, settings: settings };
  } catch (e) {
    return { success: false, message: "설정 조회 오류: " + e.message };
  }
}

function savePayrollSettings(payload) {
  try {
    var req = payload || {};
    var monthName = String(req.monthName || "").trim();
    var updates = Array.isArray(req.updates) ? req.updates : [];
    var current = loadPayrollTeacherSettings_();

    if (req.hasOwnProperty("suspicionRules")) {
      current[PAYROLL_SUSPICION_SETTINGS_KEY] = normalizePayrollSuspicionSettings_(req.suspicionRules);
    }

    updates.forEach(function(item) {
      var teacher = String((item && item.teacher) || "").trim();
      if (!teacher) return;
      var salaryMode = normalizePayrollSalaryMode_(item.salaryMode);
      var hourlyRate = Math.max(0, toPayrollNumber_(item.hourlyRate));
      var oneToOneSettlementMode = String((item && item.oneToOneSettlementMode) || "").toLowerCase() === "ratio" ? "ratio" : "hourly";
      var oneToOneRatioPercent = clampPayrollNumber_(toPayrollNumber_(item.oneToOneRatioPercent), 0, 100, 50);
      var bankName = String((item && item.bankName) || "").trim();
      var accountNumber = String((item && item.accountNumber) || "").trim();
      var accountHolder = String((item && item.accountHolder) || "").trim();
      var paid = !!(item && item.paid);

      if (!current[teacher]) current[teacher] = {};
      current[teacher].salaryMode = salaryMode;
      current[teacher].hourlyRate = hourlyRate;
      current[teacher].oneToOneSettlementMode = oneToOneSettlementMode;
      current[teacher].oneToOneRatioPercent = oneToOneRatioPercent;
      current[teacher].bankName = bankName;
      current[teacher].accountNumber = accountNumber;
      current[teacher].accountHolder = accountHolder;
      if (monthName) {
        if (!current[teacher].paidByMonth || typeof current[teacher].paidByMonth !== "object") {
          current[teacher].paidByMonth = {};
        }
        current[teacher].paidByMonth[monthName] = paid;
      }
      current[teacher].updatedAt = new Date().toISOString();
    });

    storePayrollTeacherSettings_(current);
    return { success: true, settings: current };
  } catch (e) {
    return { success: false, message: "설정 저장 오류: " + e.message };
  }
}

function savePayrollOverrides(payload) {
  try {
    var req = payload || {};
    var monthName = String(req.monthName || "").trim();
    if (!parsePayrollMonthName_(monthName)) {
      return { success: false, message: "월 탭 이름 형식이 올바르지 않습니다: " + monthName };
    }
    var overrides = normalizePayrollOverrideBundle_(req);
    overrides.updatedAt = new Date().toISOString();
    firebaseRequestWithServiceAccount_("put", getPayrollOverridesPath_(monthName), overrides);
    return {
      success: true,
      monthName: monthName,
      overrides: overrides,
      overrideSignature: buildPayrollOverrideSignature_(overrides)
    };
  } catch (e) {
    return { success: false, message: "수동 보정 저장 오류: " + e.message };
  }
}

function loadPayrollTeacherSettings_() {
  var raw = String(PropertiesService.getScriptProperties().getProperty(PAYROLL_TEACHER_SETTINGS_PROP) || "").trim();
  if (!raw) return {};
  var parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") return {};
  return parsed;
}

function storePayrollTeacherSettings_(settings) {
  var data = settings && typeof settings === "object" ? settings : {};
  PropertiesService.getScriptProperties().setProperty(PAYROLL_TEACHER_SETTINGS_PROP, JSON.stringify(data));
}

function getPayrollOverridesPath_(monthName) {
  return "payroll/months/" + encodeURIComponent(String(monthName || "").trim()) + "/overrides/current";
}

function loadPayrollOverrides_(monthName) {
  var normalizedMonth = String(monthName || "").trim();
  if (!normalizedMonth) return normalizePayrollOverrideBundle_({});
  var loaded = firebaseRequestWithServiceAccount_("get", getPayrollOverridesPath_(normalizedMonth));
  return normalizePayrollOverrideBundle_(loaded || {});
}

function normalizePayrollOverrideBundle_(input) {
  var src = input && typeof input === "object" ? input : {};
  var freeMap = {};
  (Array.isArray(src.freeIncludedRowKeys) ? src.freeIncludedRowKeys : []).forEach(function(rowKey) {
    rowKey = String(rowKey || "").trim();
    if (rowKey) freeMap[rowKey] = true;
  });

  var recognitionMap = {};
  (Array.isArray(src.recognitionOverrides) ? src.recognitionOverrides : []).forEach(function(item) {
    var rowKey = String((item && item.rowKey) || "").trim();
    if (!rowKey || typeof (item && item.recognized) !== "boolean") return;
    recognitionMap[rowKey] = !!item.recognized;
  });

  var rateMap = {};
  (Array.isArray(src.rateAdjustments) ? src.rateAdjustments : []).forEach(function(item) {
    var rowKey = String((item && item.rowKey) || "").trim();
    var rate = roundPayrollNumber_(toPayrollNumber_(item && item.rate), 2);
    if (!rowKey || rate <= 0) return;
    rateMap[rowKey] = rate;
  });

  var settlementMap = {};
  (Array.isArray(src.settlementPercentOverrides) ? src.settlementPercentOverrides : []).forEach(function(item) {
    var rowKey = String((item && item.rowKey) || "").trim();
    if (!rowKey) return;
    settlementMap[rowKey] = roundPayrollNumber_(clampPayrollNumber_(toPayrollNumber_(item && item.percent), 0, 200, 0), 2);
  });

  var freeIncludedRowKeys = Object.keys(freeMap).sort();
  var recognitionOverrides = Object.keys(recognitionMap).sort().map(function(rowKey) {
    return { rowKey: rowKey, recognized: !!recognitionMap[rowKey] };
  });
  var rateAdjustments = Object.keys(rateMap).sort().map(function(rowKey) {
    return { rowKey: rowKey, rate: rateMap[rowKey] };
  });
  var settlementPercentOverrides = Object.keys(settlementMap).sort().map(function(rowKey) {
    return { rowKey: rowKey, percent: settlementMap[rowKey] };
  });

  var normalized = {
    freeIncludedRowKeys: freeIncludedRowKeys,
    recognitionOverrides: recognitionOverrides,
    rateAdjustments: rateAdjustments,
    settlementPercentOverrides: settlementPercentOverrides
  };
  if (src.updatedAt) normalized.updatedAt = String(src.updatedAt || "");
  return normalized;
}

function mergePayrollOverrideBundles_(base, overlay) {
  var merged = normalizePayrollOverrideBundle_(base || {});
  var patch = normalizePayrollOverrideBundle_(overlay || {});
  var freeMap = toPayrollKeySet_(merged.freeIncludedRowKeys);
  patch.freeIncludedRowKeys.forEach(function(rowKey) { freeMap[rowKey] = true; });

  var recognitionMap = toPayrollRecognitionOverrideMap_(merged.recognitionOverrides);
  patch.recognitionOverrides.forEach(function(item) { recognitionMap[item.rowKey] = !!item.recognized; });

  var rateMap = toPayrollRateAdjustmentMap_(merged.rateAdjustments);
  patch.rateAdjustments.forEach(function(item) { rateMap[item.rowKey] = toPayrollNumber_(item.rate); });

  var settlementMap = toPayrollSettlementPercentOverrideMap_(merged.settlementPercentOverrides);
  patch.settlementPercentOverrides.forEach(function(item) { settlementMap[item.rowKey] = toPayrollNumber_(item.percent); });

  return normalizePayrollOverrideBundle_({
    freeIncludedRowKeys: Object.keys(freeMap),
    recognitionOverrides: Object.keys(recognitionMap).map(function(rowKey) {
      return { rowKey: rowKey, recognized: !!recognitionMap[rowKey] };
    }),
    rateAdjustments: Object.keys(rateMap).map(function(rowKey) {
      return { rowKey: rowKey, rate: rateMap[rowKey] };
    }),
    settlementPercentOverrides: Object.keys(settlementMap).map(function(rowKey) {
      return { rowKey: rowKey, percent: settlementMap[rowKey] };
    })
  });
}

function buildPayrollOverrideSignature_(overrides) {
  var text = JSON.stringify(normalizePayrollOverrideBundle_(overrides || {}));
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return bytesToHex_(digest);
}

function normalizePayrollSuspicionSettings_(input) {
  var src = input && typeof input === "object" ? input : {};
  var rules = Array.isArray(src.rules) ? src.rules : [];
  var normalizedRules = [];
  rules.forEach(function(rule) {
    var classType = normalizePayrollSuspicionClassType_((rule && rule.classType) || "");
    var hours = normalizePayrollSuspicionRuleHours_(rule && rule.hours);
    var rate = Math.max(0, Math.round(toPayrollNumber_(rule && rule.rate)));
    if (!classType || hours <= 0) return;
    normalizedRules.push({
      classType: classType,
      hours: hours,
      rate: rate
    });
  });
  var rateToleranceWon = src.hasOwnProperty("rateToleranceWon") ? toPayrollNumber_(src.rateToleranceWon) : 3000;
  return {
    enabled: src.enabled === false ? false : true,
    rateTolerancePercent: clampPayrollNumber_(toPayrollNumber_(src.rateTolerancePercent), 0, 100, 8),
    rateToleranceWon: Math.max(0, Math.round(rateToleranceWon)),
    earliestHour: clampPayrollNumber_(toPayrollNumber_(src.earliestHour), 0, 23, 8),
    latestHour: clampPayrollNumber_(toPayrollNumber_(src.latestHour), 1, 24, 23),
    maxLessonHours: clampPayrollNumber_(toPayrollNumber_(src.maxLessonHours), 1, 12, 5),
    rules: normalizedRules
  };
}

function normalizePayrollSuspicionClassType_(value) {
  var text = String(value || "").replace(/\s+/g, "");
  if (!text) return "";
  if (/개별정규|개별/.test(text)) return "개별";
  if (/1:1|1대1|일대일/.test(text)) return "1:1";
  if (/2:1|2대1/.test(text)) return "2:1";
  return text;
}

function normalizePayrollSuspicionRuleHours_(value) {
  var hours = toPayrollNumber_(value);
  if (hours <= 0) return 0;
  return Math.round(hours * 10) / 10;
}

function getDeskScheduleMonthData(payload) {
  try {
    var monthKey = normalizeDeskScheduleMonthKey_(payload && payload.monthKey);
    if (!monthKey) return { success: false, message: "monthKey가 올바르지 않습니다." };
    var basePath = buildDeskScheduleMonthPath_(monthKey);
    var stored = firebaseRequestWithServiceAccount_("get", basePath) || null;
    var entriesMap = stored && stored.entries ? stored.entries : stored;
    var hasWrappedEntries = !!(stored && stored.entries);
    var seeded = false;

    if (!entriesMap || typeof entriesMap !== "object" || !Object.keys(entriesMap).length) {
      entriesMap = {};
      buildDefaultDeskScheduleMonthSeed_(monthKey).forEach(function(item) {
        entriesMap[item.id] = item;
      });
      seeded = true;
    }

    var retiredUpdates = {};
    Object.keys(entriesMap).forEach(function(id) {
      if (isDeskRetiredScheduleWorker_(entriesMap[id] && entriesMap[id].worker)) {
        retiredUpdates[id] = null;
        delete entriesMap[id];
      }
    });
    if (Object.keys(retiredUpdates).length) {
      firebaseRequestWithServiceAccount_("patch", basePath + (hasWrappedEntries ? "/entries" : ""), retiredUpdates);
    }

    var entries = Object.keys(entriesMap).map(function(id) {
      return normalizeDeskScheduleEntry_(entriesMap[id], id);
    }).sort(compareDeskScheduleEntries_);

    return {
      success: true,
      monthKey: monthKey,
      seeded: seeded,
      entries: entries
    };
  } catch (e) {
    return { success: false, message: "근무표 조회 오류: " + e.message };
  }
}

function getDeskCalendarEvents(payload) {
  try {
    var dateKey = normalizeDeskDateKey_(payload && payload.dateKey);
    if (!dateKey) return { success: false, message: "dateKey가 올바르지 않습니다." };

    var range = buildDeskCalendarDateRange_(dateKey);
    var calendarResult = getDeskReportCalendarEvents_(range.start, range.end);
    var calendarEvents = (calendarResult && calendarResult.events ? calendarResult.events : []).sort(compareDeskReportEvents_);

    return {
      success: true,
      dateKey: dateKey,
      sources: {
        calendar: calendarEvents.length,
        source: calendarResult && calendarResult.source ? calendarResult.source : "unknown"
      },
      warnings: calendarResult && calendarResult.warnings ? calendarResult.warnings : [],
      events: calendarEvents
    };
  } catch (e) {
    return { success: false, message: "캘린더 조회 오류: " + e.message };
  }
}

function getDeskReportCalendarEvents_(start, end) {
  var props = PropertiesService.getScriptProperties();
  var calendarId = String(props.getProperty(DESK_REPORT_CALENDAR_ID_PROP) || DESK_REPORT_CALENDAR_ID).trim();
  if (!calendarId) return { events: [], warnings: ["캘린더 ID가 설정되어 있지 않습니다."], source: "none" };

  var calendarAppEvents = getDeskReportCalendarAppEvents_(calendarId, start, end);
  if (calendarAppEvents) {
    return { events: calendarAppEvents, warnings: [], source: "calendarApp" };
  }

  var url = DESK_REPORT_CALENDAR_ICS_BASE_URL + encodeURIComponent(calendarId) + "/public/basic.ics?deskPortalCacheBust=" + new Date().getTime();
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error("반포관 데스크 공개 캘린더를 읽을 수 없습니다. 상태 코드: " + status);
  }

  var icsText = response.getContentText();
  var parsedEvents = parseDeskReportCalendarIcs_(icsText, start, end);
  var warnings = buildDeskReportCalendarIcsWarnings_(icsText, start, parsedEvents);
  var events = parsedEvents.map(function(event) {
    return normalizeDeskReportCalendarIcsEvent_(event);
  }).filter(function(item) {
    return item && item.title && !/에스학원\s*대치관/.test(item.title);
  });
  return { events: events, warnings: warnings, source: "publicIcs" };
}

function getDeskReportCalendarAppEvents_(calendarId, start, end) {
  try {
    var calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) return null;
    return calendar.getEvents(start, end).map(function(event) {
      return normalizeDeskReportCalendarAppEvent_(event);
    }).filter(function(item) {
      return item && item.title && !/에스학원\s*대치관/.test(item.title);
    });
  } catch (e) {
    return null;
  }
}

function normalizeDeskReportCalendarAppEvent_(event) {
  if (!event) return null;
  var start = event.getStartTime();
  var end = event.getEndTime();
  var allDay = !!event.isAllDayEvent();
  return {
    id: "calendar_" + String(event.getId() || Utilities.getUuid()).replace(/[^\w-]/g, "_"),
    source: "calendar",
    sourceLabel: "반포관 데스크",
    title: String(event.getTitle() || "제목 없음").trim(),
    start: start ? start.toISOString() : "",
    end: end ? end.toISOString() : "",
    allDay: allDay,
    timeLabel: allDay ? "종일" : (formatDeskReportClock_(start) + " - " + formatDeskReportClock_(end))
  };
}

function buildDeskCalendarDateRange_(dateKey) {
  var parts = String(dateKey || "").split("-");
  var start = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
  var end = new Date(start.getTime());
  end.setDate(end.getDate() + 1);
  return { start: start, end: end };
}

function normalizeDeskReportCalendarIcsEvent_(event) {
  if (!event) return null;
  var isAllDay = !!event.allDay;
  var start = event.start;
  var end = event.end;
  return {
    id: "calendar_" + String(event.uid || Utilities.getUuid()).replace(/[^\w-]/g, "_"),
    source: "calendar",
    sourceLabel: "반포관 데스크",
    title: String(event.title || "제목 없음").trim(),
    start: start ? start.toISOString() : "",
    end: end ? end.toISOString() : "",
    allDay: isAllDay,
    timeLabel: isAllDay ? "종일" : (formatDeskReportClock_(start) + " - " + formatDeskReportClock_(end))
  };
}

function parseDeskReportCalendarIcs_(icsText, start, end) {
  var events = [];
  var lines = unfoldDeskReportIcsLines_(icsText);
  var current = null;
  lines.forEach(function(line) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      return;
    }
    if (line === "END:VEVENT") {
      var event = buildDeskReportIcsEvent_(current);
      if (event && doesDeskReportEventOverlap_(event, start, end)) events.push(event);
      current = null;
      return;
    }
    if (!current) return;
    var parsed = parseDeskReportIcsLine_(line);
    if (!parsed) return;
    if (parsed.name === "UID") current.uid = parsed.value;
    if (parsed.name === "SUMMARY") current.title = unescapeDeskReportIcsText_(parsed.value);
    if (parsed.name === "DTSTART") current.startField = parsed;
    if (parsed.name === "DTEND") current.endField = parsed;
  });
  return events;
}

function unfoldDeskReportIcsLines_(icsText) {
  var rawLines = String(icsText || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  var lines = [];
  rawLines.forEach(function(line) {
    if (/^[ \t]/.test(line) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  });
  return lines;
}

function parseDeskReportIcsLine_(line) {
  var divider = String(line || "").indexOf(":");
  if (divider < 0) return null;
  var head = line.slice(0, divider);
  var parts = head.split(";");
  var params = {};
  parts.slice(1).forEach(function(part) {
    var pair = part.split("=");
    params[String(pair[0] || "").toUpperCase()] = pair.slice(1).join("=");
  });
  return {
    name: String(parts[0] || "").toUpperCase(),
    params: params,
    value: line.slice(divider + 1)
  };
}

function buildDeskReportIcsEvent_(raw) {
  if (!raw || !raw.startField) return null;
  var allDay = String(raw.startField.params.VALUE || "").toUpperCase() === "DATE";
  var start = parseDeskReportIcsDate_(raw.startField.value, allDay, raw.startField.params);
  var end = raw.endField ? parseDeskReportIcsDate_(raw.endField.value, allDay, raw.endField.params) : null;
  if (!start) return null;
  if (!end) {
    end = new Date(start.getTime());
    end.setHours(end.getHours() + (allDay ? 24 : 1));
  }
  return {
    uid: raw.uid || "",
    title: raw.title || "",
    start: start,
    end: end,
    allDay: allDay
  };
}

function parseDeskReportIcsDate_(value, allDay, params) {
  var text = String(value || "").trim();
  if (!text) return null;
  if (allDay || /^\d{8}$/.test(text)) {
    return new Date(Number(text.slice(0, 4)), Number(text.slice(4, 6)) - 1, Number(text.slice(6, 8)), 0, 0, 0, 0);
  }

  var m = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  if (m[7] === "Z") {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])));
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]), 0);
}

function buildDeskReportCalendarIcsWarnings_(icsText, requestedStart, matchedEvents) {
  if (matchedEvents && matchedEvents.length) return [];
  var latest = getLatestDeskReportIcsStartDate_(icsText);
  if (latest && requestedStart && requestedStart.getTime && requestedStart.getTime() > latest.getTime() + 24 * 60 * 60 * 1000) {
    return ["공개 캘린더 피드가 " + formatDeskReportDate_(latest) + "까지만 포함되어 있습니다. 캘린더 직접 조회 권한을 확인하세요."];
  }
  return [];
}

function getLatestDeskReportIcsStartDate_(icsText) {
  var lines = unfoldDeskReportIcsLines_(icsText);
  var latest = null;
  lines.forEach(function(line) {
    var parsed = parseDeskReportIcsLine_(line);
    if (!parsed || parsed.name !== "DTSTART") return;
    var allDay = String(parsed.params.VALUE || "").toUpperCase() === "DATE";
    var date = parseDeskReportIcsDate_(parsed.value, allDay, parsed.params);
    if (date && (!latest || date > latest)) latest = date;
  });
  return latest;
}

function formatDeskReportDate_(date) {
  if (!date || isNaN(date.getTime())) return "";
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function doesDeskReportEventOverlap_(event, start, end) {
  return event && event.start && event.end && event.start < end && event.end > start;
}

function unescapeDeskReportIcsText_(value) {
  return String(value || "")
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function compareDeskReportEvents_(a, b) {
  if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;
  if (a.start !== b.start) return String(a.start || "").localeCompare(String(b.start || ""));
  return String(a.title || "").localeCompare(String(b.title || ""), "ko");
}

function formatDeskReportClock_(date) {
  if (!date || isNaN(date.getTime())) return "--:--";
  return Utilities.formatDate(date, "Asia/Seoul", "HH:mm");
}

function saveDeskScheduleEntry(payload) {
  try {
    var req = payload || {};
    var entry = normalizeDeskScheduleEntry_(req.entry || {}, req.entry && req.entry.id);
    var monthKey = normalizeDeskScheduleMonthKey_(req.monthKey || entry.date.slice(0, 7));
    if (!monthKey) return { success: false, message: "monthKey가 올바르지 않습니다." };
    if (!entry.date || entry.date.slice(0, 7) !== monthKey) {
      return { success: false, message: "근무일과 monthKey가 일치하지 않습니다." };
    }
    if (!entry.worker) return { success: false, message: "근무자 이름이 필요합니다." };
    if (isDeskRetiredScheduleWorker_(entry.worker)) return { success: false, message: "퇴사자는 근무표에 저장할 수 없습니다." };
    if (!entry.resident && !entry.unavailable && (!entry.start || !entry.end)) {
      return { success: false, message: "시작/종료 시간이 필요합니다." };
    }
    var path = buildDeskScheduleMonthPath_(monthKey) + "/entries/" + entry.id;
    firebaseRequestWithServiceAccount_("put", path, entry);
    return { success: true, monthKey: monthKey, entry: entry };
  } catch (e) {
    return { success: false, message: "근무표 저장 오류: " + e.message };
  }
}

function deleteDeskScheduleEntry(payload) {
  try {
    var req = payload || {};
    var monthKey = normalizeDeskScheduleMonthKey_(req.monthKey);
    var id = String(req.id || "").trim();
    if (!monthKey) return { success: false, message: "monthKey가 올바르지 않습니다." };
    if (!id) return { success: false, message: "삭제할 일정 ID가 없습니다." };
    firebaseRequestWithServiceAccount_("delete", buildDeskScheduleMonthPath_(monthKey) + "/entries/" + id);
    return { success: true, monthKey: monthKey, id: id };
  } catch (e) {
    return { success: false, message: "근무표 삭제 오류: " + e.message };
  }
}

function batchUpdateDeskScheduleEntries(payload) {
  try {
    var req = payload || {};
    var monthKey = normalizeDeskScheduleMonthKey_(req.monthKey);
    if (!monthKey) return { success: false, message: "monthKey가 올바르지 않습니다." };

    var deleteIds = Array.isArray(req.deleteIds) ? req.deleteIds.map(function(id) {
      return String(id || "").trim();
    }).filter(Boolean) : [];

    var entries = Array.isArray(req.entries) ? req.entries.map(function(item) {
      return normalizeDeskScheduleEntry_(item || {}, item && item.id);
    }).filter(function(entry) {
      return !isDeskRetiredScheduleWorker_(entry.worker);
    }) : [];

    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (!entry.date || entry.date.slice(0, 7) !== monthKey) {
        return { success: false, message: "근무일과 monthKey가 일치하지 않습니다." };
      }
      if (!entry.worker) return { success: false, message: "근무자 이름이 필요합니다." };
      if (!entry.resident && !entry.unavailable && (!entry.start || !entry.end)) {
        return { success: false, message: "시작/종료 시간이 필요합니다." };
      }
    }

    var updates = {};
    deleteIds.forEach(function(id) {
      updates[id] = null;
    });
    entries.forEach(function(entry) {
      updates[entry.id] = entry;
    });
    if (!Object.keys(updates).length) {
      return { success: true, monthKey: monthKey, entries: [], deletedIds: [] };
    }

    firebaseRequestWithServiceAccount_("patch", buildDeskScheduleMonthPath_(monthKey) + "/entries", updates);
    return { success: true, monthKey: monthKey, entries: entries, deletedIds: deleteIds };
  } catch (e) {
    return { success: false, message: "근무표 일괄 업데이트 오류: " + e.message };
  }
}

function buildDeskScheduleMonthPath_(monthKey) {
  return DESK_SCHEDULE_ROOT_PATH + "/" + monthKey;
}

function isDeskRetiredScheduleWorker_(workerName) {
  var safeName = String(workerName || "").trim();
  if (!safeName) return false;
  return DESK_RETIRED_SCHEDULE_WORKERS.indexOf(safeName) !== -1;
}

function buildDeskDailyJournalPath_(dateKey) {
  return DESK_DAILY_JOURNAL_ROOT_PATH + "/" + dateKey;
}

function buildDeskDailyPendingTaskPath_(taskId) {
  return DESK_DAILY_PENDING_TASKS_ROOT_PATH + "/" + String(taskId || "").trim();
}

function buildDeskSuppliesPath_() {
  return DESK_SUPPLIES_ROOT_PATH;
}

function getDefaultDeskSupplyConsumables_() {
  return [
    { id: "wet_tissue", itemName: "물티슈", productName: "데스크용 물티슈 100매", qty: 6, maxQty: 10, safetyQty: 4, unit: "개" },
    { id: "box_tissue", itemName: "곽티슈", productName: "클리넥스 200매", qty: 12, maxQty: 20, safetyQty: 8, unit: "개" },
    { id: "paper_cup", itemName: "종이컵", productName: "테이크아웃컵 1줄", qty: 5, maxQty: 8, safetyQty: 3, unit: "줄" },
    { id: "trash_bag", itemName: "쓰레기봉투", productName: "20L 검정봉투", qty: 3, maxQty: 6, safetyQty: 2, unit: "묶음" },
    { id: "sanitizer", itemName: "손소독제", productName: "대용량 리필 500ml", qty: 2, maxQty: 5, safetyQty: 2, unit: "병" },
    { id: "marker", itemName: "보드마카", productName: "화이트보드 마카 세트", qty: 4, maxQty: 8, safetyQty: 3, unit: "세트" }
  ];
}

function getDefaultDeskSupplyAssets_() {
  return [
    { id: "asset_desktop_1", type: "데스크탑", productName: "DELL OptiPlex 데스크 PC", location: "반포관 데스크", manager: "데스크 공용", status: "정상", note: "학생 등록 및 결제 업무용" },
    { id: "asset_tablet_1", type: "태블릿", productName: "iPad Air 5세대", location: "상담 테이블", manager: "상담용 공용", status: "정상", note: "학부모 상담 및 안내 자료" },
    { id: "asset_printer_1", type: "프린터", productName: "HP LaserJet Pro", location: "데스크 뒤편", manager: "데스크 공용", status: "점검 필요", note: "토너 잔량 확인 필요" }
  ];
}

function normalizeDeskSupplyConsumable_(item, fallbackId) {
  var source = item || {};
  var maxQty = Math.max(1, Number(source.maxQty || 1));
  var qty = Math.max(0, Math.min(maxQty, Number(source.qty || 0)));
  var safetyQty = Math.max(0, Math.min(maxQty, Number(source.safetyQty || 0)));
  return {
    id: String(source.id || fallbackId || ("desk_supply_" + Utilities.getUuid().replace(/-/g, "").slice(0, 8))).trim(),
    itemName: String(source.itemName || "품목명").trim(),
    productName: String(source.productName || "제품명 미입력").trim(),
    qty: qty,
    maxQty: maxQty,
    safetyQty: safetyQty,
    unit: String(source.unit || "개").trim()
  };
}

function normalizeDeskSupplyAsset_(item, fallbackId) {
  var source = item || {};
  return {
    id: String(source.id || fallbackId || Utilities.getUuid().replace(/-/g, "")).trim(),
    type: String(source.type || "기타").trim(),
    productName: String(source.productName || "제품명 미입력").trim(),
    location: String(source.location || "-").trim(),
    manager: String(source.manager || "-").trim(),
    status: String(source.status || "정상").trim(),
    note: String(source.note || "").trim()
  };
}

function normalizeDeskSupplySelectionMap_(map, consumables) {
  var source = map && typeof map === "object" ? map : {};
  var result = {};
  (consumables || []).forEach(function(item) {
    var current = source[item.id] && typeof source[item.id] === "object" ? source[item.id] : {};
    var recommended = Math.max(1, Number(item.maxQty || 1) - Number(item.qty || 0));
    result[item.id] = {
      selected: typeof current.selected === "boolean" ? current.selected : Number(item.qty || 0) <= Number(item.safetyQty || 0),
      requestQty: Math.max(1, Number(current.requestQty || recommended))
    };
  });
  return result;
}

function normalizeDeskSuppliesData_(stored) {
  var data = stored && typeof stored === "object" ? stored : {};
  var consumablesSource = Array.isArray(data.consumables) && data.consumables.length
    ? data.consumables
    : getDefaultDeskSupplyConsumables_();
  var assetsSource = Array.isArray(data.assets) && data.assets.length
    ? data.assets
    : getDefaultDeskSupplyAssets_();
  var consumables = consumablesSource.map(function(item, idx) {
    return normalizeDeskSupplyConsumable_(item, item && item.id ? item.id : ("desk_supply_" + idx));
  });
  var assets = assetsSource.map(function(item, idx) {
    return normalizeDeskSupplyAsset_(item, item && item.id ? item.id : ("desk_asset_" + idx));
  });
  return {
    consumables: consumables,
    assets: assets,
    purchaseSelections: normalizeDeskSupplySelectionMap_(data.purchaseSelections, consumables),
    purchaseRequestTarget: String(data.purchaseRequestTarget || "대표님").trim() || "대표님",
    purchaseRequestNote: String(data.purchaseRequestNote || "").trim()
  };
}

function getDeskSuppliesData() {
  try {
    var path = buildDeskSuppliesPath_();
    var stored = firebaseRequestWithServiceAccount_("get", path) || null;
    var seeded = !stored || typeof stored !== "object" || !Object.keys(stored).length;
    var data = normalizeDeskSuppliesData_(stored);
    if (seeded) {
      firebaseRequestWithServiceAccount_("put", path, data);
    }
    return { success: true, data: data, seeded: seeded };
  } catch (e) {
    return { success: false, message: "소모품 데이터 조회 오류: " + e.message };
  }
}

function adjustDeskSupplyConsumable(payload) {
  try {
    var req = payload || {};
    var id = String(req.id || "").trim();
    var delta = Number(req.delta || 0);
    if (!id) return { success: false, message: "품목 ID가 없습니다." };
    if (!delta) return { success: false, message: "조정 수량이 없습니다." };
    var path = buildDeskSuppliesPath_();
    var data = normalizeDeskSuppliesData_(firebaseRequestWithServiceAccount_("get", path) || null);
    var target = data.consumables.filter(function(item) { return item.id === id; })[0];
    if (!target) return { success: false, message: "조정할 품목을 찾을 수 없습니다." };
    target.qty = Math.max(0, Math.min(target.maxQty, Number(target.qty || 0) + delta));
    data.purchaseSelections = normalizeDeskSupplySelectionMap_(data.purchaseSelections, data.consumables);
    firebaseRequestWithServiceAccount_("put", path, data);
    return { success: true, data: data };
  } catch (e) {
    return { success: false, message: "소모품 수량 조정 오류: " + e.message };
  }
}

function saveDeskSupplyConsumable(payload) {
  try {
    var req = payload || {};
    var item = normalizeDeskSupplyConsumable_(req.item || {}, req.item && req.item.id);
    if (!item.itemName) return { success: false, message: "품목명을 입력해 주세요." };
    if (!item.productName) return { success: false, message: "제품명을 입력해 주세요." };
    var path = buildDeskSuppliesPath_();
    var data = normalizeDeskSuppliesData_(firebaseRequestWithServiceAccount_("get", path) || null);
    var nextItems = data.consumables.filter(function(existing) { return existing.id !== item.id; });
    nextItems.unshift(item);
    data.consumables = nextItems;
    data.purchaseSelections = normalizeDeskSupplySelectionMap_(data.purchaseSelections, data.consumables);
    firebaseRequestWithServiceAccount_("put", path, data);
    return { success: true, data: data, item: item };
  } catch (e) {
    return { success: false, message: "소모품 저장 오류: " + e.message };
  }
}

function deleteDeskSupplyConsumable(payload) {
  try {
    var req = payload || {};
    var id = String(req.id || "").trim();
    if (!id) return { success: false, message: "삭제할 품목 ID가 없습니다." };
    var path = buildDeskSuppliesPath_();
    var data = normalizeDeskSuppliesData_(firebaseRequestWithServiceAccount_("get", path) || null);
    data.consumables = data.consumables.filter(function(item) { return item.id !== id; });
    if (data.purchaseSelections && typeof data.purchaseSelections === "object") {
      delete data.purchaseSelections[id];
    }
    data.purchaseSelections = normalizeDeskSupplySelectionMap_(data.purchaseSelections, data.consumables);
    firebaseRequestWithServiceAccount_("put", path, data);
    return { success: true, data: data, id: id };
  } catch (e) {
    return { success: false, message: "소모품 삭제 오류: " + e.message };
  }
}

function saveDeskSupplyAsset(payload) {
  try {
    var req = payload || {};
    var asset = normalizeDeskSupplyAsset_(req.asset || {}, req.asset && req.asset.id);
    if (!asset.type) return { success: false, message: "물품 분류가 필요합니다." };
    if (!asset.productName) return { success: false, message: "제품명을 입력해 주세요." };
    var path = buildDeskSuppliesPath_();
    var data = normalizeDeskSuppliesData_(firebaseRequestWithServiceAccount_("get", path) || null);
    var nextAssets = data.assets.filter(function(item) { return item.id !== asset.id; });
    nextAssets.unshift(asset);
    data.assets = nextAssets;
    firebaseRequestWithServiceAccount_("put", path, data);
    return { success: true, data: data, asset: asset };
  } catch (e) {
    return { success: false, message: "물품 저장 오류: " + e.message };
  }
}

function deleteDeskSupplyAsset(payload) {
  try {
    var req = payload || {};
    var id = String(req.id || "").trim();
    if (!id) return { success: false, message: "삭제할 물품 ID가 없습니다." };
    var path = buildDeskSuppliesPath_();
    var data = normalizeDeskSuppliesData_(firebaseRequestWithServiceAccount_("get", path) || null);
    data.assets = data.assets.filter(function(item) { return item.id !== id; });
    firebaseRequestWithServiceAccount_("put", path, data);
    return { success: true, data: data, id: id };
  } catch (e) {
    return { success: false, message: "물품 삭제 오류: " + e.message };
  }
}

function saveDeskSupplyPurchaseState(payload) {
  try {
    var req = payload || {};
    var path = buildDeskSuppliesPath_();
    var data = normalizeDeskSuppliesData_(firebaseRequestWithServiceAccount_("get", path) || null);
    if (req.purchaseSelections && typeof req.purchaseSelections === "object") {
      data.purchaseSelections = normalizeDeskSupplySelectionMap_(req.purchaseSelections, data.consumables);
    }
    if (typeof req.purchaseRequestTarget !== "undefined") {
      data.purchaseRequestTarget = String(req.purchaseRequestTarget || "대표님").trim() || "대표님";
    }
    if (typeof req.purchaseRequestNote !== "undefined") {
      data.purchaseRequestNote = String(req.purchaseRequestNote || "").trim();
    }
    firebaseRequestWithServiceAccount_("put", path, data);
    return { success: true, data: data };
  } catch (e) {
    return { success: false, message: "구매 요청 상태 저장 오류: " + e.message };
  }
}

function buildDeskRecruitingPath_() {
  return DESK_RECRUITING_ROOT_PATH;
}

function getDeskRecruitingApplicantsData(payload) {
  try {
    var req = payload || {};
    var monthKey = normalizeDeskScheduleMonthKey_(req.monthKey);
    var stored = firebaseRequestWithServiceAccount_("get", buildDeskRecruitingPath_()) || {};
    var applicants = Object.keys(stored && typeof stored === "object" ? stored : {}).map(function(id) {
      return normalizeDeskRecruitingApplicant_(stored[id], id);
    }).filter(function(item) {
      return !monthKey ||
        String(item.interviewDate || "").slice(0, 7) === monthKey ||
        String(item.nextContactAt || "").slice(0, 7) === monthKey ||
        String(item.resumeReportedAt || "").slice(0, 7) === monthKey ||
        String(item.directorRequestedAt || "").slice(0, 7) === monthKey ||
        String(item.createdAt || "").slice(0, 7) === monthKey;
    }).sort(compareDeskRecruitingApplicants_);
    return { success: true, monthKey: monthKey, applicants: applicants };
  } catch (e) {
    return { success: false, message: "인사 관리 조회 오류: " + e.message };
  }
}

function saveDeskRecruitingApplicant(payload) {
  try {
    var applicant = normalizeDeskRecruitingApplicant_(payload && payload.applicant, payload && payload.applicant && payload.applicant.id);
    if (!applicant.applicantName) return { success: false, message: "지원자명을 입력해 주세요." };
    firebaseRequestWithServiceAccount_("put", buildDeskRecruitingPath_() + "/" + applicant.id, applicant);
    return { success: true, applicant: applicant };
  } catch (e) {
    return { success: false, message: "지원자 저장 오류: " + e.message };
  }
}

function deleteDeskRecruitingApplicant(payload) {
  try {
    var id = String(payload && payload.id || "").trim();
    if (!id) return { success: false, message: "삭제할 지원자 ID가 없습니다." };
    firebaseRequestWithServiceAccount_("delete", buildDeskRecruitingPath_() + "/" + id);
    return { success: true, id: id };
  } catch (e) {
    return { success: false, message: "지원자 삭제 오류: " + e.message };
  }
}

function normalizeDeskRecruitingApplicant_(item, fallbackId) {
  var source = item || {};
  var now = new Date().toISOString();
  var roleType = String(source.roleType || "강사").trim() || "강사";
  var subject = String(source.subject || "").trim();
  var subjectDetail = String(source.subjectDetail || "").trim();
  if (subject !== "과학") subjectDetail = "";
  var status = String(source.pipelineStatus || source.status || "이력서 검토").trim();
  status = DESK_HR_STATUS_ALIASES[status] || status;
  if (DESK_HR_STATUSES.indexOf(status) === -1) status = "이력서 검토";
  var reviewDecision = String(source.reviewDecision || "검토중").trim();
  if (DESK_HR_REVIEW_DECISIONS.indexOf(reviewDecision) === -1) reviewDecision = "검토중";
  return {
    id: String(source.id || fallbackId || buildDeskScheduleEntryId_()).trim(),
    applicantName: String(source.applicantName || source.name || "").trim(),
    roleType: roleType,
    subject: subject || (roleType === "데스크 직원" ? "데스크" : ""),
    subjectDetail: subjectDetail,
    school: String(source.school || "").trim(),
    major: String(source.major || "").trim(),
    birthYear: String(source.birthYear || "").trim(),
    gender: String(source.gender || "").trim(),
    platform: String(source.platform || "").trim(),
    status: status,
    pipelineStatus: status,
    reviewDecision: reviewDecision,
    resumeReportedAt: normalizeDeskDateKey_(source.resumeReportedAt) || "",
    directorRequestedAt: normalizeDeskDateKey_(source.directorRequestedAt) || "",
    interviewDate: normalizeDeskDateKey_(source.interviewDate) || "",
    interviewTime: String(source.interviewTime || "").trim(),
    lastContactAt: normalizeDeskDateKey_(source.lastContactAt) || "",
    nextContactAt: normalizeDeskDateKey_(source.nextContactAt) || "",
    contactChannel: String(source.contactChannel || "전화").trim() || "전화",
    contactLogs: normalizeDeskRecruitingContactLogs_(source.contactLogs),
    guidanceTemplates: normalizeDeskRecruitingGuidanceTemplates_(source.guidanceTemplates),
    jobPostTitle: String(source.jobPostTitle || "").trim(),
    note: String(source.note || "").trim(),
    createdAt: String(source.createdAt || now).trim(),
    updatedAt: String(source.updatedAt || source.createdAt || now).trim()
  };
}

function normalizeDeskRecruitingContactLogs_(logs) {
  if (!Array.isArray(logs)) return [];
  return logs.map(function(log) {
    return {
      at: String(log && log.at || "").trim(),
      channel: String(log && log.channel || "").trim(),
      summary: String(log && log.summary || "").trim()
    };
  }).filter(function(log) {
    return log.at || log.channel || log.summary;
  });
}

function normalizeDeskRecruitingGuidanceTemplates_(templates) {
  if (!Array.isArray(templates)) return [];
  return templates.map(function(template, index) {
    var stage = String(template && template.stage || template && template.title || "면접 조율").trim();
    stage = DESK_HR_STATUS_ALIASES[stage] || stage;
    if (DESK_HR_STATUSES.indexOf(stage) === -1) stage = "면접 조율";
    return {
      id: String(template && template.id || ("template_" + index)).trim(),
      title: String(template && template.title || "안내 멘트").trim() || "안내 멘트",
      stage: stage,
      channel: String(template && template.channel || "문자").trim() || "문자",
      message: String(template && template.message || "").trim()
    };
  }).filter(function(template) {
    return template.message;
  });
}

function compareDeskRecruitingApplicants_(a, b) {
  var aDate = String(a.interviewDate || a.nextContactAt || a.updatedAt || "");
  var bDate = String(b.interviewDate || b.nextContactAt || b.updatedAt || "");
  if (aDate !== bDate) return bDate.localeCompare(aDate);
  if (a.interviewTime !== b.interviewTime) return String(a.interviewTime || "").localeCompare(String(b.interviewTime || ""));
  return String(a.applicantName || "").localeCompare(String(b.applicantName || ""), "ko");
}

function normalizeDeskScheduleMonthKey_(value) {
  var text = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(text) ? text : "";
}

function normalizeDeskDateKey_(value) {
  var text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

var DESK_WORKER_NAME_ALIASES = {
  "이미현": "이민현"
};

function canonicalizeDeskWorkerName_(name) {
  var text = String(name || "").trim();
  try {
    text = text.normalize("NFC");
  } catch (e) {}
  return DESK_WORKER_NAME_ALIASES[text] || text;
}

function shiftDeskDateKey_(dateKey, days) {
  var safeDateKey = normalizeDeskDateKey_(dateKey);
  if (!safeDateKey) return "";
  var parts = safeDateKey.split("-");
  var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  date.setDate(date.getDate() + Number(days || 0));
  return Utilities.formatDate(date, "Asia/Seoul", "yyyy-MM-dd");
}

function normalizeDeskScheduleEntry_(item, fallbackId) {
  var entry = {
    id: String((item && item.id) || fallbackId || buildDeskScheduleEntryId_()).trim(),
    date: String((item && item.date) || "").trim(),
    worker: canonicalizeDeskWorkerName_((item && item.worker) || ""),
    role: String((item && item.role) || "").trim(),
    start: String((item && item.start) || "").trim(),
    end: String((item && item.end) || "").trim(),
    resident: !!(item && (item.resident || item.isResident)),
    unavailable: !!(item && (item.unavailable || item.isUnavailable)),
    note: String((item && item.note) || "").trim()
  };
  if (entry.resident || entry.unavailable) {
    entry.start = "";
    entry.end = "";
  }
  if (entry.unavailable) entry.resident = false;
  return entry;
}

function buildDeskScheduleEntryId_() {
  return Utilities.getUuid().replace(/-/g, "");
}

function compareDeskScheduleEntries_(a, b) {
  if (a.date !== b.date) return String(a.date || "").localeCompare(String(b.date || ""));
  if (!!a.unavailable !== !!b.unavailable) return a.unavailable ? 1 : -1;
  if (!!b.resident !== !!a.resident) return b.resident ? 1 : -1;
  if (a.start !== b.start) return String(a.start || "").localeCompare(String(b.start || ""));
  return String(a.worker || "").localeCompare(String(b.worker || ""), "ko");
}

function getDeskDailyJournalData(payload) {
  try {
    var dateKey = normalizeDeskDateKey_(payload && payload.dateKey);
    if (!dateKey) return { success: false, message: "dateKey가 올바르지 않습니다." };
    var stored = firebaseRequestWithServiceAccount_("get", buildDeskDailyJournalPath_(dateKey)) || {};
    var tasksMap = stored && stored.tasks ? stored.tasks : {};
    var memosMap = stored && stored.memos ? stored.memos : {};

    var tasks = Object.keys(tasksMap).map(function(id) {
      return normalizeDeskDailyJournalTask_(tasksMap[id], id, dateKey);
    }).sort(compareDeskDailyJournalTasks_);
    var memos = Object.keys(memosMap).map(function(id) {
      return normalizeDeskDailyJournalMemo_(memosMap[id], id, dateKey);
    }).sort(compareDeskDailyJournalMemos_);

    return {
      success: true,
      dateKey: dateKey,
      tasks: tasks,
      memos: memos
    };
  } catch (e) {
    return { success: false, message: "일일 업무일지 조회 오류: " + e.message };
  }
}

function getDeskDailyJournalPendingTasks(payload) {
  try {
    var req = payload || {};
    var beforeDateKey = normalizeDeskDateKey_(req.beforeDateKey || req.dateKey);
    if (!beforeDateKey) return { success: false, message: "기준 날짜가 올바르지 않습니다." };
    var workerKeys = {};
    (req.workers || []).forEach(function(name) {
      var key = normalizeDeskWorkerNameKey_(name);
      if (key) workerKeys[key] = true;
    });
    var hasWorkerFilter = !!Object.keys(workerKeys).length;
    var tasks = [];
    var seen = {};

    function addPendingTask_(rawTask, fallbackId, fallbackDateKey) {
      var task = normalizeDeskDailyJournalTask_(rawTask, fallbackId, fallbackDateKey);
      if (!task.id || seen[task.id]) return;
      if (!task.dateKey || task.dateKey >= beforeDateKey || task.completed) return;
      if (!isDeskDailyJournalSharedTask_(task) && (!hasWorkerFilter || !workerKeys[normalizeDeskWorkerNameKey_(task.worker)])) return;
      seen[task.id] = true;
      tasks.push(task);
    }

    var indexedTasks = firebaseRequestWithServiceAccount_("get", DESK_DAILY_PENDING_TASKS_ROOT_PATH) || {};
    Object.keys(indexedTasks || {}).forEach(function(id) {
      var item = indexedTasks[id];
      if (!item || typeof item !== "object") return;
      addPendingTask_(item, id, item.dateKey);
    });

    var legacyScanDays = Math.min(14, Math.max(0, Number(req.legacyScanDays || 7)));
    var legacyPaths = [];
    for (var offset = 1; offset <= legacyScanDays; offset += 1) {
      var normalizedDateKey = shiftDeskDateKey_(beforeDateKey, -offset);
      if (!normalizedDateKey) continue;
      legacyPaths.push({
        dateKey: normalizedDateKey,
        path: buildDeskDailyJournalPath_(normalizedDateKey) + "/tasks"
      });
    }
    var legacyDataByPath = firebaseBatchGetWithServiceAccount_(legacyPaths.map(function(item) {
      return item.path;
    }));
    legacyPaths.forEach(function(item) {
      var normalizedDateKey = item.dateKey;
      var dayData = legacyDataByPath[item.path] || {};
      var tasksMap = dayData && typeof dayData === "object" ? dayData : {};
      Object.keys(tasksMap).forEach(function(id) {
        addPendingTask_(tasksMap[id], id, normalizedDateKey);
      });
    });
    tasks.sort(compareDeskDailyJournalTasks_);
    return { success: true, beforeDateKey: beforeDateKey, includeSharedCarryover: true, tasks: tasks };
  } catch (e) {
    return { success: false, message: "미해결 이월 업무 조회 오류: " + e.message };
  }
}

function syncDeskDailyJournalPendingTaskIndex_(task) {
  if (!task || !task.id) return;
  if (task.completed) {
    firebaseRequestWithServiceAccount_("delete", buildDeskDailyPendingTaskPath_(task.id));
    return;
  }
  firebaseRequestWithServiceAccount_("put", buildDeskDailyPendingTaskPath_(task.id), task);
}

function saveDeskDailyJournalTask(payload) {
  try {
    var req = payload || {};
    var dateKey = normalizeDeskDateKey_(req.dateKey || (req.task && req.task.dateKey));
    if (!dateKey) return { success: false, message: "dateKey가 올바르지 않습니다." };
    var task = normalizeDeskDailyJournalTask_(req.task || {}, req.task && req.task.id, dateKey);
    if (!task.worker) return { success: false, message: "업무 대상 근무자가 필요합니다." };
    if (!task.title) return { success: false, message: "업무 제목을 입력해 주세요." };
    firebaseRequestWithServiceAccount_("put", buildDeskDailyJournalPath_(dateKey) + "/tasks/" + task.id, task);
    syncDeskDailyJournalPendingTaskIndex_(task);
    return { success: true, dateKey: dateKey, task: task };
  } catch (e) {
    return { success: false, message: "일일 업무 저장 오류: " + e.message };
  }
}

function deleteDeskDailyJournalTask(payload) {
  try {
    var req = payload || {};
    var dateKey = normalizeDeskDateKey_(req.dateKey);
    var id = String(req.id || "").trim();
    if (!dateKey) return { success: false, message: "dateKey가 올바르지 않습니다." };
    if (!id) return { success: false, message: "삭제할 업무 ID가 없습니다." };
    firebaseRequestWithServiceAccount_("delete", buildDeskDailyJournalPath_(dateKey) + "/tasks/" + id);
    firebaseRequestWithServiceAccount_("delete", buildDeskDailyPendingTaskPath_(id));
    return { success: true, dateKey: dateKey, id: id };
  } catch (e) {
    return { success: false, message: "일일 업무 삭제 오류: " + e.message };
  }
}

function saveDeskDailyJournalMemo(payload) {
  try {
    var req = payload || {};
    var dateKey = normalizeDeskDateKey_(req.dateKey || (req.memo && req.memo.dateKey));
    if (!dateKey) return { success: false, message: "dateKey가 올바르지 않습니다." };
    var memo = normalizeDeskDailyJournalMemo_(req.memo || {}, req.memo && req.memo.id, dateKey);
    if (!memo.worker) return { success: false, message: "기록 근무자 이름이 필요합니다." };
    if (!memo.text) return { success: false, message: "기록 내용을 입력해 주세요." };
    firebaseRequestWithServiceAccount_("put", buildDeskDailyJournalPath_(dateKey) + "/memos/" + memo.id, memo);
    return { success: true, dateKey: dateKey, memo: memo };
  } catch (e) {
    return { success: false, message: "근무 기록 저장 오류: " + e.message };
  }
}

function deleteDeskDailyJournalMemo(payload) {
  try {
    var req = payload || {};
    var dateKey = normalizeDeskDateKey_(req.dateKey);
    var id = String(req.id || "").trim();
    if (!dateKey) return { success: false, message: "dateKey가 올바르지 않습니다." };
    if (!id) return { success: false, message: "삭제할 기록 ID가 없습니다." };
    firebaseRequestWithServiceAccount_("delete", buildDeskDailyJournalPath_(dateKey) + "/memos/" + id);
    return { success: true, dateKey: dateKey, id: id };
  } catch (e) {
    return { success: false, message: "근무 기록 삭제 오류: " + e.message };
  }
}

function normalizeDeskDailyJournalTask_(item, fallbackId, dateKey) {
  var now = new Date().toISOString();
  var task = {
    id: String((item && item.id) || fallbackId || buildDeskScheduleEntryId_()).trim(),
    dateKey: normalizeDeskDateKey_((item && item.dateKey) || dateKey),
    worker: canonicalizeDeskWorkerName_((item && item.worker) || ""),
    category: String((item && item.category) || "일반").trim(),
    title: String((item && item.title) || "").trim(),
    note: String((item && item.note) || "").trim(),
    completed: !!(item && item.completed),
    unresolvedReason: String((item && item.unresolvedReason) || "").trim(),
    ackWorkers: normalizeDeskDailyWorkerNameArray_(item && item.ackWorkers),
    hiddenFromWorkerBand: !!(item && item.hiddenFromWorkerBand),
    sortOrder: normalizeDeskDailyTaskSortOrder_(item && item.sortOrder),
    targetWorkers: normalizeDeskDailyWorkerNameArray_(item && item.targetWorkers),
    createdAt: String((item && item.createdAt) || now).trim(),
    updatedAt: String((item && item.updatedAt) || (item && item.createdAt) || now).trim()
  };
  if (task.completed) {
    task.unresolvedReason = "";
  }
  return task;
}

function normalizeDeskDailyWorkerNameArray_(value) {
  var source = Array.isArray(value) ? value : [];
  var seen = {};
  var names = [];
  source.forEach(function(name) {
    var text = canonicalizeDeskWorkerName_(name);
    var key = normalizeDeskWorkerNameKey_(text);
    if (!text || !key || seen[key]) return;
    seen[key] = true;
    names.push(text);
  });
  return names;
}

function normalizeDeskDailyTaskSortOrder_(value) {
  var num = Number(value);
  return isFinite(num) ? num : 0;
}

function normalizeDeskDailyJournalMemo_(item, fallbackId, dateKey) {
  var now = new Date().toISOString();
  var mode = String((item && item.mode) || "report").trim();
  return {
    id: String((item && item.id) || fallbackId || buildDeskScheduleEntryId_()).trim(),
    dateKey: normalizeDeskDateKey_((item && item.dateKey) || dateKey),
    worker: canonicalizeDeskWorkerName_((item && item.worker) || ""),
    text: String((item && item.text) || "").trim(),
    category: String((item && (item.category || item.type || item.memoType)) || "일반").trim() || "일반",
    mode: mode === "record" ? "record" : "report",
    highlight: !!(item && (item.highlight || item.important || item.major)),
    createdAt: String((item && item.createdAt) || now).trim(),
    updatedAt: String((item && item.updatedAt) || (item && item.createdAt) || now).trim(),
    clientOrder: normalizeDeskDailyMemoClientOrder_(item && item.clientOrder, (item && (item.createdAt || item.updatedAt)) || now)
  };
}

function normalizeDeskDailyMemoClientOrder_(value, stamp) {
  var num = Number(value);
  if (isFinite(num) && num > 0) return num;
  var parsed = Date.parse(String(stamp || ""));
  if (isFinite(parsed)) return parsed * 1000;
  return 0;
}

function normalizeDeskWorkerNameKey_(name) {
  var text = canonicalizeDeskWorkerName_(name);
  return text.replace(/\s+/g, "").toLowerCase();
}

function isDeskDailyJournalSharedTask_(task) {
  var category = String((task && task.category) || "").trim();
  return category.indexOf(DESK_SHARED_CATEGORY_PREFIX) === 0 ||
    normalizeDeskWorkerNameKey_(task && task.worker) === normalizeDeskWorkerNameKey_(DESK_SHARED_WORKER_NAME);
}

function compareDeskDailyJournalTasks_(a, b) {
  if (!!a.completed !== !!b.completed) return a.completed ? 1 : -1;
  if (a.category !== b.category) return String(a.category || "").localeCompare(String(b.category || ""), "ko");
  if (a.worker !== b.worker) return String(a.worker || "").localeCompare(String(b.worker || ""), "ko");
  return String(a.title || "").localeCompare(String(b.title || ""), "ko");
}

function compareDeskDailyJournalMemos_(a, b) {
  var left = String(a.createdAt || a.updatedAt || "");
  var right = String(b.createdAt || b.updatedAt || "");
  if (left !== right) return left.localeCompare(right);
  var leftOrder = normalizeDeskDailyMemoClientOrder_(a && a.clientOrder, left);
  var rightOrder = normalizeDeskDailyMemoClientOrder_(b && b.clientOrder, right);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return String(a.id || "").localeCompare(String(b.id || ""));
}

function buildDefaultDeskScheduleMonthSeed_(monthKey) {
  var parts = String(monthKey || "").split("-");
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10) - 1;
  if (isNaN(year) || isNaN(month)) return [];

  var rules = [
    { worker: "홍성우", role: "총괄 팀장", days: [1, 2, 3, 4, 5, 6, 0], resident: true, note: "근무시간 상주 · 운영 총괄" },
    { worker: "안종성", role: "오후 데스크", days: [2, 4, 5, 6], start: "14:00", end: "22:30", note: "상담/학부모 응대" },
    { worker: "이민현", role: "마감 담당", days: [1, 4, 5, 6], start: "16:00", end: "22:30", note: "마감 점검 및 정산" },
    { worker: "김유민", role: "오전 데스크", days: [2, 4], start: "09:30", end: "17:00", note: "접수 및 행정 처리" },
    { worker: "이창연", role: "주임", days: [3], start: "11:00", end: "18:00", note: "실무 운영 점검" },
    { worker: "김유민", role: "야간 지원", days: [5], start: "17:30", end: "22:30", note: "금요일 마감 보조" }
  ];

  var items = [];
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  for (var day = 1; day <= daysInMonth; day++) {
    var current = new Date(year, month, day);
    var weekday = current.getDay();
    var dateKey = Utilities.formatDate(current, Session.getScriptTimeZone(), "yyyy-MM-dd");
    var weekIndex = getDeskScheduleWeekIndex_(dateKey, monthKey);
    rules.forEach(function(rule, idx) {
      if (rule.days.indexOf(weekday) === -1) return;
      if (rule.worker === "이창연" && weekIndex % 2 === 0) return;
      var time = getDeskScheduleRuleTime_(rule, weekday, weekIndex);
      var entry = normalizeDeskScheduleEntry_({
        id: ["seed", monthKey, day, idx, rule.worker].join("_").replace(/\s+/g, ""),
        date: dateKey,
        worker: rule.worker,
        role: rule.role,
        start: time.start,
        end: time.end,
        resident: !!rule.resident,
        note: time.note || rule.note || ""
      });
      items.push(entry);
    });
  }
  return items;
}

function getDeskScheduleRuleTime_(rule, weekday, weekIndex) {
  if (rule.resident) return { start: "", end: "", note: rule.note || "" };
  var start = rule.start || "";
  var end = rule.end || "";
  if (rule.role === "오전 데스크" && weekday === 0) {
    start = "10:00";
    end = "17:30";
  }
  if (rule.role === "오후 데스크" && weekday === 6) {
    start = "13:30";
    end = "21:00";
  }
  if (rule.role === "운영 지원" && weekIndex === 3) {
    start = "12:30";
    end = "18:30";
  }
  return { start: start, end: end, note: rule.note || "" };
}

function getDeskScheduleWeekIndex_(dateKey, monthKey) {
  var dateParts = String(dateKey || "").split("-");
  var monthParts = String(monthKey || "").split("-");
  var year = parseInt(monthParts[0], 10);
  var month = parseInt(monthParts[1], 10) - 1;
  var day = parseInt(dateParts[2], 10);
  var first = new Date(year, month, 1);
  var offset = (first.getDay() + 6) % 7;
  return Math.floor((offset + day - 1) / 7) + 1;
}

function getFirebaseConfigFromProps_() {
  var props = PropertiesService.getScriptProperties();
  var dbUrl = String(props.getProperty("FIREBASE_DB_URL") || "").trim().replace(/\/+$/, "");
  var projectId = String(props.getProperty("FIREBASE_PROJECT_ID") || "").trim();
  var b64 = String(props.getProperty("FIREBASE_SERVICE_ACCOUNT_JSON_B64") || "").trim();
  if (!dbUrl) throw new Error("스크립트 속성 FIREBASE_DB_URL이 비어 있습니다.");
  if (!b64) throw new Error("스크립트 속성 FIREBASE_SERVICE_ACCOUNT_JSON_B64가 비어 있습니다.");

  var saJsonText = Utilities.newBlob(Utilities.base64Decode(b64)).getDataAsString();
  var serviceAccount = JSON.parse(saJsonText);
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("서비스 계정 JSON 필수 필드(client_email/private_key)가 없습니다.");
  }
  return {
    dbUrl: dbUrl,
    projectId: projectId,
    serviceAccount: serviceAccount
  };
}

function getFirebaseAccessTokenFromServiceAccount_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("FIREBASE_SA_ACCESS_TOKEN_V2");
  if (cached) return cached;

  var cfg = getFirebaseConfigFromProps_();
  var sa = cfg.serviceAccount;
  var now = Math.floor(Date.now() / 1000);
  var header = { alg: "RS256", typ: "JWT" };
  var claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/userinfo.email",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  var encodedHeader = Utilities.base64EncodeWebSafe(JSON.stringify(header)).replace(/=+$/, "");
  var encodedClaim = Utilities.base64EncodeWebSafe(JSON.stringify(claim)).replace(/=+$/, "");
  var unsignedJwt = encodedHeader + "." + encodedClaim;
  var signature = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(unsignedJwt, sa.private_key)
  ).replace(/=+$/, "");
  var jwt = unsignedJwt + "." + signature;

  var response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    },
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  var text = response.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("Firebase 토큰 발급 실패(" + code + "): " + text);
  }
  var tokenResult = JSON.parse(text);
  var accessToken = tokenResult.access_token;
  if (!accessToken) throw new Error("Firebase 토큰 응답에 access_token이 없습니다.");

  cache.put("FIREBASE_SA_ACCESS_TOKEN_V2", accessToken, 3300);
  return accessToken;
}

function firebaseRequestWithServiceAccount_(method, path, payload) {
  var cfg = getFirebaseConfigFromProps_();
  var token = getFirebaseAccessTokenFromServiceAccount_();
  var cleanPath = String(path || "").replace(/^\/+/, "");
  var url = cfg.dbUrl + "/" + cleanPath + ".json";
  var options = {
    method: String(method || "get").toLowerCase(),
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true
  };

  if (typeof payload !== "undefined") {
    options.contentType = "application/json";
    options.payload = JSON.stringify(payload);
  }

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var text = response.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("Firebase 요청 실패(" + code + ") " + cleanPath + ": " + text);
  }
  return text ? JSON.parse(text) : null;
}

function firebaseBatchGetWithServiceAccount_(paths) {
  var cleanPaths = (paths || []).map(function(path) {
    return String(path || "").replace(/^\/+/, "");
  }).filter(Boolean);
  if (!cleanPaths.length) return {};

  var cfg = getFirebaseConfigFromProps_();
  var token = getFirebaseAccessTokenFromServiceAccount_();
  var requests = cleanPaths.map(function(cleanPath) {
    return {
      url: cfg.dbUrl + "/" + cleanPath + ".json",
      method: "get",
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true
    };
  });
  var responses = UrlFetchApp.fetchAll(requests);
  var result = {};
  responses.forEach(function(response, index) {
    var cleanPath = cleanPaths[index];
    var code = response.getResponseCode();
    var text = response.getContentText();
    if (code < 200 || code >= 300) {
      throw new Error("Firebase 일괄 조회 실패(" + code + ") " + cleanPath + ": " + text);
    }
    result[cleanPath] = text ? JSON.parse(text) : null;
  });
  return result;
}

function getFirestoreProjectId_() {
  var props = PropertiesService.getScriptProperties();
  var projectId = String(
    props.getProperty("FIRESTORE_PROJECT_ID") ||
    props.getProperty("FIREBASE_FIRESTORE_PROJECT_ID") ||
    ""
  ).trim();
  if (!projectId) throw new Error("스크립트 속성 FIRESTORE_PROJECT_ID가 비어 있습니다.");
  return projectId;
}

function firestoreRequestWithServiceAccount_(method, path, query, payload) {
  var projectId = getFirestoreProjectId_();
  var token = getFirebaseAccessTokenFromServiceAccount_();
  var cleanPath = String(path || "").replace(/^\/+/, "");
  var queryText = "";
  if (query && typeof query === "object") {
    var parts = [];
    Object.keys(query).forEach(function(key) {
      if (query[key] === null || typeof query[key] === "undefined" || query[key] === "") return;
      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(query[key])));
    });
    if (parts.length) queryText = "?" + parts.join("&");
  }
  var url = "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId) +
    "/databases/(default)/documents/" + cleanPath + queryText;
  var options = {
    method: String(method || "get").toLowerCase(),
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true
  };
  if (typeof payload !== "undefined") {
    options.contentType = "application/json";
    options.payload = JSON.stringify(payload);
  }
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var text = response.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("Firestore 요청 실패(" + code + ") " + cleanPath + ": " + text);
  }
  return text ? JSON.parse(text) : null;
}

function firestoreValueToJs_(value) {
  if (!value || typeof value !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(value, "stringValue")) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, "integerValue")) return Number(value.integerValue || 0);
  if (Object.prototype.hasOwnProperty.call(value, "doubleValue")) return Number(value.doubleValue || 0);
  if (Object.prototype.hasOwnProperty.call(value, "booleanValue")) return !!value.booleanValue;
  if (Object.prototype.hasOwnProperty.call(value, "timestampValue")) return value.timestampValue;
  if (Object.prototype.hasOwnProperty.call(value, "nullValue")) return null;
  if (value.arrayValue) {
    return ((value.arrayValue && value.arrayValue.values) || []).map(function(item) {
      return firestoreValueToJs_(item);
    });
  }
  if (value.mapValue) {
    var result = {};
    var fields = (value.mapValue && value.mapValue.fields) || {};
    Object.keys(fields).forEach(function(key) {
      result[key] = firestoreValueToJs_(fields[key]);
    });
    return result;
  }
  return null;
}

function jsValueToFirestoreValue_(value) {
  if (value === null || typeof value === "undefined") return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Math.floor(value) === value) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(function(item) {
          return jsValueToFirestoreValue_(item);
        })
      }
    };
  }
  if (typeof value === "object") {
    var fields = {};
    Object.keys(value).forEach(function(key) {
      fields[key] = jsValueToFirestoreValue_(value[key]);
    });
    return { mapValue: { fields: fields } };
  }
  return { stringValue: String(value) };
}

function firestoreFieldsFromObject_(obj) {
  var fields = {};
  Object.keys(obj || {}).forEach(function(key) {
    fields[key] = jsValueToFirestoreValue_(obj[key]);
  });
  return fields;
}

function firestoreDocumentToObject_(doc) {
  var fields = (doc && doc.fields) || {};
  var obj = {};
  Object.keys(fields).forEach(function(key) {
    obj[key] = firestoreValueToJs_(fields[key]);
  });
  if (doc && doc.name) {
    var parts = String(doc.name).split("/");
    obj.id = parts[parts.length - 1] || obj.id || "";
  }
  return obj;
}

function firestoreListCollection_(collectionPath, pageSize) {
  var rows = [];
  var pageToken = "";
  do {
    var query = { pageSize: pageSize || 500 };
    if (pageToken) query.pageToken = pageToken;
    var res = firestoreRequestWithServiceAccount_("get", collectionPath, query);
    ((res && res.documents) || []).forEach(function(doc) {
      rows.push(firestoreDocumentToObject_(doc));
    });
    pageToken = String((res && res.nextPageToken) || "");
  } while (pageToken);
  return rows;
}

function firestoreSetDocument_(collectionPath, docId, obj) {
  var cleanCollection = String(collectionPath || "").replace(/^\/+|\/+$/g, "");
  var cleanId = String(docId || "").replace(/^\/+|\/+$/g, "");
  if (!cleanCollection || !cleanId) throw new Error("Firestore 문서 경로가 비어 있습니다.");
  return firestoreRequestWithServiceAccount_("patch", cleanCollection + "/" + cleanId, null, {
    fields: firestoreFieldsFromObject_(obj || {})
  });
}

function firestoreGetDocument_(collectionPath, docId) {
  var cleanCollection = String(collectionPath || "").replace(/^\/+|\/+$/g, "");
  var cleanId = String(docId || "").replace(/^\/+|\/+$/g, "");
  if (!cleanCollection || !cleanId) throw new Error("Firestore 문서 경로가 비어 있습니다.");
  return firestoreDocumentToObject_(firestoreRequestWithServiceAccount_("get", cleanCollection + "/" + cleanId));
}

function firestoreDeleteDocument_(collectionPath, docId) {
  var cleanCollection = String(collectionPath || "").replace(/^\/+|\/+$/g, "");
  var cleanId = String(docId || "").replace(/^\/+|\/+$/g, "");
  if (!cleanCollection || !cleanId) throw new Error("Firestore 문서 경로가 비어 있습니다.");
  return firestoreRequestWithServiceAccount_("delete", cleanCollection + "/" + cleanId);
}

function firebaseSmokeTest() {
  var now = new Date();
  var payload = {
    ok: true,
    timestamp: now.toISOString(),
    scriptTimeZone: Session.getScriptTimeZone(),
    projectId: String(PropertiesService.getScriptProperties().getProperty("FIREBASE_PROJECT_ID") || "")
  };
  firebaseRequestWithServiceAccount_("put", "payroll/_smoke", payload);
  return firebaseRequestWithServiceAccount_("get", "payroll/_smoke");
}

function getFirebaseData() {
  var url = FB_URL + "daily_logs.json?auth=" + FB_SECRET;
  try {
    var response = UrlFetchApp.fetch(url);
    var result = JSON.parse(response.getContentText());
    return result;
  } catch (e) { return null; }
}

function loginUser(phoneInput, passwordInput) {
  try {
    var ss = SpreadsheetApp.openById(TEACHER_SS_ID);
    var cleanInputPhone = String(phoneInput).replace(/[^0-9]/g, ''); 
    var cleanInputPw = String(passwordInput).trim();
    if (/^\d+$/.test(cleanInputPw.replace(/-/g, ''))) cleanInputPw = cleanInputPw.replace(/[^0-9]/g, '');

    var teacherSheet = ss.getSheetByName('Teachers');
    if (!teacherSheet) return { success: false, message: 'Teachers 시트를 찾을 수 없습니다.' };
    var infoSheet = ss.getSheetByName('BasicInfo');
    
    var commonInfo = [];
    if (infoSheet) {
      try {
        var infoData = infoSheet.getDataRange().getDisplayValues();
        for(var i=1; i<infoData.length; i++) {
          if(infoData[i][0]) commonInfo.push({ label: infoData[i][0], value: infoData[i][1] });
        }
      } catch(e) {}
    }

    // [추가] 학생 정보 읽어오기 (student 탭)
    var studentList = [];
    try {
        var studentSheet = ss.getSheetByName('student'); 
        if (studentSheet) {
            var sData = studentSheet.getDataRange().getDisplayValues();
            // 1행은 헤더이므로 2행(인덱스 1)부터 시작
            for (var k = 1; k < sData.length; k++) {
                var rawName = String(sData[k][0]); // 이름 필드 (예: /홍길동)
                var school = String(sData[k][1]);  // 학교 필드
                var grade = String(sData[k][2]);   // 학년 필드

                if (rawName) {
                    // 이름 앞 '/' 제거
                    var cleanName = rawName.replace(/^\//, '').trim();
                    
                    // 학년 '3@' -> '재수생' 변환
                    if (grade === '3@') grade = '재수생';
                    
                    studentList.push({ name: cleanName, school: school, grade: grade });
                }
            }
        }
    } catch (e) { /* 학생 시트 오류 무시 */ }

    var notices = [];
    try {
        var noticeSheet = SpreadsheetApp.openById(ATTENDANCE_SS_ID).getSheetByName('Notice');
        if(noticeSheet) {
            var nData = noticeSheet.getDataRange().getDisplayValues();
            for(var k=1; k<nData.length; k++) {
                if(nData[k][1]) notices.push({ type: nData[k][0], content: nData[k][1] });
            }
        }
    } catch(e) {}

    var data = teacherSheet.getDataRange().getDisplayValues();
    
    // [관리자 목록]
    var ADMIN_PHONES = ['01086262428', '01052259356', '01033934700', '01089945993', '01042327428']; 
    var ADMIN_NAMES = ['안종성', '안준성', '김용찬', '홍성우', '에스에듀']; 

    for (var i = 1; i < data.length; i++) {
      var sheetPhoneClean = String(data[i][0]).replace(/[^0-9]/g, '');
      if ((sheetPhoneClean === cleanInputPhone) || (cleanInputPhone.length >= 8 && sheetPhoneClean.endsWith(cleanInputPhone))) {
        
        var storedPw = String(data[i][6]).trim();
        var isFirstLogin = (storedPw === "");
        var storedPwClean = String(storedPw).replace(/[^0-9a-zA-Z!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, '');
        var isPwMatch = isFirstLogin
          ? (cleanInputPhone.slice(-8) === sheetPhoneClean.slice(-8))
          : (storedPw === passwordInput || storedPw === cleanInputPw || storedPwClean === cleanInputPw);
        
        if (isPwMatch) {
          var userName = String(data[i][1]).trim();
          var isAdmin = ADMIN_PHONES.includes(sheetPhoneClean) || ADMIN_NAMES.includes(userName);
          
          var teacherList = [];
          if (isAdmin) {
             for (var j = 1; j < data.length; j++) {
               if (data[j][1]) {
                 var tLog = data[j][3];
                 if(!tLog || tLog === "") tLog = data[j][4];
                 teacherList.push({ 
                   name: data[j][1], 
                   subject: data[j][2] || "",
                   phone: data[j][0],
                   links: { log: tLog||"", task: data[j][4]||"", hours: data[j][5]||"" }
                 });
               }
             }
          }

          var myLog = data[i][3];
          if(!myLog || myLog === "") myLog = data[i][4];

          return { 
            success: true, 
            name: userName, 
            subject: data[i][2], 
            links: { log: myLog||"", task: data[i][4]||"", hours: data[i][5]||"" }, 
            common: commonInfo,
            notices: notices,
            isFirstLogin: isFirstLogin, 
            isAdmin: isAdmin, 
            teacherList: teacherList,
            studentList: studentList // [핵심] 학생 데이터 전달
          };
        } else {
          return { success: false, message: '비밀번호가 일치하지 않습니다.' };
        }
      }
    }
    return { success: false, message: '등록되지 않은 번호입니다.' };
  } catch (e) { return { success: false, message: '시스템 오류: ' + e.message }; }
}

function syncToFirebase() {
  var ss = SpreadsheetApp.openById(ATTENDANCE_SS_ID);
  var sheets = ss.getSheets();
  var jsonData = {};
  
  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var name = sheet.getName();
    if (!name.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
    
    var data = sheet.getDataRange().getDisplayValues();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[2] || !row[7]) continue; 
      
      var hours = 0;
      if(row[10]) { var match = String(row[10]).match(/[\d.]+/); if(match) hours = parseFloat(match[0]); }
      
      var teacherName = String(row[7]).trim();
      var key = name.replace(/-/g, '') + '_' + i; 
      
      var rawStudent = String(row[2]).trim();
      while(rawStudent.startsWith('/')) rawStudent = rawStudent.substring(1);
      
      var parts = rawStudent.split('/');
      var sName = parts[0].trim();
      var sSchool = parts[1] ? parts[1].trim() : (row[3] || ""); 
      var sGrade = parts[2] ? parts[2].trim() : (row[4] || ""); 

      jsonData[key] = { 
        date: name, 
        category: row[1], 
        student: sName,   
        school: sSchool,  
        grade: sGrade,    
        raw: rawStudent,  
        status: row[5], 
        teacher: teacherName, 
        start: row[8], 
        end: row[9], 
        hours: hours, 
        note: row[11] 
      };
    }
  }

  var url = FB_URL + "daily_logs.json?auth=" + FB_SECRET;
  var options = { method: "put", contentType: "application/json", payload: JSON.stringify(jsonData) };
  try { UrlFetchApp.fetch(url, options); return {success: true}; } 
  catch(e) { return {success: false, message: e.message}; }
}

function saveAttendanceData(payload) {
  try {
    if (!payload || !payload.date) return { success: false, message: '요청 데이터가 올바르지 않습니다.' };
    if (!payload.students || !payload.students.length) return { success: false, message: '학생 정보가 없습니다.' };

    var ss = SpreadsheetApp.openById(ATTENDANCE_SS_ID);
    var dateObj = new Date(payload.date);
    if (isNaN(dateObj.getTime())) return { success: false, message: '날짜 형식이 올바르지 않습니다.' };
    var dateStr = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var sheet = ss.getSheetByName(dateStr);
    
    if (!sheet) {
        var template = ss.getSheetByName('Daily_Log_Template') || ss.getSheetByName('Template');
        if(template) sheet = template.copyTo(ss).setName(dateStr);
        else return { success: false, message: '템플릿 시트가 없습니다.' };
    }
    
    var days = ['일','월','화','수','목','금','토'];
    var displayDate = (dateObj.getMonth()+1) + '/' + dateObj.getDate() + '(' + days[dateObj.getDay()] + ')';
    
    for(var k=0; k<payload.students.length; k++) {
      var student = String(payload.students[k] || "").trim();
      if (!student) continue;
      var newRow = [displayDate, payload.category, student, "", "", payload.status, "반포", payload.teacher, payload.start, payload.end, payload.hours, payload.note];
      sheet.appendRow(newRow);
    }
    
    syncToFirebase(); 
    return { success: true };
  } catch(e) { return { success: false, message: '저장 실패: ' + e.message }; }
}

function changePassword(phoneInput, newPassword) {
  var ss = SpreadsheetApp.openById(TEACHER_SS_ID);
  var sheet = ss.getSheetByName('Teachers');
  if (!sheet) return { success: false, message: 'Teachers 시트를 찾을 수 없습니다.' };
  var data = sheet.getDataRange().getValues();
  var targetPhone = String(phoneInput).replace(/\D/g, '');
  if (targetPhone.length < 8) return { success: false, message: '전화번호가 올바르지 않습니다.' };
  for (var i = 1; i < data.length; i++) {
    var rowPhone = String(data[i][0]).replace(/\D/g, '');
    if (rowPhone === targetPhone || rowPhone.slice(-8) === targetPhone.slice(-8)) {
      sheet.getRange(i + 1, 7).setValue(newPassword);
      return { success: true };
    }
  }
  return { success: false, message: '대상 사용자를 찾을 수 없습니다.' };
}

function getNoticeData() {
  try {
    var ss = SpreadsheetApp.openById(ATTENDANCE_SS_ID); 
    var sheet = ss.getSheetByName('Notice');
    if (!sheet) return [];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    var result = [];
    for(var i=0; i<data.length; i++) if(data[i][1]) result.push({ type: data[i][0], content: data[i][1] });
    return result;
  } catch (e) { return []; }
}

function reviewDailyAttendance(dateInput) {
  try {
    var ss = SpreadsheetApp.openById(ATTENDANCE_SS_ID);
    var tz = Session.getScriptTimeZone();
    var d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) return { success: false, message: '날짜 형식이 올바르지 않습니다.' };
    var dateStr = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    var sheet = ss.getSheetByName(dateStr);
    if (!sheet) return { success: true, date: dateStr, rows: 0, issues: [], summary: { critical: 0, warning: 0 } };

    var data = sheet.getDataRange().getDisplayValues();
    var issues = [];
    var summary = { critical: 0, warning: 0 };
    var rows = Math.max(0, data.length - 1);

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var line = i + 1;
      var category = String(row[1] || '').trim();
      var student = String(row[2] || '').trim();
      var status = String(row[5] || '').trim();
      var teacher = String(row[7] || '').trim();
      var start = String(row[8] || '').trim();
      var end = String(row[9] || '').trim();
      var hours = parseHours_(row[10]);

      // 일일 합계/구분선 행 등 실제 수업 레코드가 아닌 행은 검토 제외
      if (!isReviewTargetRow_(category, teacher, student, status, start, end)) continue;

      if (!status) pushIssue_(issues, summary, 'critical', line, '출결 미입력', '출결 상태(F열)가 비어 있습니다.');
      if (!student) pushIssue_(issues, summary, 'warning', line, '학생명 미입력', '학생명(C열)이 비어 있습니다.');
      if (!start || !end) pushIssue_(issues, summary, 'warning', line, '수업 시간 미입력', '시작/종료 시간(I/J열)이 비어 있습니다.');

      var parsed = parseTimeRangeHours_(start, end);
      if (parsed > 0) {
        if (parsed > 4.5 || parsed < 1.5) {
          pushIssue_(
            issues,
            summary,
            'warning',
            line,
            '비정상 수업 시간',
            '수업: ' + (category || '-') + ' / 학생: ' + (student || '-') + ' / 시간: ' + start + '~' + end + ' / 계산: ' + parsed.toFixed(1) + 'H'
          );
        }
        if (hours > 0 && Math.abs(hours - parsed) >= 0.2) {
          pushIssue_(issues, summary, 'warning', line, '시간 불일치', '입력 시수(K열)와 시작/종료 시간 계산값이 다릅니다. 입력: ' + hours.toFixed(1) + 'H / 계산: ' + parsed.toFixed(1) + 'H');
        }
      }

      var nameFromCategory = extractTeacherFromCategory_(category);
      var teacherNorm = normalizeName_(teacher);
      if (nameFromCategory && teacherNorm) {
        if (!(teacherNorm.indexOf(nameFromCategory) > -1 || nameFromCategory.indexOf(teacherNorm) > -1)) {
          pushIssue_(issues, summary, 'critical', line, '강사명 불일치', '수업명(B열) 내 강사명과 TR 강사명(H열)이 다릅니다. B열: ' + category + ' / H열: ' + teacher);
        }
      }
    }

    return { success: true, date: dateStr, rows: rows, issues: issues, summary: summary };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function parseHours_(value) {
  var m = String(value || '').match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

function parseTimeRangeHours_(start, end) {
  var s = parseTimeToMinutes_(start);
  var e = parseTimeToMinutes_(end);
  if (s < 0 || e < 0 || e <= s) return 0;
  return (e - s) / 60;
}

function parseTimeToMinutes_(raw) {
  if (!raw) return -1;
  var text = String(raw).trim();
  var m = text.match(/(오전|오후)?\s*(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return -1;
  var hour = parseInt(m[2], 10);
  var min = parseInt(m[3], 10);
  if (isNaN(hour) || isNaN(min)) return -1;
  if (m[1] === '오전' && hour === 12) hour = 0;
  if (m[1] === '오후' && hour < 12) hour += 12;
  if (hour < 0 || hour > 23 || min < 0 || min > 59) return -1;
  return hour * 60 + min;
}

function normalizeName_(name) {
  return String(name || '')
    .replace(/\s+/g, '')
    .replace(/선생님|teacher|강사|TR|T/gi, '')
    .replace(/[^가-힣A-Za-z]/g, '')
    .trim();
}

function extractTeacherFromCategory_(category) {
  var text = String(category || '').trim();
  if (!text) return '';

  // 1순위: 괄호 내 마지막 값 (예: 국어-개별(남중언)-1h -> 남중언)
  var re = /\(([^()]*)\)/g;
  var match;
  var last = '';
  while ((match = re.exec(text)) !== null) last = match[1];
  if (last) return normalizeName_(last);

  // 2순위: 하이픈 분리 후 시간 토큰 제외한 마지막 텍스트
  var parts = text.split('-').map(function(p) { return p.trim(); }).filter(function(p) { return p; });
  for (var i = parts.length - 1; i >= 0; i--) {
    var token = parts[i];
    if (/^\d+(\.\d+)?\s*(h|시간)$/i.test(token)) continue;
    var norm = normalizeName_(token);
    if (norm) return norm;
  }
  return '';
}

function pushIssue_(issues, summary, severity, line, title, detail) {
  issues.push({ severity: severity, line: line, title: title, detail: detail });
  if (severity === 'critical') summary.critical++;
  else summary.warning++;
}

function isReviewTargetRow_(category, teacher, student, status, start, end) {
  // 비수업 합계행(예: F열에 숫자만 있고 나머지 공백) 제외
  if (!category && !teacher && !student && !start && !end) return false;

  // "총 시수" 성격의 요약 행 제외
  if (!category && !teacher && !start && !end && /^\d+(\.\d+)?$/.test(String(status || '').trim())) return false;

  return true;
}

function saveClassLogRows(payload) {
  try {
    if (!payload || !payload.rows || !payload.rows.length) {
      return { success: false, message: '저장할 수업일지 데이터가 없습니다.' };
    }

    var ss = SpreadsheetApp.openById(ATTENDANCE_SS_ID);
    var sheet = ss.getSheetByName('Class Log');
    if (!sheet) return { success: false, message: 'Class Log 시트를 찾을 수 없습니다.' };

    var tz = Session.getScriptTimeZone();
    var values = [];
    var incoming = {};
    for (var i = 0; i < payload.rows.length; i++) {
      var r = payload.rows[i];
      var teacher = String(r.teacher || '').replace(/\s*T$/i, '').trim();
      var student = String(r.student || '').trim();
      var dateText = String(r.date || '').trim();
      var status = String(r.logStatus || '').trim();
      var reason = String(r.reason || '').trim();

      if (!teacher || !student || !dateText || !status) continue;

      var d = new Date(dateText);
      var dateValue = isNaN(d.getTime()) ? dateText : Utilities.formatDate(d, tz, 'yyyy-MM-dd');
      var key = [teacher, student, dateValue].join('|');
      incoming[key] = [teacher, student, dateValue, status, reason];
    }

    for (var k in incoming) values.push(incoming[k]);
    if (!values.length) return { success: false, message: '유효한 행이 없어 저장하지 못했습니다.' };

    // 같은 강사/학생/일자 키가 이미 있으면 업데이트, 없으면 append
    var lastRow = sheet.getLastRow();
    var existingMap = {};
    if (lastRow >= 2) {
      var existing = sheet.getRange(2, 1, lastRow - 1, 5).getDisplayValues();
      for (var e = 0; e < existing.length; e++) {
        var er = existing[e];
        var exTeacher = String(er[0] || '').replace(/\s*T$/i, '').trim();
        var exStudent = String(er[1] || '').trim();
        var exDateRaw = String(er[2] || '').trim();
        var exDate = exDateRaw;
        var exParsed = new Date(exDateRaw);
        if (!isNaN(exParsed.getTime())) exDate = Utilities.formatDate(exParsed, tz, 'yyyy-MM-dd');
        var exKey = [exTeacher, exStudent, exDate].join('|');
        if (!existingMap[exKey]) existingMap[exKey] = [];
        existingMap[exKey].push(e + 2);
      }
    }

    var appendValues = [];
    for (var v = 0; v < values.length; v++) {
      var row = values[v];
      var rowKey = [row[0], row[1], row[2]].join('|');
      var rowsToUpdate = existingMap[rowKey] || [];
      if (rowsToUpdate.length) {
        for (var u = 0; u < rowsToUpdate.length; u++) {
          sheet.getRange(rowsToUpdate[u], 4, 1, 2).setValues([[row[3], row[4]]]);
        }
      } else {
        appendValues.push(row);
      }
    }
    if (appendValues.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, appendValues.length, 5).setValues(appendValues);
    }
    invalidateClassLogOverviewCache_(values);
    return { success: true, count: values.length };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getClassLogMonthlyOverview(payload) {
  try {
    var now = new Date();
    var year = parseInt((payload && payload.year) || now.getFullYear(), 10);
    var month = parseInt((payload && payload.month) || (now.getMonth() + 1), 10); // 1-12
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return { success: false, message: '조회 월 정보가 올바르지 않습니다.' };
    }

    var cacheKey = 'classlog_overview_' + year + '_' + month;
    var cache = CacheService.getScriptCache();
    var cached = cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e0) {}
    }

    var ss = SpreadsheetApp.openById(ATTENDANCE_SS_ID);
    var tz = Session.getScriptTimeZone();
    var first = new Date(year, month - 1, 1);
    var daysInMonth = new Date(year, month, 0).getDate();

    var taughtMap = {}; // key: yyyy-MM-dd|teacher => {count, hours, students:{}, lessons:[]}

    for (var d = 1; d <= daysInMonth; d++) {
      var dateObj = new Date(year, month - 1, d);
      var dateKey = Utilities.formatDate(dateObj, tz, 'yyyy-MM-dd');
      var sheet = ss.getSheetByName(dateKey);
      if (!sheet) continue;
      var data = sheet.getDataRange().getDisplayValues();
      if (!data || data.length < 2) continue;

      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var category = String(row[1] || '').trim();
        var student = String(row[2] || '').trim();
        var status = String(row[5] || '').trim();
        var teacherRaw = String(row[7] || '').trim();
        var start = String(row[8] || '').trim();
        var end = String(row[9] || '').trim();
        var hours = parseHours_(row[10]);

        if (!isReviewTargetRow_(category, teacherRaw, student, status, start, end)) continue;
        if (!teacherRaw) continue;
        if (status === '당일취소' || status.indexOf('예고') > -1) continue;

        if (hours <= 0) hours = parseTimeRangeHours_(start, end);
        if (hours <= 0) continue;

        var teacher = normalizeTeacherDisplay_(teacherRaw);
        var tk = dateKey + '|' + teacher;
        if (!taughtMap[tk]) taughtMap[tk] = { count: 0, hours: 0, students: {}, lessons: [] };
        taughtMap[tk].count += 1;
        taughtMap[tk].hours += hours;
        if (student) taughtMap[tk].students[student] = true;
        taughtMap[tk].lessons.push({
          student: student,
          status: status,
          start: start,
          end: end,
          time: compactTimeRange_(start, end),
          className: category,
          hours: Math.round(hours * 10) / 10
        });
      }
    }

    var classLogSheet = ss.getSheetByName('Class Log');
    if (!classLogSheet) return { success: false, message: 'Class Log 시트를 찾을 수 없습니다.' };

    var logMap = {}; // key: yyyy-MM-dd|teacher => {total, submitted, missing, reasons:{}, entries:[]}
    var lr = classLogSheet.getLastRow();
    if (lr >= 2) {
      var logs = classLogSheet.getRange(2, 1, lr - 1, 5).getDisplayValues();
      for (var j = 0; j < logs.length; j++) {
        var r = logs[j];
        var tName = normalizeTeacherDisplay_(r[0]);
        var dateRaw = String(r[2] || '').trim();
        var st = String(r[3] || '').trim();
        var reason = String(r[4] || '').trim();
        if (!tName || !dateRaw) continue;

        var dObj = new Date(dateRaw);
        var dKey = isNaN(dObj.getTime()) ? dateRaw : Utilities.formatDate(dObj, tz, 'yyyy-MM-dd');
        if (dKey.slice(0, 7) !== Utilities.formatDate(first, tz, 'yyyy-MM')) continue;

        var lk = dKey + '|' + tName;
        if (!logMap[lk]) logMap[lk] = { total: 0, submitted: 0, missing: 0, reasons: {}, entries: [] };
        logMap[lk].total += 1;
        logMap[lk].entries.push({
          student: String(r[1] || '').trim(),
          status: st,
          reason: reason
        });
        if (st === '미제출') {
          logMap[lk].missing += 1;
          if (reason) logMap[lk].reasons[reason] = true;
        } else {
          logMap[lk].submitted += 1;
        }
      }
    }

    var dayMap = {};
    for (var day = 1; day <= daysInMonth; day++) {
      var dayObj = new Date(year, month - 1, day);
      var dayKey = Utilities.formatDate(dayObj, tz, 'yyyy-MM-dd');
      var teacherSet = {};

      var seenKeys = Object.keys(taughtMap);
      for (var a = 0; a < seenKeys.length; a++) {
        if (seenKeys[a].indexOf(dayKey + '|') === 0) teacherSet[seenKeys[a].split('|')[1]] = true;
      }
      var logKeys = Object.keys(logMap);
      for (var b = 0; b < logKeys.length; b++) {
        if (logKeys[b].indexOf(dayKey + '|') === 0) teacherSet[logKeys[b].split('|')[1]] = true;
      }

      var teachers = Object.keys(teacherSet).sort(function(x, y) { return x.localeCompare(y, 'ko'); });
      var rows = [];
      var missingTeachers = [];
      var submittedTeachers = [];
      var partialTeachers = [];
      var noLogTeachers = [];

      for (var t = 0; t < teachers.length; t++) {
        var teacherName = teachers[t];
        var key = dayKey + '|' + teacherName;
        var taught = taughtMap[key] || { count: 0, hours: 0, students: {}, lessons: [] };
        var log = logMap[key] || { total: 0, submitted: 0, missing: 0, reasons: {}, entries: [] };
        var hasClass = taught.count > 0;
        var statusLabel = '기록 없음';
        if (hasClass) {
          if (log.total === 0) statusLabel = '기록없음';
          else if (log.missing > 0 && log.submitted > 0) statusLabel = '부분 미제출';
          else if (log.missing > 0) statusLabel = '미제출';
          else statusLabel = '제출 완료';
        } else if (log.total > 0) {
          statusLabel = '기록만 존재';
        }

        if (hasClass && statusLabel === '제출 완료') submittedTeachers.push(teacherName);
        if (hasClass && statusLabel === '미제출') missingTeachers.push(teacherName);
        if (hasClass && statusLabel === '부분 미제출') partialTeachers.push(teacherName);
        if (hasClass && statusLabel === '기록없음') noLogTeachers.push(teacherName);

        rows.push({
          teacher: teacherName,
          hasClass: hasClass,
          taughtCount: taught.count,
          taughtHours: Math.round(taught.hours * 10) / 10,
          logCount: log.total,
          submittedCount: log.submitted,
          missingCount: log.missing,
          reasons: Object.keys(log.reasons),
          logEntries: log.entries,
          taughtStudents: Object.keys(taught.students || {}),
          taughtLessons: taught.lessons || [],
          status: statusLabel
        });
      }

      dayMap[dayKey] = {
        dateKey: dayKey,
        day: day,
        teachers: rows,
        taughtTeacherCount: submittedTeachers.length + missingTeachers.length + partialTeachers.length + noLogTeachers.length,
        submittedTeacherCount: submittedTeachers.length,
        missingTeacherCount: missingTeachers.length,
        partialTeacherCount: partialTeachers.length,
        noLogTeacherCount: noLogTeachers.length,
        missingTeachers: missingTeachers,
        partialTeachers: partialTeachers,
        noLogTeachers: noLogTeachers
      };
    }

    var result = {
      success: true,
      year: year,
      month: month,
      daysInMonth: daysInMonth,
      dayMap: dayMap
    };
    cache.put(cacheKey, JSON.stringify(result), 300);
    return result;
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function invalidateClassLogOverviewCache_(rows) {
  try {
    var cache = CacheService.getScriptCache();
    if (!rows || !rows.length) return;
    for (var i = 0; i < rows.length; i++) {
      var dateText = String(rows[i][2] || '').trim();
      if (!dateText) continue;
      var d = new Date(dateText);
      if (isNaN(d.getTime())) continue;
      var key = 'classlog_overview_' + d.getFullYear() + '_' + (d.getMonth() + 1);
      cache.remove(key);
    }
  } catch (e) {}
}

function compactTimeRange_(start, end) {
  var s = compactTimeLabel_(start);
  var e = compactTimeLabel_(end);
  if (!s && !e) return '';
  if (!e) return s;
  if (!s) return e;
  return s + '~' + e;
}

function compactTimeLabel_(raw) {
  var text = String(raw || '').trim();
  if (!text) return '';
  var m = text.match(/(오전|오후)?\s*(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return text;
  var hour = parseInt(m[2], 10);
  var min = String(m[3] || '00');
  var ampm = m[1] || '';
  if (!ampm) {
    if (hour === 0) { ampm = '오전'; hour = 12; }
    else if (hour < 12) ampm = '오전';
    else if (hour === 12) ampm = '오후';
    else { ampm = '오후'; hour -= 12; }
  } else {
    if (ampm === '오전' && hour === 0) hour = 12;
    if (ampm === '오후' && hour > 12) hour -= 12;
  }
  return ampm + ' ' + hour + ':' + min;
}

function normalizeTeacherDisplay_(name) {
  return String(name || '')
    .replace(/\s*T$/i, '')
    .replace(/선생님|teacher|강사|TR/gi, '')
    .replace(/\s+/g, '')
    .trim();
}

function getEventCalendarData(payload) {
  try {
    var now = new Date();
    var year = parseInt((payload && payload.year) || now.getFullYear(), 10);
    var month = parseInt((payload && payload.month) || (now.getMonth() + 1), 10); // 1-12
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return { success: false, message: '조회 월 정보가 올바르지 않습니다.' };
    }

    var ss = SpreadsheetApp.openById(ATTENDANCE_SS_ID);
    var sheet = ss.getSheetByName('event') || ss.getSheetByName('Event');
    if (!sheet) return { success: true, year: year, month: month, events: [], dayMap: {} };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, year: year, month: month, events: [], dayMap: {} };

    var tz = Session.getScriptTimeZone();
    var values = sheet.getRange(2, 1, lastRow - 1, 4).getValues(); // 날짜, 대상, 이벤트명, 비고
    var displays = sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues();
    var events = [];
    var dayMap = {};

    for (var i = 0; i < values.length; i++) {
      var dateCell = values[i][0];
      var dateObj = null;
      if (Object.prototype.toString.call(dateCell) === '[object Date]' && !isNaN(dateCell.getTime())) {
        dateObj = new Date(dateCell.getFullYear(), dateCell.getMonth(), dateCell.getDate());
      } else {
        var text = String(displays[i][0] || '').trim();
        if (!text) continue;
        var parsed = new Date(text);
        if (!isNaN(parsed.getTime())) dateObj = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      }
      if (!dateObj) continue;
      if (dateObj.getFullYear() !== year || dateObj.getMonth() !== (month - 1)) continue;

      var dateKey = Utilities.formatDate(dateObj, tz, 'yyyy-MM-dd');
      var row = {
        dateKey: dateKey,
        day: dateObj.getDate(),
        target: String(displays[i][1] || '').trim(),
        title: String(displays[i][2] || '').trim(),
        note: String(displays[i][3] || '').trim()
      };
      if (!row.title && !row.target && !row.note) continue;
      events.push(row);
      if (!dayMap[dateKey]) dayMap[dateKey] = [];
      dayMap[dateKey].push(row);
    }

    events.sort(function(a, b) {
      if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? -1 : 1;
      return String(a.title).localeCompare(String(b.title), 'ko');
    });

    return { success: true, year: year, month: month, events: events, dayMap: dayMap };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getPayrollBootstrapData() {
  try {
    var monthSheets = getPayrollMonthSheetNames_();
    if (!monthSheets.length) {
      return { success: false, message: "급여 정산 월 탭(예: 26-02)을 찾을 수 없습니다." };
    }

    var selectedMonth = monthSheets[0];
    return {
      success: true,
      months: monthSheets,
      selectedMonth: selectedMonth
    };
  } catch (e) {
    return { success: false, message: "초기 데이터 로드 오류: " + e.message };
  }
}

function getTuitionBootstrapData() {
  try {
    var months = getTuitionMonthSheetNames_();
    if (!months.length) {
      return { success: false, message: "수강료 월 탭(예: 26-02s)을 찾을 수 없습니다." };
    }
    var selectedMonth = months[0];
    var summary = getTuitionMonthSummary({ monthName: selectedMonth, statusFilter: "", keyword: "" });
    if (!summary || !summary.success) return summary;
    return {
      success: true,
      months: months,
      selectedMonth: selectedMonth,
      summary: summary
    };
  } catch (e) {
    return { success: false, message: "수강료 초기 데이터 로드 오류: " + e.message };
  }
}

function getTuitionSummaryCacheKey_(monthName) {
  return TUITION_MONTH_SUMMARY_CACHE_PREFIX + String(monthName || "").trim();
}

function cloneTuitionJson_(value) {
  try {
    return JSON.parse(JSON.stringify(value || {}));
  } catch (e) {
    return {};
  }
}

function buildTuitionMonthSnapshotDocId_(monthName) {
  var month = String(monthName || "").trim();
  if (!month) return "";
  return "tm_" + month.replace(/[^\w-]/g, "_");
}

function readTuitionJsonCache_(cacheKey) {
  if (!cacheKey) return null;
  try {
    var raw = CacheService.getScriptCache().get(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeTuitionJsonCache_(cacheKey, value, ttlSeconds) {
  if (!cacheKey || !value) return;
  try {
    CacheService.getScriptCache().put(cacheKey, JSON.stringify(value), ttlSeconds || 60);
  } catch (e) {}
}

function invalidateTuitionSummaryCache_(monthName) {
  var month = String(monthName || "").trim();
  if (!month) return;
  try {
    CacheService.getScriptCache().remove(getTuitionSummaryCacheKey_(month));
  } catch (e) {}
  try {
    firestoreDeleteDocument_(TUITION_MONTH_SNAPSHOT_FIRESTORE_COLLECTION, buildTuitionMonthSnapshotDocId_(month));
  } catch (e2) {}
}

function readTuitionMonthSnapshotFromFirestore_(monthName) {
  var month = String(monthName || "").trim();
  if (!month) return null;
  try {
    var doc = firestoreGetDocument_(TUITION_MONTH_SNAPSHOT_FIRESTORE_COLLECTION, buildTuitionMonthSnapshotDocId_(month));
    if (!doc || doc.success !== true || !Array.isArray(doc.rows)) return null;
    if (!doc.snapshot || doc.snapshot.schemaVersion !== TUITION_MONTH_SNAPSHOT_SCHEMA_VERSION) return null;
    return doc;
  } catch (e) {
    return null;
  }
}

function writeTuitionMonthSnapshotToFirestore_(monthName, summary) {
  var month = String(monthName || "").trim();
  if (!month || !summary || summary.success !== true) return;
  try {
    var snapshot = cloneTuitionJson_(summary);
    snapshot.snapshot = {
      source: "firestore",
      monthName: month,
      computedAt: new Date().toISOString(),
      schemaVersion: TUITION_MONTH_SNAPSHOT_SCHEMA_VERSION
    };
    snapshot.cache = null;
    firestoreSetDocument_(TUITION_MONTH_SNAPSHOT_FIRESTORE_COLLECTION, buildTuitionMonthSnapshotDocId_(month), snapshot);
  } catch (e) {}
}

function applyTuitionSummaryFilters_(summary, statusFilter, keyword) {
  var result = cloneTuitionJson_(summary);
  var status = String(statusFilter || "").trim();
  var needle = String(keyword || "").trim().toLowerCase();
  var rows = (Array.isArray(result.rows) ? result.rows : []).filter(function(row) {
    if (status && row.unpaidStatus !== status) return false;
    if (needle) {
      var blob = [row.studentName, row.school, row.grade, row.unpaidStatus].join(" ").toLowerCase();
      if (blob.indexOf(needle) === -1) return false;
    }
    return true;
  });
  var stats = buildTuitionSummaryStats_(rows, result.allPayments || []);
  result.rows = rows;
  result.kpi = stats.kpi;
  result.chart = stats.chart;
  result.allPayments = stats.allPayments;
  result.payments = stats.payments;
  result.filtered = !!(status || needle);
  return result;
}

function getTuitionMonthSummary(payload) {
  try {
    var req = payload || {};
    var months = getTuitionMonthSheetNames_();
    if (!months.length) {
      return { success: false, message: "수강료 월 탭(예: 26-02s)을 찾을 수 없습니다." };
    }
    var monthName = String(req.monthName || months[0]).trim();
    var statusFilter = String(req.statusFilter || "").trim();
    var keyword = String(req.keyword || "").trim().toLowerCase();
    var forceRefresh = req.forceRefresh === true;
    var canUseSummaryCache = !!monthName && !statusFilter && !keyword && !forceRefresh;
    var summaryCacheKey = canUseSummaryCache ? getTuitionSummaryCacheKey_(monthName) : "";
    var cachedSummary = canUseSummaryCache ? readTuitionJsonCache_(summaryCacheKey) : null;
    if (cachedSummary && cachedSummary.success) {
      cachedSummary.cache = {
        source: "script-cache",
        key: summaryCacheKey
      };
      return cachedSummary;
    }
    if (!forceRefresh && monthName) {
      var firestoreSnapshot = readTuitionMonthSnapshotFromFirestore_(monthName);
      if (firestoreSnapshot && firestoreSnapshot.success) {
        firestoreSnapshot.months = months;
        firestoreSnapshot.selectedMonth = monthName;
        firestoreSnapshot.cache = {
          source: "firestore-snapshot",
          documentId: buildTuitionMonthSnapshotDocId_(monthName),
          computedAt: firestoreSnapshot.snapshot && firestoreSnapshot.snapshot.computedAt || ""
        };
        var filteredSnapshot = applyTuitionSummaryFilters_(firestoreSnapshot, statusFilter, keyword);
        if (canUseSummaryCache) {
          writeTuitionJsonCache_(summaryCacheKey, filteredSnapshot, TUITION_MONTH_SUMMARY_CACHE_TTL_SECONDS);
        }
        return filteredSnapshot;
      }
    }
    var allPaymentRows = getTuitionPaymentRowsForMonth_(monthName);
    var paymentRows = [];
    var todayRows = [];
    var now = new Date();
    var todayMonthDay = ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2);
    allPaymentRows.forEach(function(row) {
      var dueMonth = row.sourceDueMonth || parseTuitionDueMonthName_(row.dueDate);
      if (dueMonth && dueMonth === monthName) {
        paymentRows.push(row);
      }
      var paidMonthDay = extractTuitionMonthDay_(row.paidAt);
      if (paidMonthDay && paidMonthDay === todayMonthDay) {
        todayRows.push(row);
      }
    });
    var paymentStudentMap = {};
    paymentRows.forEach(function(row) {
      var pkey = normalizeTuitionStudentName_(row.studentName);
      if (!pkey) return;
      paymentStudentMap[pkey] = true;
    });
    var classStudentMap = loadTuitionClassStudentMapByMonth_(monthName);
    var studentMasterBundle = loadTuitionStudentMasterBundle_();
    var studentRows = studentMasterBundle.rows || [];
    var followupBundle = loadTuitionFollowupRowsBundle_({ monthName: monthName });
    var followupMap = buildTuitionFollowupMapFromRecords_(followupBundle.rows, monthName);
    var guideAmountAudit = buildTuitionGuideAmountAudit_(monthName, followupBundle.sheetRows, followupBundle.firestoreRows, followupBundle.rows, followupBundle.skippedSheetRows);

    var studentMap = {};
    studentRows.forEach(function(row) {
      var key = normalizeTuitionStudentName_(row.name);
      if (!key) return;
      if (classStudentMap && !classStudentMap[key] && !paymentStudentMap[key]) return;
      studentMap[key] = {
        studentName: row.name,
        school: row.school,
        grade: row.grade,
        guideAmount: 0,
        collectedAmount: 0,
        paymentCount: 0,
        latestPaidAt: "",
        latestBusiness: "",
        latestMethod: "",
        latestApprovalNo: "",
        latestInputAt: "",
        latestPaymentSortKey: -1,
        latestPaymentRowNumber: 0,
        unpaidStatus: "안내이전",
        contactCount: 0,
        lastContactAt: "",
        lastContactMemo: "",
        lastUpdatedAt: ""
      };
    });

    paymentRows.forEach(function(row) {
      var key = normalizeTuitionStudentName_(row.studentName);
      if (!key) return;
      var target = studentMap[key];
      // student 탭 '등록 상태' 체크된 학생만 재원생 수강료 정산 대상에 포함
      if (!target) return;
      // 받은 금액은 음수, 환불은 양수 -> 수납 실적은 -금액의 합
      target.collectedAmount += (0 - row.amount);
      target.paymentCount += 1;
      var paymentSortKey = getTuitionPaymentSortKey_(row);
      var latestInputSortKey = parseTuitionDateTimeMs_(target.latestInputAt, monthName);
      var currentInputSortKey = parseTuitionDateTimeMs_(row.inputAt, monthName);
      if (
        paymentSortKey > target.latestPaymentSortKey ||
        (paymentSortKey === target.latestPaymentSortKey && currentInputSortKey > latestInputSortKey) ||
        (
        paymentSortKey === target.latestPaymentSortKey &&
        currentInputSortKey === latestInputSortKey &&
          toPayrollNumber_(row.rowNumber) > toPayrollNumber_(target.latestPaymentRowNumber)
        )
      ) {
        target.latestPaidAt = row.paidAt || "";
        target.latestBusiness = row.business || "";
        target.latestMethod = row.paymentType || "";
        target.latestApprovalNo = row.approvalNo || "";
        target.latestInputAt = row.inputAt || "";
        target.latestPaymentSortKey = paymentSortKey;
        target.latestPaymentRowNumber = toPayrollNumber_(row.rowNumber);
      }
    });

    Object.keys(studentMap).forEach(function(key) {
      var target = studentMap[key];
      var follow = followupMap[key];
      if (follow) {
        target.guideAmount = Math.max(0, toPayrollNumber_(follow.guideAmount));
        target.unpaidStatus = normalizeTuitionUnpaidStatus_(follow.unpaidStatus);
        target.contactCount = Math.max(0, parseInt(follow.contactCount || 0, 10) || 0);
        target.lastContactAt = String(follow.lastContactAt || "");
        target.lastContactMemo = String(follow.lastContactMemo || "");
        target.lastUpdatedAt = String(follow.lastUpdatedAt || "");
      }

      var computedOutstanding = Math.max(0, Math.round((target.guideAmount || 0) - (target.collectedAmount || 0)));
      if (
        (target.guideAmount > 0 && target.collectedAmount >= target.guideAmount) ||
        (target.guideAmount <= 0 && target.collectedAmount > 0)
      ) {
        target.unpaidStatus = "납부완료";
      } else if (target.guideAmount > 0 && target.collectedAmount > 0 && computedOutstanding > 0) {
        target.unpaidStatus = "일부완료";
      } else if (computedOutstanding > 0 && target.unpaidStatus === "납부완료") {
        target.unpaidStatus = "확인필요";
      } else if (!follow) {
        target.unpaidStatus = "안내이전";
      }

      target.guideAmount = Math.round(target.guideAmount || 0);
      target.collectedAmount = Math.round(target.collectedAmount || 0);
      target.outstandingAmount = computedOutstanding;
    });

    var list = Object.keys(studentMap).map(function(key) {
      var row = studentMap[key];
      row.studentKey = key;
      delete row.latestInputAt;
      delete row.latestPaymentSortKey;
      delete row.latestPaymentRowNumber;
      return row;
    }).filter(function(row) {
      if (statusFilter && row.unpaidStatus !== statusFilter) return false;
      if (keyword) {
        var blob = [row.studentName, row.school, row.grade, row.unpaidStatus].join(" ").toLowerCase();
        if (blob.indexOf(keyword) === -1) return false;
      }
      return true;
    }).sort(function(a, b) {
      var aDone = a.unpaidStatus === "납부완료" || a.unpaidStatus === "이월금";
      var bDone = b.unpaidStatus === "납부완료" || b.unpaidStatus === "이월금";
      if (aDone && !bDone) return 1;
      if (!aDone && bDone) return -1;
      return String(a.studentName || "").localeCompare(String(b.studentName || ""), "ko");
    });

    var summary = buildTuitionSummaryStats_(list, paymentRows);
    var result = {
      success: true,
      selectedMonth: monthName,
      months: months,
      kpi: summary.kpi,
      chart: summary.chart,
      allPayments: summary.allPayments || paymentRows,
      todayPayments: todayRows,
      payments: summary.payments,
      studentMaster: {
        source: studentMasterBundle.source || "sheet",
        count: studentRows.length,
        fallbackReason: studentMasterBundle.fallbackReason || ""
      },
      followupSource: followupBundle.source,
      guideAmountAudit: guideAmountAudit,
      rows: list
    };
    if (canUseSummaryCache) {
      writeTuitionJsonCache_(summaryCacheKey, result, TUITION_MONTH_SUMMARY_CACHE_TTL_SECONDS);
    }
    if (!statusFilter && !keyword) {
      writeTuitionMonthSnapshotToFirestore_(monthName, result);
    }
    return result;
  } catch (e) {
    return { success: false, message: "수강료 데이터 계산 오류: " + e.message };
  }
}

function backfillTuitionMonthSnapshots(payload) {
  try {
    var req = payload || {};
    var months = getTuitionMonthSheetNames_();
    var targetMonths = [];
    if (req.monthName) {
      targetMonths = [String(req.monthName || "").trim()];
    } else if (Array.isArray(req.months) && req.months.length) {
      targetMonths = req.months.map(function(monthName) {
        return String(monthName || "").trim();
      }).filter(Boolean);
    } else {
      var limit = Math.max(1, Math.min(12, parseInt(req.limit || 3, 10) || 3));
      targetMonths = months.slice(0, limit);
    }
    var results = [];
    targetMonths.forEach(function(monthName) {
      var summary = getTuitionMonthSummary({
        monthName: monthName,
        statusFilter: "",
        keyword: "",
        forceRefresh: true
      });
      results.push({
        monthName: monthName,
        success: !!(summary && summary.success),
        rows: summary && summary.rows ? summary.rows.length : 0,
        message: summary && summary.message || ""
      });
    });
    return {
      success: results.every(function(item) { return item.success; }),
      months: results
    };
  } catch (e) {
    return { success: false, message: "수강료 Firestore 스냅샷 백필 오류: " + e.message };
  }
}

function backfillTuitionPaymentsToFirestore(payload) {
  try {
    var req = payload || {};
    var months = getTuitionMonthSheetNames_();
    var targetMonths = [];
    if (req.monthName) {
      targetMonths = [String(req.monthName || "").trim()];
    } else if (Array.isArray(req.months) && req.months.length) {
      targetMonths = req.months.map(function(monthName) {
        return String(monthName || "").trim();
      }).filter(Boolean);
    } else {
      var limit = Math.max(1, Math.min(12, parseInt(req.limit || 3, 10) || 3));
      targetMonths = months.slice(0, limit);
    }

    var results = [];
    targetMonths.forEach(function(monthName) {
      var rows = getTuitionPaymentRowsForMonthFromSheet_(monthName);
      var written = 0;
      var errors = [];
      rows.forEach(function(row) {
        try {
          var result = writeTuitionPaymentToFirestore_(row);
          if (result && result.success) written++;
        } catch (e) {
          errors.push({
            studentName: row && row.studentName || "",
            message: e && e.message ? e.message : String(e)
          });
        }
      });
      invalidateTuitionSummaryCache_(monthName);
      if (errors.length === 0) {
        try {
          markTuitionPaymentMonthFirestoreReady_(monthName, rows.length, written);
        } catch (metaError) {
          errors.push({
            studentName: "",
            message: metaError && metaError.message ? metaError.message : String(metaError)
          });
        }
      }
      results.push({
        monthName: monthName,
        success: errors.length === 0,
        total: rows.length,
        written: written,
        errors: errors.slice(0, 5)
      });
    });

    return {
      success: results.every(function(item) { return item.success; }),
      months: results
    };
  } catch (e) {
    return { success: false, message: "수납 Firestore 백필 오류: " + e.message };
  }
}

function backfillTuitionMonthChargesToFirestore(payload) {
  try {
    var req = payload || {};
    var months = getTuitionMonthSheetNames_();
    var targetMonths = [];
    if (req.monthName) {
      targetMonths = [String(req.monthName || "").trim()];
    } else if (Array.isArray(req.months) && req.months.length) {
      targetMonths = req.months.map(function(monthName) {
        return String(monthName || "").trim();
      }).filter(Boolean);
    } else {
      var limit = Math.max(1, Math.min(12, parseInt(req.limit || 3, 10) || 3));
      targetMonths = months.slice(0, limit);
    }

    var results = [];
    targetMonths.forEach(function(monthName) {
      var rows = loadTuitionMonthChargeRowsFromSheet_(monthName);
      var written = 0;
      var errors = [];
      rows.forEach(function(row) {
        try {
          var result = writeTuitionMonthChargeToFirestore_(row);
          if (result && result.success) written++;
        } catch (e) {
          errors.push({
            studentName: row && row.studentName || "",
            message: e && e.message ? e.message : String(e)
          });
        }
      });
      if (errors.length === 0) {
        try {
          markTuitionMonthChargeFirestoreReady_(monthName, rows.length, written);
          invalidateTuitionSummaryCache_(monthName);
        } catch (metaError) {
          errors.push({
            studentName: "",
            message: metaError && metaError.message ? metaError.message : String(metaError)
          });
        }
      }
      results.push({
        monthName: monthName,
        success: errors.length === 0,
        total: rows.length,
        written: written,
        errors: errors.slice(0, 5)
      });
    });

    return {
      success: results.every(function(item) { return item.success; }),
      months: results
    };
  } catch (e) {
    return { success: false, message: "월별 수강료 대상 Firestore 백필 오류: " + e.message };
  }
}

function ensureTuitionPortalPaymentSheet_(ss) {
  var sheet = ss.getSheetByName(TUITION_PORTAL_PAYMENT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TUITION_PORTAL_PAYMENT_SHEET_NAME);
    sheet.getRange(1, 1, 1, 12).setValues([["납입기한", "이름", "항목", "금액", "납부", "사업자", "결재구분", "승인번호", "입력일시", "이슈메모", "원본월", "요청ID"]]);
  }
  ensureSheetHeaderColumn_(sheet, "요청ID");
  return sheet;
}

function ensureSheetHeaderColumn_(sheet, headerName) {
  if (!sheet) return -1;
  var name = String(headerName || "").trim();
  if (!name) return -1;
  var lastCol = Math.max(1, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];
  var target = normalizeTuitionHeaderText_(name);
  for (var i = 0; i < headers.length; i++) {
    if (normalizeTuitionHeaderText_(headers[i]) === target) return i;
  }
  var nextCol = lastCol + 1;
  if (sheet.getMaxColumns() < nextCol) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), nextCol - sheet.getMaxColumns());
  }
  sheet.getRange(1, nextCol).setValue(name);
  return nextCol - 1;
}

function normalizeTuitionClientRequestId_(value) {
  return String(value || "")
    .replace(/[^\w:.-]/g, "")
    .slice(0, 120)
    .trim();
}

function buildTuitionFirestoreDocId_(monthName, studentName) {
  var raw = [String(monthName || "").trim(), normalizeTuitionStudentName_(studentName)].join("|");
  var bytes = Utilities.newBlob(raw).getBytes();
  return "tf_" + Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "").slice(0, 120);
}

function buildTuitionPaymentFirestoreDocId_(record) {
  var row = record || {};
  var requestId = normalizeTuitionClientRequestId_(row.requestId || row.clientRequestId);
  if (requestId) return "tp_" + requestId;
  var raw = [
    row.sourceDueMonth || row.sourceMonth || row.originMonth || "",
    row.dueDate || "",
    normalizeTuitionStudentName_(row.studentName),
    toPayrollNumber_(row.amount),
    row.paidAt || "",
    row.paymentType || "",
    row.approvalNo || "",
    row.inputAt || "",
    row.rowNumber || ""
  ].join("|");
  var bytes = Utilities.newBlob(raw).getBytes();
  return "tp_" + Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "").slice(0, 120);
}

function buildTuitionPaymentMetaDocId_(monthName) {
  var raw = String(monthName || "").trim();
  var bytes = Utilities.newBlob(raw).getBytes();
  return "tpm_" + Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "").slice(0, 80);
}

function buildTuitionFollowupMetaDocId_(monthName) {
  var raw = String(monthName || "").trim();
  var bytes = Utilities.newBlob(raw).getBytes();
  return "tfm_" + Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "").slice(0, 80);
}

function buildTuitionMonthChargeFirestoreDocId_(monthName, studentName) {
  var raw = [String(monthName || "").trim(), normalizeTuitionStudentName_(studentName)].join("|");
  var bytes = Utilities.newBlob(raw).getBytes();
  return "tmc_" + Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "").slice(0, 120);
}

function buildTuitionMonthChargeMetaDocId_(monthName) {
  var raw = String(monthName || "").trim();
  var bytes = Utilities.newBlob(raw).getBytes();
  return "tmcm_" + Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "").slice(0, 80);
}

function buildTuitionContactLogFirestoreDocId_(requestId) {
  var id = normalizeTuitionClientRequestId_(requestId);
  if (id) return "tl_" + id;
  return "tl_" + Utilities.getUuid().replace(/-/g, "");
}

function buildTuitionStatusHistoryFirestoreDocId_(requestId) {
  var id = normalizeTuitionClientRequestId_(requestId);
  if (id) return "ts_" + id;
  return "ts_" + Utilities.getUuid().replace(/-/g, "");
}

function buildTuitionGuideAmountHistoryFirestoreDocId_(requestId) {
  var id = normalizeTuitionClientRequestId_(requestId);
  if (id) return "tg_" + id;
  return "tg_" + Utilities.getUuid().replace(/-/g, "");
}

function normalizeTuitionFollowupRecord_(source) {
  var row = source || {};
  var monthName = String(row.monthName || row.month || "").trim();
  var studentName = normalizeTuitionStudentName_(row.studentName || row.name);
  if (!monthName || !studentName) return null;
  return {
    monthName: monthName,
    studentName: studentName,
    guideAmount: Math.max(0, Math.round(toPayrollNumber_(row.guideAmount))),
    unpaidStatus: normalizeTuitionUnpaidStatus_(row.unpaidStatus),
    lastContactAt: String(row.lastContactAt || ""),
    lastContactMemo: String(row.lastContactMemo || ""),
    contactCount: Math.max(0, parseInt(row.contactCount || 0, 10) || 0),
    lastUpdatedAt: String(row.lastUpdatedAt || "")
  };
}

function normalizeTuitionPaymentRecord_(source) {
  var row = source || {};
  var studentName = normalizeTuitionStudentName_(row.studentName || row.name);
  if (!studentName) return null;
  var amount = toPayrollNumber_(row.amount);
  var paidAt = String(row.paidAt || "").trim();
  var business = String(row.business || "").trim();
  var paymentType = String(row.paymentType || "").trim();
  var approvalNo = String(row.approvalNo || "").trim();
  var inputAt = String(row.inputAt || "").trim();
  var issueMemo = String(row.issueMemo || row.memo || "").trim();
  var hasPaymentSignal = amount !== 0 || !!paidAt || !!paymentType || !!approvalNo || !!inputAt || !!business || !!issueMemo;
  if (!hasPaymentSignal) return null;
  var dueDate = String(row.dueDate || "").trim();
  var originMonth = String(row.originMonth || row.sourceMonth || "").trim();
  var sourceMonth = String(row.sourceMonth || originMonth || parseTuitionDueMonthName_(dueDate)).trim();
  var sourceDueMonth = String(row.sourceDueMonth || originMonth || parseTuitionDueMonthName_(dueDate)).trim();
  return {
    rowNumber: Math.max(0, parseInt(row.rowNumber || 0, 10) || 0),
    dueDate: dueDate,
    studentName: studentName,
    itemName: String(row.itemName || "납부금액").trim(),
    amount: amount,
    paidAt: paidAt,
    business: business,
    paymentType: paymentType,
    approvalNo: approvalNo,
    inputAt: inputAt,
    issueMemo: issueMemo,
    originMonth: originMonth,
    sourceMonth: sourceMonth,
    sourceDueMonth: sourceDueMonth,
    requestId: normalizeTuitionClientRequestId_(row.requestId || row.clientRequestId),
    createdAt: String(row.createdAt || ""),
    updatedAt: String(row.updatedAt || ""),
    source: String(row.source || "").trim()
  };
}

function writeTuitionFollowupToFirestore_(record) {
  var row = normalizeTuitionFollowupRecord_(record);
  if (!row) return { success: false, message: "Firestore 저장 대상이 비어 있습니다." };
  var nowIso = new Date().toISOString();
  var docId = buildTuitionFirestoreDocId_(row.monthName, row.studentName);
  firestoreSetDocument_(TUITION_FOLLOWUP_FIRESTORE_COLLECTION, docId, {
    monthName: row.monthName,
    studentName: row.studentName,
    guideAmount: row.guideAmount,
    unpaidStatus: row.unpaidStatus,
    lastContactAt: row.lastContactAt,
    lastContactMemo: row.lastContactMemo,
    contactCount: row.contactCount,
    lastUpdatedAt: row.lastUpdatedAt,
    updatedAt: nowIso,
    source: "desk_portal"
  });
  return { success: true, id: docId };
}

function writeTuitionPaymentToFirestore_(record) {
  var row = normalizeTuitionPaymentRecord_(record);
  if (!row) return { success: false, message: "Firestore 수납 저장 대상이 비어 있습니다." };
  var nowIso = new Date().toISOString();
  var docId = buildTuitionPaymentFirestoreDocId_(row);
  firestoreSetDocument_(TUITION_PAYMENT_FIRESTORE_COLLECTION, docId, {
    rowNumber: row.rowNumber,
    dueDate: row.dueDate,
    studentName: row.studentName,
    itemName: row.itemName,
    amount: row.amount,
    paidAt: row.paidAt,
    business: row.business,
    paymentType: row.paymentType,
    approvalNo: row.approvalNo,
    inputAt: row.inputAt,
    issueMemo: row.issueMemo,
    originMonth: row.originMonth,
    sourceMonth: row.sourceMonth,
    sourceDueMonth: row.sourceDueMonth,
    requestId: row.requestId,
    createdAt: row.createdAt || nowIso,
    updatedAt: nowIso,
    source: row.source || "desk_portal"
  });
  return { success: true, id: docId };
}

function hasTuitionPaymentRequestInFirestore_(requestId) {
  var id = normalizeTuitionClientRequestId_(requestId);
  if (!id) return false;
  try {
    var doc = firestoreGetDocument_(TUITION_PAYMENT_FIRESTORE_COLLECTION, buildTuitionPaymentFirestoreDocId_({ requestId: id }));
    return !!(doc && normalizeTuitionClientRequestId_(doc.requestId) === id);
  } catch (e) {
    return false;
  }
}

function loadTuitionPaymentRowsFromFirestore_(monthName) {
  var safeMonth = String(monthName || "").trim();
  try {
    var rows = firestoreListCollection_(TUITION_PAYMENT_FIRESTORE_COLLECTION, 1000)
      .map(normalizeTuitionPaymentRecord_)
      .filter(function(row) {
        if (!row) return false;
        if (!safeMonth) return true;
        return row.sourceDueMonth === safeMonth || row.sourceMonth === safeMonth;
      });
    rows.sort(compareTuitionPaymentRowsDesc_);
    return rows;
  } catch (e) {
    return null;
  }
}

function getTuitionPaymentRowMergeKey_(row) {
  var requestId = normalizeTuitionClientRequestId_(row && row.requestId);
  if (requestId) return "request:" + requestId;
  return [
    "row",
    String(row && (row.sourceDueMonth || row.sourceMonth || row.originMonth) || "").trim(),
    String(row && row.dueDate || "").trim(),
    normalizeTuitionStudentName_(row && row.studentName),
    toPayrollNumber_(row && row.amount),
    String(row && row.paidAt || "").trim(),
    String(row && row.paymentType || "").trim(),
    String(row && row.approvalNo || "").trim(),
    String(row && row.inputAt || "").trim()
  ].join("|");
}

function mergeTuitionPaymentRows_(primaryRows, secondaryRows) {
  var map = {};
  var merged = [];
  function add(row) {
    var normalized = normalizeTuitionPaymentRecord_(row);
    if (!normalized) return;
    var key = getTuitionPaymentRowMergeKey_(normalized);
    if (map[key]) return;
    map[key] = true;
    merged.push(normalized);
  }
  (primaryRows || []).forEach(add);
  (secondaryRows || []).forEach(add);
  merged.sort(compareTuitionPaymentRowsDesc_);
  return merged;
}

function isTuitionPaymentMonthFirestoreReady_(monthName) {
  var safeMonth = String(monthName || "").trim();
  if (!safeMonth) return false;
  try {
    var doc = firestoreGetDocument_(TUITION_PAYMENT_META_FIRESTORE_COLLECTION, buildTuitionPaymentMetaDocId_(safeMonth));
    return !!(doc && doc.monthName === safeMonth && doc.complete === true);
  } catch (e) {
    return false;
  }
}

function markTuitionPaymentMonthFirestoreReady_(monthName, totalRows, writtenRows) {
  var safeMonth = String(monthName || "").trim();
  if (!safeMonth) return;
  firestoreSetDocument_(TUITION_PAYMENT_META_FIRESTORE_COLLECTION, buildTuitionPaymentMetaDocId_(safeMonth), {
    monthName: safeMonth,
    complete: true,
    totalRows: Math.max(0, parseInt(totalRows || 0, 10) || 0),
    writtenRows: Math.max(0, parseInt(writtenRows || 0, 10) || 0),
    updatedAt: new Date().toISOString(),
    source: "desk_portal_backfill"
  });
}

function normalizeTuitionMonthChargeRecord_(source) {
  var row = source || {};
  var monthName = String(row.monthName || row.tuitionMonthName || "").trim();
  var studentName = normalizeTuitionStudentName_(row.studentName || row.name);
  if (!monthName || !studentName) return null;
  return {
    monthName: monthName,
    classMonthName: String(row.classMonthName || monthName.replace(/s$/i, "")).trim(),
    studentName: studentName,
    rowNumber: Math.max(0, parseInt(row.rowNumber || 0, 10) || 0),
    guideAmount: Math.max(0, Math.round(toPayrollNumber_(row.guideAmount))),
    active: row.active === false ? false : true,
    source: String(row.source || "").trim(),
    updatedAt: String(row.updatedAt || "")
  };
}

function writeTuitionMonthChargeToFirestore_(record) {
  var row = normalizeTuitionMonthChargeRecord_(record);
  if (!row) return { success: false, message: "Firestore 월별 수강료 대상이 비어 있습니다." };
  var nowIso = new Date().toISOString();
  var docId = buildTuitionMonthChargeFirestoreDocId_(row.monthName, row.studentName);
  firestoreSetDocument_(TUITION_MONTH_CHARGE_FIRESTORE_COLLECTION, docId, {
    monthName: row.monthName,
    classMonthName: row.classMonthName,
    studentName: row.studentName,
    rowNumber: row.rowNumber,
    guideAmount: row.guideAmount,
    active: row.active,
    source: row.source || "tuition_month_sheet",
    updatedAt: nowIso
  });
  return { success: true, id: docId };
}

function loadTuitionMonthChargeRowsFromFirestore_(monthName) {
  var safeMonth = String(monthName || "").trim();
  try {
    return firestoreListCollection_(TUITION_MONTH_CHARGE_FIRESTORE_COLLECTION, 1000)
      .map(normalizeTuitionMonthChargeRecord_)
      .filter(function(row) {
        return !!row && row.active !== false && (!safeMonth || row.monthName === safeMonth);
      });
  } catch (e) {
    return null;
  }
}

function isTuitionMonthChargeFirestoreReady_(monthName) {
  var safeMonth = String(monthName || "").trim();
  if (!safeMonth) return false;
  try {
    var doc = firestoreGetDocument_(TUITION_MONTH_CHARGE_META_FIRESTORE_COLLECTION, buildTuitionMonthChargeMetaDocId_(safeMonth));
    return !!(doc && doc.monthName === safeMonth && doc.complete === true);
  } catch (e) {
    return false;
  }
}

function markTuitionMonthChargeFirestoreReady_(monthName, totalRows, writtenRows) {
  var safeMonth = String(monthName || "").trim();
  if (!safeMonth) return;
  firestoreSetDocument_(TUITION_MONTH_CHARGE_META_FIRESTORE_COLLECTION, buildTuitionMonthChargeMetaDocId_(safeMonth), {
    monthName: safeMonth,
    classMonthName: safeMonth.replace(/s$/i, ""),
    complete: true,
    totalRows: Math.max(0, parseInt(totalRows || 0, 10) || 0),
    writtenRows: Math.max(0, parseInt(writtenRows || 0, 10) || 0),
    updatedAt: new Date().toISOString(),
    source: "desk_portal_backfill"
  });
}

function writeTuitionStatusHistoryToFirestore_(record) {
  var row = record || {};
  var monthName = String(row.monthName || "").trim();
  var studentName = normalizeTuitionStudentName_(row.studentName);
  if (!monthName || !studentName) return { success: false, message: "Firestore 상태 이력 대상이 비어 있습니다." };
  var docId = buildTuitionStatusHistoryFirestoreDocId_(row.requestId);
  firestoreSetDocument_(TUITION_STATUS_HISTORY_FIRESTORE_COLLECTION, docId, {
    monthName: monthName,
    studentName: studentName,
    previousStatus: normalizeTuitionUnpaidStatus_(row.previousStatus || ""),
    nextStatus: normalizeTuitionUnpaidStatus_(row.nextStatus || row.unpaidStatus),
    guideAmount: Math.max(0, Math.round(toPayrollNumber_(row.guideAmount))),
    contactCount: Math.max(0, parseInt(row.contactCount || 0, 10) || 0),
    changedAt: String(row.changedAt || ""),
    requestId: normalizeTuitionClientRequestId_(row.requestId),
    source: "desk_portal"
  });
  return { success: true, id: docId };
}

function writeTuitionGuideAmountHistoryToFirestore_(record) {
  var row = record || {};
  var monthName = String(row.monthName || "").trim();
  var studentName = normalizeTuitionStudentName_(row.studentName);
  if (!monthName || !studentName) return { success: false, message: "Firestore 안내 금액 이력 대상이 비어 있습니다." };
  var previousAmount = Math.max(0, Math.round(toPayrollNumber_(row.previousGuideAmount)));
  var nextAmount = Math.max(0, Math.round(toPayrollNumber_(row.nextGuideAmount || row.guideAmount)));
  if (previousAmount === nextAmount && row.skipUnchanged !== false) {
    return { success: true, skipped: true };
  }
  var docId = buildTuitionGuideAmountHistoryFirestoreDocId_(row.requestId);
  firestoreSetDocument_(TUITION_GUIDE_AMOUNT_HISTORY_FIRESTORE_COLLECTION, docId, {
    monthName: monthName,
    studentName: studentName,
    previousGuideAmount: previousAmount,
    nextGuideAmount: nextAmount,
    deltaAmount: nextAmount - previousAmount,
    unpaidStatus: normalizeTuitionUnpaidStatus_(row.unpaidStatus),
    changedAt: String(row.changedAt || ""),
    requestId: normalizeTuitionClientRequestId_(row.requestId),
    source: "desk_portal"
  });
  return { success: true, id: docId };
}

function writeTuitionContactLogToFirestore_(record) {
  var row = record || {};
  var monthName = String(row.monthName || "").trim();
  var studentName = normalizeTuitionStudentName_(row.studentName);
  if (!monthName || !studentName) return { success: false, message: "Firestore 연락 로그 대상이 비어 있습니다." };
  var docId = buildTuitionContactLogFirestoreDocId_(row.requestId);
  firestoreSetDocument_(TUITION_CONTACT_LOG_FIRESTORE_COLLECTION, docId, {
    monthName: monthName,
    studentName: studentName,
    guideAmount: Math.max(0, Math.round(toPayrollNumber_(row.guideAmount))),
    unpaidStatus: normalizeTuitionUnpaidStatus_(row.unpaidStatus),
    memo: String(row.memo || "").trim(),
    contactAt: String(row.contactAt || ""),
    requestId: normalizeTuitionClientRequestId_(row.requestId),
    createdAt: new Date().toISOString(),
    source: "desk_portal"
  });
  return { success: true, id: docId };
}

function hasTuitionContactLogRequestInFirestore_(requestId) {
  var id = normalizeTuitionClientRequestId_(requestId);
  if (!id) return false;
  try {
    var doc = firestoreGetDocument_(TUITION_CONTACT_LOG_FIRESTORE_COLLECTION, buildTuitionContactLogFirestoreDocId_(id));
    return !!(doc && normalizeTuitionClientRequestId_(doc.requestId) === id);
  } catch (e) {
    return false;
  }
}

function loadTuitionFollowupRowsFromFirestore_() {
  try {
    return firestoreListCollection_(TUITION_FOLLOWUP_FIRESTORE_COLLECTION, 500).map(function(doc) {
      return normalizeTuitionFollowupRecord_(doc);
    }).filter(function(row) {
      return !!row;
    });
  } catch (e) {
    return null;
  }
}

function isTuitionFollowupMonthFirestoreReady_(monthName) {
  var safeMonth = String(monthName || "").trim();
  if (!safeMonth) return false;
  try {
    var doc = firestoreGetDocument_(TUITION_FOLLOWUP_META_FIRESTORE_COLLECTION, buildTuitionFollowupMetaDocId_(safeMonth));
    return !!(doc && doc.monthName === safeMonth && doc.complete === true);
  } catch (e) {
    return false;
  }
}

function markTuitionFollowupMonthFirestoreReady_(monthName, totalRows, writtenRows) {
  var safeMonth = String(monthName || "").trim();
  if (!safeMonth) return;
  firestoreSetDocument_(TUITION_FOLLOWUP_META_FIRESTORE_COLLECTION, buildTuitionFollowupMetaDocId_(safeMonth), {
    monthName: safeMonth,
    complete: true,
    totalRows: Math.max(0, parseInt(totalRows || 0, 10) || 0),
    writtenRows: Math.max(0, parseInt(writtenRows || 0, 10) || 0),
    updatedAt: new Date().toISOString(),
    source: "desk_portal_backfill"
  });
}

function isTuitionSheetMirrorWritesEnabled_() {
  try {
    var value = PropertiesService.getScriptProperties().getProperty(TUITION_SHEET_MIRROR_WRITES_PROP);
    return String(value || "").toLowerCase() === "true";
  } catch (e) {
    return false;
  }
}

function loadTuitionFollowupRecordFromFirestore_(monthName, studentName) {
  var month = String(monthName || "").trim();
  var student = normalizeTuitionStudentName_(studentName);
  if (!month || !student) return null;
  try {
    return normalizeTuitionFollowupRecord_(firestoreGetDocument_(TUITION_FOLLOWUP_FIRESTORE_COLLECTION, buildTuitionFirestoreDocId_(month, student)));
  } catch (e) {
    return null;
  }
}

function findTuitionFollowupSheetRecord_(monthName, studentName) {
  var month = String(monthName || "").trim();
  var student = normalizeTuitionStudentName_(studentName);
  var ss = getPayrollSpreadsheet_();
  var sheet = ensureTuitionFollowupSheet_(ss);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var index = buildTuitionHeaderIndex_(headers, {
    monthName: ["월"],
    studentName: ["학생명"],
    guideAmount: ["안내금액"],
    unpaidStatus: ["미납상태"],
    lastContactAt: ["마지막연락일시"],
    lastContactMemo: ["마지막연락메모"],
    contactCount: ["연락횟수"],
    lastUpdatedAt: ["마지막수정일시"]
  });
  var lastRow = sheet.getLastRow();
  var rowNo = -1;
  var selectedRow = null;
  if (lastRow >= 2) {
    var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getDisplayValues();
    for (var i = 0; i < data.length; i++) {
      var monthCell = String(data[i][index.monthName] || "").trim();
      var nameCell = normalizeTuitionStudentName_(data[i][index.studentName]);
      if (monthCell === month && nameCell === student) {
        var candidateRowNo = i + 2;
        if (isTuitionFollowupRowPreferred_(data[i], index, month, candidateRowNo, selectedRow, rowNo)) {
          rowNo = candidateRowNo;
          selectedRow = data[i];
        }
      }
    }
  }
  var record = selectedRow ? normalizeTuitionFollowupRecord_({
    monthName: selectedRow[index.monthName],
    studentName: selectedRow[index.studentName],
    guideAmount: selectedRow[index.guideAmount],
    unpaidStatus: selectedRow[index.unpaidStatus],
    lastContactAt: selectedRow[index.lastContactAt],
    lastContactMemo: selectedRow[index.lastContactMemo],
    contactCount: selectedRow[index.contactCount],
    lastUpdatedAt: selectedRow[index.lastUpdatedAt]
  }) : null;
  return {
    ss: ss,
    sheet: sheet,
    index: index,
    lastRow: lastRow,
    rowNo: rowNo,
    row: selectedRow,
    record: record
  };
}

function writeTuitionFollowupSheetMirror_(state, record) {
  if (!state || !state.sheet || !record) return;
  var sheet = state.sheet;
  var index = state.index || {};
  var rowNo = state.rowNo > 0 ? state.rowNo : (state.lastRow + 1);
  var write = [];
  write[index.monthName] = record.monthName;
  write[index.studentName] = record.studentName;
  write[index.guideAmount] = record.guideAmount;
  write[index.unpaidStatus] = record.unpaidStatus;
  write[index.lastContactAt] = record.lastContactAt;
  write[index.lastContactMemo] = record.lastContactMemo;
  write[index.contactCount] = record.contactCount;
  write[index.lastUpdatedAt] = record.lastUpdatedAt;
  for (var c = 0; c < sheet.getLastColumn(); c++) {
    if (typeof write[c] === "undefined") write[c] = "";
  }
  sheet.getRange(rowNo, 1, 1, sheet.getLastColumn()).setValues([write]);
}

function appendTuitionContactLogSheetMirror_(ss, record) {
  if (!ss || !record) return;
  var logSheet = ensureTuitionContactLogSheet_(ss);
  var logRequestIndex = ensureSheetHeaderColumn_(logSheet, "요청ID");
  var requestId = normalizeTuitionClientRequestId_(record.requestId);
  if (requestId && findTuitionRequestRow_(logSheet, requestId, logRequestIndex) > 0) return;
  var logWrite = [];
  logWrite[0] = record.monthName;
  logWrite[1] = record.studentName;
  logWrite[2] = record.guideAmount;
  logWrite[3] = record.unpaidStatus;
  logWrite[4] = record.memo;
  logWrite[5] = record.contactAt;
  logWrite[logRequestIndex] = requestId;
  for (var lc = 0; lc < logSheet.getLastColumn(); lc++) {
    if (typeof logWrite[lc] === "undefined") logWrite[lc] = "";
  }
  logSheet.getRange(logSheet.getLastRow() + 1, 1, 1, logSheet.getLastColumn()).setValues([logWrite]);
}

function backfillTuitionFollowupsToFirestore(payload) {
  var req = payload || {};
  var monthName = String(req.monthName || "").trim();
  var dryRun = req.dryRun !== false;
  var rows = loadTuitionFollowupRowsFromSheet_().filter(function(row) {
    return !monthName || String(row.monthName || "").trim() === monthName;
  });
  var stats = {
    success: true,
    dryRun: dryRun,
    monthName: monthName || "all",
    total: rows.length,
    written: 0,
    errors: []
  };
  var monthTotals = {};
  var monthWritten = {};
  rows.forEach(function(row) {
    var rowMonth = String(row && row.monthName || "").trim();
    if (rowMonth) monthTotals[rowMonth] = (monthTotals[rowMonth] || 0) + 1;
    try {
      if (!dryRun) writeTuitionFollowupToFirestore_(row);
      stats.written += 1;
      if (rowMonth) monthWritten[rowMonth] = (monthWritten[rowMonth] || 0) + 1;
    } catch (e) {
      stats.errors.push({
        monthName: row.monthName,
        studentName: row.studentName,
        message: e && e.message ? e.message : String(e)
      });
    }
  });
  stats.success = stats.errors.length === 0;
  if (!dryRun && stats.success) {
    Object.keys(monthTotals).forEach(function(rowMonth) {
      markTuitionFollowupMonthFirestoreReady_(rowMonth, monthTotals[rowMonth], monthWritten[rowMonth] || 0);
    });
  }
  return stats;
}

function findTuitionRequestRow_(sheet, requestId, requestIndex) {
  var id = normalizeTuitionClientRequestId_(requestId);
  if (!sheet || !id || requestIndex < 0 || sheet.getLastRow() < 2) return -1;
  var values = sheet.getRange(2, requestIndex + 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    if (normalizeTuitionClientRequestId_(values[i][0]) === id) return i + 2;
  }
  return -1;
}

function withTuitionWriteLock_(workFn) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    lock.waitLock(20000);
    locked = true;
    return workFn();
  } catch (e) {
    return { success: false, message: "저장 대기 오류: " + e.message };
  } finally {
    if (locked) {
      try {
        lock.releaseLock();
      } catch (err) {}
    }
  }
}

function getTuitionPaymentRowsForMonth_(monthName) {
  var safeMonth = String(monthName || "").trim();
  if (!safeMonth) return [];
  var firestoreRows = loadTuitionPaymentRowsFromFirestore_(safeMonth);
  if (isTuitionPaymentMonthFirestoreReady_(safeMonth)) {
    if (Array.isArray(firestoreRows)) {
      return firestoreRows;
    }
  }
  var sheetRows = getTuitionPaymentRowsForMonthFromSheet_(safeMonth);
  return Array.isArray(firestoreRows) ? mergeTuitionPaymentRows_(sheetRows, firestoreRows) : sheetRows;
}

function getTuitionPaymentRowsForMonthFromSheet_(monthName) {
  var safeMonth = String(monthName || "").trim();
  if (!safeMonth) return [];
  var ss = getPayrollSpreadsheet_();
  var rows = [];

  var sheet = ss.getSheetByName(safeMonth);
  if (sheet) {
    parseTuitionRows_(sheet).forEach(function(row) {
      var copy = {};
      Object.keys(row).forEach(function(key) {
        copy[key] = row[key];
      });
      copy.sourceMonth = safeMonth;
      copy.sourceDueMonth = parseTuitionDueMonthName_(row.dueDate);
      rows.push(copy);
    });
  }

  var portalSheet = ss.getSheetByName(TUITION_PORTAL_PAYMENT_SHEET_NAME);
  if (portalSheet) {
    parseTuitionRows_(portalSheet).forEach(function(row) {
      var copy = {};
      Object.keys(row).forEach(function(key) {
        copy[key] = row[key];
      });
      var originMonth = String(row.originMonth || "").trim();
      copy.sourceMonth = originMonth || parseTuitionDueMonthName_(row.dueDate);
      copy.sourceDueMonth = originMonth || parseTuitionDueMonthName_(row.dueDate);
      if (copy.sourceDueMonth !== safeMonth && copy.sourceMonth !== safeMonth) return;
      rows.push(copy);
    });
  }

  rows.sort(compareTuitionPaymentRowsDesc_);
  return rows;
}

function getAllTuitionPaymentRows_(months) {
  var monthList = (months || []).map(function(monthName) {
    return String(monthName || "").trim();
  }).filter(Boolean);
  var monthMap = {};
  monthList.forEach(function(monthName) {
    monthMap[monthName] = true;
  });
  var rows = [];
  var fallbackMonthMap = {};
  var firestoreCandidateRows = [];

  var firestoreRows = loadTuitionPaymentRowsFromFirestore_("");
  var canUseFirestore = Array.isArray(firestoreRows);
  monthList.forEach(function(monthName) {
    if (!canUseFirestore || !isTuitionPaymentMonthFirestoreReady_(monthName)) {
      fallbackMonthMap[monthName] = true;
    }
  });

  if (canUseFirestore) {
    firestoreRows.forEach(function(row) {
      var sourceMonth = String(row.sourceMonth || "").trim();
      var dueMonth = String(row.sourceDueMonth || parseTuitionDueMonthName_(row.dueDate)).trim();
      if ((sourceMonth && monthMap[sourceMonth]) || (dueMonth && monthMap[dueMonth])) {
        firestoreCandidateRows.push(row);
        if ((sourceMonth && !fallbackMonthMap[sourceMonth]) || (dueMonth && !fallbackMonthMap[dueMonth])) {
          rows.push(row);
        }
      }
    });
  }

  var fallbackMonths = Object.keys(fallbackMonthMap);
  if (!fallbackMonths.length) {
    return mergeTuitionPaymentRows_(rows, []);
  }

  var ss = getPayrollSpreadsheet_();
  fallbackMonths.forEach(function(srcMonth) {
    var sheet = ss.getSheetByName(srcMonth);
    if (!sheet) return;
    parseTuitionRows_(sheet).forEach(function(row) {
      var copy = {};
      Object.keys(row).forEach(function(key) {
        copy[key] = row[key];
      });
      copy.sourceMonth = srcMonth;
      copy.sourceDueMonth = parseTuitionDueMonthName_(row.dueDate);
      rows.push(copy);
    });
  });

  var portalSheet = ss.getSheetByName(TUITION_PORTAL_PAYMENT_SHEET_NAME);
  if (portalSheet) {
    parseTuitionRows_(portalSheet).forEach(function(row) {
      var copy = {};
      Object.keys(row).forEach(function(key) {
        copy[key] = row[key];
      });
      var originMonth = String(row.originMonth || "").trim();
      copy.sourceMonth = originMonth || parseTuitionDueMonthName_(row.dueDate);
      copy.sourceDueMonth = originMonth || parseTuitionDueMonthName_(row.dueDate);
      if (!fallbackMonthMap[copy.sourceMonth] && !fallbackMonthMap[copy.sourceDueMonth]) return;
      rows.push(copy);
    });
  }

  return mergeTuitionPaymentRows_(rows, firestoreCandidateRows);
}

function saveTuitionFollowup(payload) {
  return withTuitionWriteLock_(function() {
  try {
    var req = payload || {};
    var monthName = String(req.monthName || "").trim();
    var studentName = normalizeTuitionStudentName_(req.studentName);
    var requestId = normalizeTuitionClientRequestId_(req.clientRequestId);
    if (!monthName) return { success: false, message: "월 정보가 없습니다." };
    if (!studentName) return { success: false, message: "학생명이 없습니다." };

    var guideAmount = Math.max(0, Math.round(toPayrollNumber_(req.guideAmount)));
    var unpaidStatus = normalizeTuitionUnpaidStatus_(req.unpaidStatus);
    var memo = String(req.memo || "").trim();
    var now = new Date();
    var nowIso = now.toISOString();
    var mirrorSheets = isTuitionSheetMirrorWritesEnabled_();
    if (requestId && hasTuitionContactLogRequestInFirestore_(requestId)) {
      return { success: true, duplicate: true };
    }
    var sheetState = null;
    var currentRecord = loadTuitionFollowupRecordFromFirestore_(monthName, studentName);
    if (!currentRecord || mirrorSheets) {
      sheetState = findTuitionFollowupSheetRecord_(monthName, studentName);
      if (!currentRecord && sheetState && sheetState.record) currentRecord = sheetState.record;
    }

    var currentContactCount = currentRecord ? (parseInt(currentRecord.contactCount || 0, 10) || 0) : 0;
    var previousGuideAmount = currentRecord ? Math.max(0, Math.round(toPayrollNumber_(currentRecord.guideAmount))) : 0;
    var contactCount = currentContactCount + 1;
    var nextRecord = {
      monthName: monthName,
      studentName: studentName,
      guideAmount: guideAmount,
      unpaidStatus: unpaidStatus,
      lastContactAt: nowIso,
      lastContactMemo: memo,
      contactCount: contactCount,
      lastUpdatedAt: nowIso
    };

    writeTuitionFollowupToFirestore_(nextRecord);
    writeTuitionContactLogToFirestore_({
      monthName: monthName,
      studentName: studentName,
      guideAmount: guideAmount,
      unpaidStatus: unpaidStatus,
      memo: memo,
      contactAt: nowIso,
      requestId: requestId
    });
    writeTuitionGuideAmountHistoryToFirestore_({
      monthName: monthName,
      studentName: studentName,
      previousGuideAmount: previousGuideAmount,
      nextGuideAmount: guideAmount,
      unpaidStatus: unpaidStatus,
      changedAt: nowIso,
      requestId: requestId
    });

    var sheetMirrorWarning = "";
    if (mirrorSheets) {
      try {
        writeTuitionFollowupSheetMirror_(sheetState, nextRecord);
        appendTuitionContactLogSheetMirror_(sheetState && sheetState.ss, {
          monthName: monthName,
          studentName: studentName,
          guideAmount: guideAmount,
          unpaidStatus: unpaidStatus,
          memo: memo,
          contactAt: nowIso,
          requestId: requestId
        });
        SpreadsheetApp.flush();
      } catch (sheetError) {
        sheetMirrorWarning = sheetError && sheetError.message ? sheetError.message : String(sheetError);
      }
    }
    invalidateTuitionSummaryCache_(monthName);

    return { success: true, contactAt: nowIso, contactCount: contactCount, sheetMirrorWarning: sheetMirrorWarning };
  } catch (e) {
    return { success: false, message: "연락기록 저장 오류: " + e.message };
  }
  });
}

function saveTuitionStatusOnly(payload) {
  return withTuitionWriteLock_(function() {
  try {
    var req = payload || {};
    var monthName = String(req.monthName || "").trim();
    var studentName = normalizeTuitionStudentName_(req.studentName);
    var requestId = normalizeTuitionClientRequestId_(req.clientRequestId);
    if (!monthName) return { success: false, message: "월 정보가 없습니다." };
    if (!studentName) return { success: false, message: "학생명이 없습니다." };

    var mirrorSheets = isTuitionSheetMirrorWritesEnabled_();
    var currentRecord = loadTuitionFollowupRecordFromFirestore_(monthName, studentName);
    var sheetState = null;
    if (!currentRecord || mirrorSheets) {
      sheetState = findTuitionFollowupSheetRecord_(monthName, studentName);
      if (!currentRecord && sheetState && sheetState.record) currentRecord = sheetState.record;
    }
    var nowIso = new Date().toISOString();
    var guideAmount = Math.max(0, Math.round(toPayrollNumber_(req.guideAmount)));
    if ((!guideAmount || guideAmount < 0) && currentRecord) {
      guideAmount = Math.max(0, Math.round(toPayrollNumber_(currentRecord.guideAmount)));
    }
    var previousGuideAmount = currentRecord ? Math.max(0, Math.round(toPayrollNumber_(currentRecord.guideAmount))) : 0;
    var unpaidStatus = normalizeTuitionUnpaidStatus_(req.unpaidStatus);
    var previousStatus = currentRecord ? normalizeTuitionUnpaidStatus_(currentRecord.unpaidStatus) : "";
    var contactCount = currentRecord ? (parseInt(currentRecord.contactCount || 0, 10) || 0) : 0;
    var lastContactAt = currentRecord ? String(currentRecord.lastContactAt || "") : "";
    var lastContactMemo = currentRecord ? String(currentRecord.lastContactMemo || "") : "";
    var nextRecord = {
      monthName: monthName,
      studentName: studentName,
      guideAmount: guideAmount,
      unpaidStatus: unpaidStatus,
      lastContactAt: lastContactAt,
      lastContactMemo: lastContactMemo,
      contactCount: contactCount,
      lastUpdatedAt: nowIso
    };

    writeTuitionFollowupToFirestore_(nextRecord);
    writeTuitionStatusHistoryToFirestore_({
      monthName: monthName,
      studentName: studentName,
      previousStatus: previousStatus,
      nextStatus: unpaidStatus,
      guideAmount: guideAmount,
      contactCount: contactCount,
      changedAt: nowIso,
      requestId: requestId
    });
    writeTuitionGuideAmountHistoryToFirestore_({
      monthName: monthName,
      studentName: studentName,
      previousGuideAmount: previousGuideAmount,
      nextGuideAmount: guideAmount,
      unpaidStatus: unpaidStatus,
      changedAt: nowIso,
      requestId: requestId
    });

    var sheetMirrorWarning = "";
    if (mirrorSheets) {
      try {
        writeTuitionFollowupSheetMirror_(sheetState, nextRecord);
        SpreadsheetApp.flush();
      } catch (sheetError) {
        sheetMirrorWarning = sheetError && sheetError.message ? sheetError.message : String(sheetError);
      }
    }
    invalidateTuitionSummaryCache_(monthName);
    return { success: true, status: unpaidStatus, sheetMirrorWarning: sheetMirrorWarning };
  } catch (e) {
    return { success: false, message: "상태 저장 오류: " + e.message };
  }
  });
}

function appendTuitionPaymentEntry(payload) {
  return withTuitionWriteLock_(function() {
  try {
    var req = payload || {};
    var monthName = String(req.monthName || "").trim();
    if (!monthName) return { success: false, message: "월 정보가 없습니다." };
    var studentName = normalizeTuitionStudentName_(req.studentName);
    if (!studentName) return { success: false, message: "학생명이 없습니다." };
    var amount = Math.round(toPayrollNumber_(req.amount));
    if (!amount) return { success: false, message: "금액이 0원일 수 없습니다." };

    var dueDate = String(req.dueDate || "").trim();
    var paidAt = String(req.paidAt || "").trim();
    var business = String(req.business || "").trim();
    var paymentType = String(req.paymentType || "").trim();
    var approvalNo = String(req.approvalNo || "").trim();
    var issueMemo = String(req.issueMemo || "").trim();
    var itemName = String(req.itemName || "납부금액").trim();
    var requestId = normalizeTuitionClientRequestId_(req.clientRequestId);
    var nowText = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "M/d HH:mm");
    var mirrorSheets = isTuitionSheetMirrorWritesEnabled_();
    if (requestId && hasTuitionPaymentRequestInFirestore_(requestId)) {
      return { success: true, duplicate: true };
    }

    var paymentRecord = {
      rowNumber: 0,
      dueDate: dueDate,
      studentName: studentName,
      itemName: itemName || "납부금액",
      amount: amount,
      paidAt: paidAt,
      business: business,
      paymentType: paymentType,
      approvalNo: approvalNo,
      inputAt: nowText,
      issueMemo: issueMemo,
      originMonth: monthName,
      sourceMonth: monthName,
      sourceDueMonth: monthName,
      requestId: requestId,
      source: "desk_portal"
    };

    writeTuitionPaymentToFirestore_(paymentRecord);
    var sheetMirrorWarning = "";
    if (mirrorSheets) {
      try {
        var ss = getPayrollSpreadsheet_();
        var sheet = ensureTuitionPortalPaymentSheet_(ss);
        var requestIndex = ensureSheetHeaderColumn_(sheet, "요청ID");
        if (!(requestId && findTuitionRequestRow_(sheet, requestId, requestIndex) > 0)) {
          var write = [];
          write[0] = dueDate;
          write[1] = studentName;
          write[2] = itemName || "납부금액";
          write[3] = amount;
          write[4] = paidAt;
          write[5] = business;
          write[6] = paymentType;
          write[7] = approvalNo;
          write[8] = nowText;
          write[9] = issueMemo;
          write[10] = monthName;
          write[requestIndex] = requestId;
          for (var c = 0; c < sheet.getLastColumn(); c++) {
            if (typeof write[c] === "undefined") write[c] = "";
          }
          sheet.getRange(sheet.getLastRow() + 1, 1, 1, sheet.getLastColumn()).setValues([write]);
          SpreadsheetApp.flush();
        }
      } catch (sheetError) {
        sheetMirrorWarning = sheetError && sheetError.message ? sheetError.message : String(sheetError);
      }
    }
    invalidateTuitionSummaryCache_(monthName);
    return { success: true, sheetMirrorWarning: sheetMirrorWarning };
  } catch (e) {
    return { success: false, message: "수납 입력 오류: " + e.message };
  }
  });
}

function getTuitionMonthlySalesOverview(payload) {
  try {
    var months = getTuitionMonthSheetNames_();
    if (!months.length) return { success: false, message: "수강료 월 탭이 없습니다." };
    var rows = getAllTuitionPaymentRows_(months);
    var dueMap = {};
    var paidMap = {};
    var paidStudentMap = {};

    rows.forEach(function(row) {
      var delta = 0 - toPayrollNumber_(row.amount);
      if (!delta) return;
      var sourceMonth = row.sourceDueMonth || row.sourceMonth || parseTuitionDueMonthName_(row.dueDate);
      var dueKey = parseTuitionDueMonthKey_(row.dueDate, sourceMonth);
      var paidKey = parseTuitionPaidMonthKey_(row.paidAt, sourceMonth);
      if (dueKey) dueMap[dueKey] = (dueMap[dueKey] || 0) + delta;
      if (paidKey) {
        paidMap[paidKey] = (paidMap[paidKey] || 0) + delta;
        var studentName = normalizeTuitionStudentName_(row.studentName);
        if (studentName) {
          if (!paidStudentMap[paidKey]) paidStudentMap[paidKey] = {};
          paidStudentMap[paidKey][studentName] = (paidStudentMap[paidKey][studentName] || 0) + delta;
        }
      }
    });

    var keySet = {};
    Object.keys(dueMap).forEach(function(k) { keySet[k] = true; });
    Object.keys(paidMap).forEach(function(k) { keySet[k] = true; });

    var labels = Object.keys(keySet).sort(function(a, b) {
      var pa = parseTuitionYearMonthKey_(a);
      var pb = parseTuitionYearMonthKey_(b);
      if (pa.year !== pb.year) return pa.year - pb.year;
      return pa.month - pb.month;
    });
    var paidTop10ByMonth = {};
    var defaultTopMonth = "";
    labels.forEach(function(label) {
      var ranking = Object.keys(paidStudentMap[label] || {}).map(function(studentName) {
        return {
          studentName: studentName,
          amount: Math.round(paidStudentMap[label][studentName] || 0)
        };
      }).filter(function(item) {
        return item.amount > 0;
      }).sort(function(a, b) {
        if (b.amount !== a.amount) return b.amount - a.amount;
        return String(a.studentName || "").localeCompare(String(b.studentName || ""), "ko");
      }).slice(0, 10).map(function(item, index) {
        return {
          rank: index + 1,
          studentName: item.studentName,
          amount: item.amount
        };
      });
      paidTop10ByMonth[label] = ranking;
      if (ranking.length) defaultTopMonth = label;
    });

    return {
      success: true,
      labels: labels,
      dueTotals: labels.map(function(k) { return Math.round(dueMap[k] || 0); }),
      paidTotals: labels.map(function(k) { return Math.round(paidMap[k] || 0); }),
      paidTop10ByMonth: paidTop10ByMonth,
      defaultTopMonth: defaultTopMonth || (labels.length ? labels[labels.length - 1] : "")
    };
  } catch (e) {
    return { success: false, message: "월별 매출 집계 오류: " + e.message };
  }
}

function getTuitionStudentMonthlyHistory(payload) {
  try {
    var req = payload || {};
    var studentName = normalizeTuitionStudentName_(req.studentName);
    if (!studentName) return { success: false, message: "학생명이 없습니다." };
    var months = getTuitionMonthSheetNames_();
    if (!months.length) return { success: true, studentName: studentName, rows: [] };

    var paymentRows = getAllTuitionPaymentRows_(months);
    var paymentByMonth = {};
    paymentRows.forEach(function(row) {
      if (normalizeTuitionStudentName_(row.studentName) !== studentName) return;
      var dueMonth = row.sourceDueMonth || parseTuitionDueMonthName_(row.dueDate);
      if (!dueMonth) return;
      if (!paymentByMonth[dueMonth]) {
        paymentByMonth[dueMonth] = {
          collectedAmount: 0,
          paidDates: {},
          routes: {}
        };
      }
      var bucket = paymentByMonth[dueMonth];
      bucket.collectedAmount += (0 - toPayrollNumber_(row.amount));
      if (row.paidAt) bucket.paidDates[String(row.paidAt)] = true;
      var route = normalizeTuitionRouteLabel_(row.paymentType, row.issueMemo);
      bucket.routes[route] = true;
    });

    var followupBundle = loadTuitionFollowupRowsBundle_();
    var followup = loadTuitionStudentFollowupByMonth_(studentName, followupBundle.rows);
    var rows = months.map(function(monthName) {
      var paidInfo = paymentByMonth[monthName] || { collectedAmount: 0, paidDates: {}, routes: {} };
      var followInfo = followup[monthName] || {};
      var guideAmount = Math.max(0, Math.round(toPayrollNumber_(followInfo.guideAmount)));
      var collectedAmount = Math.round(paidInfo.collectedAmount || 0);
      var outstandingAmount = Math.max(0, guideAmount - Math.max(0, collectedAmount));
      var paidDates = Object.keys(paidInfo.paidDates || {}).sort(function(a, b) { return String(a).localeCompare(String(b)); });
      var routes = Object.keys(paidInfo.routes || {});
      var unpaidStatus = normalizeTuitionUnpaidStatus_(followInfo.unpaidStatus || "");
      var paid = unpaidStatus === "이월금" ||
        (guideAmount > 0 && collectedAmount >= guideAmount) ||
        (guideAmount <= 0 && collectedAmount > 0);
      if (paid && unpaidStatus !== "이월금") unpaidStatus = "납부완료";
      if (!paid && guideAmount > 0 && collectedAmount > 0 && outstandingAmount > 0) unpaidStatus = "일부완료";
      if (!paid && outstandingAmount > 0 && unpaidStatus === "납부완료") unpaidStatus = "확인필요";
      return {
        monthName: monthName,
        guideAmount: guideAmount,
        collectedAmount: collectedAmount,
        outstandingAmount: outstandingAmount,
        contactCount: Math.max(0, parseInt(followInfo.contactCount || 0, 10) || 0),
        lastContactAt: String(followInfo.lastContactAt || ""),
        lastContactMemo: String(followInfo.lastContactMemo || ""),
        lastUpdatedAt: String(followInfo.lastUpdatedAt || ""),
        paid: paid,
        unpaidStatus: unpaidStatus,
        paidDates: paidDates,
        paymentRoutes: routes
      };
    }).sort(function(a, b) {
      var ma = parseTuitionMonthName_(a.monthName);
      var mb = parseTuitionMonthName_(b.monthName);
      if (!ma || !mb) return String(b.monthName).localeCompare(String(a.monthName));
      if (ma.year !== mb.year) return mb.year - ma.year;
      return mb.month - ma.month;
    });

    var overview = {
      totalMonths: rows.length,
      guidedMonths: 0,
      totalContacts: 0,
      paidMonths: 0,
      unpaidMonths: 0,
      totalGuideAmount: 0,
      totalCollectedAmount: 0,
      totalOutstandingAmount: 0,
      maxContacts: 0
    };
    rows.forEach(function(row) {
      var contactCount = Math.max(0, parseInt(row.contactCount || 0, 10) || 0);
      overview.totalContacts += contactCount;
      if (contactCount > 0) overview.guidedMonths += 1;
      if (row.paid) overview.paidMonths += 1;
      else overview.unpaidMonths += 1;
      overview.totalGuideAmount += Math.max(0, toPayrollNumber_(row.guideAmount));
      overview.totalCollectedAmount += Math.max(0, toPayrollNumber_(row.collectedAmount));
      overview.totalOutstandingAmount += Math.max(0, toPayrollNumber_(row.outstandingAmount));
      if (contactCount > overview.maxContacts) overview.maxContacts = contactCount;
    });
    overview.totalGuideAmount = Math.round(overview.totalGuideAmount);
    overview.totalCollectedAmount = Math.round(overview.totalCollectedAmount);
    overview.totalOutstandingAmount = Math.round(overview.totalOutstandingAmount);

    return { success: true, studentName: studentName, overview: overview, rows: rows };
  } catch (e) {
    return { success: false, message: "학생 월별 이력 조회 오류: " + e.message };
  }
}

function getTuitionGuideDashboard(payload) {
  try {
    var months = getTuitionMonthSheetNames_();
    var monthMap = {};
    (months || []).forEach(function(monthName) {
      monthMap[monthName] = {
        monthName: monthName,
        trackedStudents: 0,
        contactedStudents: 0,
        totalContacts: 0,
        totalGuideAmount: 0,
        maxContacts: 0,
        topStudents: []
      };
    });

    var studentMap = {};
    var overview = {
      totalMonths: 0,
      activeMonths: 0,
      totalContacts: 0,
      contactedStudents: 0,
      maxContacts: 0,
      maxMonthName: "",
      maxStudentName: ""
    };

    var followupBundle = loadTuitionFollowupRowsBundle_();
    followupBundle.rows.forEach(function(row) {
      var monthName = String(row.monthName || "").trim();
      var studentName = normalizeTuitionStudentName_(row.studentName);
      if (!monthName || !studentName) return;
      if (!monthMap[monthName]) {
        monthMap[monthName] = {
          monthName: monthName,
          trackedStudents: 0,
          contactedStudents: 0,
          totalContacts: 0,
          totalGuideAmount: 0,
          maxContacts: 0,
          topStudents: []
        };
      }

      var guideAmount = Math.max(0, toPayrollNumber_(row.guideAmount));
      var contactCount = Math.max(0, parseInt(row.contactCount || "0", 10) || 0);
      var unpaidStatus = normalizeTuitionUnpaidStatus_(row.unpaidStatus);
      var lastContactAt = String(row.lastContactAt || "");
      var lastContactMemo = String(row.lastContactMemo || "");
      var monthBucket = monthMap[monthName];

      monthBucket.trackedStudents += 1;
      monthBucket.totalGuideAmount += guideAmount;
      if (contactCount > 0) {
        monthBucket.contactedStudents += 1;
        monthBucket.totalContacts += contactCount;
        if (contactCount > monthBucket.maxContacts) monthBucket.maxContacts = contactCount;
      }
      monthBucket.topStudents.push({
        studentName: studentName,
        contactCount: contactCount,
        guideAmount: Math.round(guideAmount),
        unpaidStatus: unpaidStatus,
        lastContactAt: lastContactAt,
        lastContactMemo: lastContactMemo
      });

      if (!studentMap[studentName]) {
        studentMap[studentName] = {
          studentName: studentName,
          totalContacts: 0,
          monthsGuided: 0,
          maxContacts: 0,
          latestMonthName: ""
        };
      }
      if (contactCount > 0) {
        studentMap[studentName].totalContacts += contactCount;
        studentMap[studentName].monthsGuided += 1;
        if (contactCount > studentMap[studentName].maxContacts) {
          studentMap[studentName].maxContacts = contactCount;
          studentMap[studentName].latestMonthName = monthName;
        }
        overview.totalContacts += contactCount;
        if (contactCount > overview.maxContacts) {
          overview.maxContacts = contactCount;
          overview.maxMonthName = monthName;
          overview.maxStudentName = studentName;
        }
      }
    });

    var monthRows = Object.keys(monthMap).map(function(monthName) {
      var bucket = monthMap[monthName];
      var topStudents = (bucket.topStudents || []).filter(function(item) {
        return item.contactCount > 0;
      }).sort(function(a, b) {
        if (b.contactCount !== a.contactCount) return b.contactCount - a.contactCount;
        return String(a.studentName || "").localeCompare(String(b.studentName || ""), "ko");
      }).slice(0, 5);
      return {
        monthName: monthName,
        trackedStudents: bucket.trackedStudents,
        contactedStudents: bucket.contactedStudents,
        totalContacts: bucket.totalContacts,
        avgContacts: bucket.contactedStudents ? Math.round((bucket.totalContacts / bucket.contactedStudents) * 10) / 10 : 0,
        maxContacts: bucket.maxContacts,
        totalGuideAmount: Math.round(bucket.totalGuideAmount || 0),
        topStudents: topStudents
      };
    }).sort(function(a, b) {
      var ma = parseTuitionMonthName_(a.monthName);
      var mb = parseTuitionMonthName_(b.monthName);
      if (!ma || !mb) return String(b.monthName || "").localeCompare(String(a.monthName || ""));
      if (ma.year !== mb.year) return mb.year - ma.year;
      return mb.month - ma.month;
    });

    overview.totalMonths = monthRows.length;
    overview.activeMonths = monthRows.filter(function(item) { return item.totalContacts > 0; }).length;
    overview.contactedStudents = Object.keys(studentMap).filter(function(studentName) {
      return (studentMap[studentName].totalContacts || 0) > 0;
    }).length;

    var studentLeaders = Object.keys(studentMap).map(function(studentName) {
      return studentMap[studentName];
    }).filter(function(item) {
      return item.totalContacts > 0;
    }).sort(function(a, b) {
      if (b.totalContacts !== a.totalContacts) return b.totalContacts - a.totalContacts;
      if (b.maxContacts !== a.maxContacts) return b.maxContacts - a.maxContacts;
      return String(a.studentName || "").localeCompare(String(b.studentName || ""), "ko");
    }).slice(0, 12);

    return {
      success: true,
      overview: overview,
      months: monthRows,
      studentLeaders: studentLeaders
    };
  } catch (e) {
    return { success: false, message: "수강료 안내 대시보드 조회 오류: " + e.message };
  }
}

function loadTuitionStudentFollowupByMonth_(studentName, records) {
  var map = {};
  var sourceRows = Array.isArray(records) ? records : loadTuitionFollowupRowsBundle_().rows;
  sourceRows.forEach(function(row) {
    var monthName = String(row.monthName || "").trim();
    var name = normalizeTuitionStudentName_(row.studentName);
    if (!monthName || !name || name !== studentName) return;
    if (!isTuitionFollowupRecordPreferred_(row, map[monthName])) return;
    map[monthName] = {
      guideAmount: toPayrollNumber_(row.guideAmount),
      unpaidStatus: String(row.unpaidStatus || "").trim(),
      lastContactAt: String(row.lastContactAt || ""),
      lastContactMemo: String(row.lastContactMemo || ""),
      contactCount: parseInt(row.contactCount || "0", 10) || 0,
      lastUpdatedAt: String(row.lastUpdatedAt || "")
    };
  });
  return map;
}

function parseTuitionYearMonthKey_(key) {
  var text = String(key || "").trim();
  var m = text.match(/^(\d{2})-(\d{2})$/);
  if (!m) return { year: 0, month: 0 };
  return { year: 2000 + parseInt(m[1], 10), month: parseInt(m[2], 10) };
}

function parseTuitionDueMonthKey_(dueDateText, fallbackMonthName) {
  var text = String(dueDateText || "").trim();
  if (text) {
    var m4 = text.match(/(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*\d{1,2}/);
    if (m4) return String(m4[1]).slice(2) + "-" + payrollPad2_(parseInt(m4[2], 10));
    var m2 = text.match(/(^|[^0-9])(\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*\d{1,2}([^0-9]|$)/);
    if (m2) return m2[2] + "-" + payrollPad2_(parseInt(m2[3], 10));
  }
  var fallback = String(fallbackMonthName || "").replace(/s$/i, "").trim();
  return /^\d{2}-\d{2}$/.test(fallback) ? fallback : "";
}

function parseTuitionPaidMonthKey_(paidAtText, baseMonthName) {
  var text = String(paidAtText || "").trim();
  var base = parseTuitionMonthName_(baseMonthName);
  if (!base) return "";
  var year = base.year;
  var month = base.month;

  if (text) {
    var f4 = text.match(/(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*\d{1,2}/);
    if (f4) {
      year = parseInt(f4[1], 10);
      month = parseInt(f4[2], 10);
      return String(year).slice(2) + "-" + payrollPad2_(month);
    }
    var f2 = text.match(/(^|[^0-9])(\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*\d{1,2}([^0-9]|$)/);
    if (f2) {
      year = 2000 + parseInt(f2[2], 10);
      month = parseInt(f2[3], 10);
      return String(year).slice(2) + "-" + payrollPad2_(month);
    }
    var md = text.match(/(\d{1,2})\s*[.\-/]\s*(\d{1,2})/);
    if (md) {
      month = parseInt(md[1], 10);
      if (base.month === 1 && month === 12) year -= 1;
      if (base.month === 12 && month === 1) year += 1;
      return String(year).slice(2) + "-" + payrollPad2_(month);
    }
  }
  return String(year).slice(2) + "-" + payrollPad2_(month);
}

function getTuitionPaymentBaseMonthName_(row) {
  var monthName = row ? (row.sourceDueMonth || row.sourceMonth || row.originMonth || parseTuitionDueMonthName_(row.dueDate)) : "";
  var text = String(monthName || "").trim();
  if (/^\d{2}-\d{2}$/.test(text)) return text + "s";
  return text;
}

function parseTuitionDateTimeMs_(text, baseMonthName) {
  var raw = String(text || "").trim();
  if (!raw) return -1;
  var normalizedBase = String(baseMonthName || "").trim();
  if (/^\d{2}-\d{2}$/.test(normalizedBase)) normalizedBase += "s";
  var base = parseTuitionMonthName_(normalizedBase);
  var year = base ? base.year : 0;
  var month = base ? base.month : 0;
  var day = 0;
  var hour = 0;
  var minute = 0;
  var second = 0;
  var matched = null;
  var mode = "";

  var full = raw.match(/(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?:\D+(\d{1,2})\s*:\s*(\d{1,2})(?:\s*:\s*(\d{1,2}))?)?/);
  var fullShort = raw.match(/(^|\D)(\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?:\D+(\d{1,2})\s*:\s*(\d{1,2})(?:\s*:\s*(\d{1,2}))?)?/);
  var monthDay = raw.match(/(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?:\D+(\d{1,2})\s*:\s*(\d{1,2})(?:\s*:\s*(\d{1,2}))?)?/);

  if (full) {
    matched = full;
    mode = "full";
    year = parseInt(full[1], 10);
    month = parseInt(full[2], 10);
    day = parseInt(full[3], 10);
    hour = parseInt(full[4] || "0", 10);
    minute = parseInt(full[5] || "0", 10);
    second = parseInt(full[6] || "0", 10);
  } else if (fullShort) {
    matched = fullShort;
    mode = "fullShort";
    year = 2000 + parseInt(fullShort[2], 10);
    month = parseInt(fullShort[3], 10);
    day = parseInt(fullShort[4], 10);
    hour = parseInt(fullShort[5] || "0", 10);
    minute = parseInt(fullShort[6] || "0", 10);
    second = parseInt(fullShort[7] || "0", 10);
  } else if (monthDay) {
    matched = monthDay;
    mode = "monthDay";
    if (!base) return -1;
    month = parseInt(monthDay[1], 10);
    day = parseInt(monthDay[2], 10);
    hour = parseInt(monthDay[3] || "0", 10);
    minute = parseInt(monthDay[4] || "0", 10);
    second = parseInt(monthDay[5] || "0", 10);
    if (base.month === 1 && month === 12) year -= 1;
    if (base.month === 12 && month === 1) year += 1;
  } else {
    return -1;
  }

  if (!matched || isNaN(year) || isNaN(month) || isNaN(day)) return -1;
  if (month < 1 || month > 12 || day < 1 || day > 31) return -1;
  if (isNaN(hour) || hour < 0 || hour > 23) hour = 0;
  if (isNaN(minute) || minute < 0 || minute > 59) minute = 0;
  if (isNaN(second) || second < 0 || second > 59) second = 0;
  if (mode === "monthDay" && !base) return -1;
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

function getTuitionPaymentSortKey_(row) {
  var baseMonth = getTuitionPaymentBaseMonthName_(row);
  var paidKey = parseTuitionDateTimeMs_(row && row.paidAt, baseMonth);
  if (paidKey >= 0) return paidKey;
  return parseTuitionDateTimeMs_(row && row.inputAt, baseMonth);
}

function compareTuitionPaymentRowsDesc_(a, b) {
  var aPaid = getTuitionPaymentSortKey_(a);
  var bPaid = getTuitionPaymentSortKey_(b);
  if (aPaid !== bPaid) return bPaid - aPaid;

  var aInput = parseTuitionDateTimeMs_(a && a.inputAt, getTuitionPaymentBaseMonthName_(a));
  var bInput = parseTuitionDateTimeMs_(b && b.inputAt, getTuitionPaymentBaseMonthName_(b));
  if (aInput !== bInput) return bInput - aInput;

  var aPaidText = String((a && a.paidAt) || "");
  var bPaidText = String((b && b.paidAt) || "");
  if (aPaidText !== bPaidText) return bPaidText.localeCompare(aPaidText);

  var aInputText = String((a && a.inputAt) || "");
  var bInputText = String((b && b.inputAt) || "");
  if (aInputText !== bInputText) return bInputText.localeCompare(aInputText);

  return toPayrollNumber_(b && b.rowNumber) - toPayrollNumber_(a && a.rowNumber);
}

function payrollPad2_(num) {
  var n = parseInt(num, 10);
  if (isNaN(n)) n = 0;
  return n < 10 ? ("0" + n) : String(n);
}

function getPayrollMonthSummary(payload) {
  try {
    var req = payload || {};
    var ss = getPayrollSpreadsheet_();
    var monthSheets = getPayrollMonthSheetNames_(ss);
    if (!monthSheets.length) {
      return { success: false, message: "급여 정산 월 탭(예: 26-02)을 찾을 수 없습니다." };
    }

    var monthName = String(req.monthName || monthSheets[0]).trim();
    var monthMeta = parsePayrollMonthName_(monthName);
    if (!monthMeta) {
      return { success: false, message: "월 탭 이름 형식이 올바르지 않습니다: " + monthName };
    }

    var sheet = ss.getSheetByName(monthName);
    if (!sheet) {
      return { success: false, message: "선택한 월 탭을 찾을 수 없습니다: " + monthName };
    }

    var forceRefresh = !!req.forceRefresh;
    var source = readPayrollMonthSource_(sheet);
    var sheetVersion = buildPayrollSourceVersion_(source);
    var savedOverrides = loadPayrollOverrides_(monthName);
    var requestOverrides = normalizePayrollOverrideBundle_(req);
    var effectiveOverrides = mergePayrollOverrideBundles_(savedOverrides, requestOverrides);
    var options = {
      subjectFilter: String(req.subjectFilter || "").trim(),
      teacherName: String(req.teacherName || "").trim(),
      classTypeFilter: String(req.classTypeFilter || "").trim(),
      salaryMode: normalizePayrollSalaryMode_(req.salaryMode),
      ratioPercent: clampPayrollNumber_(toPayrollNumber_(req.ratioPercent), 0, 100, 50),
      hourlyRate: Math.max(0, toPayrollNumber_(req.hourlyRate)),
      freeIncludedRowKeySet: toPayrollKeySet_(effectiveOverrides.freeIncludedRowKeys),
      recognitionOverrideMap: toPayrollRecognitionOverrideMap_(effectiveOverrides.recognitionOverrides),
      rateAdjustmentMap: toPayrollRateAdjustmentMap_(effectiveOverrides.rateAdjustments),
      settlementPercentOverrideMap: toPayrollSettlementPercentOverrideMap_(effectiveOverrides.settlementPercentOverrides),
      effectiveOverrides: effectiveOverrides,
      overrideSignature: buildPayrollOverrideSignature_(effectiveOverrides)
    };
    options.teacherSettings = loadPayrollTeacherSettings_();
    options.teacherSettingsSignature = buildPayrollTeacherSettingsSignature_(options.teacherSettings, options.teacherName);
    var cacheKey = buildPayrollSummaryCacheKey_(monthName, sheetVersion, req, options);
    var cachePath = "payroll/months/" + monthName + "/summary_cache/" + cacheKey;
    var cachedSummary = null;
    var cacheError = "";

    if (!forceRefresh) {
      try {
        var cached = firebaseRequestWithServiceAccount_("get", cachePath);
        if (cached && cached.payload) cachedSummary = cached.payload;
      } catch (cacheReadErr) {
        cacheError = "read:" + cacheReadErr.message;
      }
    }

    var summary;
    var cachedValid = cachedSummary && isPayrollSummaryCacheValidForOptions_(cachedSummary, options);
    if (cachedValid) {
      summary = cachedSummary;
      summary.cache = {
        source: "firebase",
        hit: true,
        key: cacheKey,
        sheetVersion: sheetVersion
      };
    } else {
      var rowBundle = getPayrollMonthRowsBundle_(sheet, monthMeta, forceRefresh, source, sheetVersion);
      var rows = rowBundle.rows || [];
      var teacherBundle = rowBundle.teacherBundle || buildPayrollTeacherOptions_(rows);
      options.rateSuspicionMap = getPayrollRateSuspicionMapCached_(rows, monthName, sheetVersion, options.teacherSettings[PAYROLL_SUSPICION_SETTINGS_KEY], forceRefresh);
      summary = buildPayrollSummary_(rows, monthMeta, options);
      summary.cache = {
        source: "firebase",
        hit: false,
        key: cacheKey,
        sheetVersion: sheetVersion,
        error: cacheError,
        invalidated: !!cachedSummary,
        forceRefresh: forceRefresh
      };
      summary.subjects = teacherBundle.subjects;
      summary.teachers = teacherBundle.teachers;
      summary.teacherGroups = teacherBundle.groups;
    }

    summary.success = true;
    summary.selectedMonth = monthName;
    summary.monthLabel = monthMeta.year + "년 " + monthMeta.month + "월";
    summary.salaryMode = options.salaryMode;
    summary.ratioPercent = options.ratioPercent;
    summary.hourlyRate = options.hourlyRate;
    summary.subjects = summary.subjects || [];
    summary.teachers = summary.teachers || [];
    summary.teacherGroups = summary.teacherGroups || [];
    summary.months = monthSheets;
    summary.savedOverrides = effectiveOverrides;
    summary.overrideSignature = options.overrideSignature;
    if (!cachedValid) {
      try {
        firebaseRequestWithServiceAccount_("put", cachePath, {
          storedAt: new Date().toISOString(),
          monthName: monthName,
          sheetVersion: sheetVersion,
          payload: summary
        });
      } catch (cacheWriteErr) {
        summary.cache.error = summary.cache.error
          ? summary.cache.error + " / write:" + cacheWriteErr.message
          : "write:" + cacheWriteErr.message;
      }
    }
    return summary;
  } catch (e) {
    return { success: false, message: "정산 데이터 계산 오류: " + e.message };
  }
}

function getPayrollSheetVersion_(sheet, rows) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var sourceRows = Array.isArray(rows) ? rows : [];
  var payload = sourceRows.map(function(row) {
    return [
      row.rowNumber,
      row.name,
      row.classDateRaw,
      row.className,
      row.attendance,
      row.room,
      row.teacher,
      row.start,
      row.end,
      row.hours,
      row.rate,
      row.amount,
      row.note,
      row.discount
    ];
  });
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(payload)
  );
  return [lastRow, lastCol, bytesToHex_(digest)].join("_");
}

function buildPayrollSummaryCacheKey_(monthName, sheetVersion, req, options) {
  var effectiveOverrides = (options && options.effectiveOverrides) || {};
  var freeRows = (Array.isArray(effectiveOverrides.freeIncludedRowKeys) ? effectiveOverrides.freeIncludedRowKeys : [])
    .map(function(v) { return String(v || "").trim(); })
    .filter(function(v) { return !!v; })
    .sort();
  var overrides = (Array.isArray(effectiveOverrides.recognitionOverrides) ? effectiveOverrides.recognitionOverrides : [])
    .map(function(item) {
      return {
        rowKey: String((item && item.rowKey) || "").trim(),
        recognized: !!(item && item.recognized)
      };
    })
    .filter(function(item) { return !!item.rowKey; })
    .sort(function(a, b) { return a.rowKey < b.rowKey ? -1 : (a.rowKey > b.rowKey ? 1 : 0); });
  var rateAdjustments = (Array.isArray(effectiveOverrides.rateAdjustments) ? effectiveOverrides.rateAdjustments : [])
    .map(function(item) {
      return {
        rowKey: String((item && item.rowKey) || "").trim(),
        rate: roundPayrollNumber_(toPayrollNumber_(item && item.rate), 2)
      };
    })
    .filter(function(item) { return !!item.rowKey && item.rate > 0; })
    .sort(function(a, b) { return a.rowKey < b.rowKey ? -1 : (a.rowKey > b.rowKey ? 1 : 0); });
  var settlementPercentOverrides = (Array.isArray(effectiveOverrides.settlementPercentOverrides) ? effectiveOverrides.settlementPercentOverrides : [])
    .map(function(item) {
      return {
        rowKey: String((item && item.rowKey) || "").trim(),
        percent: roundPayrollNumber_(clampPayrollNumber_(toPayrollNumber_(item && item.percent), 0, 200, 0), 2)
      };
    })
    .filter(function(item) { return !!item.rowKey; })
    .sort(function(a, b) { return a.rowKey < b.rowKey ? -1 : (a.rowKey > b.rowKey ? 1 : 0); });

  var signature = {
    cacheSchemaVersion: PAYROLL_CACHE_SCHEMA_VERSION,
    monthName: monthName,
    sheetVersion: sheetVersion,
    subjectFilter: options.subjectFilter,
    teacherName: options.teacherName,
    classTypeFilter: options.classTypeFilter,
    salaryMode: options.salaryMode,
    ratioPercent: options.ratioPercent,
    hourlyRate: options.hourlyRate,
    teacherSettingsSignature: options.teacherSettingsSignature || "",
    overrideSignature: options.overrideSignature || "",
    freeIncludedRowKeys: freeRows,
    recognitionOverrides: overrides,
    rateAdjustments: rateAdjustments,
    settlementPercentOverrides: settlementPercentOverrides
  };
  var text = JSON.stringify(signature);
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return bytesToHex_(digest);
}

function isPayrollSummaryCacheValidForOptions_(summary, options) {
  if (!summary || !Array.isArray(summary.rows)) return false;
  var teacher = String(options.teacherName || "").trim();
  var subject = String(options.subjectFilter || "").trim();
  var classType = String(options.classTypeFilter || "").trim();
  for (var i = 0; i < summary.rows.length; i++) {
    var row = summary.rows[i] || {};
    if (teacher && String(row.teacher || "").trim() !== teacher) return false;
    if (subject && String(row.subject || "").trim() !== subject) return false;
    if (classType && String(row.classType || "").trim() !== classType) return false;
  }
  return true;
}

function bytesToHex_(bytes) {
  return bytes.map(function(b) {
    var v = b;
    if (v < 0) v += 256;
    var s = v.toString(16);
    return s.length === 1 ? "0" + s : s;
  }).join("");
}

function buildPayrollTeacherSettingsSignature_(settings, teacherName) {
  var source = settings && typeof settings === "object" ? settings : {};
  var payload = {
    suspicionRules: normalizePayrollSuspicionSettings_(source[PAYROLL_SUSPICION_SETTINGS_KEY] || {})
  };
  if (teacherName) {
    var cfg = source[teacherName] || {};
    payload[teacherName] = {
      salaryMode: normalizePayrollSalaryMode_(cfg.salaryMode),
      hourlyRate: Math.max(0, toPayrollNumber_(cfg.hourlyRate)),
      oneToOneSettlementMode: String(cfg.oneToOneSettlementMode || "").toLowerCase() === "ratio" ? "ratio" : "hourly",
      oneToOneRatioPercent: clampPayrollNumber_(toPayrollNumber_(cfg.oneToOneRatioPercent), 0, 100, 50)
    };
  } else {
    var keys = Object.keys(source).sort();
    keys.forEach(function(name) {
      if (name === PAYROLL_SUSPICION_SETTINGS_KEY) return;
      var cfg = source[name] || {};
      payload[name] = {
        salaryMode: normalizePayrollSalaryMode_(cfg.salaryMode),
        hourlyRate: Math.max(0, toPayrollNumber_(cfg.hourlyRate)),
        oneToOneSettlementMode: String(cfg.oneToOneSettlementMode || "").toLowerCase() === "ratio" ? "ratio" : "hourly",
        oneToOneRatioPercent: clampPayrollNumber_(toPayrollNumber_(cfg.oneToOneRatioPercent), 0, 100, 50)
      };
    });
  }
  return JSON.stringify(payload);
}

function getPayrollSpreadsheet_() {
  return SpreadsheetApp.openById(PAYROLL_SS_ID);
}

function getPayrollMonthSheetNames_(ss) {
  ss = ss || getPayrollSpreadsheet_();
  var names = ss.getSheets().map(function(sheet) { return sheet.getName(); });
  var valid = names.filter(function(name) { return !!parsePayrollMonthName_(name); });
  valid.sort(function(a, b) {
    var ma = parsePayrollMonthName_(a);
    var mb = parsePayrollMonthName_(b);
    if (ma.year !== mb.year) return mb.year - ma.year;
    return mb.month - ma.month;
  });
  return valid;
}

function getPayrollMonthRowsBundle_(sheet, monthMeta, forceRefresh, source, sheetVersion) {
  source = source || readPayrollMonthSource_(sheet);
  sheetVersion = sheetVersion || buildPayrollSourceVersion_(source);
  var cachePath = "payroll/months/" + monthMeta.sheetName + "/row_snapshot/" + PAYROLL_CACHE_SCHEMA_VERSION + "/" + sheetVersion;
  if (!forceRefresh) {
    try {
      var cached = firebaseRequestWithServiceAccount_("get", cachePath);
      if (cached && Array.isArray(cached.rows) && cached.teacherBundle) {
        return {
          rows: cached.rows,
          teacherBundle: cached.teacherBundle,
          sheetVersion: sheetVersion,
          source: "firebase"
        };
      }
    } catch (cacheReadErr) {
      // Row snapshot cache is an optimization only; fall through to local parsing.
    }
  }

  var rows = parsePayrollRowsFromSource_(source, monthMeta);
  var teacherBundle = buildPayrollTeacherOptions_(rows);
  var bundle = {
    rows: rows,
    teacherBundle: teacherBundle,
    sheetVersion: sheetVersion,
    source: "sheet"
  };
  try {
    firebaseRequestWithServiceAccount_("put", cachePath, {
      storedAt: new Date().toISOString(),
      sheetVersion: sheetVersion,
      rows: rows,
      teacherBundle: teacherBundle
    });
  } catch (cacheWriteErr) {
    bundle.cacheError = cacheWriteErr.message;
  }
  return bundle;
}

function readPayrollMonthSource_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) {
    return { lastRow: lastRow, lastCol: lastCol, headers: [], values: [] };
  }
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function(h) {
    return normalizePayrollHeader_(h);
  });
  if (lastRow < 2) {
    return { lastRow: lastRow, lastCol: lastCol, headers: headers, values: [] };
  }
  var indexMap = getPayrollColumnIndexMap_(headers);
  var dataColCount = Math.max(1, Math.min(lastCol, getPayrollMaxColumnIndex_(indexMap) + 1));
  var values = sheet.getRange(2, 1, lastRow - 1, dataColCount).getDisplayValues();
  return {
    lastRow: lastRow,
    lastCol: lastCol,
    dataColCount: dataColCount,
    headers: headers,
    values: values
  };
}

function buildPayrollSourceVersion_(source) {
  var payload = {
    lastRow: toPayrollNumber_(source && source.lastRow, 0),
    lastCol: toPayrollNumber_(source && source.lastCol, 0),
    dataColCount: toPayrollNumber_(source && source.dataColCount, 0),
    headers: (source && source.headers) || [],
    values: (source && source.values) || []
  };
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(payload));
  return [payload.lastRow, payload.lastCol, bytesToHex_(digest)].join("_");
}

function getTuitionMonthSheetNames_() {
  var cached = readTuitionJsonCache_(TUITION_MONTH_NAMES_CACHE_KEY);
  if (Array.isArray(cached) && cached.length) return cached;
  var ss = getPayrollSpreadsheet_();
  var names = ss.getSheets().map(function(sheet) { return sheet.getName(); });
  var valid = names.filter(function(name) {
    return /^\d{2}-\d{2}s$/i.test(String(name || "").trim());
  });
  valid.sort(function(a, b) {
    var ma = parseTuitionMonthName_(a);
    var mb = parseTuitionMonthName_(b);
    if (!ma || !mb) return String(b).localeCompare(String(a));
    if (ma.year !== mb.year) return mb.year - ma.year;
    return mb.month - ma.month;
  });
  writeTuitionJsonCache_(TUITION_MONTH_NAMES_CACHE_KEY, valid, TUITION_MONTH_NAMES_CACHE_TTL_SECONDS);
  return valid;
}

function parseTuitionMonthName_(name) {
  var text = String(name || "").trim();
  var m = text.match(/^(\d{2})-(\d{2})s$/i);
  if (!m) return null;
  var yy = parseInt(m[1], 10);
  var mm = parseInt(m[2], 10);
  if (isNaN(yy) || isNaN(mm) || mm < 1 || mm > 12) return null;
  return { year: 2000 + yy, month: mm };
}

function parseTuitionRows_(sheet) {
  var values = sheet.getDataRange().getDisplayValues();
  if (!values || values.length < 2) return [];
  var headers = values[0] || [];
  var index = buildTuitionHeaderIndex_(headers, {
    dueDate: ["납입기한"],
    studentName: ["이름"],
    itemName: ["항목"],
    amount: ["금액"],
    paidAt: ["납부"],
    business: ["사업자"],
    paymentType: ["결재구분", "결제구분"],
    approvalNo: ["승인번호"],
    inputAt: ["입력일시"],
    issueMemo: ["이슈메모", "메모", "비고", "column10", "column1"],
    originMonth: ["원본월", "기준월"],
    requestId: ["요청ID", "requestId", "clientRequestId"]
  });
  var issueMemoIndex = index.issueMemo;
  var originMonthIndex = index.originMonth;
  var requestIdIndex = index.requestId;
  if (issueMemoIndex === 0) {
    var h0 = normalizeTuitionHeaderText_(headers[0]);
    var isMemoHeader = h0.indexOf("이슈메모") !== -1 || h0.indexOf("메모") !== -1 || h0.indexOf("비고") !== -1 || h0.indexOf("column10") !== -1 || h0.indexOf("column1") !== -1;
    if (!isMemoHeader) {
      issueMemoIndex = headers.length >= 10 ? 9 : -1;
    }
  }
  if (originMonthIndex === 0) {
    var oh0 = normalizeTuitionHeaderText_(headers[0]);
    var isOriginHeader = oh0.indexOf("원본월") !== -1 || oh0.indexOf("기준월") !== -1;
    if (!isOriginHeader) originMonthIndex = -1;
  }
  if (requestIdIndex === 0) {
    var rh0 = normalizeTuitionHeaderText_(headers[0]);
    var isRequestHeader = rh0.indexOf("요청id") !== -1 || rh0.indexOf("requestid") !== -1 || rh0.indexOf("clientrequestid") !== -1;
    if (!isRequestHeader) requestIdIndex = -1;
  }

  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var studentName = normalizeTuitionStudentName_(row[index.studentName]);
    if (!studentName) continue;
    var amount = toPayrollNumber_(row[index.amount]);
    var paidAt = String(row[index.paidAt] || "").trim();
    var business = String(row[index.business] || "").trim();
    var paymentType = String(row[index.paymentType] || "").trim();
    var approvalNo = String(row[index.approvalNo] || "").trim();
    var inputAt = String(row[index.inputAt] || "").trim();
    var issueMemo = issueMemoIndex >= 0 ? String(row[issueMemoIndex] || "").trim() : "";
    var hasPaymentSignal = amount !== 0 || !!paidAt || !!paymentType || !!approvalNo || !!inputAt || !!business || !!issueMemo;
    if (!hasPaymentSignal) continue;

    rows.push({
      rowNumber: i + 1,
      dueDate: String(row[index.dueDate] || "").trim(),
      studentName: studentName,
      itemName: String(row[index.itemName] || "").trim(),
      amount: amount,
      paidAt: paidAt,
      business: business,
      paymentType: paymentType,
      approvalNo: approvalNo,
      inputAt: inputAt,
      issueMemo: issueMemo,
      originMonth: originMonthIndex >= 0 ? String(row[originMonthIndex] || "").trim() : "",
      requestId: requestIdIndex >= 0 ? normalizeTuitionClientRequestId_(row[requestIdIndex]) : ""
    });
  }
  return rows;
}

function normalizeTuitionRouteLabel_(paymentType, issueMemo) {
  var raw = String(paymentType || "").toLowerCase();
  if (!raw) return "기타";
  if (/서울페이|서초페이|제로페이/.test(raw)) return "서울페이";
  if (/현장|방문|카운터|pos/.test(raw)) return "현장결제";
  if (/계좌|이체|입금|송금|무통장/.test(raw)) return "계좌";
  if (/현금/.test(raw)) return "현금";
  if (/카드|신한|국민|삼성|농협|현대|하나|롯데/.test(raw)) return "카드";
  return "기타";
}

function parseTuitionDueMonthName_(dueDateText) {
  var text = String(dueDateText || "").trim();
  if (!text) return "";
  var m = text.match(/(\d{2})\s*[-./]\s*(\d{2})\s*[-./]\s*\d{1,2}/);
  if (!m) m = text.match(/(\d{2})\s*년\s*(\d{1,2})\s*월/);
  if (!m) m = text.match(/\b(\d{2})(\d{2})\d{2}\b/);
  if (!m) return "";
  var yy = parseInt(m[1], 10);
  var mm = parseInt(m[2], 10);
  if (isNaN(yy) || isNaN(mm) || mm < 1 || mm > 12) return "";
  return ("0" + yy).slice(-2) + "-" + ("0" + mm).slice(-2) + "s";
}

function extractTuitionMonthDay_(dateText) {
  var text = String(dateText || "").trim();
  if (!text) return "";
  var full = text.match(/(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/);
  var fullShort = text.match(/(^|\D)(\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})(\D|$)/);
  var md = text.match(/(\d{1,2})\s*[\/.\-]\s*(\d{1,2})/);
  var month = 0;
  var day = 0;
  if (full) {
    month = parseInt(full[2], 10);
    day = parseInt(full[3], 10);
  } else if (fullShort) {
    month = parseInt(fullShort[3], 10);
    day = parseInt(fullShort[4], 10);
  } else if (md) {
    month = parseInt(md[1], 10);
    day = parseInt(md[2], 10);
  } else {
    return "";
  }
  if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) return "";
  return ("0" + month).slice(-2) + "-" + ("0" + day).slice(-2);
}

function loadTuitionClassStudentMapByMonth_(tuitionMonthName) {
  var tuitionMonth = String(tuitionMonthName || "").trim();
  if (!tuitionMonth) return null;
  if (isTuitionMonthChargeFirestoreReady_(tuitionMonth)) {
    var firestoreRows = loadTuitionMonthChargeRowsFromFirestore_(tuitionMonth);
    if (Array.isArray(firestoreRows)) {
      var firestoreMap = {};
      firestoreRows.forEach(function(row) {
        var name = normalizeTuitionStudentName_(row.studentName);
        if (!name) return;
        firestoreMap[name] = true;
      });
      if (Object.keys(firestoreMap).length) return firestoreMap;
    }
  }
  var sheetRows = loadTuitionMonthChargeRowsFromSheet_(tuitionMonth);
  var map = {};
  sheetRows.forEach(function(row) {
    var name = normalizeTuitionStudentName_(row.studentName);
    if (!name) return;
    map[name] = true;
  });
  return Object.keys(map).length ? map : null;
}

function loadTuitionMonthChargeRowsFromSheet_(tuitionMonthName) {
  var tuitionMonth = String(tuitionMonthName || "").trim();
  var classMonthName = tuitionMonth.replace(/s$/i, "");
  if (!/^\d{2}-\d{2}$/.test(classMonthName)) return [];
  var ss = getPayrollSpreadsheet_();
  var sheet = ss.getSheetByName(classMonthName);
  if (!sheet) return [];

  var values = sheet.getDataRange().getDisplayValues();
  if (!values || values.length < 2) return [];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i] || [];
    var name = normalizeTuitionStudentName_(row[0]);
    if (!name) continue;
    rows.push({
      monthName: tuitionMonth,
      classMonthName: classMonthName,
      studentName: name,
      rowNumber: i + 1,
      guideAmount: 0,
      active: true,
      source: "tuition_month_sheet"
    });
  }
  return rows;
}

function ensureTuitionPaymentMemoColumn_(sheet) {
  if (!sheet) return;
  var targetCol = 10;
  if (sheet.getMaxColumns() < targetCol) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), targetCol - sheet.getMaxColumns());
  }
  var header = String(sheet.getRange(1, targetCol).getDisplayValue() || "").trim();
  if (!header) {
    sheet.getRange(1, targetCol).setValue("이슈메모");
  }
}

function buildTuitionHeaderIndex_(headers, spec) {
  var normalized = (headers || []).map(function(h) {
    return normalizeTuitionHeaderText_(h);
  });
  var index = {};
  Object.keys(spec).forEach(function(key) {
    index[key] = -1;
    var candidates = spec[key] || [];
    for (var i = 0; i < normalized.length; i++) {
      for (var j = 0; j < candidates.length; j++) {
        var token = normalizeTuitionHeaderText_(candidates[j]);
        if (token && normalized[i].indexOf(token) !== -1) {
          index[key] = i;
          break;
        }
      }
      if (index[key] !== -1) break;
    }
    if (index[key] === -1) index[key] = 0;
  });
  return index;
}

function normalizeTuitionHeaderText_(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[^\u3131-\uD79D0-9A-Za-z]/g, "")
    .toLowerCase();
}

function loadTuitionStudentMasterBundle_() {
  var fallbackReason = "";
  try {
    var firestoreRows = loadTuitionStudentMasterFromFirestore_();
    if (firestoreRows.length) {
      return { rows: firestoreRows, source: "firestore", fallbackReason: "" };
    }
    fallbackReason = "Firestore students 응답이 비어 있습니다.";
  } catch (e) {
    fallbackReason = e && e.message ? e.message : String(e);
  }
  return {
    rows: loadTuitionStudentMasterFromSheet_(),
    source: "sheet",
    fallbackReason: fallbackReason
  };
}

function loadTuitionStudentMaster_() {
  return loadTuitionStudentMasterBundle_().rows || [];
}

function loadTuitionStudentMasterFromFirestore_() {
  var cache = CacheService.getScriptCache();
  var cacheKey = "TUITION_FIRESTORE_STUDENTS_V1";
  var cached = cache.get(cacheKey);
  if (cached) {
    try {
      var cachedRows = JSON.parse(cached);
      if (Array.isArray(cachedRows)) return cachedRows;
    } catch (e0) {}
  }
  var docs = firestoreListCollection_("students", 500);
  var rows = [];
  var seen = {};
  docs.forEach(function(doc) {
    if (!isTuitionFirestoreStudentRegistered_(doc)) return;
    var name = normalizeTuitionStudentName_(doc.studentName || doc.name || doc.displayName);
    if (!name) return;
    var school = String(doc.school || doc.schoolName || "").trim();
    var grade = String(doc.grade || doc.gradeName || "").trim();
    var key = [name, school, grade].join("|");
    if (seen[key]) return;
    seen[key] = true;
    rows.push({
      id: String(doc.studentId || doc.id || "").trim(),
      name: name,
      school: school,
      grade: grade,
      registrationStatus: String(doc.status || "").trim() || (doc.active === true ? "ACTIVE" : "")
    });
  });
  rows.sort(function(a, b) {
    return String(a.name || "").localeCompare(String(b.name || ""), "ko");
  });
  try {
    cache.put(cacheKey, JSON.stringify(rows), 60);
  } catch (e1) {}
  return rows;
}

function isTuitionFirestoreStudentRegistered_(doc) {
  if (!doc || typeof doc !== "object") return false;
  if (doc.active === false || doc.isActive === false) return false;
  var status = String(doc.status || doc.registrationStatus || doc.enrollmentStatus || "").trim().toUpperCase();
  if (!status) return doc.active === true || doc.isActive === true;
  if (/^(ACTIVE|REGISTERED|ENROLLED|재원|등록|활성)$/.test(status)) return true;
  if (/^(INACTIVE|DISABLED|DELETED|STOPPED|WITHDRAWN|PAUSED|중지|퇴원|비활성|삭제)$/.test(status)) return false;
  return doc.active === true || doc.isActive === true;
}

function loadTuitionStudentMasterFromSheet_() {
  var ss = SpreadsheetApp.openById(TEACHER_SS_ID);
  var sheet = ss.getSheetByName("student");
  if (!sheet) return [];
  var range = sheet.getDataRange();
  var values = range.getValues();
  var displayValues = range.getDisplayValues();
  var validations = range.getDataValidations();
  if (!values || values.length < 2) return [];

  var headers = values[0] || [];
  var normalizedHeaders = headers.map(function(h) {
    return normalizeTuitionHeaderText_(h);
  });
  var nameCol = findTuitionStudentColIndex_(normalizedHeaders, ["이름필드", "이름", "학생명"], 0);
  var schoolCol = findTuitionStudentColIndex_(normalizedHeaders, ["학교필드", "학교"], 1);
  var gradeCol = findTuitionStudentColIndex_(normalizedHeaders, ["학년필드", "학년"], 2);
  var activeCol = findTuitionStudentColIndex_(normalizedHeaders, ["등록상태", "등록여부", "재원상태"], -1);

  var rows = [];
  for (var i = 1; i < displayValues.length; i++) {
    var row = values[i] || [];
    var displayRow = displayValues[i] || [];
    var rawName = String(displayRow[nameCol] || "").trim();
    if (!rawName) continue;
    if (activeCol >= 0) {
      var activeValue = row[activeCol];
      var activeDisplayValue = displayRow[activeCol];
      var activeValidation = (validations[i] && validations[i][activeCol]) || null;
      if (!isTuitionStudentRegistered_(activeValue, activeDisplayValue, activeValidation)) continue;
    }
    rows.push({
      name: normalizeTuitionStudentName_(rawName),
      school: String(displayRow[schoolCol] || "").trim(),
      grade: String(displayRow[gradeCol] || "").trim()
    });
  }
  return rows;
}

function findTuitionStudentColIndex_(normalizedHeaders, tokens, fallback) {
  for (var i = 0; i < normalizedHeaders.length; i++) {
    var header = normalizedHeaders[i] || "";
    for (var j = 0; j < tokens.length; j++) {
      var token = normalizeTuitionHeaderText_(tokens[j]);
      if (token && header.indexOf(token) !== -1) return i;
    }
  }
  return fallback;
}

function isTuitionStudentRegistered_(rawValue, displayValue, validation) {
  if (
    validation &&
    validation.getCriteriaType &&
    validation.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.CHECKBOX
  ) {
    // 체크박스는 "true"만 유효 학생으로 인정 (사용자 지정 체크값도 지원)
    var checkboxArgs = validation.getCriteriaValues() || [];
    if (checkboxArgs.length >= 2) {
      var checkedValue = checkboxArgs[0];
      var uncheckedValue = checkboxArgs[1];
      if (checkedValue !== null && checkedValue !== undefined && String(checkedValue) !== "") {
        return String(rawValue) === String(checkedValue);
      }
      if (uncheckedValue !== null && uncheckedValue !== undefined && String(rawValue) === String(uncheckedValue)) {
        return false;
      }
    }
    return rawValue === true || String(rawValue || "").trim().toLowerCase() === "true";
  }

  if (typeof rawValue === "boolean") return rawValue;
  if (typeof rawValue === "number") return rawValue === 1;
  var text = String(rawValue === null || rawValue === undefined || rawValue === "" ? (displayValue || "") : rawValue)
    .trim()
    .toLowerCase();
  if (!text) return false;
  if (text === "true" || text === "1" || text === "y" || text === "yes") return true;
  if (text === "false" || text === "0" || text === "n" || text === "no") return false;
  return /^(등록|재원|활성|사용|체크|checked|v|o|✓|✔|☑|✅)$/i.test(String(text));
}

function normalizeTuitionStudentName_(name) {
  return String(name || "").replace(/^\//, "").trim();
}

function normalizeTuitionUnpaidStatus_(status) {
  var text = String(status || "").trim();
  var allow = {
    "납부완료": true,
    "이월금": true,
    "일부완료": true,
    "안내이전": true,
    "안내완료": true,
    "연락두절": true,
    "확인필요": true,
    "납부예정": true
  };
  return allow[text] ? text : "안내이전";
}

function buildTuitionSummaryStats_(rows, paymentRows) {
  var kpi = {
    totalStudents: rows.length,
    paidStudents: 0,
    unpaidStudents: 0,
    expectedAmount: 0,
    collectedAmount: 0,
    outstandingAmount: 0
  };
  var statusMap = {
    "납부완료": 0,
    "이월금": 0,
    "일부완료": 0,
    "안내이전": 0,
    "안내완료": 0,
    "연락두절": 0,
    "확인필요": 0,
    "납부예정": 0
  };

  rows.forEach(function(row) {
    kpi.expectedAmount += Math.max(0, toPayrollNumber_(row.guideAmount));
    kpi.collectedAmount += Math.max(0, toPayrollNumber_(row.collectedAmount));
    kpi.outstandingAmount += Math.max(0, toPayrollNumber_(row.outstandingAmount));
    if (row.unpaidStatus === "납부완료" || row.unpaidStatus === "이월금") kpi.paidStudents += 1;
    else kpi.unpaidStudents += 1;
    if (!statusMap[row.unpaidStatus]) statusMap[row.unpaidStatus] = 0;
    statusMap[row.unpaidStatus] += 1;
  });
  kpi.expectedAmount = Math.round(kpi.expectedAmount);
  kpi.collectedAmount = Math.round(kpi.collectedAmount);
  kpi.outstandingAmount = Math.round(kpi.outstandingAmount);

  var chartLabels = Object.keys(statusMap);
  var chartValues = chartLabels.map(function(label) { return statusMap[label] || 0; });

  var payments = (paymentRows || []).slice().sort(compareTuitionPaymentRowsDesc_);

  return {
    kpi: kpi,
    chart: {
      labels: chartLabels,
      values: chartValues
    },
    allPayments: (paymentRows || []).slice(),
    payments: payments
  };
}

function ensureTuitionFollowupSheet_(ss) {
  var sheet = ss.getSheetByName(TUITION_FOLLOWUP_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TUITION_FOLLOWUP_SHEET_NAME);
    sheet.getRange(1, 1, 1, 8).setValues([[
      "월",
      "학생명",
      "안내금액",
      "미납상태",
      "마지막연락일시",
      "마지막연락메모",
      "연락횟수",
      "마지막수정일시"
    ]]);
  }
  return sheet;
}

function ensureTuitionContactLogSheet_(ss) {
  var sheet = ss.getSheetByName(TUITION_CONTACT_LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TUITION_CONTACT_LOG_SHEET_NAME);
    sheet.getRange(1, 1, 1, 7).setValues([[
      "월",
      "학생명",
      "안내금액",
      "미납상태",
      "메모",
      "기록일시",
      "요청ID"
    ]]);
  }
  ensureSheetHeaderColumn_(sheet, "요청ID");
  return sheet;
}

function getTuitionFollowupRecordSortKey_(record) {
  if (!record) return -1;
  var monthName = String(record.monthName || "").trim();
  var updatedKey = parseTuitionDateTimeMs_(record.lastUpdatedAt, monthName);
  var contactKey = parseTuitionDateTimeMs_(record.lastContactAt, monthName);
  return Math.max(updatedKey, contactKey);
}

function isTuitionFollowupRecordPreferred_(candidate, current) {
  if (!current) return true;
  var candidateKey = getTuitionFollowupRecordSortKey_(candidate);
  var currentKey = getTuitionFollowupRecordSortKey_(current);
  if (candidateKey !== currentKey) return candidateKey > currentKey;
  return String(candidate && candidate.lastUpdatedAt || "").localeCompare(String(current && current.lastUpdatedAt || "")) >= 0;
}

function loadTuitionFollowupRowsFromSheet_() {
  var ss = getPayrollSpreadsheet_();
  var sheet = ss.getSheetByName(TUITION_FOLLOWUP_SHEET_NAME);
  var rows = [];
  if (!sheet || sheet.getLastRow() < 2) return rows;
  var values = sheet.getDataRange().getDisplayValues();
  var headers = values[0] || [];
  var index = buildTuitionHeaderIndex_(headers, {
    monthName: ["월"],
    studentName: ["학생명"],
    guideAmount: ["안내금액"],
    unpaidStatus: ["미납상태"],
    lastContactAt: ["마지막연락일시"],
    lastContactMemo: ["마지막연락메모"],
    contactCount: ["연락횟수"],
    lastUpdatedAt: ["마지막수정일시"]
  });
  for (var i = 1; i < values.length; i++) {
    var row = values[i] || [];
    var record = normalizeTuitionFollowupRecord_({
      monthName: row[index.monthName],
      studentName: row[index.studentName],
      guideAmount: row[index.guideAmount],
      unpaidStatus: row[index.unpaidStatus],
      lastContactAt: row[index.lastContactAt],
      lastContactMemo: row[index.lastContactMemo],
      contactCount: row[index.contactCount],
      lastUpdatedAt: row[index.lastUpdatedAt]
    });
    if (record) rows.push(record);
  }
  return rows;
}

function mergeTuitionFollowupRows_(sheetRows, firestoreRows) {
  var map = {};
  function add(record) {
    var row = normalizeTuitionFollowupRecord_(record);
    if (!row) return;
    var key = row.monthName + "|" + row.studentName;
    if (isTuitionFollowupRecordPreferred_(row, map[key])) map[key] = row;
  }
  (sheetRows || []).forEach(add);
  (firestoreRows || []).forEach(add);
  return Object.keys(map).map(function(key) {
    return map[key];
  });
}

function hasTuitionFollowupRowsForMonth_(rows, monthName) {
  var month = String(monthName || "").trim();
  if (!month) return (rows || []).length > 0;
  for (var i = 0; i < (rows || []).length; i++) {
    if (String(rows[i] && rows[i].monthName || "").trim() === month) return true;
  }
  return false;
}

function loadTuitionFollowupRowsBundle_(options) {
  var opts = options || {};
  var monthName = String(opts.monthName || "").trim();
  var firestoreRows = loadTuitionFollowupRowsFromFirestore_();
  var firestoreAvailable = Array.isArray(firestoreRows);
  if (firestoreAvailable && monthName && isTuitionFollowupMonthFirestoreReady_(monthName)) {
    return {
      source: "firestore",
      rows: firestoreRows,
      sheetRows: [],
      firestoreRows: firestoreRows,
      skippedSheetRows: true
    };
  }
  var sheetRows = loadTuitionFollowupRowsFromSheet_();
  var rows = firestoreAvailable ? mergeTuitionFollowupRows_(sheetRows, firestoreRows) : sheetRows;
  return {
    source: firestoreAvailable ? "sheet-firestore-merged" : "sheet-fallback-firestore-error",
    rows: rows,
    sheetRows: sheetRows,
    firestoreRows: firestoreAvailable ? firestoreRows : null,
    skippedSheetRows: false
  };
}

function loadTuitionAllFollowupRecords_() {
  return loadTuitionFollowupRowsBundle_().rows;
}

function buildTuitionFollowupMapFromRecords_(records, monthName) {
  var map = {};
  (records || []).forEach(function(row) {
    if (String(row.monthName || "").trim() !== monthName) return;
    var name = normalizeTuitionStudentName_(row.studentName);
    if (!name) return;
    if (!isTuitionFollowupRecordPreferred_(row, map[name])) return;
    map[name] = {
      guideAmount: toPayrollNumber_(row.guideAmount),
      unpaidStatus: normalizeTuitionUnpaidStatus_(row.unpaidStatus),
      lastContactAt: String(row.lastContactAt || ""),
      lastContactMemo: String(row.lastContactMemo || ""),
      contactCount: parseInt(row.contactCount || "0", 10) || 0,
      lastUpdatedAt: String(row.lastUpdatedAt || "")
    };
  });
  return map;
}

function loadTuitionFollowupMap_(monthName) {
  return buildTuitionFollowupMapFromRecords_(loadTuitionAllFollowupRecords_(), monthName);
}

function selectTuitionFollowupRowsByMonth_(rows, monthName) {
  var map = {};
  (rows || []).forEach(function(row) {
    var record = normalizeTuitionFollowupRecord_(row);
    if (!record || record.monthName !== monthName) return;
    var name = normalizeTuitionStudentName_(record.studentName);
    if (!name) return;
    if (isTuitionFollowupRecordPreferred_(record, map[name])) map[name] = record;
  });
  return map;
}

function summarizeTuitionGuideAmountMap_(map) {
  var names = Object.keys(map || {});
  var total = 0;
  names.forEach(function(name) {
    total += Math.max(0, Math.round(toPayrollNumber_(map[name] && map[name].guideAmount)));
  });
  return {
    students: names.length,
    totalGuideAmount: Math.round(total)
  };
}

function buildTuitionGuideAmountAudit_(monthName, sheetRows, firestoreRows, mergedRows, skippedSheetRows) {
  var sheetMap = selectTuitionFollowupRowsByMonth_(sheetRows, monthName);
  var firestoreAvailable = Array.isArray(firestoreRows);
  var firestoreMap = firestoreAvailable ? selectTuitionFollowupRowsByMonth_(firestoreRows, monthName) : {};
  var mergedMap = selectTuitionFollowupRowsByMonth_(mergedRows, monthName);
  var missingInFirestore = 0;
  var missingInSheet = 0;
  var amountMismatchCount = 0;

  Object.keys(sheetMap).forEach(function(name) {
    if (!firestoreMap[name]) {
      missingInFirestore += 1;
      return;
    }
    var sheetAmount = Math.max(0, Math.round(toPayrollNumber_(sheetMap[name].guideAmount)));
    var firestoreAmount = Math.max(0, Math.round(toPayrollNumber_(firestoreMap[name].guideAmount)));
    if (sheetAmount !== firestoreAmount) amountMismatchCount += 1;
  });
  Object.keys(firestoreMap).forEach(function(name) {
    if (!sheetMap[name]) missingInSheet += 1;
  });

  return {
    monthName: monthName,
    source: skippedSheetRows ? "firestore-fast" : (firestoreAvailable ? "sheet+firestore" : "sheet"),
    skippedSheetRows: !!skippedSheetRows,
    sheet: summarizeTuitionGuideAmountMap_(sheetMap),
    firestore: Object.assign({ available: firestoreAvailable }, summarizeTuitionGuideAmountMap_(firestoreMap)),
    merged: summarizeTuitionGuideAmountMap_(mergedMap),
    missingInFirestore: missingInFirestore,
    missingInSheet: missingInSheet,
    amountMismatchCount: amountMismatchCount,
    checkedAt: new Date().toISOString()
  };
}

function getTuitionFollowupRowSortKey_(row, index, monthName) {
  if (!row) return -1;
  var updatedKey = parseTuitionDateTimeMs_(row[index.lastUpdatedAt], monthName);
  var contactKey = parseTuitionDateTimeMs_(row[index.lastContactAt], monthName);
  return Math.max(updatedKey, contactKey);
}

function isTuitionFollowupRowPreferred_(candidateRow, index, monthName, candidateRowNo, currentRow, currentRowNo) {
  if (!currentRow) return true;
  var candidateKey = getTuitionFollowupRowSortKey_(candidateRow, index, monthName);
  var currentKey = getTuitionFollowupRowSortKey_(currentRow, index, monthName);
  if (candidateKey !== currentKey) return candidateKey > currentKey;
  return candidateRowNo > currentRowNo;
}

function parsePayrollMonthName_(name) {
  var text = String(name || "").trim();
  var m = text.match(/^(\d{2}|\d{4})-(\d{2})$/);
  if (!m) return null;
  var yearNum = parseInt(m[1], 10);
  var monthNum = parseInt(m[2], 10);
  if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) return null;
  if (m[1].length === 2) yearNum += 2000;
  return {
    sheetName: text,
    year: yearNum,
    month: monthNum,
    daysInMonth: new Date(yearNum, monthNum, 0).getDate()
  };
}

function parsePayrollRows_(sheet, monthMeta) {
  return parsePayrollRowsFromSource_(readPayrollMonthSource_(sheet), monthMeta);
}

function parsePayrollRowsFromSource_(source, monthMeta) {
  var values = (source && source.values) || [];
  if (!values.length) return [];
  var headers = (source && source.headers) || [];
  var indexMap = getPayrollColumnIndexMap_(headers);
  var rows = [];

  for (var r = 0; r < values.length; r++) {
    var row = values[r] || [];
    var teacherName = String(row[indexMap.tr] || "").trim();
    var studentName = normalizePayrollStudentName_(row[indexMap.name]);
    var className = String(row[indexMap.className] || "").trim();
    if (!teacherName && !studentName && !className) continue;

    var dateInfo = parsePayrollDateCell_(row[indexMap.classDate], monthMeta);
    var startText = String(row[indexMap.start] || "").trim();
    var endText = String(row[indexMap.end] || "").trim();
    var startMinutes = parsePayrollTimeMinutes_(startText);
    var endMinutes = parsePayrollTimeMinutes_(endText);
    var hours = toPayrollNumber_(row[indexMap.hours]);
    if (hours <= 0) {
      hours = computePayrollHourDiff_(startText, endText);
    }
    var classType = detectPayrollClassType_(className);
    var schoolType = detectPayrollSchoolType_(className);
    var gradeBand = detectPayrollGradeBand_(className);
    var subject = detectPayrollSubject_(className);
    var rateSignature = [subject, schoolType, gradeBand, classType].join("|");
    var rowNumber = r + 2;
    var rowKey = buildPayrollRowKey_(monthMeta.sheetName, rowNumber, [
      studentName,
      dateInfo.dateKey,
      className,
      String(row[indexMap.attendance] || "").trim(),
      teacherName,
      startText,
      endText,
      hours,
      toPayrollNumber_(row[indexMap.hourlyRate]),
      toPayrollNumber_(row[indexMap.amount]),
      toPayrollNumber_(row[indexMap.discount])
    ]);

    rows.push({
      rowNumber: rowNumber,
      rowKey: rowKey,
      name: studentName,
      classDateRaw: String(row[indexMap.classDate] || "").trim(),
      classDateKey: dateInfo.dateKey,
      classDateLabel: dateInfo.label,
      day: dateInfo.day,
      className: className,
      attendance: String(row[indexMap.attendance] || "").trim(),
      attendanceCode: normalizePayrollAttendanceCode_(row[indexMap.attendance]),
      room: String(row[indexMap.room] || "").trim(),
      teacher: teacherName,
      start: startText,
      end: endText,
      startMinutes: startMinutes,
      endMinutes: endMinutes,
      hours: hours,
      rate: toPayrollNumber_(row[indexMap.hourlyRate]),
      amount: toPayrollNumber_(row[indexMap.amount]),
      note: String(row[indexMap.note] || "").trim(),
      discount: toPayrollNumber_(row[indexMap.discount]),
      classType: classType,
      schoolType: schoolType,
      gradeBand: gradeBand,
      subject: subject,
      rateSignature: rateSignature
    });
  }

  rows.sort(function(a, b) {
    if (a.classDateKey !== b.classDateKey) return a.classDateKey < b.classDateKey ? -1 : 1;
    if (a.start !== b.start) return a.start < b.start ? -1 : 1;
    return a.rowNumber - b.rowNumber;
  });
  return rows;
}

function normalizePayrollStudentName_(value) {
  var text = String(value || "").trim();
  return text.replace(/^\/+/, "").trim();
}

function getPayrollColumnIndexMap_(headers) {
  return {
    name: findPayrollHeaderIndex_(headers, ["이름"], 0),
    classDate: findPayrollHeaderIndex_(headers, ["수업일"], 1),
    className: findPayrollHeaderIndex_(headers, ["반명"], 2),
    attendance: findPayrollHeaderIndex_(headers, ["출결"], 3),
    room: findPayrollHeaderIndex_(headers, ["관"], 4),
    tr: findPayrollHeaderIndex_(headers, ["tr"], 5),
    start: findPayrollHeaderIndex_(headers, ["시작"], 6),
    end: findPayrollHeaderIndex_(headers, ["종료"], 7),
    hours: findPayrollHeaderIndex_(headers, ["시간"], 8),
    hourlyRate: findPayrollHeaderIndex_(headers, ["시간당"], 9),
    amount: findPayrollHeaderIndex_(headers, ["금액"], 10),
    note: findPayrollHeaderIndex_(headers, ["참고"], 11),
    discount: findPayrollHeaderIndex_(headers, ["할인"], 12)
  };
}

function getPayrollMaxColumnIndex_(indexMap) {
  var maxIndex = 0;
  Object.keys(indexMap || {}).forEach(function(key) {
    var index = parseInt(indexMap[key], 10);
    if (!isNaN(index) && index > maxIndex) maxIndex = index;
  });
  return maxIndex;
}

function buildPayrollRowKey_(monthName, rowNumber, parts) {
  var text = JSON.stringify(parts || []);
  return String(monthName || "") + ":" + String(rowNumber || "") + ":" + payrollSimpleHash_(text);
}

function payrollSimpleHash_(text) {
  var source = String(text || "");
  var hash = 2166136261;
  for (var i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}

function normalizePayrollHeader_(text) {
  return String(text || "").replace(/\s+/g, "").toLowerCase();
}

function findPayrollHeaderIndex_(headers, candidates, fallback) {
  for (var i = 0; i < candidates.length; i++) {
    var key = normalizePayrollHeader_(candidates[i]);
    var idx = headers.indexOf(key);
    if (idx !== -1) return idx;
  }
  return fallback;
}

function parsePayrollDateCell_(value, monthMeta) {
  var raw = String(value || "").trim();
  var month = monthMeta.month;
  var day = 1;
  var md = raw.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (md) {
    month = parseInt(md[1], 10);
    day = parseInt(md[2], 10);
  } else {
    var dOnly = raw.match(/(\d{1,2})/);
    if (dOnly) day = parseInt(dOnly[1], 10);
  }
  if (isNaN(month) || month < 1 || month > 12) month = monthMeta.month;
  if (isNaN(day) || day < 1 || day > 31) day = 1;

  var dateObj = new Date(monthMeta.year, month - 1, day);
  if (dateObj.getMonth() + 1 !== month) {
    dateObj = new Date(monthMeta.year, monthMeta.month - 1, Math.min(day, monthMeta.daysInMonth));
  }

  var tz = Session.getScriptTimeZone() || "Asia/Seoul";
  return {
    dateKey: Utilities.formatDate(dateObj, tz, "yyyy-MM-dd"),
    label: (dateObj.getMonth() + 1) + "/" + dateObj.getDate(),
    day: dateObj.getDate(),
    month: dateObj.getMonth() + 1
  };
}

function detectPayrollClassType_(className) {
  var text = String(className || "").trim();
  if (!text) return "미분류";

  var ratioMatch = text.match(/\d+\s*:\s*\d+/);
  if (ratioMatch) return ratioMatch[0].replace(/\s+/g, "");
  if (/개별정규/.test(text)) return "개별정규";
  if (/개별/.test(text)) return "개별";
  if (/정규/.test(text)) return "정규";
  if (/특강/.test(text)) return "특강";
  if (/보강|보충/.test(text)) return "보강";
  return text.split("-")[0].trim();
}

function detectPayrollSubject_(className) {
  var text = String(className || "").replace(/\s+/g, "");
  if (/수학|math|미적|기하|확통|대수/i.test(text)) return "수학";
  if (/영어|eng|토플|텝스|toeic/i.test(text)) return "영어";
  if (/국어|kor|문학|독해|화작|언매/i.test(text)) return "국어";
  if (/과학|sci|물리|화학|생명|지구과학/i.test(text)) return "과학";
  if (/사회|사탐|역사|정치|경제|지리/i.test(text)) return "사회";
  if (/논술|에세이/i.test(text)) return "논술";
  return "기타";
}

function detectPayrollSchoolType_(className) {
  var text = String(className || "").replace(/\s+/g, "");
  if (/초등|초/i.test(text)) return "초등";
  if (/중등|중/i.test(text)) return "중등";
  if (/고등|고|n수|재수|반수/i.test(text)) return "고등/N수";
  return "미분류";
}

function detectPayrollGradeBand_(className) {
  var text = String(className || "");
  if (/재수|반수|n수|N수|N\d/.test(text)) return "N수";
  var g = text.match(/([1-6])\s*학년/);
  if (g) {
    var grade = parseInt(g[1], 10);
    if (grade <= 2) return "초등";
    if (grade <= 3) return "중등";
    return "고등";
  }
  var short = text.match(/-(\d)\s*h/i);
  if (short) {
    var n = parseInt(short[1], 10);
    if (n <= 2) return "중등";
    return "고등";
  }
  return "미분류";
}

function normalizePayrollAttendanceCode_(attendance) {
  var status = String(attendance || "").replace(/\s+/g, "");
  if (!status) return "기타";
  if (/출석/.test(status)) return "출석";
  if (/지각/.test(status)) return "지각";
  if (/당일취소|당취/.test(status)) return "당일취소";
  if (/결석예고/.test(status)) return "결석예고";
  if (/결석보강/.test(status)) return "결석보강";
  if (/보강|보충/.test(status)) return "보강";
  if (/프리/.test(status)) return "프리";
  if (/결석/.test(status)) return "결석";
  return status;
}

function normalizePayrollSalaryMode_(value) {
  return String(value || "").toLowerCase() === "hourly" ? "hourly" : "ratio";
}

function isPayrollOneToOneClassType_(classType) {
  var text = String(classType || "").replace(/\s+/g, "");
  return text === "1:1";
}

function resolvePayrollOneToOneRule_(teacherSettings, teacherName, defaultRatioPercent) {
  var settings = teacherSettings && typeof teacherSettings === "object" ? teacherSettings : {};
  var cfg = settings[String(teacherName || "").trim()] || {};
  var mode = String(cfg.oneToOneSettlementMode || "").toLowerCase() === "ratio" ? "ratio" : "hourly";
  var ratioPercent = clampPayrollNumber_(toPayrollNumber_(cfg.oneToOneRatioPercent), 0, 100, defaultRatioPercent || 50);
  return {
    useRatio: mode === "ratio",
    ratioPercent: ratioPercent
  };
}

function normalizePayrollDiscountPercent_(value) {
  var raw = toPayrollNumber_(value);
  if (raw <= 0) return 0;
  if (raw <= 1) raw = raw * 100;
  return clampPayrollNumber_(raw, 0, 100, 0);
}

function computePayrollDiscountAmount_(amount, discountPercent) {
  var percent = normalizePayrollDiscountPercent_(discountPercent);
  if (percent <= 0) return 0;
  return Math.round(Math.max(0, toPayrollNumber_(amount)) * (percent / 100));
}

function buildPayrollSummary_(rows, monthMeta, options) {
  var subjectFilter = String(options.subjectFilter || "").trim();
  var teacherName = options.teacherName;
  var classTypeFilter = String(options.classTypeFilter || "").trim();
  var filteredRows = rows.filter(function(row) {
    if (subjectFilter && row.subject !== subjectFilter) return false;
    if (classTypeFilter && row.classType !== classTypeFilter) return false;
    return !teacherName || row.teacher === teacherName;
  });
  var dayMap = {};
  var detailRows = [];
  var typeTotals = {};
  var typeFinanceMap = {};
  var attendanceTotals = {};
  var workingDayMap = {};
  var recognizedIntervalsByDay = {};
  var studentBaselineMap = buildPayrollStudentRateBaseline_(rows);
  var teacherSettings = options.teacherSettings || {};

  var totalRecognizedHours = 0;
  var totalRecognizedGross = 0;
  var totalRecognizedDiscount = 0;
  var totalRecognizedNet = 0;
  var totalCanceledAmount = 0;
  var recognizedLessonCount = 0;
  var totalRatioPay = 0;
  var totalOneToOneRatioSettlement = 0;
  var rateSuspicionMap = options.rateSuspicionMap || detectPayrollRateSuspicionMap_(rows, teacherSettings[PAYROLL_SUSPICION_SETTINGS_KEY]);

  for (var i = 0; i < filteredRows.length; i++) {
    var row = filteredRows[i];
    var isFreeIncluded = !!options.freeIncludedRowKeySet[row.rowKey];
    var baseAttendanceInfo = evaluatePayrollAttendance_(row.attendance, isFreeIncluded);
    var overrideValue = options.recognitionOverrideMap[row.rowKey];
    var attendanceInfo = applyPayrollRecognitionOverride_(baseAttendanceInfo, overrideValue);
    var suggestedRate = resolvePayrollSuggestedRate_(row, studentBaselineMap);
    var isMakeupZeroEligible = isPayrollMakeupZeroAmountEligible_(row);
    var manualRate = options.rateAdjustmentMap[row.rowKey];
    var effectiveRate = row.rate;
    var effectiveAmount = row.amount;
    var rateAdjusted = false;

    if (attendanceInfo.recognized && isMakeupZeroEligible) {
      var chosenRate = (manualRate > 0) ? manualRate : (suggestedRate > 0 ? suggestedRate : row.rate);
      if (chosenRate > 0) {
        effectiveRate = chosenRate;
        effectiveAmount = Math.round(chosenRate * row.hours);
        rateAdjusted = Math.round(effectiveAmount) !== Math.round(row.amount);
      }
    } else if (manualRate > 0) {
      effectiveRate = manualRate;
      effectiveAmount = Math.round(manualRate * row.hours);
      rateAdjusted = true;
    }

    var discountPercent = normalizePayrollDiscountPercent_(row.discount);
    var discountAmount = computePayrollDiscountAmount_(effectiveAmount, discountPercent);
    var netAmount = effectiveAmount - discountAmount;
    var recognizedHours = attendanceInfo.recognized ? row.hours : 0;
    var recognizedGross = attendanceInfo.recognized ? effectiveAmount : 0;
    var recognizedDiscount = attendanceInfo.recognized ? discountAmount : 0;
    var recognizedNet = attendanceInfo.recognized ? netAmount : 0;
    var hasSettlementPercentOverride = Object.prototype.hasOwnProperty.call(options.settlementPercentOverrideMap || {}, row.rowKey);
    var settlementPercentApplied = options.salaryMode === "ratio" ? options.ratioPercent : 0;

    if (!dayMap[row.classDateKey]) {
      dayMap[row.classDateKey] = {
        dateKey: row.classDateKey,
        label: row.classDateLabel,
        day: row.day,
        lessonCount: 0,
        recognizedHours: 0,
        pureTeachingHours: 0,
        grossSales: 0,
        discount: 0,
        netSales: 0,
        settlementAmount: 0,
        ratioSettlement: 0,
        oneToOneRatioSettlement: 0,
        canceledAmount: 0,
        classTypeMap: {},
        classTypeHourMap: {}
      };
    }
    attendanceTotals[row.attendanceCode] = (attendanceTotals[row.attendanceCode] || 0) + 1;
    if (row.attendanceCode === "당일취소") {
      dayMap[row.classDateKey].canceledAmount += Math.round(row.amount);
      totalCanceledAmount += Math.round(row.amount);
      if (!typeFinanceMap[row.classType]) {
        typeFinanceMap[row.classType] = { type: row.classType, count: 0, hours: 0, hourlyHoursEligible: 0, gross: 0, net: 0, settlement: 0, ratioSettlement: 0, oneToOneRatioSettlement: 0, canceled: 0, canceledCount: 0 };
      }
      typeFinanceMap[row.classType].canceled += Math.round(row.amount);
      typeFinanceMap[row.classType].canceledCount += 1;
    }

    if (attendanceInfo.recognized) {
      dayMap[row.classDateKey].lessonCount += 1;
      dayMap[row.classDateKey].recognizedHours += recognizedHours;
      dayMap[row.classDateKey].grossSales += recognizedGross;
      dayMap[row.classDateKey].discount += recognizedDiscount;
      dayMap[row.classDateKey].netSales += recognizedNet;
      dayMap[row.classDateKey].classTypeHourMap[row.classType] = (dayMap[row.classDateKey].classTypeHourMap[row.classType] || 0) + recognizedHours;
      dayMap[row.classDateKey].classTypeMap[row.classType] = (dayMap[row.classDateKey].classTypeMap[row.classType] || 0) + 1;
      workingDayMap[row.classDateKey] = true;
      typeTotals[row.classType] = (typeTotals[row.classType] || 0) + 1;
      if (!typeFinanceMap[row.classType]) {
        typeFinanceMap[row.classType] = { type: row.classType, count: 0, hours: 0, hourlyHoursEligible: 0, gross: 0, net: 0, settlement: 0, ratioSettlement: 0, oneToOneRatioSettlement: 0, canceled: 0, canceledCount: 0 };
      }
      typeFinanceMap[row.classType].count += 1;
      typeFinanceMap[row.classType].hours += recognizedHours;
      typeFinanceMap[row.classType].gross += recognizedGross;
      typeFinanceMap[row.classType].net += recognizedNet;
      recognizedLessonCount += 1;
      totalRecognizedHours += recognizedHours;
      totalRecognizedGross += recognizedGross;
      totalRecognizedDiscount += recognizedDiscount;
      totalRecognizedNet += recognizedNet;
      var oneToOneRule = resolvePayrollOneToOneRule_(teacherSettings, row.teacher, options.ratioPercent);
      var useOneToOneRatio = options.salaryMode === "hourly" && oneToOneRule.useRatio && isPayrollOneToOneClassType_(row.classType);
      var baseSettlementPercent = options.salaryMode === "ratio"
        ? options.ratioPercent
        : (useOneToOneRatio ? oneToOneRule.ratioPercent : 0);
      settlementPercentApplied = hasSettlementPercentOverride
        ? clampPayrollNumber_(toPayrollNumber_(options.settlementPercentOverrideMap[row.rowKey]), 0, 200, baseSettlementPercent)
        : baseSettlementPercent;
      var rowSettlement = 0;
      if (options.salaryMode === "hourly") {
        if (hasSettlementPercentOverride || useOneToOneRatio) {
          rowSettlement = recognizedNet * (settlementPercentApplied / 100);
          dayMap[row.classDateKey].oneToOneRatioSettlement += rowSettlement;
          typeFinanceMap[row.classType].oneToOneRatioSettlement += rowSettlement;
          totalOneToOneRatioSettlement += rowSettlement;
        } else {
          rowSettlement = 0; // 시급제는 일자 순수시수 기준으로 계산(아래 day settlement에서 처리)
          typeFinanceMap[row.classType].hourlyHoursEligible += recognizedHours;
        }
      } else {
        rowSettlement = recognizedNet * (settlementPercentApplied / 100);
        dayMap[row.classDateKey].ratioSettlement += rowSettlement;
        typeFinanceMap[row.classType].ratioSettlement += rowSettlement;
        totalRatioPay += rowSettlement;
      }
      typeFinanceMap[row.classType].settlement += rowSettlement;
      if (!useOneToOneRatio && !hasSettlementPercentOverride && row.startMinutes !== null && row.endMinutes !== null && row.endMinutes > row.startMinutes) {
        if (!recognizedIntervalsByDay[row.classDateKey]) recognizedIntervalsByDay[row.classDateKey] = [];
        recognizedIntervalsByDay[row.classDateKey].push([row.startMinutes, row.endMinutes]);
      }
    }

    detailRows.push({
      rowKey: row.rowKey,
      rowNumber: row.rowNumber,
      name: row.name,
      classDateLabel: row.classDateLabel,
      classDateKey: row.classDateKey,
      className: row.className,
      classType: row.classType,
      subject: row.subject,
      schoolType: row.schoolType,
      gradeBand: row.gradeBand,
      attendance: row.attendance,
      attendanceCode: row.attendanceCode,
      room: row.room,
      teacher: row.teacher,
      start: row.start,
      end: row.end,
      hours: row.hours,
      rate: effectiveRate,
      baseRate: row.rate,
      amount: Math.round(effectiveAmount),
      originalAmount: row.amount,
      discount: Math.round(discountAmount),
      discountPercent: discountPercent,
      discountRaw: row.discount,
      netAmount: netAmount,
      note: row.note,
      isFreeEligible: attendanceInfo.freeEligible,
      freeIncluded: attendanceInfo.freeEligible && isFreeIncluded,
      baseRecognized: baseAttendanceInfo.recognized,
      recognized: attendanceInfo.recognized,
      isManuallyOverridden: typeof overrideValue === "boolean",
      recognitionLabel: attendanceInfo.label,
      recognizedHours: recognizedHours,
      recognizedNet: recognizedNet,
      oneToOneRatioRuleApplied: options.salaryMode === "hourly" && isPayrollOneToOneClassType_(row.classType)
        ? resolvePayrollOneToOneRule_(teacherSettings, row.teacher, options.ratioPercent).useRatio
        : false,
      settlementPercentApplied: roundPayrollNumber_(settlementPercentApplied, 2),
      settlementPercentOverridden: hasSettlementPercentOverride,
      suspectedRateMismatch: !!rateSuspicionMap[row.rowKey],
      suspectedRateReason: rateSuspicionMap[row.rowKey] || "",
      autoRepriceEligible: isMakeupZeroEligible,
      autoRepriced: isMakeupZeroEligible && rateAdjusted,
      suggestedRate: suggestedRate > 0 ? suggestedRate : 0,
      rateManuallyAdjusted: manualRate > 0
    });
  }

  var pureTeachingHours = 0;
  Object.keys(recognizedIntervalsByDay).forEach(function(dateKey) {
    var mergedHours = mergePayrollIntervalsToHours_(recognizedIntervalsByDay[dateKey]);
    dayMap[dateKey].pureTeachingHours = mergedHours;
    pureTeachingHours += mergedHours;
  });

  var ratioPay = totalRatioPay;
  var hourlyPay = (pureTeachingHours * options.hourlyRate) + totalOneToOneRatioSettlement;
  var estimatedPay = options.salaryMode === "hourly" ? hourlyPay : ratioPay;

  Object.keys(dayMap).forEach(function(dateKey) {
    var day = dayMap[dateKey];
    var daySettlement = options.salaryMode === "hourly"
      ? ((day.pureTeachingHours * options.hourlyRate) + (day.oneToOneRatioSettlement || 0))
      : (day.ratioSettlement || 0);
    day.settlementAmount = Math.round(daySettlement);
    day.ratioSettlement = Math.round(day.ratioSettlement || 0);
    day.oneToOneRatioSettlement = Math.round(day.oneToOneRatioSettlement || 0);
  });

  Object.keys(typeFinanceMap).forEach(function(typeName) {
    var bucket = typeFinanceMap[typeName];
    bucket.hours = roundPayrollNumber_(bucket.hours, 2);
    bucket.hourlyHoursEligible = roundPayrollNumber_(bucket.hourlyHoursEligible || 0, 2);
    bucket.gross = Math.round(bucket.gross);
    bucket.net = Math.round(bucket.net);
    bucket.canceled = Math.round(bucket.canceled || 0);
    bucket.canceledCount = Math.round(bucket.canceledCount || 0);
    bucket.ratioSettlement = Math.round(bucket.ratioSettlement || 0);
    bucket.oneToOneRatioSettlement = Math.round(bucket.oneToOneRatioSettlement || 0);
    if (options.salaryMode === "hourly") {
      bucket.settlement = Math.round((bucket.hourlyHoursEligible * options.hourlyRate) + bucket.oneToOneRatioSettlement);
    } else {
      bucket.settlement = Math.round(bucket.ratioSettlement || 0);
    }
  });

  return {
    kpi: {
      totalLessons: filteredRows.length,
      recognizedLessons: recognizedLessonCount,
      recognizedHours: roundPayrollNumber_(totalRecognizedHours, 2),
      pureTeachingHours: roundPayrollNumber_(pureTeachingHours, 2),
      grossSales: Math.round(totalRecognizedGross),
      discount: Math.round(totalRecognizedDiscount),
      netSales: Math.round(totalRecognizedNet),
      canceledAmount: Math.round(totalCanceledAmount),
      oneToOneRatioSettlement: Math.round(totalOneToOneRatioSettlement),
      workingDays: Object.keys(workingDayMap).length,
      estimatedPay: Math.round(estimatedPay),
      ratioPay: Math.round(ratioPay),
      hourlyPay: Math.round(hourlyPay)
    },
    classTypeSummary: Object.keys(typeTotals).map(function(typeName) {
      return { type: typeName, count: typeTotals[typeName] };
    }).sort(function(a, b) { return b.count - a.count; }),
    classTypeFinanceSummary: Object.keys(typeFinanceMap).map(function(typeName) {
      return typeFinanceMap[typeName];
    }).sort(function(a, b) { return b.net - a.net; }),
    attendanceSummary: Object.keys(attendanceTotals).map(function(code) {
      return { code: code, count: attendanceTotals[code] };
    }).sort(function(a, b) { return b.count - a.count; }),
    calendar: buildPayrollCalendarData_(monthMeta, dayMap),
    chart: buildPayrollChartData_(monthMeta, dayMap),
    rows: detailRows
  };
}

function buildPayrollTeacherOptions_(rows) {
  var teacherMap = {};
  var teacherSubjectCounter = {};
  rows.forEach(function(row) {
    var name = String(row.teacher || "").trim();
    if (!name) return;
    teacherMap[name] = true;
    if (!teacherSubjectCounter[name]) teacherSubjectCounter[name] = {};
    teacherSubjectCounter[name][row.subject] = (teacherSubjectCounter[name][row.subject] || 0) + 1;
  });
  var teachers = Object.keys(teacherMap);
  teachers.sort(function(a, b) { return a.localeCompare(b, "ko"); });

  var groupMap = {};
  teachers.forEach(function(name) {
    var subject = resolvePayrollTeacherMainSubject_(teacherSubjectCounter[name] || {});
    if (!groupMap[subject]) groupMap[subject] = [];
    groupMap[subject].push(name);
  });

  var subjectOrder = ["수학", "영어", "국어", "과학", "사회", "논술", "기타"];
  var subjects = Object.keys(groupMap).sort(function(a, b) {
    var ai = subjectOrder.indexOf(a);
    var bi = subjectOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b, "ko");
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  var groups = subjects.map(function(subject) {
    groupMap[subject].sort(function(a, b) { return a.localeCompare(b, "ko"); });
    return { subject: subject, teachers: groupMap[subject] };
  });
  subjects.unshift("");
  return { subjects: subjects, teachers: teachers, groups: groups };
}

function buildPayrollCalendarData_(monthMeta, dayMap) {
  var firstWeekday = new Date(monthMeta.year, monthMeta.month - 1, 1).getDay();
  var weeks = [];
  var currentWeek = [];
  var tz = Session.getScriptTimeZone() || "Asia/Seoul";

  for (var i = 0; i < firstWeekday; i++) currentWeek.push(null);

  for (var day = 1; day <= monthMeta.daysInMonth; day++) {
    var dateObj = new Date(monthMeta.year, monthMeta.month - 1, day);
    var dateKey = Utilities.formatDate(dateObj, tz, "yyyy-MM-dd");
    var raw = dayMap[dateKey];
    var classTypes = [];
    if (raw && raw.classTypeMap) {
      classTypes = Object.keys(raw.classTypeMap).sort(function(a, b) {
        return raw.classTypeMap[b] - raw.classTypeMap[a];
      });
    }
    var classTypeHours = [];
    if (raw && raw.classTypeHourMap) {
      classTypeHours = Object.keys(raw.classTypeHourMap).map(function(typeName) {
        return { type: typeName, hours: roundPayrollNumber_(raw.classTypeHourMap[typeName], 2) };
      }).sort(function(a, b) { return b.hours - a.hours; });
    }
    currentWeek.push({
      day: day,
      dateKey: dateKey,
      recognizedHours: roundPayrollNumber_(raw ? raw.recognizedHours : 0, 2),
      pureTeachingHours: roundPayrollNumber_(raw ? raw.pureTeachingHours : 0, 2),
      netSales: Math.round(raw ? raw.netSales : 0),
      settlementAmount: Math.round(raw ? raw.settlementAmount : 0),
      canceledAmount: Math.round(raw ? raw.canceledAmount : 0),
      lessonCount: raw ? raw.lessonCount : 0,
      classTypes: classTypes,
      classTypeHours: classTypeHours
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return {
    year: monthMeta.year,
    month: monthMeta.month,
    weeks: weeks
  };
}

function buildPayrollChartData_(monthMeta, dayMap) {
  var labels = [];
  var grossSales = [];
  var netSales = [];
  var recognizedHours = [];
  var pureTeachingHours = [];
  var tz = Session.getScriptTimeZone() || "Asia/Seoul";

  for (var day = 1; day <= monthMeta.daysInMonth; day++) {
    var dateObj = new Date(monthMeta.year, monthMeta.month - 1, day);
    var dateKey = Utilities.formatDate(dateObj, tz, "yyyy-MM-dd");
    var row = dayMap[dateKey];
    labels.push(String(day));
    grossSales.push(Math.round(row ? row.grossSales : 0));
    netSales.push(Math.round(row ? row.netSales : 0));
    recognizedHours.push(roundPayrollNumber_(row ? row.recognizedHours : 0, 2));
    pureTeachingHours.push(roundPayrollNumber_(row ? row.pureTeachingHours : 0, 2));
  }

  return {
    labels: labels,
    grossSales: grossSales,
    netSales: netSales,
    recognizedHours: recognizedHours,
    pureTeachingHours: pureTeachingHours
  };
}

function evaluatePayrollAttendance_(attendance, freeIncluded) {
  var status = String(attendance || "").replace(/\s+/g, "");
  if (!status) return { recognized: false, freeEligible: false, label: "미인정" };
  if (/당일취소|당취/.test(status)) return { recognized: false, freeEligible: false, label: "당일취소 미인정" };
  if (/프리/.test(status)) {
    return {
      recognized: !!freeIncluded,
      freeEligible: true,
      label: freeIncluded ? "프리 수동인정" : "프리 미인정"
    };
  }
  if (/결석보강/.test(status)) return { recognized: true, freeEligible: false, label: "결석보강 인정" };
  if (/보강|보충/.test(status)) return { recognized: true, freeEligible: false, label: "보강 인정" };
  if (/지각/.test(status)) return { recognized: true, freeEligible: false, label: "지각 인정" };
  if (/출석/.test(status)) return { recognized: true, freeEligible: false, label: "출석 인정" };
  return { recognized: false, freeEligible: false, label: "미인정" };
}

function applyPayrollRecognitionOverride_(baseInfo, overrideValue) {
  if (typeof overrideValue !== "boolean") return baseInfo;
  return {
    recognized: overrideValue,
    freeEligible: baseInfo.freeEligible,
    label: overrideValue ? "수동 인정" : "수동 제외"
  };
}

function resolvePayrollTeacherMainSubject_(counterMap) {
  var subject = "기타";
  var max = -1;
  Object.keys(counterMap || {}).forEach(function(key) {
    var count = counterMap[key] || 0;
    if (count > max) {
      max = count;
      subject = key;
    }
  });
  return subject;
}

function toPayrollRecognitionOverrideMap_(list) {
  var map = {};
  var arr = Array.isArray(list) ? list : [];
  for (var i = 0; i < arr.length; i++) {
    var item = arr[i] || {};
    var key = String(item.rowKey || "").trim();
    if (!key) continue;
    if (typeof item.recognized !== "boolean") continue;
    map[key] = item.recognized;
  }
  return map;
}

function toPayrollRateAdjustmentMap_(list) {
  var map = {};
  var arr = Array.isArray(list) ? list : [];
  for (var i = 0; i < arr.length; i++) {
    var item = arr[i] || {};
    var key = String(item.rowKey || "").trim();
    var rate = toPayrollNumber_(item.rate);
    if (!key || rate <= 0) continue;
    map[key] = rate;
  }
  return map;
}

function toPayrollSettlementPercentOverrideMap_(list) {
  var map = {};
  var arr = Array.isArray(list) ? list : [];
  for (var i = 0; i < arr.length; i++) {
    var item = arr[i] || {};
    var key = String(item.rowKey || "").trim();
    if (!key) continue;
    var percent = clampPayrollNumber_(toPayrollNumber_(item.percent), 0, 200, 0);
    map[key] = percent;
  }
  return map;
}

function isPayrollMakeupZeroAmountEligible_(row) {
  if (!row) return false;
  if (row.attendanceCode !== "보강") return false;
  if (toPayrollNumber_(row.amount) !== 0) return false;
  var text = (String(row.note || "") + " " + String(row.className || "")).replace(/\s+/g, "");
  return /당일취소|당취/.test(text);
}

function buildPayrollStudentRateBaseline_(rows) {
  var bucket = {};
  rows.forEach(function(row) {
    if (!row || !row.name || row.rate <= 0 || row.amount <= 0) return;
    var keys = [
      [row.name, row.subject, row.classType].join("|"),
      [row.name, "", row.classType].join("|"),
      [row.name, row.subject, ""].join("|"),
      [row.name, "", ""].join("|")
    ];
    keys.forEach(function(k) {
      if (!bucket[k]) bucket[k] = [];
      bucket[k].push(row.rate);
    });
  });

  var baseline = {};
  Object.keys(bucket).forEach(function(k) {
    var rates = bucket[k];
    if (!rates || !rates.length) return;
    var freq = {};
    rates.forEach(function(rate) {
      var kk = String(Math.round(rate));
      freq[kk] = (freq[kk] || 0) + 1;
    });
    var bestRate = 0;
    var bestCount = -1;
    Object.keys(freq).forEach(function(kk) {
      if (freq[kk] > bestCount) {
        bestCount = freq[kk];
        bestRate = parseFloat(kk);
      }
    });
    if (bestRate > 0) baseline[k] = bestRate;
  });
  return baseline;
}

function resolvePayrollSuggestedRate_(row, baselineMap) {
  if (!row || !baselineMap || !row.name) return 0;
  var keys = [
    [row.name, row.subject, row.classType].join("|"),
    [row.name, "", row.classType].join("|"),
    [row.name, row.subject, ""].join("|"),
    [row.name, "", ""].join("|")
  ];
  for (var i = 0; i < keys.length; i++) {
    var val = toPayrollNumber_(baselineMap[keys[i]]);
    if (val > 0) return val;
  }
  return 0;
}

function mergePayrollIntervalsToHours_(intervals) {
  if (!intervals || !intervals.length) return 0;
  var sorted = intervals.slice().sort(function(a, b) {
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });
  var total = 0;
  var currentStart = sorted[0][0];
  var currentEnd = sorted[0][1];

  for (var i = 1; i < sorted.length; i++) {
    var next = sorted[i];
    if (next[0] <= currentEnd) {
      if (next[1] > currentEnd) currentEnd = next[1];
      continue;
    }
    total += (currentEnd - currentStart);
    currentStart = next[0];
    currentEnd = next[1];
  }
  total += (currentEnd - currentStart);
  return roundPayrollNumber_(total / 60, 2);
}

function detectPayrollRateSuspicionMap_(rows, suspicionSettings) {
  var settings = normalizePayrollSuspicionSettings_(suspicionSettings || {});
  if (settings.enabled === false) return {};
  var signatureMap = {};
  var studentMap = {};
  var studentSummaryMap = {};
  var configuredRuleMap = buildPayrollConfiguredRateRuleMap_(settings);
  rows.forEach(function(row) {
    if (row.rate > 0 && !isPayrollAllowedAlternativeRate_(row, settings)) {
      var key = row.teacher + "|" + row.rateSignature;
      if (!signatureMap[key]) signatureMap[key] = [];
      signatureMap[key].push(row.rate);
      var studentKey = [row.teacher, row.name, row.classType, row.subject].join("|");
      if (!studentMap[studentKey]) studentMap[studentKey] = [];
      studentMap[studentKey].push(row.rate);
    }
    if (!row.name) return;
    if (!studentSummaryMap[row.name]) {
      studentSummaryMap[row.name] = { total: 0, combo: {}, teacher: {} };
    }
    var summary = studentSummaryMap[row.name];
    summary.total += 1;
    var comboKey = [row.subject || "-", normalizePayrollSuspicionClassType_(row.classType || "-") || row.classType || "-"].join("|");
    summary.combo[comboKey] = (summary.combo[comboKey] || 0) + 1;
    if (row.teacher) summary.teacher[row.teacher] = (summary.teacher[row.teacher] || 0) + 1;
  });

  var baselineMap = {};
  Object.keys(signatureMap).forEach(function(key) {
    var rates = signatureMap[key];
    if (!rates || rates.length < 5) return;
    var freq = {};
    rates.forEach(function(rate) {
      var k = String(Math.round(rate));
      freq[k] = (freq[k] || 0) + 1;
    });
    var topKey = "";
    var topCount = 0;
    Object.keys(freq).forEach(function(k) {
      if (freq[k] > topCount) {
        topCount = freq[k];
        topKey = k;
      }
    });
    if (topCount < 3) return;
    baselineMap[key] = { rate: parseFloat(topKey), count: topCount, total: rates.length };
  });

  var studentBaselineMap = {};
  Object.keys(studentMap).forEach(function(key) {
    var rates = studentMap[key] || [];
    if (rates.length < 2) return;
    var freq = {};
    rates.forEach(function(rate) {
      var k = String(Math.round(rate));
      freq[k] = (freq[k] || 0) + 1;
    });
    var topKey = "";
    var topCount = 0;
    Object.keys(freq).forEach(function(k) {
      if (freq[k] > topCount) {
        topCount = freq[k];
        topKey = k;
      }
    });
    if (topCount < 2) return;
    studentBaselineMap[key] = parseFloat(topKey);
  });

  var suspicionMap = {};
  rows.forEach(function(row) {
    var reasons = [];
    appendPayrollConfiguredRateSuspicion_(reasons, row, configuredRuleMap, settings);
    appendPayrollTimeSuspicion_(reasons, row, settings);
    appendPayrollClassTeacherSuspicion_(reasons, row);
    appendPayrollStudentPatternSuspicion_(reasons, row, studentSummaryMap);
    appendPayrollAmountSuspicion_(reasons, row);

    if (row.rate > 0) {
      var studentKey = [row.teacher, row.name, row.classType, row.subject].join("|");
      var studentBaseline = studentBaselineMap[studentKey];
      if (studentBaseline > 0) {
        var studentGap = Math.abs(row.rate - studentBaseline) / studentBaseline;
        var studentAbs = Math.abs(row.rate - studentBaseline);
        if (studentGap >= 0.07 && studentAbs >= 3000) {
          reasons.push("학생 기준 " + Math.round(studentBaseline).toLocaleString("ko-KR") + "원 대비 이탈");
        }
      } else {
        var baseline = baselineMap[row.teacher + "|" + row.rateSignature];
        if (baseline) {
          var gap = Math.abs(row.rate - baseline.rate) / baseline.rate;
          var absGap = Math.abs(row.rate - baseline.rate);
          if (gap >= 0.15 && absGap >= 7000) {
            reasons.push("통계 기준 " + Math.round(baseline.rate).toLocaleString("ko-KR") + "원 대비 이탈");
          }
        }
      }
    }

    if (reasons.length) suspicionMap[row.rowKey] = uniquePayrollReasons_(reasons).join("\n");
  });
  return suspicionMap;
}

function getPayrollRateSuspicionMapCached_(rows, monthName, sheetVersion, suspicionSettings, forceRefresh) {
  var settings = normalizePayrollSuspicionSettings_(suspicionSettings || {});
  if (settings.enabled === false) return {};
  var keyPayload = {
    cacheSchemaVersion: PAYROLL_CACHE_SCHEMA_VERSION,
    monthName: String(monthName || ""),
    sheetVersion: String(sheetVersion || ""),
    suspicionSettings: settings
  };
  var keyDigest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(keyPayload));
  var key = bytesToHex_(keyDigest);
  var cachePath = "payroll/months/" + monthName + "/suspicion_cache/" + key;
  if (!forceRefresh) {
    try {
      var cached = firebaseRequestWithServiceAccount_("get", cachePath);
      if (cached && cached.map && typeof cached.map === "object") return cached.map;
    } catch (cacheReadErr) {
      // Suspicion cache is an optimization only; fall through to recompute.
    }
  }
  var suspicionMap = detectPayrollRateSuspicionMap_(rows, settings);
  try {
    firebaseRequestWithServiceAccount_("put", cachePath, {
      storedAt: new Date().toISOString(),
      sheetVersion: sheetVersion,
      map: suspicionMap
    });
  } catch (cacheWriteErr) {
    // Non-fatal: summary still uses freshly computed suspicion reasons.
  }
  return suspicionMap;
}

function buildPayrollConfiguredRateRuleMap_(settings) {
  var map = {};
  (settings.rules || []).forEach(function(rule) {
    var rate = Math.max(0, toPayrollNumber_(rule.rate));
    if (rate <= 0) return;
    var classType = normalizePayrollSuspicionClassType_(rule.classType || "");
    var hours = normalizePayrollSuspicionRuleHours_(rule.hours);
    if (!classType || hours <= 0) return;
    map[classType + "|" + hours] = rate;
  });
  return map;
}

function appendPayrollConfiguredRateSuspicion_(reasons, row, ruleMap, settings) {
  if (!row) return;
  var classType = normalizePayrollSuspicionClassType_(row.classType || "");
  if (!classType) return;
  var hours = normalizePayrollSuspicionRuleHours_(row.hours);
  var expectedRate = toPayrollNumber_(ruleMap[classType + "|" + hours]);
  if (expectedRate <= 0) return;
  if (isPayrollAllowedAlternativeConfiguredAmount_(row, settings)) return;
  var candidates = getPayrollSuspicionAmountCandidates_(row);
  if (isPayrollAmountCandidateWithinTolerance_(candidates, expectedRate, settings)) return;
  var representativeAmount = candidates.length ? candidates[0] : 0;
  var gap = representativeAmount > 0 ? Math.abs(representativeAmount - expectedRate) / expectedRate : 1;
  var absGap = representativeAmount > 0 ? Math.abs(representativeAmount - expectedRate) : expectedRate;
  var tolerancePercent = Math.max(0, toPayrollNumber_(settings.rateTolerancePercent, 8)) / 100;
  var toleranceWon = Math.max(0, toPayrollNumber_(settings.rateToleranceWon, 3000));
  if (gap <= tolerancePercent || absGap <= toleranceWon) return;
  reasons.push("설정 기준 " + classType + " " + formatPayrollPlainHours_(hours) + "시간 " + Math.round(expectedRate).toLocaleString("ko-KR") + "원 대비 이탈");
}

function isPayrollAllowedAlternativeRate_(row, settings) {
  var classType = normalizePayrollSuspicionClassType_(row.classType || "");
  var hours = normalizePayrollSuspicionRuleHours_(row.hours);
  if (classType !== "개별") return false;
  var allowedRates = [];
  if ([2, 3, 4].indexOf(hours) !== -1) allowedRates.push(28125);
  if (isPayrollElementaryOrMiddle_(row)) allowedRates.push(25000);
  return isPayrollRateInAllowedList_(row.rate, allowedRates, settings);
}

function isPayrollAllowedAlternativeConfiguredAmount_(row, settings) {
  var classType = normalizePayrollSuspicionClassType_(row.classType || "");
  var hours = normalizePayrollSuspicionRuleHours_(row.hours);
  if (classType !== "개별" || hours <= 0) return false;
  var allowedAmounts = [];
  if ([2, 3, 4].indexOf(hours) !== -1) allowedAmounts.push(28125 * hours);
  if (isPayrollElementaryOrMiddle_(row)) allowedAmounts.push(25000 * hours);
  if (!allowedAmounts.length) return false;
  var candidates = getPayrollSuspicionAmountCandidates_(row);
  for (var i = 0; i < allowedAmounts.length; i++) {
    if (isPayrollAmountCandidateWithinTolerance_(candidates, allowedAmounts[i], settings)) return true;
  }
  return false;
}

function isPayrollElementaryOrMiddle_(row) {
  var schoolType = String((row && row.schoolType) || "").trim();
  if (schoolType === "초등" || schoolType === "중등") return true;
  return /초등|중등|초[1-6]|중[1-3]/.test(String((row && row.className) || ""));
}

function isPayrollRateInAllowedList_(rateValue, allowedRates, settings) {
  var rate = toPayrollNumber_(rateValue, 0);
  if (rate <= 0 || !allowedRates || !allowedRates.length) return false;
  var tolerancePercent = Math.max(0, toPayrollNumber_(settings.rateTolerancePercent, 8)) / 100;
  var toleranceWon = Math.max(0, toPayrollNumber_(settings.rateToleranceWon, 3000));
  for (var i = 0; i < allowedRates.length; i++) {
    var allowedRate = toPayrollNumber_(allowedRates[i], 0);
    if (allowedRate <= 0) continue;
    var gap = Math.abs(rate - allowedRate) / allowedRate;
    var absGap = Math.abs(rate - allowedRate);
    if (gap <= tolerancePercent || absGap <= toleranceWon) return true;
  }
  return false;
}

function getPayrollSuspicionAmountCandidates_(row) {
  var candidates = [];
  function addCandidate(value) {
    var amount = Math.round(toPayrollNumber_(value, 0));
    if (amount <= 0) return;
    if (candidates.indexOf(amount) === -1) candidates.push(amount);
  }
  var amount = toPayrollNumber_(row && row.amount, 0);
  var rate = toPayrollNumber_(row && row.rate, 0);
  var hours = toPayrollNumber_(row && row.hours, 0);
  var discount = normalizePayrollDiscountPercent_(row && row.discount);
  addCandidate(amount);
  if (rate > 0 && hours > 0) addCandidate(rate * hours);
  if (amount > 0 && discount > 0 && discount < 100) {
    addCandidate(amount / (1 - (discount / 100)));
  }
  return candidates;
}

function isPayrollAmountCandidateWithinTolerance_(candidates, expectedAmount, settings) {
  var expected = toPayrollNumber_(expectedAmount, 0);
  if (expected <= 0 || !candidates || !candidates.length) return false;
  var tolerancePercent = Math.max(0, toPayrollNumber_(settings.rateTolerancePercent, 8)) / 100;
  var toleranceWon = Math.max(0, toPayrollNumber_(settings.rateToleranceWon, 3000));
  for (var i = 0; i < candidates.length; i++) {
    var amount = toPayrollNumber_(candidates[i], 0);
    if (amount <= 0) continue;
    var gap = Math.abs(amount - expected) / expected;
    var absGap = Math.abs(amount - expected);
    if (gap <= tolerancePercent || absGap <= toleranceWon) return true;
  }
  return false;
}

function appendPayrollTimeSuspicion_(reasons, row, settings) {
  var start = row.startMinutes;
  var end = row.endMinutes;
  if (start === null || end === null) {
    reasons.push("수업 시작/종료 시간 파싱 불가");
    return;
  }
  if (end <= start) {
    reasons.push("종료 시간이 시작 시간보다 빠르거나 같습니다");
    return;
  }
  var earliest = Math.round(toPayrollNumber_(settings.earliestHour, 8) * 60);
  var latest = Math.round(toPayrollNumber_(settings.latestHour, 23) * 60);
  if (start < earliest || end > latest) {
    reasons.push("설정 운영시간(" + formatPayrollHourLabel_(earliest) + "~" + formatPayrollHourLabel_(latest) + ") 밖 수업");
  }
  var durationHours = (end - start) / 60;
  var maxLessonHours = Math.max(1, toPayrollNumber_(settings.maxLessonHours, 5));
  if (durationHours > maxLessonHours + 0.001 || toPayrollNumber_(row.hours, 0) > maxLessonHours + 0.001) {
    reasons.push("1회 수업 시간이 " + formatPayrollPlainHours_(maxLessonHours) + "시간 초과");
  }
  if (Math.abs(durationHours - toPayrollNumber_(row.hours, 0)) >= 0.25) {
    reasons.push("시작-종료 시간과 입력 시수가 불일치");
  }
}

function appendPayrollClassTeacherSuspicion_(reasons, row) {
  var hinted = extractPayrollClassTeacherHint_(row.className || "");
  if (!hinted || !row.teacher) return;
  if (normalizePayrollCompareText_(hinted) !== normalizePayrollCompareText_(row.teacher)) {
    reasons.push("반명 표기 강사(" + hinted + ")와 TR(" + row.teacher + ") 불일치");
  }
}

function appendPayrollStudentPatternSuspicion_(reasons, row, summaryMap) {
  var summary = summaryMap[row.name || ""];
  if (!summary || summary.total < 4) return;
  var comboKey = [row.subject || "-", normalizePayrollSuspicionClassType_(row.classType || "-") || row.classType || "-"].join("|");
  var comboCount = summary.combo[comboKey] || 0;
  var maxComboCount = getPayrollMaxCount_(summary.combo);
  if (comboCount === 1 && maxComboCount >= 3) {
    reasons.push("학생이 평소 듣던 과목/유형 조합과 다른 수업");
  }
  var teacherCount = summary.teacher[row.teacher || ""] || 0;
  var maxTeacherCount = getPayrollMaxCount_(summary.teacher);
  if (teacherCount === 1 && maxTeacherCount >= 3) {
    reasons.push("학생 기준 평소 담당 강사와 다른 수업");
  }
}

function appendPayrollAmountSuspicion_(reasons, row) {
  var rate = toPayrollNumber_(row.rate, 0);
  var hours = toPayrollNumber_(row.hours, 0);
  var amount = toPayrollNumber_(row.amount, 0);
  if (rate > 0 && hours > 0 && amount > 0) {
    var expected = Math.round(rate * hours);
    var candidates = getPayrollSuspicionAmountCandidates_(row);
    var tolerance = Math.max(1000, expected * 0.03);
    var matched = candidates.some(function(candidate) {
      return Math.abs(toPayrollNumber_(candidate, 0) - expected) < tolerance;
    });
    if (!matched) {
      reasons.push("금액과 시간당 금액 x 시수 불일치");
    }
  }
  var discount = normalizePayrollDiscountPercent_(row.discount);
  if (discount > 70) reasons.push("할인율이 70%를 초과합니다");
}

function extractPayrollClassTeacherHint_(className) {
  var text = String(className || "");
  var matches = text.match(/\(([^)]+)\)/g);
  if (!matches || !matches.length) return "";
  var hint = matches[matches.length - 1].replace(/[()]/g, "").trim();
  if (!hint || /\d|h|H|시간|분|초|중|고|N수/.test(hint)) return "";
  return hint;
}

function normalizePayrollCompareText_(text) {
  return String(text || "").replace(/\s+/g, "").toLowerCase();
}

function getPayrollMaxCount_(map) {
  var max = 0;
  Object.keys(map || {}).forEach(function(key) {
    max = Math.max(max, toPayrollNumber_(map[key], 0));
  });
  return max;
}

function uniquePayrollReasons_(reasons) {
  var seen = {};
  return (reasons || []).filter(function(reason) {
    var text = String(reason || "").trim();
    if (!text || seen[text]) return false;
    seen[text] = true;
    return true;
  });
}

function formatPayrollHourLabel_(minutes) {
  var hour = Math.floor(minutes / 60);
  var minute = Math.round(minutes % 60);
  return hour + ":" + (minute < 10 ? "0" + minute : minute);
}

function formatPayrollPlainHours_(hours) {
  var value = Math.round(toPayrollNumber_(hours, 0) * 10) / 10;
  return String(value).replace(/\.0$/, "");
}

function toPayrollKeySet_(list) {
  var map = {};
  var arr = Array.isArray(list) ? list : [];
  for (var i = 0; i < arr.length; i++) {
    var key = String(arr[i] || "").trim();
    if (key) map[key] = true;
  }
  return map;
}

function toPayrollNumber_(value) {
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  var text = String(value || "").replace(/,/g, "").replace(/[^\d.\-]/g, "");
  if (!text) return 0;
  var num = parseFloat(text);
  return isNaN(num) ? 0 : num;
}

function roundPayrollNumber_(value, digits) {
  var d = Math.pow(10, digits || 0);
  return Math.round((value || 0) * d) / d;
}

function clampPayrollNumber_(value, min, max, fallback) {
  var num = isNaN(value) ? fallback : value;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

function computePayrollHourDiff_(startText, endText) {
  var start = parsePayrollTimeMinutes_(startText);
  var end = parsePayrollTimeMinutes_(endText);
  if (start === null || end === null || end <= start) return 0;
  return roundPayrollNumber_((end - start) / 60, 2);
}

function parsePayrollTimeMinutes_(text) {
  var raw = String(text || "").trim();
  if (!raw) return null;

  var m = raw.match(/(오전|오후)?\s*(\d{1,2})\s*:\s*(\d{1,2})/);
  if (!m) return null;
  var period = m[1] || "";
  var hour = parseInt(m[2], 10);
  var minute = parseInt(m[3], 10);
  if (isNaN(hour) || isNaN(minute)) return null;
  if (period === "오후" && hour < 12) hour += 12;
  if (period === "오전" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}
