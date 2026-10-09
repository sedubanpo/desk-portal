// Versioned intranet calculation snapshot. Regenerate with scripts/sync-intranet-projection.mjs; see intranet-projection.sources.json.

// functions/lessonTime.js
function lessonClockMinutes(value, allowEndOfDay = false) {
  if (allowEndOfDay && value === "24:00") return 1440;
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
function lessonTimeSpan(start, end) {
  const a = lessonClockMinutes(start), b = lessonClockMinutes(end, true);
  return a !== null && b !== null && b > a ? b - a : null;
}

// functions/feeMerge.js
var feeClassKey = (value) => String(value || "").trim().replace(/\s+/g, "").replace(/-?\d+(?:\.\d+)?h$/i, "").replace(/\(([^)]+)\)/g, "-$1").replace(/개별정규/g, "\uAC1C\uBCC4").replace(/T(?=-|$)/gi, "").replace(/--+/g, "-");
function actualLessonMinutes(lesson) {
  const normalize = (value) => String(value || "").replace(/^(\d):/, "0$1:");
  const minutes = lessonTimeSpan(normalize(lesson?.start), normalize(lesson?.end));
  return Number.isInteger(minutes) && minutes > 0 && minutes <= 720 ? minutes : null;
}
function mergeTeacher(value) {
  return String(value || "").trim().replace(/\s+/g, "").replace(/T$/i, "");
}
function mergeCourse(lesson) {
  const teacher = mergeTeacher(lesson?.teacher);
  let value = String(lesson?.className || "").trim();
  if (teacher) {
    const escaped = teacher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    value = value.replace(new RegExp(`\\(${escaped}T?\\)`, "gi"), "").replace(new RegExp(`(?:^|[-\\s])${escaped}T?(?=[-\\s]|$)`, "gi"), "-");
  }
  const course = feeClassKey(value).replace(/(?:-|\s)?\d+(?:\.\d+)?시간$/i, "").replace(/[\s_]+/g, "-").replace(/--+/g, "-").replace(/^-|-$/g, "");
  return course.replace(/^(국어|영어|수학|과학|사회)(개별|1:1|2:1|3:1)/, "$1-$2");
}
function mergeIdentity(lesson) {
  const course = mergeCourse(lesson), teacher = mergeTeacher(lesson?.teacher);
  const actualMinutes = actualLessonMinutes(lesson);
  return course && teacher && actualMinutes !== null ? { course, teacher, actualMinutes } : null;
}
function mergeMatches(merge, lesson) {
  if (merge?.identityVersion === 2) {
    const identity2 = automaticCourseIdentity(lesson);
    return Boolean(identity2 && identity2.type === merge.type && identity2.teacher === merge.teacher && identity2.actualMinutes === merge.actualMinutes);
  }
  const identity = mergeIdentity(lesson);
  return Boolean(identity && merge && identity.course === merge.course && identity.teacher === merge.teacher && identity.actualMinutes === merge.actualMinutes && Array.isArray(merge.lessonIds) && merge.lessonIds.includes(lesson.id));
}
function automaticCourseIdentity(lesson) {
  const teacher = mergeTeacher(lesson?.teacher);
  const actualMinutes = actualLessonMinutes(lesson);
  const name = String(lesson?.className || "").replace(/\s*:\s*/g, ":").replace(/개별\s*정규/g, "\uAC1C\uBCC4");
  const ratios = [...new Set(name.match(/\d+:\d+/g) || [])];
  const special = [.../* @__PURE__ */ new Set([...name.match(/특강|컨설팅|수행평가|그룹|보충|자습/g) || [], ...lesson.kind === "special" ? ["\uD2B9\uAC15"] : []])].sort();
  if (ratios.length > 1) return null;
  const base = lesson.singleIndividual ? "1\uBA85\uAC1C\uBCC4" : ratios[0] || (/1명개별/.test(name) ? "1\uBA85\uAC1C\uBCC4" : /개별/.test(name) ? "\uAC1C\uBCC4" : /정규/.test(name) ? "\uC815\uADDC" : "");
  const type = [base, ...special].filter(Boolean).join("\xB7");
  if (!teacher || /^(미입력|미정|강사미상|없음|-)$/i.test(teacher) || !type || actualMinutes === null) return null;
  return { teacher, type, actualMinutes };
}
function automaticCourseKey(lesson) {
  const identity = automaticCourseIdentity(lesson);
  const month = String(lesson?.date || "").slice(0, 7);
  return identity && lesson?.studentId && /^20\d{2}-(0[1-9]|1[0-2])$/.test(month) ? JSON.stringify([lesson.studentId, month, identity.teacher, identity.type, identity.actualMinutes]) : "";
}
function compatibleSessionAttendance(a, b) {
  const segments = ["regular", "late", "cancel", "absence"];
  return segments.includes(a) && segments.includes(b);
}

// functions/feeScope.js
function scopeMatches(scope, lesson) {
  if (scope?.protectedThrough && lesson.date <= scope.protectedThrough) return false;
  if (scope?.protectedLessonIds?.includes(lesson.id)) return false;
  if (!scope || scope.version !== 1 || scope.studentId !== lesson.studentId || lesson.date < scope.effectiveFrom || scope.effectiveThrough && lesson.date > scope.effectiveThrough) return false;
  if (scope.allocation) return Object.entries(scope.allocation.snapshot).every(([k, v]) => lesson[k] === v);
  const identity = automaticCourseIdentity(lesson);
  if (!identity || ["teacher", "type", "actualMinutes"].some((k) => identity[k] !== scope.identity[k]) || mergeCourse(lesson) !== scope.identity.course) return false;
  return scope.scope !== "occurrence" || scope.lessonId === lesson.id && Object.entries(scope.snapshot).every(([k, v]) => lesson[k] === v);
}
function scopedAmount(scope, lesson) {
  if (!scopeMatches(scope, lesson)) return null;
  if (["absence", "cancelMakeup", "lateMakeup", "free", "study"].includes(lesson.kind)) return 0;
  const minutes = lesson.kind === "cancel" ? scope.allocation?.minutes ?? scope.identity.actualMinutes : lesson.billMinutes;
  if (!Number.isSafeInteger(minutes) || minutes < 0) return null;
  if (scope.allocation) return minutes > 0 ? scope.allocation.amount : 0;
  return scope.rateUnit === "perClass" ? minutes > 0 ? scope.amount : 0 : Math.round(scope.amount * minutes / 60);
}
function selectFeeScope(assignments, lesson) {
  const scopes = assignments.map((a) => a.feeScope).filter(Boolean);
  const local = scopes.filter((s) => s.scope === "occurrence" && s.lessonId === lesson.id && s.studentId === lesson.studentId);
  if (local.length) return { scope: local[0], review: local.length !== 1 || !!local[0].withdrawn || !scopeMatches(local[0], lesson) };
  const applied = scopes.filter((s) => (s.applications || []).some((r) => r.lessonId === lesson.id));
  if (applied.length) {
    const s = applied[0], record = s.applications.find((r) => r.lessonId === lesson.id);
    const basis = { ...record.scope || s, studentId: s.studentId, agreementId: s.agreementId };
    const effective = record.allocation ? { ...basis, allocation: record.allocation } : basis;
    return { scope: effective, review: applied.length !== 1 || !!s.withdrawn || !scopeMatches(effective, lesson) || Object.entries(record.snapshot).some(([k, v]) => lesson[k] !== v) };
  }
  const matches = scopes.filter((s) => s.scope !== "occurrence" && !s.withdrawn && scopeMatches(s, lesson));
  if (matches.length) return { scope: matches[0], review: matches.length !== 1 };
  const changed2 = scopes.find((s) => s.lessonId === lesson.id && s.studentId === lesson.studentId && !(s.protectedThrough && lesson.date <= s.protectedThrough) && !s.protectedLessonIds?.includes(lesson.id));
  return changed2 ? { scope: changed2, review: true } : null;
}
function reusableLegacyEvidence(lesson) {
  return !lesson.feeAllocation && !lesson.feeScopeIsolation && !lesson.scopedFee && !lesson.billingDecision && lesson.feeProjection?.sourceType !== "scoped-fee";
}

// src/attendanceNames.ts
function attendanceIdentity(status) {
  return status === "\uB2F9\uCDE8\uBCF4\uCDA9" ? "\uBCF4\uCDA9" : status;
}

// src/domain.ts
var emptyStore = () => ({
  students: [],
  lessons: [],
  payments: [],
  paymentChecks: [],
  batches: [],
  demo: false
});
function medicalAbsenceWaived(l) {
  return !!l.medicalAbsence && l.kind === "absence" && l.billMinutes === 0 && l.payMinutes === 0;
}
function accessCharge(l) {
  if (medicalAbsenceWaived(l)) return 0;
  if (l.singleIndividual) return null;
  if (["student-special-rate", "bulk-fee-override", "daily-fee-override", "session-course-rate", "contract-session-rate"].includes(l.feeProjection?.sourceType || "")) return null;
  return l.source === "access-history" && l.access?.billingAuthoritative === true && typeof l.access.amount === "number" && Number.isFinite(l.access.amount) && l.access.amount >= 0 ? Math.round(l.access.amount * 100) / 100 : null;
}
function charge(l) {
  if (l.scopedFee?.review) return null;
  if (l.scopedFee && !l.studentDiscount) return scopedAmount(l.scopedFee.scope, l);
  if (l.studentDiscount) {
    const { studentDiscount, ...base } = l;
    return charge(base) === null ? null : studentDiscount.amount;
  }
  if (medicalAbsenceWaived(l)) return 0;
  const original = accessCharge(l);
  if (l.reviewed && original !== null) return original;
  if (!l.reviewed || l.rate === null || !Number.isSafeInteger(l.rate) || l.rate < 0 || l.rateUnit !== void 0 && !["perHour", "perClass"].includes(l.rateUnit) || l.billMinutes === null || !Number.isInteger(l.billMinutes) || l.billMinutes < 0 || l.payMinutes === null || !Number.isInteger(l.payMinutes) || l.payMinutes < 0)
    return null;
  if (["absence", "cancelMakeup", "lateMakeup", "free"].includes(l.kind) && l.billMinutes !== 0)
    return null;
  if (["absence", "cancel"].includes(l.kind) && l.payMinutes !== 0) return null;
  if (l.rateUnit === "perClass") return l.billMinutes > 0 ? l.rate : 0;
  const result = (BigInt(l.rate) * BigInt(l.billMinutes) + 30n) / 60n;
  return result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : null;
}
function estimatedCharge(l) {
  if (l.deletedAt) return 0;
  if (l.scopedFee?.review) return null;
  if (l.scopedFee && !l.studentDiscount) return scopedAmount(l.scopedFee.scope, l);
  if (l.studentDiscount) {
    const { studentDiscount, ...base } = l;
    return estimatedCharge(base) === null ? null : studentDiscount.amount;
  }
  const original = accessCharge(l);
  if (original !== null) return original;
  if (l.reviewed) return charge(l);
  if (l.feeProjection?.sourceType !== "daily-fee-override" && ["regular", "late"].includes(l.kind) && /(?:당취|당일\s*취소)[\s\S]*(?:보충|보강)|(?:보충|보강)[\s\S]*(?:당취|당일\s*취소)/.test(l.note || "")) return null;
  const free = ["absence", "cancelMakeup", "lateMakeup", "free"].includes(l.kind);
  const billingMemo = /할인|무료|면제|환불|차감|추가\s*청구|금액|수강료|단가|청구|조퇴|단축|연장|시간\s*(?:변경|확인)|미납|미정/.test(l.note || "");
  const cancellationMemoException = /할인|무료|면제|환불|차감|추가|금액|수강료|단가|청구|조퇴|단축|연장|시간\s*(?:변경|확인)|미납|미정|중복|이중|미청구|취소\s*(?:아님|아니)/.test(l.note || "");
  const settledCancellation = l.kind === "cancel" && l.payMinutes === 0 && typeof l.billMinutes === "number" && l.billMinutes > 0 && Number.isInteger(l.billMinutes) && typeof l.rate === "number" && Number.isSafeInteger(l.rate) && l.rate > 0 && !l.automaticFeeConflict && !cancellationMemoException;
  const settledLate = l.kind === "late" && typeof l.rate === "number" && l.rate > 0 && Number.isSafeInteger(l.rate) && typeof l.billMinutes === "number" && l.billMinutes > 0 && Number.isInteger(l.billMinutes) && !l.automaticFeeConflict && !billingMemo;
  const safeWarnings = (l.warnings || []).every((w) => settledLate && w === "\uCD9C\uACB0 \uC9C0\uAC01: \uCCAD\uAD6C \uAE30\uC900 \uD655\uC778" || settledCancellation && ["\uCD9C\uACB0 \uB2F9\uC77C\uCDE8\uC18C: \uCCAD\uAD6C \uAE30\uC900 \uD655\uC778", "\uD2B9\uC774\uC0AC\uD56D \uD655\uC778"].includes(w) || w === "\uCD9C\uACB0 \uB2F9\uC77C\uCDE8\uC18C: \uCCAD\uAD6C \uAE30\uC900 \uD655\uC778" && l.kind === "cancel" && ["session-course-rate", "contract-session-rate", "student-special-rate"].includes(l.feeProjection?.sourceType || "") || w === "\uCD9C\uACB0 \uACB0\uC11D\uC608\uACE0: \uCCAD\uAD6C \uAE30\uC900 \uD655\uC778" && l.kind === "absence" && l.billMinutes === 0 && l.payMinutes === 0 && ["session-course-rate", "contract-session-rate"].includes(l.feeProjection?.sourceType || "") || w === "\uD2B9\uC774\uC0AC\uD56D \uD655\uC778" && (!billingMemo || ["session-course-rate", "contract-session-rate"].includes(l.feeProjection?.sourceType || "") && /(?:지각|당일취소|당취|결석예고)\s*확인\s*중/.test(l.note || "") && !/할인|무료|면제|환불|차감|추가\s*청구|금액|수강료|단가|청구|결석|취소|보강|보충|조퇴|단축|연장|시간\s*(?:변경|확인)|미납|미정/.test((l.note || "").replace(/(?:지각|당일취소|당취|결석예고)\s*확인\s*중/g, "")) || l.feeProjection?.sourceType === "student-special-rate" && /할인/.test(l.note || "") && !/무료|면제|환불|차감|추가|결석|취소|당취|보강|보충|조퇴|단축|연장|확인|미정/.test(l.note || "")) || w === "\uAC19\uC740 \uC774\uB984\uC758 \uD559\uAD50 \uAC12\uC774 \uB2E4\uB985\uB2C8\uB2E4. \uD559\uC0DD \uC5F0\uACB0 \uD655\uC778" || w === "\uACFC\uAC70 \uAC15\uC0AC \uD3EC\uD138 \uC6D0\uBCF8 \xB7 \uB2E8\uAC00\uC640 \uCCAD\uAD6C \uAE30\uC900 \uBBF8\uC774\uAD00" || w === "\uC804\uCCB4 \uD559\uC0DD \uC911 \uC720\uC77C\uD55C \uC774\uB984\uC73C\uB85C \uC5F0\uACB0 \xB7 \uC6D0\uBCF8 \uD559\uAD50 \uB300\uC870 \uAD8C\uC7A5");
  if (!safeWarnings && !["bulk-fee-override", "daily-fee-override"].includes(l.feeProjection?.sourceType || "") || l.kind === "study") return null;
  return charge({
    ...l,
    reviewed: true,
    payMinutes: 0,
    ...free ? { rate: 0, rateUnit: "perHour" } : {}
  });
}

// src/automaticCourseFees.ts
function automaticCourseFees(rows, studentId, month) {
  const individualKey = (row) => {
    const identity = automaticCourseIdentity(row);
    return identity?.type === "\uAC1C\uBCC4" ? JSON.stringify(["student-individual", row.studentId, row.date.slice(0, 7), identity.actualMinutes]) : "";
  };
  const exactKey = (row) => JSON.stringify(["exact", automaticCourseKey(row), mergeCourse(row)]);
  const groups = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const key = automaticCourseKey(row);
    if (!key || row.deletedAt || row.studentId !== studentId || !row.date.startsWith(month)) continue;
    groups.set(key, [...groups.get(key) || [], row]);
    const exact = exactKey(row);
    groups.set(exact, [...groups.get(exact) || [], row]);
    const shared = individualKey(row);
    if (shared) groups.set(shared, [...groups.get(shared) || [], row]);
  }
  const resolved = /* @__PURE__ */ new Map();
  for (const [key, members] of groups) {
    const full = members.filter((row) => ["regular", "late", "cancel"].includes(row.kind) && row.billMinutes !== null && row.billMinutes > 0 && row.billMinutes === actualLessonMinutes(row));
    const evidence = full.filter((row) => reusableLegacyEvidence(row) && row.kind === "regular" && !Number(row.access?.discount || 0) && !/할인|무료|금액\s*예외|보강|보충/.test([row.note, row.reason].join(" "))).map(estimatedCharge).filter((value) => value !== null);
    const amounts = [...new Set(evidence)];
    resolved.set(key, { count: evidence.length, amount: amounts.length === 1 && Number.isSafeInteger(amounts[0]) && amounts[0] > 0 ? amounts[0] : void 0, conflict: amounts.length > 1 });
  }
  return rows.map((row) => {
    if (row.studentId !== studentId || !row.date.startsWith(month)) return row;
    if (!reusableLegacyEvidence(row)) return row;
    let own = resolved.get(automaticCourseKey(row));
    if (own?.conflict && row.rate == null) {
      const earlier = (groups.get(exactKey(row)) || []).filter((l) => reusableLegacyEvidence(l) && l.date < row.date && l.kind === "regular" && l.billMinutes === actualLessonMinutes(l) && !l.deletedAt && !Number(l.access?.discount || 0) && !/할인|무료|금액\s*예외|보강|보충/.test([l.note, l.reason].join(" ")));
      const amounts = earlier.map(estimatedCharge).filter((v) => v !== null);
      if (amounts.length >= 2 && new Set(amounts).size === 1 && Number.isSafeInteger(amounts[0]) && amounts[0] > 0) own = { amount: amounts[0], conflict: false, count: amounts.length };
    }
    const shared = resolved.get(individualKey(row));
    const value = own?.conflict || own?.amount !== void 0 ? own : row.rate == null && shared?.amount !== void 0 && !shared.conflict ? shared : own;
    if (!value || row.deletedAt) return row;
    if (value.conflict) return { ...row, automaticFeeConflict: true };
    if (value.amount === void 0 || estimatedCharge(row) !== null || !["regular", "late", "cancel"].includes(row.kind) || row.billMinutes === null || row.billMinutes <= 0 || row.billMinutes !== actualLessonMinutes(row) || Number(row.access?.discount || 0) !== 0 || /할인|무료|금액\s*예외/.test([row.note, row.reason].join(" ")) || row.rateOverride !== void 0 || accessCharge(row) !== null) return row;
    return {
      ...row,
      rate: value.amount,
      rateUnit: "perClass",
      reviewed: false,
      automaticFeeApplied: true,
      feeProjection: row.feeProjection || { rate: row.rate, rateUnit: row.rateUnit, reviewed: row.reviewed, sourceType: "automatic-course-rate" }
    };
  });
}

// functions/historicalFeeAssignment.js
function historicalAssignmentMatches(assignment, lesson) {
  if (assignment?.bulkMerge === true) {
    const snapshot2 = assignment.lessonSnapshot;
    if (!snapshot2 || !lesson || lesson.deletedAt) return false;
    const identity = (value) => {
      const minutes = lessonTimeSpan(value?.start, value?.end);
      if (minutes === null) return "";
      const teacher = String(value?.teacher || "").trim().replace(/\s+/g, "").replace(/T$/i, "");
      const course = String(value?.className || "").trim().replace(/\s+/g, "").replace(/-?\d+(?:\.\d+)?h$/i, "").replace(/(?:-|\s)?\d+(?:\.\d+)?시간$/i, "").replace(/개별정규/g, "\uAC1C\uBCC4");
      return minutes > 0 && teacher && course ? `${course}|${teacher}|${minutes}` : "";
    };
    return identity(snapshot2) === identity(lesson);
  }
  if (assignment?.sourceType !== "historical-recovery") return true;
  const snapshot = assignment.lessonSnapshot;
  if (!snapshot || !lesson || lesson.deletedAt) return false;
  return ["date", "start", "end", "kind", "className", "teacher", "billMinutes"].every(
    (key) => snapshot[key] !== void 0 && snapshot[key] === lesson[key]
  );
}
function importedClassDurationMatches(assignment, lesson) {
  if (!/개별/.test(lesson?.className || "") || /\d+\s*:\s*\d+/.test(lesson?.className || "")) return true;
  const evidence = assignment?.evidence;
  if (!Array.isArray(evidence) || !evidence.length || !evidence.every((e) => e.unit === "perClass" && e.hours > 0)) return true;
  if (lesson?.singleIndividual || lesson?.kind !== "regular" || /1\s*명\s*개별|보충|보강|할인|형제|무료/.test([lesson?.className, lesson?.note, lesson?.reason].join(" "))) return true;
  const clock = (value) => /^\d{2}:\d{2}$/.test(value || "") ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN;
  const minutes = clock(lesson?.end) - clock(lesson?.start);
  if (!(minutes > 0) || lesson?.billMinutes !== minutes) return true;
  if (assignment.amount === 28125 && evidence.some((e) => e.hours !== 4 && Math.abs(e.rate / e.hours - 28125) < 0.01)) return true;
  return evidence.some((e) => e.hours * 60 === minutes);
}

// functions/lateFeeRecovery.js
var classKey = (lesson) => {
  const teacher = mergeTeacher(lesson?.teacher);
  const course = mergeCourse(lesson);
  return course && teacher ? `${course}|${teacher}` : "";
};
var exceptional = (lesson) => /할인|형제|무료|보강|보충|금액\s*(?:예외|조정|할인)|시간\s*(?:책정|조정)/.test(
  [lesson?.note, lesson?.reason, ...lesson?.warnings || []].filter(Boolean).join(" ")
);
var validAmount = (amount) => Number.isSafeInteger(amount) && amount > 0 && amount <= 1e7;
function accessEvidence(lesson) {
  if (lesson?.source !== "access-history" || lesson?.access?.billingAuthoritative !== true || Number(lesson.access.discount || 0) !== 0)
    return null;
  const amount = Number(lesson.access.amount);
  return validAmount(amount) ? { amount, rateUnit: "perClass", total: amount, source: "access" } : null;
}
function pricedEvidence(lesson, rateFor) {
  const value = rateFor?.(lesson);
  if (value?.preferOverAccess) return rateEvidence(value, lesson);
  const access = accessEvidence(lesson);
  if (access) return access;
  return rateEvidence(value, lesson);
}
function rateEvidence(value, lesson) {
  const amount = Number(value?.amount), rateUnit = value?.rateUnit || "perHour";
  if (!validAmount(amount) || !["perHour", "perClass"].includes(rateUnit)) return null;
  const total = rateUnit === "perClass" ? amount : amount * lesson.billMinutes / 60;
  return Number.isSafeInteger(total) && total > 0 ? { amount, rateUnit, total, source: "rate" } : null;
}
function lateRegularRateCandidate(lesson, rows, rateFor = () => null) {
  if (!lesson || lesson.kind !== "late" || !Number.isInteger(lesson.billMinutes) || lesson.billMinutes <= 0 || exceptional(lesson)) return null;
  const month = String(lesson.date || "").slice(0, 7), key = classKey(lesson);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || !key) return null;
  const regulars = (rows || []).filter((row) => row && !row.deletedAt && row.kind === "regular" && row.studentId === lesson.studentId && String(row.date || "").slice(0, 7) === month && row.billMinutes === lesson.billMinutes && classKey(row) === key);
  if (!regulars.length || regulars.some(exceptional)) return null;
  const evidence = regulars.map((row) => pricedEvidence(row, rateFor));
  if (evidence.some((value) => !value) || new Set(evidence.map((value) => value.total)).size !== 1) return null;
  const access = evidence.filter((value) => value.source === "access");
  if (access.length) return { amount: access[0].total, rateUnit: "perClass", source: "same-month-access-regular", evidenceCount: evidence.length };
  const signatures = new Set(evidence.map((value) => `${value.amount}|${value.rateUnit}`));
  return signatures.size === 1 ? { amount: evidence[0].amount, rateUnit: evidence[0].rateUnit, source: "same-month-regular-rate", evidenceCount: evidence.length } : null;
}

// src/presentation.ts
function classLabel(name, teacher = "") {
  let value = name.trim();
  const person = teacher.trim().replace(/T$/i, "");
  if (!person) return value;
  const escaped = person.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  value = value.replace(new RegExp(`\\(${escaped}T?\\)`, "g"), `-${person}T`);
  value = value.replace(
    new RegExp(`-${escaped}(?:T)?(?=-|$)`, "g"),
    `-${person}T`
  );
  if (!value.includes(`${person}T`)) {
    value = /-\d+(?:\.\d+)?h$/i.test(value) ? value.replace(/(-\d+(?:\.\d+)?h)$/i, `-${person}T$1`) : `${value}-${person}T`;
  }
  return value.replace(/T(?=\d+(?:\.\d+)?h$)/i, "T-").replace(/--+/g, "-");
}

// src/fees.ts
var feeClassKey2 = (value) => value.trim().replace(/\s+/g, "").replace(/-?\d+(?:\.\d+)?h$/i, "").replace(/\(([^)]+)\)/g, "-$1").replace(/개별정규/g, "\uAC1C\uBCC4").replace(/T(?=-|$)/gi, "").replace(/--+/g, "-");
var feeAssignment = (rows, lesson) => rows.find((a) => !a.feeScope && a.kind === "lesson" && a.target === lesson.id && historicalAssignmentMatches(a, lesson)) || rows.find(
  (a) => !a.feeScope && a.kind === "class" && lesson.kind !== "special" && importedClassDurationMatches(a, lesson) && (a.durationHours === void 0 || Number(lesson.className.match(/(\d+(?:\.\d+)?)h$/i)?.[1]) === a.durationHours && lesson.billMinutes === a.durationHours * 60) && feeClassKey2(a.target) === feeClassKey2(classLabel(lesson.className, lesson.teacher))
);
function applyFees(store, studentId, month, assignments, merges = []) {
  const scopedAssignments = assignments.map((a) => a.feeScope ? { ...a, feeScope: { ...a.feeScope, studentId } } : a);
  const defaults = merges.filter((row) => row.sourceType === "prior-confirmed-rate");
  const explicit = merges.filter((row) => row.sourceType !== "prior-confirmed-rate");
  return {
    ...store,
    lessons: automaticCourseFees(store.lessons.map((l) => {
      const { feeGroupId: _feeGroupId, automaticFeeApplied: _automatic, automaticFeeConflict: _conflict, ...base } = l;
      if (base.studentId !== studentId || !base.date.startsWith(month)) return l;
      const scoped = selectFeeScope(scopedAssignments, base);
      if (scoped && (scoped.review || scoped.scope.scope === "occurrence" || base.rate === null && base.rateOverride === void 0 && !(base.source === "access-history" && base.access?.billingAuthoritative))) {
        return {
          ...base,
          studentDiscount: void 0,
          scopedFee: scoped,
          automaticFeeConflict: scoped.review,
          rate: scoped.scope.amount,
          rateUnit: scoped.scope.rateUnit,
          reviewed: false,
          feeProjection: base.feeProjection || { rate: base.rate, rateUnit: base.rateUnit, reviewed: base.reviewed, sourceType: "scoped-fee" }
        };
      }
      if (l.singleIndividual) return l;
      const merge = explicit.find((row) => mergeMatches(row, base));
      const grouped = merge ? { ...base, feeGroupId: merge.id, ...merge.scope === "month" ? { feeScopeIsolation: true } : {} } : base;
      if (["absence", "cancelMakeup", "lateMakeup", "free"].includes(grouped.kind)) {
        const savedZeroOverride = grouped.rateOverride === 0 && grouped.rate === 0 && grouped.billMinutes === 0;
        return merge || savedZeroOverride ? {
          ...grouped,
          feeProjection: grouped.feeProjection || {
            rate: grouped.rate,
            reviewed: grouped.reviewed,
            rateUnit: grouped.rateUnit,
            sourceType: savedZeroOverride ? "daily-fee-override" : "bulk-fee-override"
          }
        } : grouped;
      }
      const a = (merge ? void 0 : feeAssignment(assignments, grouped)) || (merge ? {
        kind: "lesson",
        target: grouped.id,
        rateId: merge.id,
        amount: merge.amount,
        rateUnit: merge.rateUnit,
        label: merge.course,
        updatedBy: merge.updatedBy,
        updatedAt: merge.updatedAt,
        sourceType: "bulk-fee-override"
      } : void 0);
      const dailyOverride = grouped.rateOverride;
      const activeDailyOverride = typeof dailyOverride === "number" && Number.isSafeInteger(dailyOverride) && dailyOverride >= 0 && grouped.rate === dailyOverride && (!a || grouped.rateOverrideAgainst === (a.updatedAt || ""));
      if (grouped.source === "access-history" && grouped.access?.billingAuthoritative && activeDailyOverride) {
        return {
          ...grouped,
          feeProjection: grouped.feeProjection || {
            rate: grouped.rate,
            reviewed: grouped.reviewed,
            rateUnit: grouped.rateUnit,
            sourceType: "daily-fee-override"
          }
        };
      }
      if (grouped.source === "access-history" && grouped.access?.billingAuthoritative && a?.sourceType !== "bulk-fee-override") return grouped;
      if (grouped.rateOverride !== void 0 && !merge && (!a || a.updatedAt === (grouped.rateOverrideAgainst || "")))
        return { ...grouped, rate: grouped.rateOverride };
      if (!a && grouped.kind === "late") {
        const recovered = lateRegularRateCandidate(grouped, store.lessons, (row) => {
          if (!reusableLegacyEvidence(row) || selectFeeScope(scopedAssignments, row)) return null;
          const rowAssignment = feeAssignment(assignments, row);
          const override = row.rateOverride;
          const activeOverride = typeof override === "number" && Number.isSafeInteger(override) && override >= 0 && (!rowAssignment || rowAssignment.updatedAt === (row.rateOverrideAgainst || ""));
          if (activeOverride) return { amount: override, rateUnit: row.rateUnit || "perHour", preferOverAccess: true };
          if (rowAssignment) return {
            amount: rowAssignment.amount,
            rateUnit: rowAssignment.rateUnit || "perHour",
            preferOverAccess: rowAssignment.sourceType === "bulk-fee-override"
          };
          const amount = row.rate;
          return typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0 ? { amount, rateUnit: row.rateUnit || "perHour" } : null;
        });
        if (recovered) return {
          ...grouped,
          feeProjection: grouped.feeProjection || {
            rate: grouped.rate,
            reviewed: grouped.reviewed,
            rateUnit: grouped.rateUnit,
            sourceType: "late-regular-recovery"
          },
          rate: recovered.amount,
          rateUnit: recovered.rateUnit,
          reviewed: false
        };
      }
      if (!a) return grouped;
      return {
        ...grouped,
        feeProjection: grouped.feeProjection || {
          rate: grouped.rate,
          reviewed: grouped.reviewed,
          rateUnit: grouped.rateUnit,
          ...a.sourceType ? { sourceType: a.sourceType } : {}
        },
        rate: a.amount,
        rateUnit: a.rateUnit || "perHour",
        reviewed: false
      };
    }), studentId, month).map((row) => {
      if (row.studentId !== studentId || !row.date.startsWith(month) || row.deletedAt || row.scopedFee || row.singleIndividual || row.rateOverride !== void 0 || row.automaticFeeConflict || estimatedCharge(row) !== null || row.rate !== null || !["regular", "late", "cancel", "special", "absenceMakeup"].includes(row.kind) || row.billMinutes !== actualLessonMinutes(row) || !row.billMinutes || Number(row.access?.discount || 0) || /할인|무료|면제|환불|차감|금액\s*예외|일회성|이번만/.test([row.note, row.reason].join(" ")))
        return row;
      const prior = defaults.find((value) => mergeMatches(value, row));
      if (!prior) return row;
      if (prior.conflict) return { ...row, automaticFeeConflict: true };
      if (!Number.isSafeInteger(prior.amount) || prior.amount <= 0) return row;
      return {
        ...row,
        rate: prior.amount,
        rateUnit: "perClass",
        reviewed: false,
        automaticFeeApplied: true,
        feeProjection: row.feeProjection || { rate: row.rate, rateUnit: row.rateUnit, reviewed: row.reviewed, sourceType: "prior-confirmed-rate" }
      };
    })
  };
}
function removeFeeProjection(store) {
  return {
    ...store,
    lessons: store.lessons.map((l) => {
      const { feeAllocation: _allocation, feeScopeIsolation: _isolation, scopedFee: _scoped, studentDiscount: _discount, feeProjection, feeGroupId: _feeGroupId, automaticFeeApplied: _automatic, automaticFeeConflict: _conflict, ...base } = l;
      if (!feeProjection) return base;
      const { sourceType: _sourceType, ...original } = feeProjection;
      return { ...base, ...original };
    })
  };
}

// functions/feeHistory.js
import { createHash } from "node:crypto";
var historyId = (value) => createHash("sha256").update(value).digest("hex");
function feeClassKey3(value) {
  return String(value).trim().replace(/\s+/g, "").replace(/-?\d+(?:\.\d+)?h$/i, "").replace(/\(([^)]+)\)/g, "-$1").replace(/개별정규/g, "\uAC1C\uBCC4").replace(/T(?=-|$)/gi, "").replace(/--+/g, "-");
}
function inheritFees(period, baseline, month) {
  const inherited = (baseline?.assignments || []).filter(
    (a) => a.sourceMonth <= month && !(period.suppressedTargets || []).includes(feeClassKey3(a.target)) && !period.assignments.some(
      (x) => x.kind === "class" && feeClassKey3(x.target) === feeClassKey3(a.target)
    )
  );
  return { ...period, assignments: [...inherited, ...period.assignments] };
}
function recoverIssueFees(issues, month, period) {
  const recovered = [];
  for (const issue of issues) {
    if (issue.type !== "fee" || issue.status !== "open" || !issue.studentId) continue;
    const evidence = (issue.evidence || []).filter((e2) => e2.sourceMonth === month);
    if (!evidence.length || evidence.some((e2) => e2.unit !== "perClass" || !Number.isInteger(e2.rate) || e2.rate <= 0 || !(e2.hours > 0))) continue;
    if ((issue.reasons || []).some((r) => /할인|형제|학생 연결|비정형|수업 구분/.test(r))) continue;
    const signatures = new Set(evidence.map((e2) => `${e2.rate}|${e2.hours}|${feeClassKey3(e2.className)}`));
    if (signatures.size !== 1) continue;
    const e = evidence[0], target = feeClassKey3(e.className);
    if ((period.suppressedTargets || []).some((t) => feeClassKey3(t) === target) || (period.assignments || []).some((a) => a.kind === "class" && feeClassKey3(a.target) === target)) continue;
    recovered.push({ kind: "class", target, rateId: `recovered-${issue.id}`, amount: e.rate, rateUnit: "perClass", durationHours: e.hours, label: e.className, updatedAt: issue.createdAt || "", updatedBy: "\uC6D0\uBCF8 \uD68C\uB2F9 \uB2E8\uAC00 \uBCF5\uAD6C", sourceMonth: month });
  }
  return recovered.filter((a) => recovered.every((b) => b.target !== a.target || b.amount === a.amount && b.durationHours === a.durationHours));
}

// functions/singleIndividual.js
function singleIndividualMinutes(l) {
  const minutes = (t) => Number(String(t).slice(0, 2)) * 60 + Number(String(t).slice(3));
  const actual = minutes(l.end) - minutes(l.start);
  return !l.deletedAt && ["regular", "late"].includes(l.kind) && /개별/.test(l.className) && !/\d+\s*:\s*\d+|특강|수행평가|자습|보충/.test(l.className) && [120, 180].includes(actual) && l.sourceMinutes === actual ? actual + 60 : null;
}
function validSingleIndividual(l) {
  const expected = singleIndividualMinutes(l);
  return !!l.singleIndividual && expected !== null && l.singleIndividual.bookedMinutes === expected && l.billMinutes === expected && l.payMinutes === expected && l.rateUnit === "perHour";
}

// functions/portalChanges.js
var sentLessons = (p) => p.publishedLessons || (p.status === "sent" ? p.lessons : []) || [];
var fields = ["date", "className", "teacher", "kind", "start", "end", "payMinutes", "note"];
var sameField = (before, after, key) => {
  if (key === "note") return String(before?.note || "") === String(after?.note || "");
  return before?.[key] === after?.[key];
};
var changed = (a, b) => !!b.deletedAt || fields.some((k) => !sameField(a, b, k));

// src/studentDiscounts.ts
var discountCourseKey = (l) => {
  const i = automaticCourseIdentity(l);
  return i ? JSON.stringify([i.teacher, i.type, mergeCourse(l)]) : "";
};
function applyStudentDiscounts(rows, studentId, month, policy) {
  if (!policy || policy.month > month) return rows;
  return rows.map((l) => {
    if (l.studentId !== studentId || !l.date.startsWith(month) || l.deletedAt) return l;
    if (l.scopedFee?.review || l.scopedFee?.scope.valueMode === "final") {
      const { studentDiscount, ...clean } = l;
      return clean;
    }
    const { studentDiscount: old, ...base } = l;
    let priced = base;
    const identity = automaticCourseIdentity(base);
    const special = policy.specialHourly !== null && identity?.type === "\uAC1C\uBCC4" && !base.singleIndividual && ["regular", "late", "cancel", "absence", "cancelMakeup", "absenceMakeup", "lateMakeup", "free"].includes(base.kind);
    if (base.scopedFee) {
      const amount2 = estimatedCharge(base), course2 = policy.courses.find((c) => c.key === discountCourseKey(base)), percent2 = course2?.percent ?? policy.percent;
      if (amount2 === null || amount2 === 0) return base;
      const minutes = base.kind === "cancel" ? base.scopedFee.scope.allocation?.minutes ?? base.scopedFee.scope.identity.actualMinutes : base.billMinutes;
      const discountBase = special && minutes !== null ? Math.round(policy.specialHourly * minutes / 60) : amount2;
      return { ...base, studentDiscount: { base: amount2, amount: Math.round(discountBase * (100 - percent2) / 100), percent: percent2, reason: course2?.reason || policy.reason, month: policy.month, special } };
    }
    if (special) {
      priced = { ...base, automaticFeeConflict: false, rate: policy.specialHourly, rateUnit: "perHour", reviewed: false, feeGroupId: base.feeGroupId || "student-special", feeProjection: { ...base.feeProjection || { rate: base.rate, rateUnit: base.rateUnit, reviewed: base.reviewed }, sourceType: ["absence", "cancelMakeup", "lateMakeup", "free"].includes(base.kind) ? "bulk-fee-override" : "student-special-rate" } };
    }
    const amount = estimatedCharge(priced), course = policy.courses.find((c) => c.key === discountCourseKey(base)), percent = course?.percent ?? policy.percent;
    if (amount === null || amount === 0 || !special && percent === 0) return priced;
    const result = Math.round(amount * (100 - percent) / 100);
    return { ...priced, studentDiscount: { base: amount, amount: result, percent, reason: course?.reason || policy.reason, month: policy.month, special } };
  });
}

// src/continuousLessons.ts
function continuousLessons(rows) {
  const buckets = /* @__PURE__ */ new Map();
  for (const row of rows.filter((l) => !l.deletedAt)) {
    const bucketKey = JSON.stringify([row.studentId, row.date, mergeTeacher(row.teacher), mergeCourse(row)]);
    const bucket = buckets.get(bucketKey) || [];
    bucket.push(row);
    buckets.set(bucketKey, bucket);
  }
  const groups = [];
  for (const bucket of buckets.values()) {
    const bucketGroups = [];
    for (const row of bucket.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.id.localeCompare(b.id))) {
      const previous = bucketGroups.at(-1), last = previous?.at(-1);
      if (last && compatibleSessionAttendance(last.kind, row.kind) && last.end === row.start) previous.push(row);
      else bucketGroups.push([row]);
    }
    groups.push(...bucketGroups);
  }
  return groups.map((members) => {
    const safe = members.every((l) => !!automaticCourseIdentity(l) && l.kind === "regular" && actualLessonMinutes(l) === l.sourceMinutes && l.billMinutes === l.sourceMinutes && estimatedCharge(l) !== null && (l.rateUnit || "perHour") === "perHour" && !l.automaticFeeConflict) && new Set(members.map((l) => estimatedCharge(l) / l.sourceMinutes)).size === 1;
    const key = JSON.stringify(members.map((l) => {
      const source = l.feeProjection ? { ...l, ...l.feeProjection } : l;
      return [source.id, source.studentId, source.date, source.start, source.end, source.className, source.teacher, source.kind, attendanceIdentity(source.status), source.sourceMinutes, source.billMinutes, source.rate, source.rateUnit || "perHour", source.rateOverride, source.note];
    }));
    const mixedAttendance = new Set(members.map((l) => l.kind)).size > 1;
    return { key, rows: members, ambiguous: members.length > 1 && !safe, reason: !safe ? mixedAttendance ? "\uD55C \uD68C\uCC28\uC758 \uC5EC\uB7EC \uCD9C\uACB0 \uAD6C\uAC04\uC778\uC9C0 \uD655\uC778\uD558\uC138\uC694. \uC6D0\uBCF8 \uCD9C\uACB0\uACFC \uC778\uC815\uC2DC\uC218\uB294 \uC720\uC9C0\uB429\uB2C8\uB2E4." : "\uCD9C\uACB0\xB7\uC2DC\uC218\xB7\uB2E8\uAC00 \uB610\uB294 \uD68C\uB2F9 \uCCAD\uAD6C \uAE30\uC900\uC744 \uD655\uC778\uD558\uC138\uC694." : "" };
  }).sort((a, b) => a.rows[0].studentId.localeCompare(b.rows[0].studentId) || a.rows[0].date.localeCompare(b.rows[0].date) || a.rows[0].start.localeCompare(b.rows[0].start) || a.rows[0].id.localeCompare(b.rows[0].id));
}
function displayedLessonSessions(rows, decisions) {
  const saved = normalizeSessionDecisions(decisions);
  const contracts = effectiveContractSessions(rows, saved), ids = new Set(contracts.flatMap((s) => s.rows.map((l) => l.id)));
  return [...contracts, ...continuousLessons(rows.filter((l) => !ids.has(l.id))).flatMap((g) => g.rows.length > 1 && saved[g.key] !== "separate" && (!g.ambiguous || saved[g.key] === "group") ? [g] : g.rows.map((row) => ({ key: row.id, rows: [row], ambiguous: false, reason: "" })))].sort((a, b) => a.rows[0].date.localeCompare(b.rows[0].date) || a.rows[0].start.localeCompare(b.rows[0].start));
}
function effectiveContractSessions(rows, saved) {
  const explicit = contractLessonSessions(rows), ids = new Set(explicit.flatMap((s) => s.rows.map((l) => l.id)));
  return [...explicit, ...inferredLessonSessions(rows).filter((s) => s.rows.every((l) => !ids.has(l.id)))].filter((session) => !continuousLessons(session.rows).some((candidate) => saved[candidate.key] === "separate"));
}
function normalizeSessionKey(key) {
  try {
    const rows = JSON.parse(key);
    if (!Array.isArray(rows) || !rows.every(Array.isArray)) return key;
    return JSON.stringify(rows.map((r) => {
      const copy = [...r];
      copy[12] ||= "perHour";
      return copy;
    }));
  } catch {
    return key;
  }
}
function normalizeSessionDecisions(decisions) {
  return Object.fromEntries(Object.entries(decisions).map(([key, value]) => [normalizeSessionKey(key), value]));
}
function contractLessonSessions(rows) {
  const buckets = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const match = /(?:-|\s)(\d+(?:\.\d+)?)\s*(?:h|시간)\s*$/i.exec(row.className);
    const minutes = match ? Math.round(Number(match[1]) * 60) : 0, actual = actualLessonMinutes(row);
    if (row.deletedAt || row.singleIndividual || !minutes || !actual || actual >= minutes || !["regular", "late", "cancel", "absence"].includes(row.kind) || !automaticCourseIdentity(row)) continue;
    const key = JSON.stringify([row.studentId, row.date, mergeTeacher(row.teacher), mergeCourse(row), minutes]);
    const bucket = buckets.get(key) || { minutes, rows: [] };
    bucket.rows.push(row);
    buckets.set(key, bucket);
  }
  const result = [];
  for (const { minutes, rows: members } of buckets.values()) {
    const sorted = [...members].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
    for (let i = 0; i < sorted.length; i++) {
      const group = [sorted[i]];
      let duration = actualLessonMinutes(sorted[i]);
      for (let j = i + 1; j < sorted.length && duration < minutes; j++) {
        if (group.at(-1).end !== sorted[j].start) break;
        group.push(sorted[j]);
        duration += actualLessonMinutes(sorted[j]);
      }
      if (group.length > 1 && duration === minutes && new Set(group.map((l) => l.kind)).size > 1) {
        if (rows.some((l) => !group.some((g) => g.id === l.id) && !l.deletedAt && l.studentId === group[0].studentId && l.date === group[0].date && mergeTeacher(l.teacher) === mergeTeacher(group[0].teacher) && l.start < group.at(-1).end && l.end > group[0].start)) continue;
        result.push({ key: "contract:" + JSON.stringify(group.map((l) => [l.id, l.start, l.end, l.kind, l.className])), rows: group, ambiguous: false, reason: "\uD55C \uD68C\uCC28\uC758 \uCD9C\uACB0 \uAD6C\uAC04", contract: true });
        i += group.length - 1;
      }
    }
  }
  return result;
}
function inferredLessonSessions(rows) {
  const exceptional3 = (l) => l.singleIndividual || l.automaticFeeConflict || l.rateOverride !== void 0 || Number(l.access?.discount || 0) !== 0 || /1\s*명|할인|전과목|무료|면제|환불|차감|보강|보충|조퇴|단축|연장|금액\s*예외/.test([l.className, l.note, l.reason].join(" "));
  const candidates = continuousLessons(rows);
  const evidence = rows.filter((l) => !l.deletedAt && l.kind === "regular" && !exceptional3(l) && l.sourceMinutes === actualLessonMinutes(l) && l.billMinutes === actualLessonMinutes(l) && estimatedCharge(l) !== null && estimatedCharge(l) > 0 && !["contract-session-rate", "session-course-rate"].includes(l.feeProjection?.sourceType || "") && !rows.some((other) => other.id !== l.id && !other.deletedAt && other.studentId === l.studentId && other.date === l.date && mergeTeacher(other.teacher) === mergeTeacher(l.teacher) && other.start <= l.end && other.end >= l.start));
  return candidates.filter((s) => {
    if (s.rows.length < 2 || new Set(s.rows.map((l) => l.kind)).size < 2 || s.rows.some((l) => exceptional3(l) || !["regular", "late", "cancel", "absence"].includes(l.kind) || !automaticCourseIdentity(l) || !/^(개별|\d+:\d+)$/.test(automaticCourseIdentity(l).type))) return false;
    const first = s.rows[0], last = s.rows.at(-1), virtual = { ...first, end: last.end }, minutes = actualLessonMinutes(virtual);
    if (!minutes || s.rows.some((l) => {
      const m = /(?:-|\s)(\d+(?:\.\d+)?)\s*(?:h|시간)\s*$/i.exec(l.className);
      return m && Math.round(Number(m[1]) * 60) !== minutes;
    })) return false;
    if (rows.some((l) => !l.deletedAt && !s.rows.some((r) => r.id === l.id) && l.studentId === first.studentId && l.date === first.date && mergeTeacher(l.teacher) === mergeTeacher(first.teacher) && l.start < last.end && l.end > first.start)) return false;
    const matches = evidence.filter((l) => l.date !== first.date && automaticCourseKey(l) === automaticCourseKey(virtual) && mergeCourse(l) === mergeCourse(first));
    return matches.length > 0 && new Set(matches.map((l) => estimatedCharge(l))).size === 1;
  }).map((s) => ({ ...s, ambiguous: false, contract: true, reason: "\uAC19\uC740 \uB2EC\uC758 \uB3D9\uC77C \uC218\uC5C5 \uC2DC\uAC04\xB7\uB2E8\uAC00\uB85C \uD655\uC778\uB41C \uD55C \uD68C\uCC28" }));
}

// src/sessionFees.ts
function applySessionFees(rows, decisions, _linkedStudentIds = [], periodFor) {
  const saved = normalizeSessionDecisions(decisions), sessions = displayedLessonSessions(rows, saved);
  const exceptional3 = (l) => !reusableLegacyEvidence(l) || !!l.singleIndividual || !!l.automaticFeeConflict || Number(l.access?.discount || 0) !== 0 || /1\s*명|할인|전과목|무료|면제|환불|차감|보강|보충|조퇴|단축|연장|금액\s*예외/.test([l.className, l.note, l.reason].join(" "));
  const regular = (l) => !exceptional3(l) && ["regular", "late"].includes(l.kind) && l.billMinutes === actualLessonMinutes(l) && l.sourceMinutes === actualLessonMinutes(l) && /^(개별|\d+:\d+)$/.test(automaticCourseIdentity(l)?.type || "");
  const evidence = /* @__PURE__ */ new Map();
  for (const s of sessions) {
    if (s.rows.length !== 1) continue;
    const l = s.rows[0], amount = estimatedCharge(l);
    if (l.kind !== "regular" || !regular(l) || amount === null || amount <= 0 || !Number.isSafeInteger(amount)) continue;
    const key = automaticCourseKey(l);
    const values = evidence.get(key) || /* @__PURE__ */ new Set();
    values.add(amount);
    evidence.set(key, values);
  }
  const replacements = /* @__PURE__ */ new Map();
  for (const s of sessions) {
    const contractPart = (l) => !exceptional3(l) && ["regular", "late", "cancel", "absence"].includes(l.kind) && l.sourceMinutes === actualLessonMinutes(l) && l.billMinutes === (l.kind === "absence" ? 0 : actualLessonMinutes(l)) && (!["cancel", "absence"].includes(l.kind) || l.payMinutes === 0) && /^(개별|\d+:\d+)$/.test(automaticCourseIdentity(l)?.type || "");
    if (s.rows.length === 1 && estimatedCharge(s.rows[0]) !== null) continue;
    const mixedAttendance = new Set(s.rows.map((l) => l.kind)).size > 1;
    if (s.rows.length > 1 && !s.contract && saved[s.key] !== "group" || !s.rows.every((l) => (s.contract || mixedAttendance || s.rows.length === 1 ? contractPart(l) : regular(l)) && l.rateOverride === void 0 && !["bulk-fee-override", "daily-fee-override"].includes(l.feeProjection?.sourceType || "") && (l.kind === "absence" || estimatedCharge(l) !== 0))) continue;
    const virtual = { ...s.rows[0], end: s.rows.at(-1).end }, minutes = actualLessonMinutes(virtual);
    let scopedSource;
    let values = evidence.get(automaticCourseKey(virtual));
    const period = periodFor?.(virtual);
    if (period?.assignments.some((a) => a.feeScope?.protectedLessonIds?.some((id) => s.rows.some((l) => l.id === id)))) continue;
    if (!values && period && s.rows.length > 1) {
      const whole = { ...virtual, id: "session:" + s.key, kind: "regular", status: "\uCD9C\uC11D", sourceMinutes: minutes, billMinutes: minutes, payMinutes: minutes, rate: null, rateUnit: "perHour", feeProjection: void 0, access: void 0, rateOverride: void 0 };
      const priced = applyFees({ ...emptyStore(), lessons: [whole] }, whole.studentId, whole.date.slice(0, 7), period.assignments, period.merges || []).lessons[0];
      const total2 = estimatedCharge(priced);
      if (total2 !== null && total2 > 0 && Number.isSafeInteger(total2) && !priced.automaticFeeConflict) {
        values = /* @__PURE__ */ new Set([total2]);
        scopedSource = priced.scopedFee?.scope;
      }
    }
    if (values?.size !== 1) continue;
    const total = [...values][0];
    if (s.rows.every((l) => estimatedCharge(l) !== null) && s.rows.reduce((sum, l) => sum + estimatedCharge(l), 0) === total * s.rows.reduce((n, l) => n + (l.billMinutes || 0), 0) / minutes) continue;
    let elapsed = 0, allocated = 0;
    const projected = s.rows.map((l) => {
      elapsed += actualLessonMinutes(l);
      const cumulative = Math.round(total * elapsed / minutes), amount = cumulative - allocated;
      allocated = cumulative;
      return { ...l, ...scopedSource ? { feeAllocation: { agreementId: scopedSource.agreementId, scope: scopedSource, sessionId: "session:" + s.key, sourceIds: s.rows.map((r) => r.id), amount, minutes: actualLessonMinutes(l), snapshot: Object.fromEntries(["date", "start", "end", "className", "teacher"].map((k) => [k, String(l[k])])) } } : {}, rate: amount, rateUnit: "perClass", reviewed: false, automaticFeeApplied: true, feeProjection: { ...l.feeProjection || { rate: l.rate, rateUnit: l.rateUnit, reviewed: l.reviewed }, sourceType: s.contract ? "contract-session-rate" : "session-course-rate" } };
    });
    if (projected.some((l) => estimatedCharge(l) === null)) continue;
    projected.forEach((l) => replacements.set(l.id, l));
  }
  return rows.map((l) => replacements.get(l.id) || l);
}

// functions/lateBillingRecovery.js
var positiveMinutes = (value) => Number.isInteger(value) && value > 0 && value <= 1440;
function matchingRegularBillMinutes(lesson, rows) {
  if (!lesson || lesson.kind !== "late" || lesson.billMinutes !== null && lesson.billMinutes !== void 0) return null;
  const identity = mergeIdentity(lesson), month = String(lesson.date || "").slice(0, 7);
  if (!identity || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const amounts = new Set((rows || []).filter((row) => {
    const candidate = mergeIdentity(row);
    return row && !row.deletedAt && row.kind === "regular" && row.studentId === lesson.studentId && String(row.date || "").slice(0, 7) === month && candidate && candidate.course === identity.course && candidate.teacher === identity.teacher && candidate.actualMinutes === identity.actualMinutes && positiveMinutes(row.billMinutes);
  }).map((row) => row.billMinutes));
  return amounts.size === 1 && amounts.has(identity.actualMinutes) ? identity.actualMinutes : null;
}

// src/billingTime.ts
function contractMinutes(name) {
  const match = /(?:^|[-\s])(\d+(?:\.\d+)?)\s*h\b/i.exec(name);
  const n = match ? Math.round(Number(match[1]) * 60) : NaN;
  return Number.isSafeInteger(n) && n > 0 && n <= 1440 ? n : null;
}
function automaticBillingTime(rows) {
  const base = rows.map((l) => {
    if (l.billMinutes !== null && l.billMinutes !== void 0) return l;
    const free = ["absence", "cancelMakeup", "lateMakeup", "free"].includes(
      l.kind
    );
    const contract = contractMinutes(l.className);
    const bill = free ? 0 : l.kind === "regular" || l.kind === "absenceMakeup" ? l.sourceMinutes : l.kind === "cancel" ? contract ?? l.sourceMinutes : null;
    return bill === null ? l : { ...l, billMinutes: bill, autoBill: true };
  });
  const used = /* @__PURE__ */ new Set();
  return base.map((l) => {
    if (l.billMinutes !== null && l.billMinutes !== void 0 || l.kind !== "late") return l;
    const contract = contractMinutes(l.className);
    const inferred = contract === null ? matchingRegularBillMinutes(l, base) : null;
    const total = contract ?? inferred;
    if (total === null) return l;
    const identity = inferred === null ? null : mergeIdentity(l);
    const key = identity ? JSON.stringify([l.studentId, l.date, identity.course, identity.teacher, identity.actualMinutes]) : JSON.stringify([l.studentId, l.date, l.className, l.teacher]);
    const allocated = base.filter(
      (x) => x.studentId === l.studentId && x.date === l.date && (identity ? (() => {
        const candidate = mergeIdentity(x);
        return candidate && candidate.course === identity.course && candidate.teacher === identity.teacher && candidate.actualMinutes === identity.actualMinutes;
      })() : x.className === l.className && x.teacher === l.teacher)
    ).reduce((s, x) => s + (x.billMinutes ?? 0), 0);
    const minutes = used.has(key) ? 0 : Math.max(0, total - allocated);
    used.add(key);
    return { ...l, billMinutes: minutes, autoBill: true };
  });
}

// src/feeReview.ts
function projectedFeeRows(lessons, students, data, month, decisions = {}) {
  const normalized = lessons.map((lesson) => {
    const student = students.find((s) => s.id === lesson.studentId || s.canonicalId === lesson.studentId);
    return { ...lesson, studentId: student?.id || lesson.studentId };
  });
  let projected = removeFeeProjection({ ...emptyStore(), students, lessons: normalized });
  projected = { ...projected, lessons: automaticBillingTime(projected.lessons) };
  const context = (lesson) => {
    const student = students.find((s) => s.id === lesson.studentId || s.canonicalId === lesson.studentId);
    const canonical = student?.canonicalId || student?.id || lesson.studentId;
    const period = data.periods[canonical] || { revision: 0, assignments: [] };
    return { student, canonical, period };
  };
  for (const studentId of new Set(projected.lessons.filter((l) => l.date.startsWith(month + "-")).map((l) => l.studentId))) {
    const { period } = context(projected.lessons.find((l) => l.studentId === studentId));
    projected = applyFees(projected, studentId, month, period.assignments, period.merges || []);
  }
  let rows = applySessionFees(projected.lessons, decisions, students.filter((s) => s.canonicalId).map((s) => s.id), (l) => context(l).period);
  for (const studentId of new Set(rows.map((l) => l.studentId))) {
    const { period } = context(rows.find((l) => l.studentId === studentId));
    rows = applyStudentDiscounts(rows, studentId, month, period.discountPolicy);
  }
  return rows.filter((l) => !l.deletedAt && l.date.startsWith(month + "-")).map((l) => {
    const value = context(l);
    return { lesson: l, student: value.student, canonical: value.canonical, period: value.period, rate: l.rate };
  });
}

// functions/feecalcBilling.generated.js
function lessonClockMinutes2(value, allowEndOfDay = false) {
  if (allowEndOfDay && value === "24:00") return 1440;
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
function lessonTimeSpan2(start, end) {
  const a = lessonClockMinutes2(start), b = lessonClockMinutes2(end, true);
  return a !== null && b !== null && b > a ? b - a : null;
}
var feeClassKey4 = (value) => String(value || "").trim().replace(/\s+/g, "").replace(/-?\d+(?:\.\d+)?h$/i, "").replace(/\(([^)]+)\)/g, "-$1").replace(/개별정규/g, "\uAC1C\uBCC4").replace(/T(?=-|$)/gi, "").replace(/--+/g, "-");
function actualLessonMinutes2(lesson) {
  const normalize = (value) => String(value || "").replace(/^(\d):/, "0$1:");
  const minutes = lessonTimeSpan2(normalize(lesson?.start), normalize(lesson?.end));
  return Number.isInteger(minutes) && minutes > 0 && minutes <= 720 ? minutes : null;
}
function mergeTeacher2(value) {
  return String(value || "").trim().replace(/\s+/g, "").replace(/T$/i, "");
}
function mergeCourse2(lesson) {
  const teacher = mergeTeacher2(lesson?.teacher);
  let value = String(lesson?.className || "").trim();
  if (teacher) {
    const escaped = teacher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    value = value.replace(new RegExp(`\\(${escaped}T?\\)`, "gi"), "").replace(new RegExp(`(?:^|[-\\s])${escaped}T?(?=[-\\s]|$)`, "gi"), "-");
  }
  const course = feeClassKey4(value).replace(/(?:-|\s)?\d+(?:\.\d+)?시간$/i, "").replace(/[\s_]+/g, "-").replace(/--+/g, "-").replace(/^-|-$/g, "");
  return course.replace(/^(국어|영어|수학|과학|사회)(개별|1:1|2:1|3:1)/, "$1-$2");
}
function mergeIdentity2(lesson) {
  const course = mergeCourse2(lesson), teacher = mergeTeacher2(lesson?.teacher);
  const actualMinutes = actualLessonMinutes2(lesson);
  return course && teacher && actualMinutes !== null ? { course, teacher, actualMinutes } : null;
}
function mergeMatches2(merge, lesson) {
  if (merge?.identityVersion === 2) {
    const identity2 = automaticCourseIdentity2(lesson);
    return Boolean(identity2 && identity2.type === merge.type && identity2.teacher === merge.teacher && identity2.actualMinutes === merge.actualMinutes);
  }
  const identity = mergeIdentity2(lesson);
  return Boolean(identity && merge && identity.course === merge.course && identity.teacher === merge.teacher && identity.actualMinutes === merge.actualMinutes && Array.isArray(merge.lessonIds) && merge.lessonIds.includes(lesson.id));
}
function automaticCourseIdentity2(lesson) {
  const teacher = mergeTeacher2(lesson?.teacher);
  const actualMinutes = actualLessonMinutes2(lesson);
  const name = String(lesson?.className || "").replace(/\s*:\s*/g, ":").replace(/개별\s*정규/g, "\uAC1C\uBCC4");
  const ratios = [...new Set(name.match(/\d+:\d+/g) || [])];
  const special = [.../* @__PURE__ */ new Set([...name.match(/특강|컨설팅|수행평가|그룹|보충|자습/g) || [], ...lesson.kind === "special" ? ["\uD2B9\uAC15"] : []])].sort();
  if (ratios.length > 1) return null;
  const base = lesson.singleIndividual ? "1\uBA85\uAC1C\uBCC4" : ratios[0] || (/1명개별/.test(name) ? "1\uBA85\uAC1C\uBCC4" : /개별/.test(name) ? "\uAC1C\uBCC4" : /정규/.test(name) ? "\uC815\uADDC" : "");
  const type = [base, ...special].filter(Boolean).join("\xB7");
  if (!teacher || /^(미입력|미정|강사미상|없음|-)$/i.test(teacher) || !type || actualMinutes === null) return null;
  return { teacher, type, actualMinutes };
}
function automaticCourseKey2(lesson) {
  const identity = automaticCourseIdentity2(lesson);
  const month = String(lesson?.date || "").slice(0, 7);
  return identity && lesson?.studentId && /^20\d{2}-(0[1-9]|1[0-2])$/.test(month) ? JSON.stringify([lesson.studentId, month, identity.teacher, identity.type, identity.actualMinutes]) : "";
}
function compatibleSessionAttendance2(a, b) {
  const segments = ["regular", "late", "cancel", "absence"];
  return segments.includes(a) && segments.includes(b);
}
function scopeMatches2(scope, lesson) {
  if (scope?.protectedThrough && lesson.date <= scope.protectedThrough) return false;
  if (scope?.protectedLessonIds?.includes(lesson.id)) return false;
  if (!scope || scope.version !== 1 || scope.studentId !== lesson.studentId || lesson.date < scope.effectiveFrom || scope.effectiveThrough && lesson.date > scope.effectiveThrough) return false;
  if (scope.allocation) return Object.entries(scope.allocation.snapshot).every(([k, v]) => lesson[k] === v);
  const identity = automaticCourseIdentity2(lesson);
  if (!identity || ["teacher", "type", "actualMinutes"].some((k) => identity[k] !== scope.identity[k]) || mergeCourse2(lesson) !== scope.identity.course) return false;
  return scope.scope !== "occurrence" || scope.lessonId === lesson.id && Object.entries(scope.snapshot).every(([k, v]) => lesson[k] === v);
}
function scopedAmount2(scope, lesson) {
  if (!scopeMatches2(scope, lesson)) return null;
  if (["absence", "cancelMakeup", "lateMakeup", "free", "study"].includes(lesson.kind)) return 0;
  const minutes = lesson.kind === "cancel" ? scope.allocation?.minutes ?? scope.identity.actualMinutes : lesson.billMinutes;
  if (!Number.isSafeInteger(minutes) || minutes < 0) return null;
  if (scope.allocation) return minutes > 0 ? scope.allocation.amount : 0;
  return scope.rateUnit === "perClass" ? minutes > 0 ? scope.amount : 0 : Math.round(scope.amount * minutes / 60);
}
function selectFeeScope2(assignments, lesson) {
  const scopes = assignments.map((a) => a.feeScope).filter(Boolean);
  const local = scopes.filter((s) => s.scope === "occurrence" && s.lessonId === lesson.id && s.studentId === lesson.studentId);
  if (local.length) return { scope: local[0], review: local.length !== 1 || !!local[0].withdrawn || !scopeMatches2(local[0], lesson) };
  const applied = scopes.filter((s) => (s.applications || []).some((r) => r.lessonId === lesson.id));
  if (applied.length) {
    const s = applied[0], record = s.applications.find((r) => r.lessonId === lesson.id);
    const basis = { ...record.scope || s, studentId: s.studentId, agreementId: s.agreementId };
    const effective = record.allocation ? { ...basis, allocation: record.allocation } : basis;
    return { scope: effective, review: applied.length !== 1 || !!s.withdrawn || !scopeMatches2(effective, lesson) || Object.entries(record.snapshot).some(([k, v]) => lesson[k] !== v) };
  }
  const matches = scopes.filter((s) => s.scope !== "occurrence" && !s.withdrawn && scopeMatches2(s, lesson));
  if (matches.length) return { scope: matches[0], review: matches.length !== 1 };
  const changed2 = scopes.find((s) => s.lessonId === lesson.id && s.studentId === lesson.studentId && !(s.protectedThrough && lesson.date <= s.protectedThrough) && !s.protectedLessonIds?.includes(lesson.id));
  return changed2 ? { scope: changed2, review: true } : null;
}
function reusableLegacyEvidence2(lesson) {
  return !lesson.feeAllocation && !lesson.feeScopeIsolation && !lesson.scopedFee && !lesson.billingDecision && lesson.feeProjection?.sourceType !== "scoped-fee";
}
function attendanceIdentity2(status) {
  return status === "\uB2F9\uCDE8\uBCF4\uCDA9" ? "\uBCF4\uCDA9" : status;
}
var emptyStore2 = () => ({
  students: [],
  lessons: [],
  payments: [],
  paymentChecks: [],
  batches: [],
  demo: false
});
function medicalAbsenceWaived2(l) {
  return !!l.medicalAbsence && l.kind === "absence" && l.billMinutes === 0 && l.payMinutes === 0;
}
function accessCharge2(l) {
  if (medicalAbsenceWaived2(l)) return 0;
  if (l.singleIndividual) return null;
  if (["student-special-rate", "bulk-fee-override", "daily-fee-override", "session-course-rate", "contract-session-rate"].includes(l.feeProjection?.sourceType || "")) return null;
  return l.source === "access-history" && l.access?.billingAuthoritative === true && typeof l.access.amount === "number" && Number.isFinite(l.access.amount) && l.access.amount >= 0 ? Math.round(l.access.amount * 100) / 100 : null;
}
function charge2(l) {
  if (l.scopedFee?.review) return null;
  if (l.scopedFee && !l.studentDiscount) return scopedAmount2(l.scopedFee.scope, l);
  if (l.studentDiscount) {
    const { studentDiscount, ...base } = l;
    return charge2(base) === null ? null : studentDiscount.amount;
  }
  if (medicalAbsenceWaived2(l)) return 0;
  const original = accessCharge2(l);
  if (l.reviewed && original !== null) return original;
  if (!l.reviewed || l.rate === null || !Number.isSafeInteger(l.rate) || l.rate < 0 || l.rateUnit !== void 0 && !["perHour", "perClass"].includes(l.rateUnit) || l.billMinutes === null || !Number.isInteger(l.billMinutes) || l.billMinutes < 0 || l.payMinutes === null || !Number.isInteger(l.payMinutes) || l.payMinutes < 0)
    return null;
  if (["absence", "cancelMakeup", "lateMakeup", "free"].includes(l.kind) && l.billMinutes !== 0)
    return null;
  if (["absence", "cancel"].includes(l.kind) && l.payMinutes !== 0) return null;
  if (l.rateUnit === "perClass") return l.billMinutes > 0 ? l.rate : 0;
  const result = (BigInt(l.rate) * BigInt(l.billMinutes) + 30n) / 60n;
  return result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : null;
}
function estimatedCharge2(l) {
  if (l.deletedAt) return 0;
  if (l.scopedFee?.review) return null;
  if (l.scopedFee && !l.studentDiscount) return scopedAmount2(l.scopedFee.scope, l);
  if (l.studentDiscount) {
    const { studentDiscount, ...base } = l;
    return estimatedCharge2(base) === null ? null : studentDiscount.amount;
  }
  const original = accessCharge2(l);
  if (original !== null) return original;
  if (l.reviewed) return charge2(l);
  if (l.feeProjection?.sourceType !== "daily-fee-override" && ["regular", "late"].includes(l.kind) && /(?:당취|당일\s*취소)[\s\S]*(?:보충|보강)|(?:보충|보강)[\s\S]*(?:당취|당일\s*취소)/.test(l.note || "")) return null;
  const free = ["absence", "cancelMakeup", "lateMakeup", "free"].includes(l.kind);
  const billingMemo = /할인|무료|면제|환불|차감|추가\s*청구|금액|수강료|단가|청구|조퇴|단축|연장|시간\s*(?:변경|확인)|미납|미정/.test(l.note || "");
  const cancellationMemoException = /할인|무료|면제|환불|차감|추가|금액|수강료|단가|청구|조퇴|단축|연장|시간\s*(?:변경|확인)|미납|미정|중복|이중|미청구|취소\s*(?:아님|아니)/.test(l.note || "");
  const settledCancellation = l.kind === "cancel" && l.payMinutes === 0 && typeof l.billMinutes === "number" && l.billMinutes > 0 && Number.isInteger(l.billMinutes) && typeof l.rate === "number" && Number.isSafeInteger(l.rate) && l.rate > 0 && !l.automaticFeeConflict && !cancellationMemoException;
  const settledLate = l.kind === "late" && typeof l.rate === "number" && l.rate > 0 && Number.isSafeInteger(l.rate) && typeof l.billMinutes === "number" && l.billMinutes > 0 && Number.isInteger(l.billMinutes) && !l.automaticFeeConflict && !billingMemo;
  const safeWarnings = (l.warnings || []).every((w) => settledLate && w === "\uCD9C\uACB0 \uC9C0\uAC01: \uCCAD\uAD6C \uAE30\uC900 \uD655\uC778" || settledCancellation && ["\uCD9C\uACB0 \uB2F9\uC77C\uCDE8\uC18C: \uCCAD\uAD6C \uAE30\uC900 \uD655\uC778", "\uD2B9\uC774\uC0AC\uD56D \uD655\uC778"].includes(w) || w === "\uCD9C\uACB0 \uB2F9\uC77C\uCDE8\uC18C: \uCCAD\uAD6C \uAE30\uC900 \uD655\uC778" && l.kind === "cancel" && ["session-course-rate", "contract-session-rate", "student-special-rate"].includes(l.feeProjection?.sourceType || "") || w === "\uCD9C\uACB0 \uACB0\uC11D\uC608\uACE0: \uCCAD\uAD6C \uAE30\uC900 \uD655\uC778" && l.kind === "absence" && l.billMinutes === 0 && l.payMinutes === 0 && ["session-course-rate", "contract-session-rate"].includes(l.feeProjection?.sourceType || "") || w === "\uD2B9\uC774\uC0AC\uD56D \uD655\uC778" && (!billingMemo || ["session-course-rate", "contract-session-rate"].includes(l.feeProjection?.sourceType || "") && /(?:지각|당일취소|당취|결석예고)\s*확인\s*중/.test(l.note || "") && !/할인|무료|면제|환불|차감|추가\s*청구|금액|수강료|단가|청구|결석|취소|보강|보충|조퇴|단축|연장|시간\s*(?:변경|확인)|미납|미정/.test((l.note || "").replace(/(?:지각|당일취소|당취|결석예고)\s*확인\s*중/g, "")) || l.feeProjection?.sourceType === "student-special-rate" && /할인/.test(l.note || "") && !/무료|면제|환불|차감|추가|결석|취소|당취|보강|보충|조퇴|단축|연장|확인|미정/.test(l.note || "")) || w === "\uAC19\uC740 \uC774\uB984\uC758 \uD559\uAD50 \uAC12\uC774 \uB2E4\uB985\uB2C8\uB2E4. \uD559\uC0DD \uC5F0\uACB0 \uD655\uC778" || w === "\uACFC\uAC70 \uAC15\uC0AC \uD3EC\uD138 \uC6D0\uBCF8 \xB7 \uB2E8\uAC00\uC640 \uCCAD\uAD6C \uAE30\uC900 \uBBF8\uC774\uAD00" || w === "\uC804\uCCB4 \uD559\uC0DD \uC911 \uC720\uC77C\uD55C \uC774\uB984\uC73C\uB85C \uC5F0\uACB0 \xB7 \uC6D0\uBCF8 \uD559\uAD50 \uB300\uC870 \uAD8C\uC7A5");
  if (!safeWarnings && !["bulk-fee-override", "daily-fee-override"].includes(l.feeProjection?.sourceType || "") || l.kind === "study") return null;
  return charge2({
    ...l,
    reviewed: true,
    payMinutes: 0,
    ...free ? { rate: 0, rateUnit: "perHour" } : {}
  });
}
function automaticCourseFees2(rows, studentId, month) {
  const individualKey = (row) => {
    const identity = automaticCourseIdentity2(row);
    return identity?.type === "\uAC1C\uBCC4" ? JSON.stringify(["student-individual", row.studentId, row.date.slice(0, 7), identity.actualMinutes]) : "";
  };
  const exactKey = (row) => JSON.stringify(["exact", automaticCourseKey2(row), mergeCourse2(row)]);
  const groups = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const key = automaticCourseKey2(row);
    if (!key || row.deletedAt || row.studentId !== studentId || !row.date.startsWith(month)) continue;
    groups.set(key, [...groups.get(key) || [], row]);
    const exact = exactKey(row);
    groups.set(exact, [...groups.get(exact) || [], row]);
    const shared = individualKey(row);
    if (shared) groups.set(shared, [...groups.get(shared) || [], row]);
  }
  const resolved = /* @__PURE__ */ new Map();
  for (const [key, members] of groups) {
    const full = members.filter((row) => ["regular", "late", "cancel"].includes(row.kind) && row.billMinutes !== null && row.billMinutes > 0 && row.billMinutes === actualLessonMinutes2(row));
    const evidence = full.filter((row) => reusableLegacyEvidence2(row) && row.kind === "regular" && !Number(row.access?.discount || 0) && !/할인|무료|금액\s*예외|보강|보충/.test([row.note, row.reason].join(" "))).map(estimatedCharge2).filter((value) => value !== null);
    const amounts = [...new Set(evidence)];
    resolved.set(key, { count: evidence.length, amount: amounts.length === 1 && Number.isSafeInteger(amounts[0]) && amounts[0] > 0 ? amounts[0] : void 0, conflict: amounts.length > 1 });
  }
  return rows.map((row) => {
    if (row.studentId !== studentId || !row.date.startsWith(month)) return row;
    if (!reusableLegacyEvidence2(row)) return row;
    let own = resolved.get(automaticCourseKey2(row));
    if (own?.conflict && row.rate == null) {
      const earlier = (groups.get(exactKey(row)) || []).filter((l) => reusableLegacyEvidence2(l) && l.date < row.date && l.kind === "regular" && l.billMinutes === actualLessonMinutes2(l) && !l.deletedAt && !Number(l.access?.discount || 0) && !/할인|무료|금액\s*예외|보강|보충/.test([l.note, l.reason].join(" ")));
      const amounts = earlier.map(estimatedCharge2).filter((v) => v !== null);
      if (amounts.length >= 2 && new Set(amounts).size === 1 && Number.isSafeInteger(amounts[0]) && amounts[0] > 0) own = { amount: amounts[0], conflict: false, count: amounts.length };
    }
    const shared = resolved.get(individualKey(row));
    const value = own?.conflict || own?.amount !== void 0 ? own : row.rate == null && shared?.amount !== void 0 && !shared.conflict ? shared : own;
    if (!value || row.deletedAt) return row;
    if (value.conflict) return { ...row, automaticFeeConflict: true };
    if (value.amount === void 0 || estimatedCharge2(row) !== null || !["regular", "late", "cancel"].includes(row.kind) || row.billMinutes === null || row.billMinutes <= 0 || row.billMinutes !== actualLessonMinutes2(row) || Number(row.access?.discount || 0) !== 0 || /할인|무료|금액\s*예외/.test([row.note, row.reason].join(" ")) || row.rateOverride !== void 0 || accessCharge2(row) !== null) return row;
    return {
      ...row,
      rate: value.amount,
      rateUnit: "perClass",
      reviewed: false,
      automaticFeeApplied: true,
      feeProjection: row.feeProjection || { rate: row.rate, rateUnit: row.rateUnit, reviewed: row.reviewed, sourceType: "automatic-course-rate" }
    };
  });
}
function historicalAssignmentMatches2(assignment, lesson) {
  if (assignment?.bulkMerge === true) {
    const snapshot2 = assignment.lessonSnapshot;
    if (!snapshot2 || !lesson || lesson.deletedAt) return false;
    const identity = (value) => {
      const minutes = lessonTimeSpan2(value?.start, value?.end);
      if (minutes === null) return "";
      const teacher = String(value?.teacher || "").trim().replace(/\s+/g, "").replace(/T$/i, "");
      const course = String(value?.className || "").trim().replace(/\s+/g, "").replace(/-?\d+(?:\.\d+)?h$/i, "").replace(/(?:-|\s)?\d+(?:\.\d+)?시간$/i, "").replace(/개별정규/g, "\uAC1C\uBCC4");
      return minutes > 0 && teacher && course ? `${course}|${teacher}|${minutes}` : "";
    };
    return identity(snapshot2) === identity(lesson);
  }
  if (assignment?.sourceType !== "historical-recovery") return true;
  const snapshot = assignment.lessonSnapshot;
  if (!snapshot || !lesson || lesson.deletedAt) return false;
  return ["date", "start", "end", "kind", "className", "teacher", "billMinutes"].every(
    (key) => snapshot[key] !== void 0 && snapshot[key] === lesson[key]
  );
}
function importedClassDurationMatches2(assignment, lesson) {
  if (!/개별/.test(lesson?.className || "") || /\d+\s*:\s*\d+/.test(lesson?.className || "")) return true;
  const evidence = assignment?.evidence;
  if (!Array.isArray(evidence) || !evidence.length || !evidence.every((e) => e.unit === "perClass" && e.hours > 0)) return true;
  if (lesson?.singleIndividual || lesson?.kind !== "regular" || /1\s*명\s*개별|보충|보강|할인|형제|무료/.test([lesson?.className, lesson?.note, lesson?.reason].join(" "))) return true;
  const clock = (value) => /^\d{2}:\d{2}$/.test(value || "") ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN;
  const minutes = clock(lesson?.end) - clock(lesson?.start);
  if (!(minutes > 0) || lesson?.billMinutes !== minutes) return true;
  if (assignment.amount === 28125 && evidence.some((e) => e.hours !== 4 && Math.abs(e.rate / e.hours - 28125) < 0.01)) return true;
  return evidence.some((e) => e.hours * 60 === minutes);
}
var classKey2 = (lesson) => {
  const teacher = mergeTeacher2(lesson?.teacher);
  const course = mergeCourse2(lesson);
  return course && teacher ? `${course}|${teacher}` : "";
};
var exceptional2 = (lesson) => /할인|형제|무료|보강|보충|금액\s*(?:예외|조정|할인)|시간\s*(?:책정|조정)/.test(
  [lesson?.note, lesson?.reason, ...lesson?.warnings || []].filter(Boolean).join(" ")
);
var validAmount2 = (amount) => Number.isSafeInteger(amount) && amount > 0 && amount <= 1e7;
function accessEvidence2(lesson) {
  if (lesson?.source !== "access-history" || lesson?.access?.billingAuthoritative !== true || Number(lesson.access.discount || 0) !== 0)
    return null;
  const amount = Number(lesson.access.amount);
  return validAmount2(amount) ? { amount, rateUnit: "perClass", total: amount, source: "access" } : null;
}
function pricedEvidence2(lesson, rateFor) {
  const value = rateFor?.(lesson);
  if (value?.preferOverAccess) return rateEvidence2(value, lesson);
  const access = accessEvidence2(lesson);
  if (access) return access;
  return rateEvidence2(value, lesson);
}
function rateEvidence2(value, lesson) {
  const amount = Number(value?.amount), rateUnit = value?.rateUnit || "perHour";
  if (!validAmount2(amount) || !["perHour", "perClass"].includes(rateUnit)) return null;
  const total = rateUnit === "perClass" ? amount : amount * lesson.billMinutes / 60;
  return Number.isSafeInteger(total) && total > 0 ? { amount, rateUnit, total, source: "rate" } : null;
}
function lateRegularRateCandidate2(lesson, rows, rateFor = () => null) {
  if (!lesson || lesson.kind !== "late" || !Number.isInteger(lesson.billMinutes) || lesson.billMinutes <= 0 || exceptional2(lesson)) return null;
  const month = String(lesson.date || "").slice(0, 7), key = classKey2(lesson);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || !key) return null;
  const regulars = (rows || []).filter((row) => row && !row.deletedAt && row.kind === "regular" && row.studentId === lesson.studentId && String(row.date || "").slice(0, 7) === month && row.billMinutes === lesson.billMinutes && classKey2(row) === key);
  if (!regulars.length || regulars.some(exceptional2)) return null;
  const evidence = regulars.map((row) => pricedEvidence2(row, rateFor));
  if (evidence.some((value) => !value) || new Set(evidence.map((value) => value.total)).size !== 1) return null;
  const access = evidence.filter((value) => value.source === "access");
  if (access.length) return { amount: access[0].total, rateUnit: "perClass", source: "same-month-access-regular", evidenceCount: evidence.length };
  const signatures = new Set(evidence.map((value) => `${value.amount}|${value.rateUnit}`));
  return signatures.size === 1 ? { amount: evidence[0].amount, rateUnit: evidence[0].rateUnit, source: "same-month-regular-rate", evidenceCount: evidence.length } : null;
}
function classLabel2(name, teacher = "") {
  let value = name.trim();
  const person = teacher.trim().replace(/T$/i, "");
  if (!person) return value;
  const escaped = person.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  value = value.replace(new RegExp(`\\(${escaped}T?\\)`, "g"), `-${person}T`);
  value = value.replace(
    new RegExp(`-${escaped}(?:T)?(?=-|$)`, "g"),
    `-${person}T`
  );
  if (!value.includes(`${person}T`)) {
    value = /-\d+(?:\.\d+)?h$/i.test(value) ? value.replace(/(-\d+(?:\.\d+)?h)$/i, `-${person}T$1`) : `${value}-${person}T`;
  }
  return value.replace(/T(?=\d+(?:\.\d+)?h$)/i, "T-").replace(/--+/g, "-");
}
var feeClassKey22 = (value) => value.trim().replace(/\s+/g, "").replace(/-?\d+(?:\.\d+)?h$/i, "").replace(/\(([^)]+)\)/g, "-$1").replace(/개별정규/g, "\uAC1C\uBCC4").replace(/T(?=-|$)/gi, "").replace(/--+/g, "-");
var feeAssignment2 = (rows, lesson) => rows.find((a) => !a.feeScope && a.kind === "lesson" && a.target === lesson.id && historicalAssignmentMatches2(a, lesson)) || rows.find(
  (a) => !a.feeScope && a.kind === "class" && lesson.kind !== "special" && importedClassDurationMatches2(a, lesson) && (a.durationHours === void 0 || Number(lesson.className.match(/(\d+(?:\.\d+)?)h$/i)?.[1]) === a.durationHours && lesson.billMinutes === a.durationHours * 60) && feeClassKey22(a.target) === feeClassKey22(classLabel2(lesson.className, lesson.teacher))
);
function applyFees2(store, studentId, month, assignments, merges = []) {
  const scopedAssignments = assignments.map((a) => a.feeScope ? { ...a, feeScope: { ...a.feeScope, studentId } } : a);
  const defaults = merges.filter((row) => row.sourceType === "prior-confirmed-rate");
  const explicit = merges.filter((row) => row.sourceType !== "prior-confirmed-rate");
  return {
    ...store,
    lessons: automaticCourseFees2(store.lessons.map((l) => {
      const { feeGroupId: _feeGroupId, automaticFeeApplied: _automatic, automaticFeeConflict: _conflict, ...base } = l;
      if (base.studentId !== studentId || !base.date.startsWith(month)) return l;
      const scoped = selectFeeScope2(scopedAssignments, base);
      if (scoped && (scoped.review || scoped.scope.scope === "occurrence" || base.rate === null && base.rateOverride === void 0 && !(base.source === "access-history" && base.access?.billingAuthoritative))) {
        return {
          ...base,
          studentDiscount: void 0,
          scopedFee: scoped,
          automaticFeeConflict: scoped.review,
          rate: scoped.scope.amount,
          rateUnit: scoped.scope.rateUnit,
          reviewed: false,
          feeProjection: base.feeProjection || { rate: base.rate, rateUnit: base.rateUnit, reviewed: base.reviewed, sourceType: "scoped-fee" }
        };
      }
      if (l.singleIndividual) return l;
      const merge = explicit.find((row) => mergeMatches2(row, base));
      const grouped = merge ? { ...base, feeGroupId: merge.id, ...merge.scope === "month" ? { feeScopeIsolation: true } : {} } : base;
      if (["absence", "cancelMakeup", "lateMakeup", "free"].includes(grouped.kind)) {
        const savedZeroOverride = grouped.rateOverride === 0 && grouped.rate === 0 && grouped.billMinutes === 0;
        return merge || savedZeroOverride ? {
          ...grouped,
          feeProjection: grouped.feeProjection || {
            rate: grouped.rate,
            reviewed: grouped.reviewed,
            rateUnit: grouped.rateUnit,
            sourceType: savedZeroOverride ? "daily-fee-override" : "bulk-fee-override"
          }
        } : grouped;
      }
      const a = (merge ? void 0 : feeAssignment2(assignments, grouped)) || (merge ? {
        kind: "lesson",
        target: grouped.id,
        rateId: merge.id,
        amount: merge.amount,
        rateUnit: merge.rateUnit,
        label: merge.course,
        updatedBy: merge.updatedBy,
        updatedAt: merge.updatedAt,
        sourceType: "bulk-fee-override"
      } : void 0);
      const dailyOverride = grouped.rateOverride;
      const activeDailyOverride = typeof dailyOverride === "number" && Number.isSafeInteger(dailyOverride) && dailyOverride >= 0 && grouped.rate === dailyOverride && (!a || grouped.rateOverrideAgainst === (a.updatedAt || ""));
      if (grouped.source === "access-history" && grouped.access?.billingAuthoritative && activeDailyOverride) {
        return {
          ...grouped,
          feeProjection: grouped.feeProjection || {
            rate: grouped.rate,
            reviewed: grouped.reviewed,
            rateUnit: grouped.rateUnit,
            sourceType: "daily-fee-override"
          }
        };
      }
      if (grouped.source === "access-history" && grouped.access?.billingAuthoritative && a?.sourceType !== "bulk-fee-override") return grouped;
      if (grouped.rateOverride !== void 0 && !merge && (!a || a.updatedAt === (grouped.rateOverrideAgainst || "")))
        return { ...grouped, rate: grouped.rateOverride };
      if (!a && grouped.kind === "late") {
        const recovered = lateRegularRateCandidate2(grouped, store.lessons, (row) => {
          if (!reusableLegacyEvidence2(row) || selectFeeScope2(scopedAssignments, row)) return null;
          const rowAssignment = feeAssignment2(assignments, row);
          const override = row.rateOverride;
          const activeOverride = typeof override === "number" && Number.isSafeInteger(override) && override >= 0 && (!rowAssignment || rowAssignment.updatedAt === (row.rateOverrideAgainst || ""));
          if (activeOverride) return { amount: override, rateUnit: row.rateUnit || "perHour", preferOverAccess: true };
          if (rowAssignment) return {
            amount: rowAssignment.amount,
            rateUnit: rowAssignment.rateUnit || "perHour",
            preferOverAccess: rowAssignment.sourceType === "bulk-fee-override"
          };
          const amount = row.rate;
          return typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0 ? { amount, rateUnit: row.rateUnit || "perHour" } : null;
        });
        if (recovered) return {
          ...grouped,
          feeProjection: grouped.feeProjection || {
            rate: grouped.rate,
            reviewed: grouped.reviewed,
            rateUnit: grouped.rateUnit,
            sourceType: "late-regular-recovery"
          },
          rate: recovered.amount,
          rateUnit: recovered.rateUnit,
          reviewed: false
        };
      }
      if (!a) return grouped;
      return {
        ...grouped,
        feeProjection: grouped.feeProjection || {
          rate: grouped.rate,
          reviewed: grouped.reviewed,
          rateUnit: grouped.rateUnit,
          ...a.sourceType ? { sourceType: a.sourceType } : {}
        },
        rate: a.amount,
        rateUnit: a.rateUnit || "perHour",
        reviewed: false
      };
    }), studentId, month).map((row) => {
      if (row.studentId !== studentId || !row.date.startsWith(month) || row.deletedAt || row.scopedFee || row.singleIndividual || row.rateOverride !== void 0 || row.automaticFeeConflict || estimatedCharge2(row) !== null || row.rate !== null || !["regular", "late", "cancel", "special", "absenceMakeup"].includes(row.kind) || row.billMinutes !== actualLessonMinutes2(row) || !row.billMinutes || Number(row.access?.discount || 0) || /할인|무료|면제|환불|차감|금액\s*예외|일회성|이번만/.test([row.note, row.reason].join(" ")))
        return row;
      const prior = defaults.find((value) => mergeMatches2(value, row));
      if (!prior) return row;
      if (prior.conflict) return { ...row, automaticFeeConflict: true };
      if (!Number.isSafeInteger(prior.amount) || prior.amount <= 0) return row;
      return {
        ...row,
        rate: prior.amount,
        rateUnit: "perClass",
        reviewed: false,
        automaticFeeApplied: true,
        feeProjection: row.feeProjection || { rate: row.rate, rateUnit: row.rateUnit, reviewed: row.reviewed, sourceType: "prior-confirmed-rate" }
      };
    })
  };
}
function applyFeePeriods(store, studentId, periods) {
  return Object.entries(periods).reduce((next, [month, period]) => applyFees2(next, studentId, month, period.assignments, period.merges || []), store);
}
var discountCourseKey2 = (l) => {
  const i = automaticCourseIdentity2(l);
  return i ? JSON.stringify([i.teacher, i.type, mergeCourse2(l)]) : "";
};
function applyStudentDiscounts2(rows, studentId, month, policy) {
  if (!policy || policy.month > month) return rows;
  return rows.map((l) => {
    if (l.studentId !== studentId || !l.date.startsWith(month) || l.deletedAt) return l;
    if (l.scopedFee?.review || l.scopedFee?.scope.valueMode === "final") {
      const { studentDiscount, ...clean } = l;
      return clean;
    }
    const { studentDiscount: old, ...base } = l;
    let priced = base;
    const identity = automaticCourseIdentity2(base);
    const special = policy.specialHourly !== null && identity?.type === "\uAC1C\uBCC4" && !base.singleIndividual && ["regular", "late", "cancel", "absence", "cancelMakeup", "absenceMakeup", "lateMakeup", "free"].includes(base.kind);
    if (base.scopedFee) {
      const amount2 = estimatedCharge2(base), course2 = policy.courses.find((c) => c.key === discountCourseKey2(base)), percent2 = course2?.percent ?? policy.percent;
      if (amount2 === null || amount2 === 0) return base;
      const minutes = base.kind === "cancel" ? base.scopedFee.scope.allocation?.minutes ?? base.scopedFee.scope.identity.actualMinutes : base.billMinutes;
      const discountBase = special && minutes !== null ? Math.round(policy.specialHourly * minutes / 60) : amount2;
      return { ...base, studentDiscount: { base: amount2, amount: Math.round(discountBase * (100 - percent2) / 100), percent: percent2, reason: course2?.reason || policy.reason, month: policy.month, special } };
    }
    if (special) {
      priced = { ...base, automaticFeeConflict: false, rate: policy.specialHourly, rateUnit: "perHour", reviewed: false, feeGroupId: base.feeGroupId || "student-special", feeProjection: { ...base.feeProjection || { rate: base.rate, rateUnit: base.rateUnit, reviewed: base.reviewed }, sourceType: ["absence", "cancelMakeup", "lateMakeup", "free"].includes(base.kind) ? "bulk-fee-override" : "student-special-rate" } };
    }
    const amount = estimatedCharge2(priced), course = policy.courses.find((c) => c.key === discountCourseKey2(base)), percent = course?.percent ?? policy.percent;
    if (amount === null || amount === 0 || !special && percent === 0) return priced;
    const result = Math.round(amount * (100 - percent) / 100);
    return { ...priced, studentDiscount: { base: amount, amount: result, percent, reason: course?.reason || policy.reason, month: policy.month, special } };
  });
}
var positiveMinutes2 = (value) => Number.isInteger(value) && value > 0 && value <= 1440;
function matchingRegularBillMinutes2(lesson, rows) {
  if (!lesson || lesson.kind !== "late" || lesson.billMinutes !== null && lesson.billMinutes !== void 0) return null;
  const identity = mergeIdentity2(lesson), month = String(lesson.date || "").slice(0, 7);
  if (!identity || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const amounts = new Set((rows || []).filter((row) => {
    const candidate = mergeIdentity2(row);
    return row && !row.deletedAt && row.kind === "regular" && row.studentId === lesson.studentId && String(row.date || "").slice(0, 7) === month && candidate && candidate.course === identity.course && candidate.teacher === identity.teacher && candidate.actualMinutes === identity.actualMinutes && positiveMinutes2(row.billMinutes);
  }).map((row) => row.billMinutes));
  return amounts.size === 1 && amounts.has(identity.actualMinutes) ? identity.actualMinutes : null;
}
function contractMinutes2(name) {
  const match = /(?:^|[-\s])(\d+(?:\.\d+)?)\s*h\b/i.exec(name);
  const n = match ? Math.round(Number(match[1]) * 60) : NaN;
  return Number.isSafeInteger(n) && n > 0 && n <= 1440 ? n : null;
}
function automaticBillingTime2(rows) {
  const base = rows.map((l) => {
    if (l.billMinutes !== null && l.billMinutes !== void 0) return l;
    const free = ["absence", "cancelMakeup", "lateMakeup", "free"].includes(
      l.kind
    );
    const contract = contractMinutes2(l.className);
    const bill = free ? 0 : l.kind === "regular" || l.kind === "absenceMakeup" ? l.sourceMinutes : l.kind === "cancel" ? contract ?? l.sourceMinutes : null;
    return bill === null ? l : { ...l, billMinutes: bill, autoBill: true };
  });
  const used = /* @__PURE__ */ new Set();
  return base.map((l) => {
    if (l.billMinutes !== null && l.billMinutes !== void 0 || l.kind !== "late") return l;
    const contract = contractMinutes2(l.className);
    const inferred = contract === null ? matchingRegularBillMinutes2(l, base) : null;
    const total = contract ?? inferred;
    if (total === null) return l;
    const identity = inferred === null ? null : mergeIdentity2(l);
    const key = identity ? JSON.stringify([l.studentId, l.date, identity.course, identity.teacher, identity.actualMinutes]) : JSON.stringify([l.studentId, l.date, l.className, l.teacher]);
    const allocated = base.filter(
      (x) => x.studentId === l.studentId && x.date === l.date && (identity ? (() => {
        const candidate = mergeIdentity2(x);
        return candidate && candidate.course === identity.course && candidate.teacher === identity.teacher && candidate.actualMinutes === identity.actualMinutes;
      })() : x.className === l.className && x.teacher === l.teacher)
    ).reduce((s, x) => s + (x.billMinutes ?? 0), 0);
    const minutes = used.has(key) ? 0 : Math.max(0, total - allocated);
    used.add(key);
    return { ...l, billMinutes: minutes, autoBill: true };
  });
}
function continuousLessons2(rows) {
  const buckets = /* @__PURE__ */ new Map();
  for (const row of rows.filter((l) => !l.deletedAt)) {
    const bucketKey = JSON.stringify([row.studentId, row.date, mergeTeacher2(row.teacher), mergeCourse2(row)]);
    const bucket = buckets.get(bucketKey) || [];
    bucket.push(row);
    buckets.set(bucketKey, bucket);
  }
  const groups = [];
  for (const bucket of buckets.values()) {
    const bucketGroups = [];
    for (const row of bucket.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.id.localeCompare(b.id))) {
      const previous = bucketGroups.at(-1), last = previous?.at(-1);
      if (last && compatibleSessionAttendance2(last.kind, row.kind) && last.end === row.start) previous.push(row);
      else bucketGroups.push([row]);
    }
    groups.push(...bucketGroups);
  }
  return groups.map((members) => {
    const safe = members.every((l) => !!automaticCourseIdentity2(l) && l.kind === "regular" && actualLessonMinutes2(l) === l.sourceMinutes && l.billMinutes === l.sourceMinutes && estimatedCharge2(l) !== null && (l.rateUnit || "perHour") === "perHour" && !l.automaticFeeConflict) && new Set(members.map((l) => estimatedCharge2(l) / l.sourceMinutes)).size === 1;
    const key = JSON.stringify(members.map((l) => {
      const source = l.feeProjection ? { ...l, ...l.feeProjection } : l;
      return [source.id, source.studentId, source.date, source.start, source.end, source.className, source.teacher, source.kind, attendanceIdentity2(source.status), source.sourceMinutes, source.billMinutes, source.rate, source.rateUnit || "perHour", source.rateOverride, source.note];
    }));
    const mixedAttendance = new Set(members.map((l) => l.kind)).size > 1;
    return { key, rows: members, ambiguous: members.length > 1 && !safe, reason: !safe ? mixedAttendance ? "\uD55C \uD68C\uCC28\uC758 \uC5EC\uB7EC \uCD9C\uACB0 \uAD6C\uAC04\uC778\uC9C0 \uD655\uC778\uD558\uC138\uC694. \uC6D0\uBCF8 \uCD9C\uACB0\uACFC \uC778\uC815\uC2DC\uC218\uB294 \uC720\uC9C0\uB429\uB2C8\uB2E4." : "\uCD9C\uACB0\xB7\uC2DC\uC218\xB7\uB2E8\uAC00 \uB610\uB294 \uD68C\uB2F9 \uCCAD\uAD6C \uAE30\uC900\uC744 \uD655\uC778\uD558\uC138\uC694." : "" };
  }).sort((a, b) => a.rows[0].studentId.localeCompare(b.rows[0].studentId) || a.rows[0].date.localeCompare(b.rows[0].date) || a.rows[0].start.localeCompare(b.rows[0].start) || a.rows[0].id.localeCompare(b.rows[0].id));
}
function displayedLessonSessions2(rows, decisions) {
  const saved = normalizeSessionDecisions2(decisions);
  const contracts = effectiveContractSessions2(rows, saved), ids = new Set(contracts.flatMap((s) => s.rows.map((l) => l.id)));
  return [...contracts, ...continuousLessons2(rows.filter((l) => !ids.has(l.id))).flatMap((g) => g.rows.length > 1 && saved[g.key] !== "separate" && (!g.ambiguous || saved[g.key] === "group") ? [g] : g.rows.map((row) => ({ key: row.id, rows: [row], ambiguous: false, reason: "" })))].sort((a, b) => a.rows[0].date.localeCompare(b.rows[0].date) || a.rows[0].start.localeCompare(b.rows[0].start));
}
function effectiveContractSessions2(rows, saved) {
  const explicit = contractLessonSessions2(rows), ids = new Set(explicit.flatMap((s) => s.rows.map((l) => l.id)));
  return [...explicit, ...inferredLessonSessions2(rows).filter((s) => s.rows.every((l) => !ids.has(l.id)))].filter((session) => !continuousLessons2(session.rows).some((candidate) => saved[candidate.key] === "separate"));
}
function normalizeSessionKey2(key) {
  try {
    const rows = JSON.parse(key);
    if (!Array.isArray(rows) || !rows.every(Array.isArray)) return key;
    return JSON.stringify(rows.map((r) => {
      const copy = [...r];
      copy[12] ||= "perHour";
      return copy;
    }));
  } catch {
    return key;
  }
}
function normalizeSessionDecisions2(decisions) {
  return Object.fromEntries(Object.entries(decisions).map(([key, value]) => [normalizeSessionKey2(key), value]));
}
function contractLessonSessions2(rows) {
  const buckets = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const match = /(?:-|\s)(\d+(?:\.\d+)?)\s*(?:h|시간)\s*$/i.exec(row.className);
    const minutes = match ? Math.round(Number(match[1]) * 60) : 0, actual = actualLessonMinutes2(row);
    if (row.deletedAt || row.singleIndividual || !minutes || !actual || actual >= minutes || !["regular", "late", "cancel", "absence"].includes(row.kind) || !automaticCourseIdentity2(row)) continue;
    const key = JSON.stringify([row.studentId, row.date, mergeTeacher2(row.teacher), mergeCourse2(row), minutes]);
    const bucket = buckets.get(key) || { minutes, rows: [] };
    bucket.rows.push(row);
    buckets.set(key, bucket);
  }
  const result = [];
  for (const { minutes, rows: members } of buckets.values()) {
    const sorted = [...members].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
    for (let i = 0; i < sorted.length; i++) {
      const group = [sorted[i]];
      let duration = actualLessonMinutes2(sorted[i]);
      for (let j = i + 1; j < sorted.length && duration < minutes; j++) {
        if (group.at(-1).end !== sorted[j].start) break;
        group.push(sorted[j]);
        duration += actualLessonMinutes2(sorted[j]);
      }
      if (group.length > 1 && duration === minutes && new Set(group.map((l) => l.kind)).size > 1) {
        if (rows.some((l) => !group.some((g) => g.id === l.id) && !l.deletedAt && l.studentId === group[0].studentId && l.date === group[0].date && mergeTeacher2(l.teacher) === mergeTeacher2(group[0].teacher) && l.start < group.at(-1).end && l.end > group[0].start)) continue;
        result.push({ key: "contract:" + JSON.stringify(group.map((l) => [l.id, l.start, l.end, l.kind, l.className])), rows: group, ambiguous: false, reason: "\uD55C \uD68C\uCC28\uC758 \uCD9C\uACB0 \uAD6C\uAC04", contract: true });
        i += group.length - 1;
      }
    }
  }
  return result;
}
function inferredLessonSessions2(rows) {
  const exceptional22 = (l) => l.singleIndividual || l.automaticFeeConflict || l.rateOverride !== void 0 || Number(l.access?.discount || 0) !== 0 || /1\s*명|할인|전과목|무료|면제|환불|차감|보강|보충|조퇴|단축|연장|금액\s*예외/.test([l.className, l.note, l.reason].join(" "));
  const candidates = continuousLessons2(rows);
  const evidence = rows.filter((l) => !l.deletedAt && l.kind === "regular" && !exceptional22(l) && l.sourceMinutes === actualLessonMinutes2(l) && l.billMinutes === actualLessonMinutes2(l) && estimatedCharge2(l) !== null && estimatedCharge2(l) > 0 && !["contract-session-rate", "session-course-rate"].includes(l.feeProjection?.sourceType || "") && !rows.some((other) => other.id !== l.id && !other.deletedAt && other.studentId === l.studentId && other.date === l.date && mergeTeacher2(other.teacher) === mergeTeacher2(l.teacher) && other.start <= l.end && other.end >= l.start));
  return candidates.filter((s) => {
    if (s.rows.length < 2 || new Set(s.rows.map((l) => l.kind)).size < 2 || s.rows.some((l) => exceptional22(l) || !["regular", "late", "cancel", "absence"].includes(l.kind) || !automaticCourseIdentity2(l) || !/^(개별|\d+:\d+)$/.test(automaticCourseIdentity2(l).type))) return false;
    const first = s.rows[0], last = s.rows.at(-1), virtual = { ...first, end: last.end }, minutes = actualLessonMinutes2(virtual);
    if (!minutes || s.rows.some((l) => {
      const m = /(?:-|\s)(\d+(?:\.\d+)?)\s*(?:h|시간)\s*$/i.exec(l.className);
      return m && Math.round(Number(m[1]) * 60) !== minutes;
    })) return false;
    if (rows.some((l) => !l.deletedAt && !s.rows.some((r) => r.id === l.id) && l.studentId === first.studentId && l.date === first.date && mergeTeacher2(l.teacher) === mergeTeacher2(first.teacher) && l.start < last.end && l.end > first.start)) return false;
    const matches = evidence.filter((l) => l.date !== first.date && automaticCourseKey2(l) === automaticCourseKey2(virtual) && mergeCourse2(l) === mergeCourse2(first));
    return matches.length > 0 && new Set(matches.map((l) => estimatedCharge2(l))).size === 1;
  }).map((s) => ({ ...s, ambiguous: false, contract: true, reason: "\uAC19\uC740 \uB2EC\uC758 \uB3D9\uC77C \uC218\uC5C5 \uC2DC\uAC04\xB7\uB2E8\uAC00\uB85C \uD655\uC778\uB41C \uD55C \uD68C\uCC28" }));
}
function applySessionFees2(rows, decisions, _linkedStudentIds = [], periodFor) {
  const saved = normalizeSessionDecisions2(decisions), sessions = displayedLessonSessions2(rows, saved);
  const exceptional22 = (l) => !reusableLegacyEvidence2(l) || !!l.singleIndividual || !!l.automaticFeeConflict || Number(l.access?.discount || 0) !== 0 || /1\s*명|할인|전과목|무료|면제|환불|차감|보강|보충|조퇴|단축|연장|금액\s*예외/.test([l.className, l.note, l.reason].join(" "));
  const regular = (l) => !exceptional22(l) && ["regular", "late"].includes(l.kind) && l.billMinutes === actualLessonMinutes2(l) && l.sourceMinutes === actualLessonMinutes2(l) && /^(개별|\d+:\d+)$/.test(automaticCourseIdentity2(l)?.type || "");
  const evidence = /* @__PURE__ */ new Map();
  for (const s of sessions) {
    if (s.rows.length !== 1) continue;
    const l = s.rows[0], amount = estimatedCharge2(l);
    if (l.kind !== "regular" || !regular(l) || amount === null || amount <= 0 || !Number.isSafeInteger(amount)) continue;
    const key = automaticCourseKey2(l);
    const values = evidence.get(key) || /* @__PURE__ */ new Set();
    values.add(amount);
    evidence.set(key, values);
  }
  const replacements = /* @__PURE__ */ new Map();
  for (const s of sessions) {
    const contractPart = (l) => !exceptional22(l) && ["regular", "late", "cancel", "absence"].includes(l.kind) && l.sourceMinutes === actualLessonMinutes2(l) && l.billMinutes === (l.kind === "absence" ? 0 : actualLessonMinutes2(l)) && (!["cancel", "absence"].includes(l.kind) || l.payMinutes === 0) && /^(개별|\d+:\d+)$/.test(automaticCourseIdentity2(l)?.type || "");
    if (s.rows.length === 1 && estimatedCharge2(s.rows[0]) !== null) continue;
    const mixedAttendance = new Set(s.rows.map((l) => l.kind)).size > 1;
    if (s.rows.length > 1 && !s.contract && saved[s.key] !== "group" || !s.rows.every((l) => (s.contract || mixedAttendance || s.rows.length === 1 ? contractPart(l) : regular(l)) && l.rateOverride === void 0 && !["bulk-fee-override", "daily-fee-override"].includes(l.feeProjection?.sourceType || "") && (l.kind === "absence" || estimatedCharge2(l) !== 0))) continue;
    const virtual = { ...s.rows[0], end: s.rows.at(-1).end }, minutes = actualLessonMinutes2(virtual);
    let scopedSource;
    let values = evidence.get(automaticCourseKey2(virtual));
    const period = periodFor?.(virtual);
    if (period?.assignments.some((a) => a.feeScope?.protectedLessonIds?.some((id) => s.rows.some((l) => l.id === id)))) continue;
    if (!values && period && s.rows.length > 1) {
      const whole = { ...virtual, id: "session:" + s.key, kind: "regular", status: "\uCD9C\uC11D", sourceMinutes: minutes, billMinutes: minutes, payMinutes: minutes, rate: null, rateUnit: "perHour", feeProjection: void 0, access: void 0, rateOverride: void 0 };
      const priced = applyFees2({ ...emptyStore2(), lessons: [whole] }, whole.studentId, whole.date.slice(0, 7), period.assignments, period.merges || []).lessons[0];
      const total2 = estimatedCharge2(priced);
      if (total2 !== null && total2 > 0 && Number.isSafeInteger(total2) && !priced.automaticFeeConflict) {
        values = /* @__PURE__ */ new Set([total2]);
        scopedSource = priced.scopedFee?.scope;
      }
    }
    if (values?.size !== 1) continue;
    const total = [...values][0];
    if (s.rows.every((l) => estimatedCharge2(l) !== null) && s.rows.reduce((sum, l) => sum + estimatedCharge2(l), 0) === total * s.rows.reduce((n, l) => n + (l.billMinutes || 0), 0) / minutes) continue;
    let elapsed = 0, allocated = 0;
    const projected = s.rows.map((l) => {
      elapsed += actualLessonMinutes2(l);
      const cumulative = Math.round(total * elapsed / minutes), amount = cumulative - allocated;
      allocated = cumulative;
      return { ...l, ...scopedSource ? { feeAllocation: { agreementId: scopedSource.agreementId, scope: scopedSource, sessionId: "session:" + s.key, sourceIds: s.rows.map((r) => r.id), amount, minutes: actualLessonMinutes2(l), snapshot: Object.fromEntries(["date", "start", "end", "className", "teacher"].map((k) => [k, String(l[k])])) } } : {}, rate: amount, rateUnit: "perClass", reviewed: false, automaticFeeApplied: true, feeProjection: { ...l.feeProjection || { rate: l.rate, rateUnit: l.rateUnit, reviewed: l.reviewed }, sourceType: s.contract ? "contract-session-rate" : "session-course-rate" } };
    });
    if (projected.some((l) => estimatedCharge2(l) === null)) continue;
    projected.forEach((l) => replacements.set(l.id, l));
  }
  return rows.map((l) => replacements.get(l.id) || l);
}
function projectLessonPeriods(rows, studentId, periods, decisions, linkedStudentIds = []) {
  const fees = applyFeePeriods({ ...emptyStore2(), lessons: automaticBillingTime2(rows.filter((l) => !l.deletedAt)) }, studentId, periods);
  const beforeDiscount = decisions === null ? fees.lessons : applySessionFees2(fees.lessons, decisions, linkedStudentIds, (l) => l.studentId === studentId ? periods[l.date.slice(0, 7)] : void 0);
  let lessons = beforeDiscount;
  for (const [month, period] of Object.entries(periods)) lessons = applyStudentDiscounts2(lessons, studentId, month, period.discountPolicy);
  return { beforeDiscount, lessons };
}
function projectMonthlyLessons(rows, studentId, month, period, decisions, linked = false) {
  return projectLessonPeriods(rows, studentId, { [month]: period }, decisions, linked ? [studentId] : []).lessons;
}

// functions/makeupHours.js
function restoreImportedMakeupHours(lesson) {
  const l = (
    /** @type {any} */
    lesson
  );
  if (!l || !["teacher-portal-history", "access-history"].includes(l.source) || !["cancelMakeup", "absenceMakeup"].includes(l.kind) || l.deletedAt || l.dailyDirty || l.teacherReviewed || l.reviewed || l.sourceMinutes !== 0 || l.payMinutes !== 0 || l.history?.hours !== 0) return lesson;
  const minutes = lessonTimeSpan(l.start, l.end);
  if (minutes === null) return lesson;
  return { ...l, sourceMinutes: minutes, payMinutes: minutes };
}

// functions/feeApplications.js
var fail = (message) => {
  throw Object.assign(Error(message), { status: 409 });
};
async function attachFeeApplications(db, studentId, month, period, tx) {
  const query = db.collection("intranetFeeApplications").where("studentId", "==", studentId).limit(121);
  const docs = await (tx ? tx.get(query) : query.get());
  if (docs.size > 120) fail("\uC57D\uC815 \uC801\uC6A9 \uC774\uB825\uC758 \uC870\uD68C \uAE30\uAC04 \uD55C\uB3C4\uB97C \uB118\uC5C8\uC2B5\uB2C8\uB2E4.");
  const records = docs.docs.flatMap((d) => d.data().records || []);
  if (records.length > 1e4) fail("\uC57D\uC815 \uC801\uC6A9 \uC774\uB825 \uC870\uD68C \uD55C\uB3C4\uB97C \uB118\uC5C8\uC2B5\uB2C8\uB2E4.");
  const assignments = (period.assignments || []).map((a) => a.feeScope ? { ...a, feeScope: { ...a.feeScope, agreementId: a.rateId, applications: records.filter((r) => r.agreementId === a.rateId) } } : a);
  for (const r of records) if (!assignments.some((a) => a.rateId === r.agreementId)) assignments.push({ kind: "lesson", target: r.lessonId, rateId: r.agreementId, amount: r.scope.amount, rateUnit: r.scope.rateUnit, feeScope: { ...r.scope, agreementId: r.agreementId, applications: records.filter((x) => x.agreementId === r.agreementId), withdrawn: true } });
  return { ...period, assignments };
}

// functions/publishedView.js
function publishedView(period = {}, historyLessons = []) {
  const deletedIds = new Set(period.publishedDeletedIds || []);
  const lessons = new Map(
    [...historyLessons, ...sentLessons(period)].map((lesson) => [lesson.id, lesson])
  );
  return [...lessons.values()].filter((lesson) => !deletedIds.has(lesson.id) && !lesson.deletedAt).map(restoreImportedMakeupHours);
}

// functions/carriedFees.js
var exceptionalTariff = (value) => /할인|무료|면제|환불|차감|금액\s*예외|보강|보충|일회성|이번만|(?:이|해당)\s*수업만/.test(String(value || ""));
function recurringLessonAssignment(assignment, lesson) {
  if (assignment.feeScope) return false;
  if (assignment.sourceType === "historical-recovery") return true;
  return assignment.source === "fee-review" && !assignment.sourceType && !exceptionalTariff(assignment.note) && feeClassKey3(assignment.label) === feeClassKey3(lesson.className) && (!assignment.lessonSnapshot || ["date", "start", "end", "kind", "className", "teacher"].every((key) => assignment.lessonSnapshot[key] === lesson[key]));
}
function carryMonthlyFees(current, history, month) {
  const periods = history.filter((p) => p.month < month).sort((a, b) => b.month.localeCompare(a.month));
  const suppressed = new Set((current.suppressedTargets || []).map(feeClassKey3));
  const merges = (current.merges || []).filter((m) => !suppressed.has(feeClassKey3(m.course)));
  const assignments = [...current.assignments || []];
  const scopedIds = new Set(assignments.filter((a) => a.feeScope).map((a) => a.rateId));
  const identity = (m) => JSON.stringify([m.type, m.teacher, m.actualMinutes]);
  const seen = new Set(merges.filter((m) => m.identityVersion === 2).map(identity));
  const classes = new Set(assignments.filter((a) => a.kind === "class").map((a) => feeClassKey3(a.target)));
  const resolved = /* @__PURE__ */ new Set([...classes, ...merges.map((m) => feeClassKey3(m.course)), ...suppressed]);
  for (const period of periods) {
    const temporary = new Set((period.monthOnlySuppressedTargets || []).map(feeClassKey3));
    for (const target of period.suppressedTargets || []) {
      const key = feeClassKey3(target);
      if (temporary.has(key) || resolved.has(key)) continue;
      suppressed.add(key);
      resolved.add(key);
      classes.add(key);
    }
    for (const m of period.merges || []) {
      if (m.scope === "month" || m.identityVersion !== 2 || seen.has(identity(m))) continue;
      if (suppressed.has(feeClassKey3(m.course)) || classes.has(feeClassKey3(m.course))) continue;
      seen.add(identity(m));
      resolved.add(feeClassKey3(m.course));
      merges.push({ ...m, id: `carry:${period.month}:${m.id}`, lessonIds: [], sourceMonth: period.month });
    }
    for (const a of period.assignments || []) {
      if (a.feeScope) {
        const s = a.feeScope;
        if (s.scope === "contract" && !scopedIds.has(a.rateId) && (!s.effectiveThrough || s.effectiveThrough >= month + "-01")) {
          assignments.push({ ...a, sourceMonth: period.month });
          scopedIds.add(a.rateId);
        }
        continue;
      }
      const key = feeClassKey3(a.target);
      if (a.kind !== "class" || classes.has(key) || suppressed.has(key)) continue;
      classes.add(key);
      resolved.add(key);
      assignments.push({ ...a, sourceMonth: period.month });
    }
  }
  return { ...current, merges, assignments, suppressedTargets: [...suppressed] };
}
function confirmedFeeHistory(studentId, month, periods, sources, baseline, issues = []) {
  const history = periods.filter((p) => p.month < month).map((p) => ({ ...p, assignments: [...p.assignments || []], merges: [...p.merges || []] }));
  for (const source of sources) {
    if (source.month >= month) continue;
    const stored = history.find((p) => p.month === source.month) || { studentId, month: source.month, assignments: [], merges: [] };
    const fees = inheritFees({ ...stored, assignments: [...stored.assignments], merges: [...stored.merges] }, baseline, source.month);
    fees.assignments.push(...recoverIssueFees(issues, source.month, fees));
    const originals = source.lessons.filter((l) => l.studentId === studentId && l.date?.slice(0, 7) === source.month && !l.deletedAt);
    const eligible = new Set(originals.filter((l) => {
      const identity = automaticCourseIdentity2(l);
      return identity && ["regular", "special"].includes(l.kind) && l.billMinutes === identity.actualMinutes && !l.singleIndividual && l.rateOverride === void 0 && !l.studentDiscount && !l.feeProjection && (!l.access?.sessionMinutes || l.access.sessionMinutes === identity.actualMinutes || l.access.billingAuthoritative && (l.rateUnit || "perHour") === "perHour" && l.rate === l.access.hourlyRate && Number.isSafeInteger(l.access.amount) && l.access.amount > 0 && Math.abs(l.access.amount - l.rate * identity.actualMinutes / 60) <= 1) && !Number(l.access?.discount || 0) && !exceptionalTariff([l.note, l.reason].join(" ")) && !fees.assignments.some((a) => a.kind === "lesson" && a.target === l.id && !recurringLessonAssignment(a, l)) && !(stored.suppressedTargets || []).some((t) => [feeClassKey3(l.className), feeClassKey3(mergeCourse2(l))].includes(feeClassKey3(t)));
    }).map((l) => l.id));
    const groups = /* @__PURE__ */ new Map();
    for (const l of projectMonthlyLessons(originals, studentId, source.month, { ...fees, discountPolicy: null }, {}, true)) {
      if (!eligible.has(l.id) || l.scopedFee || l.billingDecision) continue;
      const identity = automaticCourseIdentity2(l), amount = estimatedCharge2(l);
      if (!identity || !Number.isSafeInteger(amount) || amount <= 0) continue;
      const key = JSON.stringify([identity.type, identity.teacher, identity.actualMinutes]);
      const group = groups.get(key) || { ...identity, course: feeClassKey3(l.className), amounts: /* @__PURE__ */ new Set() };
      group.amounts.add(amount);
      groups.set(key, group);
    }
    for (const [key, g] of groups) {
      if (stored.merges.some((m) => m.identityVersion === 2 && JSON.stringify([m.type, m.teacher, m.actualMinutes]) === key)) continue;
      stored.merges.push({
        id: `confirmed:${source.month}:${historyId(key)}`,
        identityVersion: 2,
        lessonIds: [],
        teacher: g.teacher,
        type: g.type,
        actualMinutes: g.actualMinutes,
        course: g.course,
        amount: g.amounts.size === 1 ? [...g.amounts][0] : 0,
        conflict: g.amounts.size > 1,
        rateUnit: "perClass",
        sourceType: "prior-confirmed-rate",
        sourceMonth: source.month,
        note: "\uD655\uC778\uB41C \uC774\uC804 \uB2EC \uD68C\uB2F9 \uB2E8\uAC00",
        updatedBy: "\uC790\uB3D9 \uC2B9\uACC4",
        updatedAt: ""
      });
    }
    if (!history.includes(stored)) history.push(stored);
  }
  return history;
}
async function readConfirmedFeeSources(db, studentId, month, tx) {
  const read = (query) => tx ? tx.get(query) : query.get();
  const snapshots = await Promise.all(["intranetStudentPeriods", "intranetLegacyPeriods"].map((name) => read(db.collection(name).where("studentId", "==", studentId).limit(241))));
  if (snapshots.some((s) => s.docs.length > 240)) throw Object.assign(Error("\uD559\uC0DD\uC758 \uB2E8\uAC00 \uC2B9\uACC4 \uC870\uD68C \uD55C\uB3C4\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4."), { status: 413 });
  const maps = snapshots.map((s) => new Map(s.docs.map((d) => d.data()).filter((p) => p.month && p.month < month).map((p) => [p.month, p])));
  const months = [...new Set(maps.flatMap((m) => [...m.keys()]))];
  return months.map((m) => {
    const current = maps[0].get(m) || {}, legacy = maps[1].get(m) || {};
    for (const p of [current, legacy]) {
      if (p.studentId && p.studentId !== studentId) throw Object.assign(Error("\uB2E8\uAC00 \uC2B9\uACC4 \uC218\uC5C5\uC758 \uD559\uC0DD \uC815\uBCF4\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."), { status: 409 });
      if ((p.lessons || []).length > 1e3 || (p.publishedLessons || []).length > 1e3) throw Object.assign(Error("\uD559\uC0DD \uC6D4 \uC218\uC5C5 \uC870\uD68C \uD55C\uB3C4\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4."), { status: 413 });
    }
    return { month: m, lessons: publishedView(current, legacy.lessons || []).map((l) => ({ ...l, studentId: l.studentId ?? studentId })) };
  });
}
async function readCarriedFees(db, studentId, month, current, tx) {
  const read = (query) => tx ? tx.get(query) : query.get();
  const [past, sources, baseline, issues] = await Promise.all([
    read(db.collection("intranetStudentFees").where("studentId", "==", studentId).limit(241)),
    readConfirmedFeeSources(db, studentId, month, tx),
    read(db.doc(`intranetFeeBaselines/${studentId}`)),
    read(db.collection("intranetIssues").where("studentId", "==", studentId).limit(1001))
  ]);
  if (past.docs.length > 240 || issues.docs.length > 1e3) throw Object.assign(Error("\uD559\uC0DD\uC758 \uB2E8\uAC00 \uC2B9\uACC4 \uC870\uD68C \uD55C\uB3C4\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4."), { status: 413 });
  return attachFeeApplications(db, studentId, month, carryMonthlyFees(current, confirmedFeeHistory(studentId, month, past.docs.map((d) => d.data()), sources, baseline.data(), issues.docs.map((d) => ({ ...d.data(), id: d.id }))), month), tx);
}

// functions/studentDiscounts.js
function discountPolicyFor(data, month) {
  return [...data?.policies || []].filter((p) => p.month <= month).sort((a, b) => a.month.localeCompare(b.month)).at(-1) || null;
}
export {
  applyFees,
  carryMonthlyFees,
  changed,
  discountPolicyFor,
  estimatedCharge,
  inheritFees,
  projectedFeeRows,
  readCarriedFees,
  recoverIssueFees,
  validSingleIndividual
};
