import { useUserPreferences } from '@/core/preferences/preferences-store';

export class HapticsService {
  public static triggerSuccess(): void {
    const isEnabled = useUserPreferences.getState().hapticsEnabled;
    if (!isEnabled) return;
    // Platform-safe haptic trigger
  }

  public static triggerImpact(): void {
    const isEnabled = useUserPreferences.getState().hapticsEnabled;
    if (!isEnabled) return;
    // Platform-safe haptic trigger
  }

  public static triggerSelection(): void {
    const isEnabled = useUserPreferences.getState().hapticsEnabled;
    if (!isEnabled) return;
    // Platform-safe haptic trigger
  }
}
