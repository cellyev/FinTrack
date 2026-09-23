import {
  calculateNextOccurrence,
  getDaysInMonth,
} from '@/features/recurring-transactions/domain/recurring-frequency';

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

describe('Recurring Long-Horizon & High-Stress Date Arithmetic Engine', () => {
  describe('A. 10-Year (120-Month) Jan 31 Month-End Clamping & Anchor Preservation', () => {
    it('advances 120 monthly cycles from 2026-01-31 without anchor drift', () => {
      let currentDate = '2026-01-31';
      const anchorDay = 31;

      for (let cycle = 1; cycle <= 120; cycle++) {
        const nextDate = calculateNextOccurrence(currentDate, 'monthly', anchorDay);
        const [yearStr, monthStr, dayStr] = nextDate.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const day = parseInt(dayStr, 10);

        const daysInCurrentMonth = getDaysInMonth(year, month);
        const expectedDay = Math.min(anchorDay, daysInCurrentMonth);

        expect(day).toBe(expectedDay);

        // Clamping checks
        if (month === 2) {
          expect(day).toBe(isLeapYear(year) ? 29 : 28);
        } else if ([4, 6, 9, 11].includes(month)) {
          expect(day).toBe(30);
        } else {
          expect(day).toBe(31);
        }

        currentDate = nextDate;
      }

      // After 120 months (10 full years), we should land precisely on 2036-01-31
      expect(currentDate).toBe('2036-01-31');
    });
  });

  describe('B. Leap-Year Feb 29 Anchor Progression Over 10 Years', () => {
    it('advances monthly from 2024-02-29 preserving anchor day 29 in subsequent leap and non-leap years', () => {
      let currentDate = '2024-02-29';
      const anchorDay = 29;

      for (let cycle = 1; cycle <= 120; cycle++) {
        const nextDate = calculateNextOccurrence(currentDate, 'monthly', anchorDay);
        const [yearStr, monthStr, dayStr] = nextDate.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const day = parseInt(dayStr, 10);

        if (month === 2) {
          expect(day).toBe(isLeapYear(year) ? 29 : 28);
        } else {
          expect(day).toBe(29);
        }

        currentDate = nextDate;
      }

      expect(currentDate).toBe('2034-02-28');
    });
  });

  describe('C. Multi-Cycle Yearly Progression with Leap Year Clamping', () => {
    it('advances yearly from 2024-02-29 across 12 years clamping to Feb 28 and restoring Feb 29 in leap years', () => {
      let currentDate = '2024-02-29';
      const anchorDay = 29;
      const expectedYears: [string, string][] = [
        ['2024-02-29', '2025-02-28'],
        ['2025-02-28', '2026-02-28'],
        ['2026-02-28', '2027-02-28'],
        ['2027-02-28', '2028-02-29'], // 2028 is leap year
        ['2028-02-29', '2029-02-28'],
        ['2029-02-28', '2030-02-28'],
        ['2030-02-28', '2031-02-28'],
        ['2031-02-28', '2032-02-29'], // 2032 is leap year
        ['2032-02-29', '2033-02-28'],
        ['2033-02-28', '2034-02-28'],
        ['2034-02-28', '2035-02-28'],
        ['2035-02-28', '2036-02-29'], // 2036 is leap year
      ];

      for (const [start, expectedNext] of expectedYears) {
        const next = calculateNextOccurrence(start, 'yearly', anchorDay);
        expect(next).toBe(expectedNext);
        currentDate = next;
      }

      expect(currentDate).toBe('2036-02-29');
    });
  });

  describe('D. 10-Year (520-Week) Weekly Progression', () => {
    it('advances exactly 520 weekly steps of 7 days without drift', () => {
      let currentDate = '2026-01-05'; // Monday
      const startMs = Date.UTC(2026, 0, 5);

      for (let week = 1; week <= 520; week++) {
        const nextDate = calculateNextOccurrence(currentDate, 'weekly');
        const [yearStr, monthStr, dayStr] = nextDate.split('-');
        const currentMs = Date.UTC(
          parseInt(yearStr, 10),
          parseInt(monthStr, 10) - 1,
          parseInt(dayStr, 10)
        );

        // Must be exactly 7 * week days from start
        const diffDays = Math.round((currentMs - startMs) / (1000 * 60 * 60 * 24));
        expect(diffDays).toBe(week * 7);

        // Day of week must stay Monday (ISO day 1)
        const dateObj = new Date(nextDate + 'T00:00:00Z');
        expect(dateObj.getUTCDay()).toBe(1);

        currentDate = nextDate;
      }
    });
  });

  describe('E. 10-Year (3652-Day) Daily Progression', () => {
    it('advances 3652 daily steps covering all month boundaries and leap days', () => {
      let currentDate = '2024-01-01'; // 2024 is leap year (366 days)
      const startMs = Date.UTC(2024, 0, 1);

      for (let dayCount = 1; dayCount <= 3652; dayCount++) {
        const nextDate = calculateNextOccurrence(currentDate, 'daily');
        const [yearStr, monthStr, dayStr] = nextDate.split('-');
        const currentMs = Date.UTC(
          parseInt(yearStr, 10),
          parseInt(monthStr, 10) - 1,
          parseInt(dayStr, 10)
        );

        const diffDays = Math.round((currentMs - startMs) / (1000 * 60 * 60 * 24));
        expect(diffDays).toBe(dayCount);

        currentDate = nextDate;
      }
    });
  });
});
