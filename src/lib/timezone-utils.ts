import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Converts a UTC date to the user's timezone
 * @param date - Date string or Date object in UTC
 * @param timezone - User's timezone (e.g., 'America/Denver')
 * @returns Date object in the user's timezone
 */
export const toUserTimezone = (date: Date | string, timezone: string): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return toZonedTime(dateObj, timezone);
};

/**
 * Converts a date from the user's timezone to UTC
 * @param date - Date object in user's local timezone
 * @param timezone - User's timezone (e.g., 'America/Denver')
 * @returns Date object in UTC
 */
export const fromUserTimezone = (date: Date, timezone: string): Date => {
  return fromZonedTime(date, timezone);
};

/**
 * Gets the hour in the user's timezone
 * @param date - Date string or Date object in UTC
 * @param timezone - User's timezone
 * @returns Hour (0-23) in user's timezone
 */
export const getHourInTimezone = (date: Date | string, timezone: string): number => {
  const zonedDate = toUserTimezone(date, timezone);
  return zonedDate.getHours();
};

/**
 * Creates a date at a specific time in the user's timezone and converts to UTC
 * @param dateStr - Date string like "2025-10-23"
 * @param time - Time string like "23:59:59"
 * @param timezone - User's timezone
 * @returns ISO string in UTC
 */
export const createDateInTimezone = (
  dateStr: string,
  time: string,
  timezone: string
): string => {
  const localDate = new Date(`${dateStr}T${time}`);
  const utcDate = fromZonedTime(localDate, timezone);
  return utcDate.toISOString();
};
