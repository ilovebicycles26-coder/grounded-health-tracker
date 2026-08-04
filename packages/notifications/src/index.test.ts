import { describe, expect, it } from 'vitest';
import { isQuietTime, notificationCopy, validateNotificationPreference } from './index';
describe('notification privacy and quiet hours', () => {
  it('uses generic lock-screen copy', () => {
    const lockScreenText = Object.values(notificationCopy)
      .flatMap(({ title, body }) => [title, body])
      .join(' ');
    expect(lockScreenText).not.toMatch(/weight|supplement|kettlebell/i);
  });
  it('handles quiet hours that cross midnight', () => {
    expect(isQuietTime('23:30', '22:00', '07:00')).toBe(true);
    expect(isQuietTime('08:00', '22:00', '07:00')).toBe(false);
  });
  it('rejects malformed times', () => {
    expect(
      validateNotificationPreference({
        category: 'habit_due',
        enabled: true,
        localTime: '25:00',
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      }).ok,
    ).toBe(false);
  });
});
