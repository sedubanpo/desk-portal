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
  const groups = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const key = automaticCourseKey(row);
    if (!key || row.deletedAt || row.studentId !== studentId || !row.date.startsWith(month)) continue;
    groups.set(key, [...groups.get(key) || [], row]);
    const shared = individualKey(row);
    if (shared) groups.set(shared, [...groups.get(shared) || [], row]);
  }
  const resolved = /* @__PURE__ */ new Map();
  for (const [key, members] of groups) {
    const full = members.filter((row) => ["regular", "late", "cancel"].includes(row.kind) && row.billMinutes !== null && row.billMinutes > 0 && row.billMinutes === actualLessonMinutes(row));
    const evidence = full.filter((row) => row.kind === "regular" && !Number(row.access?.discount || 0) && !/할인|무료|금액\s*예외|보강|보충/.test([row.note, row.reason].join(" "))).map(estimatedCharge).filter((value) => value !== null);
    const amounts = [...new Set(evidence)];
    resolved.set(key, { amount: amounts.length === 1 && Number.isSafeInteger(amounts[0]) && amounts[0] > 0 ? amounts[0] : void 0, conflict: amounts.length > 1 });
  }
  return rows.map((row) => {
    if (row.studentId !== studentId || !row.date.startsWith(month)) return row;
    const own = resolved.get(automaticCourseKey(row));
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
var feeAssignment = (rows, lesson) => rows.find((a) => a.kind === "lesson" && a.target === lesson.id && historicalAssignmentMatches(a, lesson)) || rows.find(
  (a) => a.kind === "class" && lesson.kind !== "special" && importedClassDurationMatches(a, lesson) && (a.durationHours === void 0 || Number(lesson.className.match(/(\d+(?:\.\d+)?)h$/i)?.[1]) === a.durationHours && lesson.billMinutes === a.durationHours * 60) && feeClassKey2(a.target) === feeClassKey2(classLabel(lesson.className, lesson.teacher))
);
function applyFees(store, studentId, month, assignments, merges = []) {
  return {
    ...store,
    lessons: automaticCourseFees(store.lessons.map((l) => {
      if (l.singleIndividual) return l;
      const { feeGroupId: _feeGroupId, automaticFeeApplied: _automatic, automaticFeeConflict: _conflict, ...base } = l;
      if (base.studentId !== studentId || !base.date.startsWith(month)) return l;
      const merge = merges.find((row) => mergeMatches(row, base));
      const grouped = merge ? { ...base, feeGroupId: merge.id } : base;
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
    }), studentId, month)
  };
}
function removeFeeProjection(store) {
  return {
    ...store,
    lessons: store.lessons.map((l) => {
      const { studentDiscount: _discount, feeProjection, feeGroupId: _feeGroupId, automaticFeeApplied: _automatic, automaticFeeConflict: _conflict, ...base } = l;
      if (!feeProjection) return base;
      const { sourceType: _sourceType, ...original } = feeProjection;
      return { ...base, ...original };
    })
  };
}

// functions/feeHistory.js
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
    const { studentDiscount: old, ...base } = l;
    let priced = base;
    const identity = automaticCourseIdentity(base);
    const special = policy.specialHourly !== null && identity?.type === "\uAC1C\uBCC4" && !base.singleIndividual && ["regular", "late", "cancel", "absence", "cancelMakeup", "absenceMakeup", "lateMakeup", "free"].includes(base.kind);
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
  const exceptional2 = (l) => l.singleIndividual || l.automaticFeeConflict || l.rateOverride !== void 0 || Number(l.access?.discount || 0) !== 0 || /1\s*명|할인|전과목|무료|면제|환불|차감|보강|보충|조퇴|단축|연장|금액\s*예외/.test([l.className, l.note, l.reason].join(" "));
  const candidates = continuousLessons(rows);
  const evidence = rows.filter((l) => !l.deletedAt && l.kind === "regular" && !exceptional2(l) && l.sourceMinutes === actualLessonMinutes(l) && l.billMinutes === actualLessonMinutes(l) && estimatedCharge(l) !== null && estimatedCharge(l) > 0 && !["contract-session-rate", "session-course-rate"].includes(l.feeProjection?.sourceType || "") && !rows.some((other) => other.id !== l.id && !other.deletedAt && other.studentId === l.studentId && other.date === l.date && mergeTeacher(other.teacher) === mergeTeacher(l.teacher) && other.start <= l.end && other.end >= l.start));
  return candidates.filter((s) => {
    if (s.rows.length < 2 || new Set(s.rows.map((l) => l.kind)).size < 2 || s.rows.some((l) => exceptional2(l) || !["regular", "late", "cancel", "absence"].includes(l.kind) || !automaticCourseIdentity(l) || !/^(개별|\d+:\d+)$/.test(automaticCourseIdentity(l).type))) return false;
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
function applySessionFees(rows, decisions, _linkedStudentIds = []) {
  const saved = normalizeSessionDecisions(decisions), sessions = displayedLessonSessions(rows, saved);
  const exceptional2 = (l) => !!l.singleIndividual || !!l.automaticFeeConflict || Number(l.access?.discount || 0) !== 0 || /1\s*명|할인|전과목|무료|면제|환불|차감|보강|보충|조퇴|단축|연장|금액\s*예외/.test([l.className, l.note, l.reason].join(" "));
  const regular = (l) => !exceptional2(l) && ["regular", "late"].includes(l.kind) && l.billMinutes === actualLessonMinutes(l) && l.sourceMinutes === actualLessonMinutes(l) && /^(개별|\d+:\d+)$/.test(automaticCourseIdentity(l)?.type || "");
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
    const contractPart = (l) => !exceptional2(l) && ["regular", "late", "cancel", "absence"].includes(l.kind) && l.sourceMinutes === actualLessonMinutes(l) && l.billMinutes === (l.kind === "absence" ? 0 : actualLessonMinutes(l)) && (!["cancel", "absence"].includes(l.kind) || l.payMinutes === 0) && /^(개별|\d+:\d+)$/.test(automaticCourseIdentity(l)?.type || "");
    if (s.rows.length === 1 && estimatedCharge(s.rows[0]) !== null) continue;
    const mixedAttendance = new Set(s.rows.map((l) => l.kind)).size > 1;
    if (s.rows.length > 1 && !s.contract && saved[s.key] !== "group" || !s.rows.every((l) => (s.contract || mixedAttendance || s.rows.length === 1 ? contractPart(l) : regular(l)) && l.rateOverride === void 0 && !["bulk-fee-override", "daily-fee-override"].includes(l.feeProjection?.sourceType || "") && (l.kind === "absence" || estimatedCharge(l) !== 0))) continue;
    const virtual = { ...s.rows[0], end: s.rows.at(-1).end }, minutes = actualLessonMinutes(virtual);
    const values = evidence.get(automaticCourseKey(virtual));
    if (values?.size !== 1) continue;
    const total = [...values][0];
    if (s.rows.every((l) => estimatedCharge(l) !== null) && s.rows.reduce((sum, l) => sum + estimatedCharge(l), 0) === total * s.rows.reduce((n, l) => n + (l.billMinutes || 0), 0) / minutes) continue;
    let elapsed = 0, allocated = 0;
    const projected = s.rows.map((l) => {
      elapsed += actualLessonMinutes(l);
      const cumulative = Math.round(total * elapsed / minutes), amount = cumulative - allocated;
      allocated = cumulative;
      return { ...l, rate: amount, rateUnit: "perClass", reviewed: false, automaticFeeApplied: true, feeProjection: { ...l.feeProjection || { rate: l.rate, rateUnit: l.rateUnit, reviewed: l.reviewed }, sourceType: s.contract ? "contract-session-rate" : "session-course-rate" } };
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
  let rows = applySessionFees(projected.lessons, decisions, students.filter((s) => s.canonicalId).map((s) => s.id));
  for (const studentId of new Set(rows.map((l) => l.studentId))) {
    const { period } = context(rows.find((l) => l.studentId === studentId));
    rows = applyStudentDiscounts(rows, studentId, month, period.discountPolicy);
  }
  return rows.filter((l) => !l.deletedAt && l.date.startsWith(month + "-")).map((l) => {
    const value = context(l);
    return { lesson: l, student: value.student, canonical: value.canonical, period: value.period, rate: l.rate };
  });
}

// functions/carriedFees.js
function carryMonthlyFees(current, history, month) {
  const periods = history.filter((p) => p.month < month).sort((a, b) => b.month.localeCompare(a.month));
  const suppressed = new Set((current.suppressedTargets || []).map(feeClassKey3));
  const merges = (current.merges || []).filter((m) => !suppressed.has(feeClassKey3(m.course)));
  const assignments = [...current.assignments || []];
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
      if (m.identityVersion !== 2 || seen.has(identity(m))) continue;
      if (suppressed.has(feeClassKey3(m.course)) || classes.has(feeClassKey3(m.course))) continue;
      seen.add(identity(m));
      resolved.add(feeClassKey3(m.course));
      merges.push({ ...m, id: `carry:${period.month}:${m.id}`, lessonIds: [], sourceMonth: period.month });
    }
    for (const a of period.assignments || []) {
      const key = feeClassKey3(a.target);
      if (a.kind !== "class" || classes.has(key) || suppressed.has(key)) continue;
      classes.add(key);
      resolved.add(key);
      assignments.push({ ...a, sourceMonth: period.month });
    }
  }
  return { ...current, merges, assignments, suppressedTargets: [...suppressed] };
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
  recoverIssueFees,
  validSingleIndividual
};
