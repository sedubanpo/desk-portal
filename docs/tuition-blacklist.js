// Month numbers are consecutive across years. Only recorded student-months count towards release.
function tuitionBlacklistByStudent(history, selectedMonth, currentMonth) {
  function monthIndex(key) {
    var parts = /^(?:20)?(\d{2})-(0[1-9]|1[0-2])s?$/.exec(key || '');
    return parts ? (2000 + Number(parts[1])) * 12 + Number(parts[2]) - 1 : NaN;
  }
  var current = monthIndex(currentMonth);
  var end = Math.min(monthIndex(selectedMonth), current);
  var students = new Map(), active = new Map();
  history.forEach(function(row) {
    var month = monthIndex(row.sourceMonth);
    var name = String(row.studentName || '').replace(/^\/+/, '').trim();
    var count = Number(row.contactCount);
    if (!name || !(month <= end) || row.contactCount == null || !Number.isInteger(count) || count < 0) return;
    if (!students.has(name)) students.set(name, new Map());
    var months = students.get(name);
    months.set(month, Math.max(months.get(month) || 0, count));
  });
  students.forEach(function(months, name) {
    var registered = null, stable = 0;
    var first = Math.min.apply(null, Array.from(months.keys()));
    for (var month = first; month <= end; month++) {
      var count = months.get(month);
      if (count >= 3) {
        if (registered === null) registered = month;
        stable = 0;
      } else if (registered !== null && month < current) {
        stable = count == null ? 0 : stable + 1;
        if (stable === 3) { registered = null; stable = 0; }
      }
    }
    if (registered !== null) active.set(name, {registered: registered, stable: stable, end: end, current: current, months: months});
  });
  return active;
}

if (typeof module === 'object' && module.exports) module.exports = tuitionBlacklistByStudent;
