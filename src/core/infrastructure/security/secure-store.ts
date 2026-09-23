import * as SecureStore from 'expo-secure-store';

export class SecureStoreAdapter {
  public static async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn(`[SecureStoreAdapter] Failed to get item for key "${key}":`, error);
      return null;
    }
  }

  public static async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn(`[SecureStoreAdapter] Failed to set item for key "${key}":`, error);
    }
  }

  public static async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn(`[SecureStoreAdapter] Failed to delete item for key "${key}":`, error);
    }
  }
}
