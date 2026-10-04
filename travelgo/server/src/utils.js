function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function genId(prefix, n) {
  return prefix + String(n).padStart(4, '0');
}

module.exports = { todayStr, daysBetween, genId };
