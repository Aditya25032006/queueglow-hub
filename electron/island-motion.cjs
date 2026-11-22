const DURATION_MS = 780;
const IDLE_SECONDS = 30;

function gaze(point, bounds, sleeping) {
  if (sleeping) return { x: 0, y: 0, sleeping: true };
  const dx = point.x - (bounds.x + bounds.width / 2);
  const dy = point.y - (bounds.y + 22);
  const distance = Math.hypot(dx, dy);
  const strength = Math.max(0, 1 - distance / 300);
  const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
  return {
    x: Math.round(clamp(dx / 24, 4) * strength * 4) / 4,
    y: Math.round(clamp(dy / 32, 3) * strength * 4) / 4,
    sleeping: false,
  };
}

module.exports = { DURATION_MS, IDLE_SECONDS, gaze };
