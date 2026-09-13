/* Shared student identity presentation. Firestore remains the source of truth. */
(function(root) {
  'use strict';
  var students = [], assets = [], unsubscribe = [], generation = 0;
  var names = new Map(), ids = new Map(), icons = new Map(), schools = new Map();
  function schoolKey(name) { return clean(name).replace(/^신반포$/, '신반포중').replace(/고등학교$/, '고').replace(/중학교$/, '중').replace(/초등학교$/, '초').replace(/\s+/g, ' ').toLowerCase(); }
  function fallback(kind) { return '<span class="identity-fallback" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' + (kind === 'school' ? '<path d="m3 9 9-6 9 6v12H3Z M9 21v-7h6v7 M7 10h1m8 0h1"/>' : '<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>') + '</svg></span>'; }
  function school(name, grade) {
    var url = schools.get(schoolKey(name));
    return '<span class="school-identity" data-school-icon-name="' + escape(name) + '" data-school-grade="' + escape(grade) + '">' + fallback('school') + (url ? '<img class="school-identity-icon" src="' + escape(url) + '" alt="" onerror="this.remove()">' : '') + '<span>' + escape(name) + (grade ? ' ' + escape(grade) : '') + '</span></span>';
  }
  function clean(value) { return String(value || '').replace(/^\/+/, '').trim(); }
  function escape(value) { return String(value || '').replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function timestamp(value) {
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (value && value.seconds) return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
    return typeof value === 'number' ? value : Date.parse(value || '') || 0;
  }
  function reindex() {
    names = new Map(); ids = new Map(); icons = new Map(); schools = new Map();
    students.forEach(function(s) {
      var name = clean(s.name || s.studentName || s.displayName);
      var gender = s.gender === 'male' || s.gender === 'female' ? s.gender : '';
      if (s.id) ids.set(String(s.id), gender);
      if (s.studentId) ids.set(String(s.studentId), gender);
      // Name-only legacy records cannot safely resolve duplicate students.
      if (name) names.set(name, names.has(name) ? '' : gender);
    });
    assets.slice().sort(function(a,b) { return timestamp(a.updatedAt || a.createdAt) - timestamp(b.updatedAt || b.createdAt) || String(a.id || '').localeCompare(String(b.id || '')); }).forEach(function(a) {
      var key = a.lookupKey || a.id;
      if (key.indexOf('school:') === 0) schools.set(schoolKey(key.slice(7)), String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && /^https:\/\//i.test(a.imageUrl || '') ? a.imageUrl : '');
      if (key !== 'student-gender:male' && key !== 'student-gender:female') return;
      icons.set(key.slice(15), String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && /^https:\/\//i.test(a.imageUrl || '') ? a.imageUrl : '');
    });
  }
  function image(name, id) {
    var gender = id ? ids.get(String(id)) : names.get(clean(name));
    var url = icons.get(gender);
    if (!icons.has(gender) && (gender === 'male' || gender === 'female')) url = 'https://sedubanpo.github.io/s-lms/account-management/assets/student-' + gender + '.svg';
    return url ? '<img class="student-gender-icon" src="' + escape(url) + '" alt="' + (gender === 'male' ? '남학생' : '여학생') + '" decoding="async" onerror="this.remove()">' : '';
  }
  function render(name, id) {
    name = clean(name);
    return '<span class="student-identity" data-student-icon-name="' + escape(name) + '" data-student-icon-id="' + escape(id) + '">' + image(name,id) + '<span>' + escape(name) + '</span></span>';
  }
  function refresh() {
    if (!root.document) return;
    root.document.querySelectorAll('[data-school-icon-name]').forEach(function(el) {
      var template = root.document.createElement('template'); template.innerHTML = school(el.dataset.schoolIconName, el.dataset.schoolGrade);
      var next = template.content.firstChild.innerHTML;
      if (el.innerHTML !== next) el.innerHTML = next;
    });
    root.document.querySelectorAll('[data-student-icon-name]').forEach(function(el) {
      var html = render(el.dataset.studentIconName, el.dataset.studentIconId);
      var template = root.document.createElement('template'); template.innerHTML = html;
      var next = template.content.firstChild.innerHTML;
      if (el.innerHTML !== next) el.innerHTML = next;
    });
  }
  function stop() {
    generation++;
    unsubscribe.splice(0).forEach(function(fn) { fn(); });
    students = []; assets = []; reindex(); refresh();
  }
  function start(db) {
    stop(); var token = generation;
    ['students','sharedIconAssets'].forEach(function(collection) {
      unsubscribe.push(db.collection(collection).onSnapshot(function(snapshot) {
        if (token !== generation) return;
        var rows = snapshot.docs.map(function(doc) { return Object.assign({}, doc.data(), {id:doc.id}); });
        if (collection === 'students') students = rows; else assets = rows;
        reindex(); refresh();
      }, function() {
        if (token !== generation) return;
        if (collection === 'students') students = []; else assets = [];
        reindex(); refresh();
        console.warn('Student gender icons unavailable: ' + collection);
      }));
    });
  }
  var api = {render:render,school:school,start:start,stop:stop};
  root.StudentGenderIcons = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
