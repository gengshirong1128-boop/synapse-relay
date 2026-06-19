import * as SecureStore from 'expo-secure-store';

export interface ApiProfile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  backend: 'claude-code' | 'codex';
}

const STORAGE_KEY = 'api_profiles';

export const profileStorage = {
  async getProfiles(): Promise<ApiProfile[]> {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  },

  async saveProfiles(profiles: ApiProfile[]): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(profiles));
  },

  async addProfile(profile: ApiProfile): Promise<void> {
    const profiles = await this.getProfiles();
    profiles.push(profile);
    await this.saveProfiles(profiles);
  },

  async updateProfile(id: string, updates: Partial<ApiProfile>): Promise<void> {
    const profiles = await this.getProfiles();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx >= 0) {
      profiles[idx] = { ...profiles[idx], ...updates };
      await this.saveProfiles(profiles);
    }
  },

  async deleteProfile(id: string): Promise<void> {
    const profiles = await this.getProfiles();
    await this.saveProfiles(profiles.filter(p => p.id !== id));
  },
};
