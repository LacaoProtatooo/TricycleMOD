/**
 * Coding Day Utilities
 * 
 * Implements the number coding system where tricycles are restricted from operating
 * on a designated day of the week. Similar to MMDA's number coding scheme.
 */

// Days of the week mapping (0 = Sunday, 6 = Saturday - JavaScript's Date.getDay() format)
export const DAYS_OF_WEEK = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

// Short day names
export const DAYS_SHORT = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

/**
 * Check if today is the tricycle's coding day
 * @param {number|null} codingDay - The coding day (0-6, where 0=Sunday)
 * @returns {boolean} - True if today is the coding day
 */
export const isTodayCodingDay = (codingDay) => {
  if (codingDay === null || codingDay === undefined) {
    return false; // No coding day assigned
  }
  
  const today = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  return today === codingDay;
};

/**
 * Check if a specific date is the tricycle's coding day
 * @param {number|null} codingDay - The coding day (0-6)
 * @param {Date} date - The date to check
 * @returns {boolean} - True if the date falls on the coding day
 */
export const isDateCodingDay = (codingDay, date) => {
  if (codingDay === null || codingDay === undefined) {
    return false;
  }
  
  return date.getDay() === codingDay;
};

/**
 * Get the name of the coding day
 * @param {number|null} codingDay - The coding day (0-6)
 * @param {boolean} short - Whether to return short name (default: false)
 * @returns {string} - The day name or 'None' if no coding day
 */
export const getCodingDayName = (codingDay, short = false) => {
  if (codingDay === null || codingDay === undefined) {
    return 'None';
  }
  
  return short ? DAYS_SHORT[codingDay] : DAYS_OF_WEEK[codingDay];
};

/**
 * Get hours remaining until coding day restriction ends
 * @param {number} codingDay - The coding day (0-6)
 * @returns {number} - Hours until midnight (end of coding day)
 */
export const getHoursUntilCodingEnds = (codingDay) => {
  if (!isTodayCodingDay(codingDay)) {
    return 0;
  }
  
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0); // Next midnight
  
  const diffMs = midnight - now;
  return Math.ceil(diffMs / (1000 * 60 * 60));
};

/**
 * Get the next coding day date
 * @param {number|null} codingDay - The coding day (0-6)
 * @returns {Date|null} - The next occurrence of the coding day
 */
export const getNextCodingDay = (codingDay) => {
  if (codingDay === null || codingDay === undefined) {
    return null;
  }
  
  const today = new Date();
  const todayDay = today.getDay();
  
  // Calculate days until next coding day
  let daysUntil = codingDay - todayDay;
  if (daysUntil <= 0) {
    daysUntil += 7; // Next week
  }
  
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntil);
  nextDate.setHours(0, 0, 0, 0);
  
  return nextDate;
};

/**
 * Format the coding day status message
 * @param {number|null} codingDay - The coding day (0-6)
 * @returns {object} - Status object with message, isCodingDay, and severity
 */
export const getCodingDayStatus = (codingDay) => {
  if (codingDay === null || codingDay === undefined) {
    return {
      isCodingDay: false,
      message: 'No coding day assigned',
      severity: 'none',
      canOperate: true,
    };
  }
  
  if (isTodayCodingDay(codingDay)) {
    const hoursRemaining = getHoursUntilCodingEnds(codingDay);
    return {
      isCodingDay: true,
      message: `Today is your coding day (${getCodingDayName(codingDay)}). You cannot operate this tricycle.`,
      hoursRemaining,
      severity: 'error',
      canOperate: false,
    };
  }
  
  const nextCoding = getNextCodingDay(codingDay);
  const daysUntil = Math.ceil((nextCoding - new Date()) / (1000 * 60 * 60 * 24));
  
  return {
    isCodingDay: false,
    message: `Next coding day: ${getCodingDayName(codingDay)} (${daysUntil} day${daysUntil !== 1 ? 's' : ''} away)`,
    nextCodingDate: nextCoding,
    daysUntilCoding: daysUntil,
    severity: daysUntil === 1 ? 'warning' : 'info',
    canOperate: true,
  };
};

export default {
  DAYS_OF_WEEK,
  DAYS_SHORT,
  isTodayCodingDay,
  isDateCodingDay,
  getCodingDayName,
  getHoursUntilCodingEnds,
  getNextCodingDay,
  getCodingDayStatus,
};
