export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

export type NetworkStatusListener = (status: NetworkStatus) => void;

export interface INetworkMonitor {
  getStatus(): Promise<NetworkStatus>;
  addListener(listener: NetworkStatusListener): () => void;
}
