/**
 * Israel-local wall-clock helpers. The server may run in any timezone (Render =
 * UTC), but "sync every day at 07:00" means 07:00 in Israel, including across
 * DST changes. Dependency-free: offsets come from Intl.
 */

export const IL_TZ = 'Asia/Jerusalem';

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: IL_TZ,
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** Wall-clock parts of an instant in Israel. */
export const israelParts = (date) => {
  const p = Object.fromEntries(fmt.formatToParts(date).map(({ type, value }) => [type, value]));
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour), minute: Number(p.minute), second: Number(p.second),
  };
};

// Israel offset (ms, positive east of UTC) at a given instant.
const offsetAt = (ms) => {
  const p = israelParts(new Date(ms));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
};

/** The UTC instant of an Israel wall-clock time (y, m 1-12, d, h:00). */
export const israelWallToDate = (year, month, day, hour) => {
  const wall = Date.UTC(year, month - 1, day, hour, 0, 0);
  let ms = wall - offsetAt(wall);
  ms = wall - offsetAt(ms); // second pass settles DST transitions
  return new Date(ms);
};

/** Start (00:00 Israel) of the month containing `date`, shifted by `offset` months. */
export const israelMonthStart = (date, offset = 0) => {
  const p = israelParts(date);
  const t = new Date(Date.UTC(p.year, p.month - 1 + offset, 1));
  return israelWallToDate(t.getUTCFullYear(), t.getUTCMonth() + 1, 1, 0);
};

/** 'YYYY-MM-01' key of the Israel month containing `date` (matches $dateToString with IL_TZ). */
export const israelMonthKey = (date) => {
  const p = israelParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-01`;
};

/**
 * Next instant strictly after `from` at which Israel's clock reads `hour`:00.
 * @param {Date} from
 * @param {number} hour 0-23
 */
export const nextIsraelHour = (from, hour) => {
  const p = israelParts(from);
  let candidate = israelWallToDate(p.year, p.month, p.day, hour);
  if (candidate <= from) {
    // Same wall hour tomorrow (Date.UTC normalizes month/day overflow).
    const t = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
    candidate = israelWallToDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), hour);
  }
  return candidate;
};
