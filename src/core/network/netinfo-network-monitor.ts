import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { INetworkMonitor, NetworkStatus, NetworkStatusListener } from './network-monitor.interface';

export class NetInfoNetworkMonitor implements INetworkMonitor {
  public async getStatus(): Promise<NetworkStatus> {
    const state = await NetInfo.fetch();
    return this.mapState(state);
  }

  public addListener(listener: NetworkStatusListener): () => void {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      listener(this.mapState(state));
    });
    return unsubscribe;
  }

  private mapState(state: NetInfoState): NetworkStatus {
    return {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
    };
  }
}

export const networkMonitor: INetworkMonitor = new NetInfoNetworkMonitor();
