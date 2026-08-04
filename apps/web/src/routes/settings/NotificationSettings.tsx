import {
  notificationCategories,
  notificationCopy,
  type NotificationCategory,
  type NotificationPreference,
} from '@grounded/notifications';
import { Button, Card, Checkbox, TextField } from '@grounded/ui/web';
import { useState } from 'react';
const storageKey = 'grounded:notification-preferences:v1';
const labels: Record<NotificationCategory, string> = {
  habit_due: 'Habit reminders',
  weigh_in_weekly: 'Weekly weigh-in',
  routine_planned: 'Planned movement',
};
function defaults(): NotificationPreference[] {
  return notificationCategories.map((category) => ({
    category,
    enabled: false,
    localTime: category === 'habit_due' ? '09:00' : '18:00',
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  }));
}
function load() {
  try {
    const value = localStorage.getItem(storageKey);
    return value ? (JSON.parse(value) as NotificationPreference[]) : defaults();
  } catch {
    return defaults();
  }
}
export function Component() {
  const [preferences, setPreferences] = useState(load);
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    'Notification' in window ? Notification.permission : 'denied',
  );
  const [message, setMessage] = useState<string | null>(null);
  function update(category: NotificationCategory, change: Partial<NotificationPreference>) {
    setPreferences((current) =>
      current.map((item) => (item.category === category ? { ...item, ...change } : item)),
    );
  }
  function save() {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
    setMessage('Reminder preferences saved on this device.');
  }
  async function enable() {
    if (!('Notification' in window)) {
      setMessage('Notifications are not supported by this browser.');
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    setMessage(result === 'granted' ? 'Notifications enabled.' : 'Notifications remain off.');
  }
  async function test(category: NotificationCategory) {
    if (permission !== 'granted') return;
    const copy = notificationCopy[category];
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(copy.title, {
      body: copy.body,
      tag: `grounded-test-${category}`,
      data: { url: copy.deepLink },
    });
  }
  return (
    <Card>
      <header className="settings-section-heading">
        <p className="eyebrow">REMINDERS</p>
        <h2>Gentle, private reminders</h2>
        <p>
          Permission is optional. Notifications never show health values or private notes on your
          lock screen.
        </p>
      </header>
      <div className="settings-form">
        <div className="permission-row">
          <div>
            <strong>Browser permission</strong>
            <p>Current status: {permission}</p>
          </div>
          <Button onClick={() => void enable()} variant="secondary">
            {permission === 'granted' ? 'Permission enabled' : 'Enable notifications'}
          </Button>
        </div>
        {preferences.map((preference) => (
          <fieldset className="notification-preference" key={preference.category}>
            <legend>{labels[preference.category]}</legend>
            <Checkbox
              checked={preference.enabled}
              label="Enabled"
              onChange={(event) => update(preference.category, { enabled: event.target.checked })}
            />
            <TextField
              label="Reminder time"
              onChange={(event) => update(preference.category, { localTime: event.target.value })}
              type="time"
              value={preference.localTime}
            />
            <Button
              disabled={permission !== 'granted'}
              onClick={() => void test(preference.category)}
              variant="quiet"
            >
              Send test
            </Button>
          </fieldset>
        ))}
        <div className="form-grid form-grid--two">
          <TextField
            label="Quiet hours start"
            onChange={(event) =>
              setPreferences((current) =>
                current.map((item) => ({ ...item, quietHoursStart: event.target.value })),
              )
            }
            type="time"
            value={preferences[0]?.quietHoursStart ?? '22:00'}
          />
          <TextField
            label="Quiet hours end"
            onChange={(event) =>
              setPreferences((current) =>
                current.map((item) => ({ ...item, quietHoursEnd: event.target.value })),
              )
            }
            type="time"
            value={preferences[0]?.quietHoursEnd ?? '07:00'}
          />
        </div>
        {message ? (
          <p className="success-message" role="status">
            {message}
          </p>
        ) : null}
        <Button onClick={save}>Save reminders</Button>
      </div>
    </Card>
  );
}
