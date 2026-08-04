import type { PersistenceController, SessionPersistence } from '@grounded/auth';

const preferenceKey = 'grounded.auth.persistence';
const authPrefix = 'sb-';

export class BrowserAuthStorage implements PersistenceController {
  public constructor(
    private readonly durable: Storage,
    private readonly session: Storage,
  ) {}
  public getPersistence(): SessionPersistence {
    return this.durable.getItem(preferenceKey) === 'durable' ? 'durable' : 'session';
  }
  public setPersistence(value: SessionPersistence): void {
    const previous = this.active();
    this.durable.setItem(preferenceKey, value);
    const next = this.active();
    if (previous === next) return;
    const keys = Array.from({ length: previous.length }, (_, index) => previous.key(index)).filter(
      (key): key is string => key?.startsWith(authPrefix) === true,
    );
    for (const key of keys) {
      const stored = previous.getItem(key);
      if (stored !== null) next.setItem(key, stored);
      previous.removeItem(key);
    }
  }
  public getItem(key: string): string | null {
    return this.active().getItem(key);
  }
  public setItem(key: string, value: string): void {
    this.active().setItem(key, value);
    this.inactive().removeItem(key);
  }
  public removeItem(key: string): void {
    this.durable.removeItem(key);
    this.session.removeItem(key);
  }
  private active(): Storage {
    return this.getPersistence() === 'durable' ? this.durable : this.session;
  }
  private inactive(): Storage {
    return this.getPersistence() === 'durable' ? this.session : this.durable;
  }
}
