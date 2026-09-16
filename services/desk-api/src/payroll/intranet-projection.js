// Versioned intranet calculation snapshot. Regenerate with scripts/sync-intranet-projection.mjs; see intranet-projection.sources.json.

// functions/historicalFeeAssignment.js
function historicalAssignmentMatches(assignment, lesson) {
  if (assignment?.bulkMerge === true) {
    const snapshot2 = assignment.lessonSnapshot;
    if (!snapshot2 || !lesson || lesson.deletedAt) return false;
    const identity = (value) => {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value?.start || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value?.end || "")) return "";
      const minutes = Number(value.end.slice(0, 2)) * 60 + Number(value.end.slice(3)) - Number(value.start.slice(0, 2)) * 60 - Number(value.start.slice(3));
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

// functions/feeMerge.js
var feeClassKey = (value) => String(value || "").trim().replace(/\s+/g, "").replace(/-?\d+(?:\.\d+)?h$/i, "").replace(/\(([^)]+)\)/g, "-$1").replace(/개별정규/g, "\uAC1C\uBCC4").replace(/T(?=-|$)/gi, "").replace(/--+/g, "-");
var clockMinutes = (value) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const hours = Number(match[1]), minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
};
function actualLessonMinutes(lesson) {
  const start = clockMinutes(lesson?.start), end = clockMinutes(lesson?.end);
  const minutes = start === null || end === null ? null : end - start;
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
  const identity = mergeIdentity(lesson);
  return Boolean(identity && merge && identity.course === merge.course && identity.teacher === merge.teacher && identity.actualMinutes === merge.actualMinutes && Array.isArray(merge.lessonIds) && merge.lessonIds.includes(lesson.id));
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
  (a) => a.kind === "class" && (a.durationHours === void 0 || Number(lesson.className.match(/(\d+(?:\.\d+)?)h$/i)?.[1]) === a.durationHours && lesson.billMinutes === a.durationHours * 60) && feeClassKey2(a.target) === feeClassKey2(classLabel(lesson.className, lesson.teacher))
);
function applyFees(store, studentId, month, assignments, merges = []) {
  return {
    ...store,
    lessons: store.lessons.map((l) => {
      const { feeGroupId: _feeGroupId, ...base } = l;
      if (base.studentId !== studentId || !base.date.startsWith(month)) return l;
      const merge = merges.find((row) => mergeMatches(row, base));
      const grouped = merge ? { ...base, feeGroupId: merge.id } : base;
      if (["absence", "cancelMakeup", "lateMakeup", "free"].includes(grouped.kind)) {
        return merge ? {
          ...grouped,
          feeProjection: grouped.feeProjection || {
            rate: grouped.rate,
            reviewed: grouped.reviewed,
            rateUnit: grouped.rateUnit,
            sourceType: "bulk-fee-override"
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
    })
  };
}

// src/domain.ts
function medicalAbsenceWaived(l) {
  return !!l.medicalAbsence && l.kind === "absence" && l.billMinutes === 0 && l.payMinutes === 0;
}
function accessCharge(l) {
  if (medicalAbsenceWaived(l)) return 0;
  if (["bulk-fee-override", "daily-fee-override"].includes(l.feeProjection?.sourceType || "")) return null;
  return l.source === "access-history" && l.access?.billingAuthoritative === true && typeof l.access.amount === "number" && Number.isFinite(l.access.amount) && l.access.amount >= 0 ? Math.round(l.access.amount * 100) / 100 : null;
}
function charge(l) {
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
  const original = accessCharge(l);
  if (original !== null) return original;
  if (l.reviewed) return charge(l);
  const free = ["absence", "cancelMakeup", "lateMakeup", "free"].includes(l.kind);
  const safeWarnings = (l.warnings || []).every((w) => w === "\uACFC\uAC70 \uAC15\uC0AC \uD3EC\uD138 \uC6D0\uBCF8 \xB7 \uB2E8\uAC00\uC640 \uCCAD\uAD6C \uAE30\uC900 \uBBF8\uC774\uAD00" || w === "\uC804\uCCB4 \uD559\uC0DD \uC911 \uC720\uC77C\uD55C \uC774\uB984\uC73C\uB85C \uC5F0\uACB0 \xB7 \uC6D0\uBCF8 \uD559\uAD50 \uB300\uC870 \uAD8C\uC7A5");
  if (!safeWarnings && !["bulk-fee-override", "daily-fee-override"].includes(l.feeProjection?.sourceType || "") || l.kind === "study") return null;
  return charge({
    ...l,
    reviewed: true,
    payMinutes: 0,
    ...free ? { rate: 0, rateUnit: "perHour" } : {}
  });
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

// functions/portalChanges.js
var fields = ["date", "className", "teacher", "kind", "start", "end", "payMinutes", "note", "rate", "rateUnit", "rateOverride", "rateOverrideAgainst"];
var sameField = (before, after, key) => {
  if (key === "note") return String(before?.note || "") === String(after?.note || "");
  if (key === "rateUnit") return String(before?.rateUnit || "perHour") === String(after?.rateUnit || "perHour");
  return before?.[key] === after?.[key];
};
var changed = (a, b) => !!b.deletedAt || fields.some((k) => !sameField(a, b, k));
export {
  applyFees,
  changed,
  estimatedCharge,
  inheritFees,
  recoverIssueFees
};
