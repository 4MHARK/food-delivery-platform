// Opening-hours math for restaurant schedules.
//
// All schedules are interpreted in one timezone (WAT by default). Times are
// "HH:MM" in 24-hour form. A window like 18:00–02:00 crosses midnight: the
// evening portion belongs to today's row, the early-morning portion to
// yesterday's.
const TIMEZONE = process.env.RESTAURANT_TIMEZONE || "Africa/Lagos";

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function localClock(now) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const value = (type) => parts.find((part) => part.type === type)?.value;
  let hour = Number(value("hour"));
  if (hour === 24) hour = 0; // some ICU versions render midnight as 24

  return {
    dayOfWeek: WEEKDAYS[value("weekday")],
    minutes: hour * 60 + Number(value("minute")),
  };
}

function toMinutes(time) {
  if (!time) return null;
  const [hours, minutes] = String(time).split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return hours * 60 + minutes;
}

// Returns { isOpenNow, reason } where reason is "manual" | "hours" | "always".
export function computeOpenStatus(restaurant, now = new Date()) {
  if (restaurant.isOpen === false) {
    return { isOpenNow: false, reason: "manual" };
  }

  const hours = restaurant.hours || [];
  if (hours.length === 0) {
    // No schedule configured means always open (backwards compatible).
    return { isOpenNow: true, reason: "always" };
  }

  const { dayOfWeek, minutes } = localClock(now);
  const today = hours.find((row) => row.dayOfWeek === dayOfWeek);
  const yesterday = hours.find((row) => row.dayOfWeek === (dayOfWeek + 6) % 7);

  if (today && !today.isClosed) {
    const open = toMinutes(today.openTime);
    const close = toMinutes(today.closeTime);

    if (open !== null && close !== null) {
      if (open === close) return { isOpenNow: true, reason: "hours" }; // 24h
      if (open < close && minutes >= open && minutes < close) {
        return { isOpenNow: true, reason: "hours" };
      }
      // Overnight window: only the evening portion belongs to today.
      if (open > close && minutes >= open) {
        return { isOpenNow: true, reason: "hours" };
      }
    }
  }

  // Early morning may still be inside yesterday's overnight window.
  if (yesterday && !yesterday.isClosed) {
    const open = toMinutes(yesterday.openTime);
    const close = toMinutes(yesterday.closeTime);
    if (open !== null && close !== null && open > close && minutes < close) {
      return { isOpenNow: true, reason: "hours" };
    }
  }

  return { isOpenNow: false, reason: "hours" };
}

export { TIMEZONE };
