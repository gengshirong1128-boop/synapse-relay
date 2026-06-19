import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEYS = {
  AUTH_TOKEN: 'relay_auth_token',
  SERVER_URL: 'relay_server_url',
  API_CONFIG: 'relay_api_config',
  THEME: 'app_theme',
} as const;

type WebStorage = {
  localStorage?: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
};

export const storage = {
  async getToken(): Promise<string | null> {
    return getItem(KEYS.AUTH_TOKEN);
  },

  async setToken(token: string): Promise<void> {
    await setItem(KEYS.AUTH_TOKEN, token);
  },

  async clearToken(): Promise<void> {
    await deleteItem(KEYS.AUTH_TOKEN);
  },

  async getServerUrl(): Promise<string | null> {
    return getItem(KEYS.SERVER_URL);
  },

  async setServerUrl(url: string): Promise<void> {
    await setItem(KEYS.SERVER_URL, url);
  },

  async getApiConfig(): Promise<{ baseUrl: string; apiKey: string; model: string } | null> {
    const raw = await getItem(KEYS.API_CONFIG);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },

  async setApiConfig(config: { baseUrl: string; apiKey: string; model: string }): Promise<void> {
    await setItem(KEYS.API_CONFIG, JSON.stringify(config));
  },

  async getTheme(): Promise<'light' | 'dark' | null> {
    const v = await getItem(KEYS.THEME);
    return (v === 'light' || v === 'dark') ? v : null;
  },

  async setTheme(theme: 'light' | 'dark'): Promise<void> {
    await setItem(KEYS.THEME, theme);
  },
};

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return (globalThis as WebStorage).localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      (globalThis as WebStorage).localStorage?.setItem(key, value);
    } catch {
      // Ignore browser storage restrictions in preview mode.
    }
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      (globalThis as WebStorage).localStorage?.removeItem(key);
    } catch {
      // Ignore browser storage restrictions in preview mode.
    }
    return;
  }

  await SecureStore.deleteItemAsync(key);
}
