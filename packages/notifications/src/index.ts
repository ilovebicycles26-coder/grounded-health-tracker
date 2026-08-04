import { failure, success, type Result } from '@grounded/domain';
export const notificationCategories = ['habit_due', 'weigh_in_weekly', 'routine_planned'] as const;
export type NotificationCategory = (typeof notificationCategories)[number];
export interface NotificationPreference {
  readonly category: NotificationCategory;
  readonly enabled: boolean;
  readonly localTime: string;
  readonly quietHoursStart: string;
  readonly quietHoursEnd: string;
}
export interface NotificationRequest {
  readonly id: string;
  readonly category: NotificationCategory;
  readonly deliverAt: string;
  readonly deepLink: string;
}
export interface NotificationScheduler {
  schedule(request: NotificationRequest): Promise<Result<void>>;
  cancel(id: string): Promise<Result<void>>;
}
export const notificationCopy: Record<
  NotificationCategory,
  { title: string; body: string; deepLink: string }
> = {
  habit_due: {
    title: 'A gentle Grounded reminder',
    body: 'A small action is ready when you are.',
    deepLink: '/habits',
  },
  weigh_in_weekly: {
    title: 'A gentle Grounded reminder',
    body: 'Your weekly check-in is ready when you are.',
    deepLink: '/progress/weight',
  },
  routine_planned: {
    title: 'A gentle Grounded reminder',
    body: 'Your movement plan is ready when it suits you.',
    deepLink: '/exercise',
  },
};
export function asLocalTime(value: string): Result<string> {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? success(value)
    : failure({ kind: 'validation', code: 'invalid_local_time', field: 'time' });
}
export function isQuietTime(localTime: string, start: string, end: string): boolean {
  if (start === end) return false;
  return start < end
    ? localTime >= start && localTime < end
    : localTime >= start || localTime < end;
}
export function validateNotificationPreference(
  input: NotificationPreference,
): Result<NotificationPreference> {
  if (!notificationCategories.includes(input.category))
    return failure({ kind: 'validation', code: 'invalid_notification_category' });
  for (const value of [input.localTime, input.quietHoursStart, input.quietHoursEnd]) {
    const time = asLocalTime(value);
    if (!time.ok) return time;
  }
  return success(input);
}
