import { create } from 'zustand';

export interface UserPreferencesState {
  defaultAccountId?: string;
  defaultCategoryId?: string;
  currencyDisplay: 'standard' | 'short';
  hapticsEnabled: boolean;
  setDefaultAccountId: (id?: string) => void;
  setDefaultCategoryId: (id?: string) => void;
  setCurrencyDisplay: (format: 'standard' | 'short') => void;
  setHapticsEnabled: (enabled: boolean) => void;
}

export const useUserPreferences = create<UserPreferencesState>((set) => ({
  defaultAccountId: undefined,
  defaultCategoryId: undefined,
  currencyDisplay: 'standard',
  hapticsEnabled: true,
  setDefaultAccountId: (id) => set({ defaultAccountId: id }),
  setDefaultCategoryId: (id) => set({ defaultCategoryId: id }),
  setCurrencyDisplay: (currencyDisplay) => set({ currencyDisplay }),
  setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
}));
