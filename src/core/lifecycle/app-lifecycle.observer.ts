import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import { SyncCoordinator } from '../sync/application/sync-coordinator';

export class AppLifecycleObserver {
  private subscription: NativeEventSubscription | null = null;
  private lastState: AppStateStatus = AppState.currentState;

  constructor(
    private readonly coordinator: SyncCoordinator = SyncCoordinator.getInstance()
  ) {}

  public initialize(): void {
    if (this.subscription) {
      return;
    }

    this.subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBackground = this.lastState === 'background' || this.lastState === 'inactive';
      const isNowActive = nextState === 'active';

      this.lastState = nextState;

      if (wasBackground && isNowActive) {
        this.coordinator.requestSync('foreground', 300);
      }
    });
  }

  public cleanup(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }
}

export const appLifecycleObserver = new AppLifecycleObserver();
