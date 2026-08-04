import * as SecureStore from 'expo-secure-store';

type MobilePersistence = 'durable' | 'session';

export class MobileAuthStorage {
  private persistence: MobilePersistence = 'durable';
  private readonly sessionValues = new Map<string, string>();
  public setPersistence(value: MobilePersistence): void {
    this.persistence = value;
    if (value === 'session') this.sessionValues.clear();
  }
  public async getItem(key: string): Promise<string | null> {
    return this.persistence === 'session'
      ? (this.sessionValues.get(key) ?? null)
      : SecureStore.getItemAsync(key);
  }
  public async setItem(key: string, value: string): Promise<void> {
    if (this.persistence === 'session') {
      this.sessionValues.set(key, value);
      await SecureStore.deleteItemAsync(key);
      return;
    }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    this.sessionValues.delete(key);
  }
  public async removeItem(key: string): Promise<void> {
    this.sessionValues.delete(key);
    await SecureStore.deleteItemAsync(key);
  }
}
