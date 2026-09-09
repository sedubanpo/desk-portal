/* Shared student identity presentation. Firestore remains the source of truth. */
(function(root) {
  'use strict';
  var students = [], assets = [], unsubscribe = [], generation = 0;
  var names = new Map(), ids = new Map(), icons = new Map();
  function clean(value) { return String(value || '').replace(/^\/+/, '').trim(); }
  function escape(value) { return String(value || '').replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function timestamp(value) {
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (value && value.seconds) return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
    return typeof value === 'number' ? value : Date.parse(value || '') || 0;
  }
  function reindex() {
    names = new Map(); ids = new Map(); icons = new Map();
    students.forEach(function(s) {
      var name = clean(s.studentName || s.name || s.displayName);
      var gender = s.gender === 'male' || s.gender === 'female' ? s.gender : '';
      if (s.id) ids.set(String(s.id), gender);
      if (s.studentId) ids.set(String(s.studentId), gender);
      // Name-only legacy records cannot safely resolve duplicate students.
      if (name) names.set(name, names.has(name) ? '' : gender);
    });
    assets.slice().sort(function(a,b) { return timestamp(a.updatedAt || a.createdAt) - timestamp(b.updatedAt || b.createdAt) || String(a.id || '').localeCompare(String(b.id || '')); }).forEach(function(a) {
      var key = a.lookupKey || a.id;
      if (key !== 'student-gender:male' && key !== 'student-gender:female') return;
      icons.set(key.slice(15), String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && /^https:\/\//i.test(a.imageUrl || '') ? a.imageUrl : '');
    });
  }
  function image(name, id) {
    var gender = id ? ids.get(String(id)) : names.get(clean(name));
    var url = icons.get(gender);
    return url ? '<img class="student-gender-icon" src="' + escape(url) + '" alt="' + (gender === 'male' ? '남학생' : '여학생') + '" decoding="async" onerror="this.remove()">' : '';
  }
  function render(name, id) {
    name = clean(name);
    return '<span class="student-identity" data-student-icon-name="' + escape(name) + '" data-student-icon-id="' + escape(id) + '">' + image(name,id) + '<span>' + escape(name) + '</span></span>';
  }
  function refresh() {
    if (!root.document) return;
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
  var api = {render:render,start:start,stop:stop};
  root.StudentGenderIcons = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
