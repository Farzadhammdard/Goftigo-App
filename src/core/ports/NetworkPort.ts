export interface NetworkPort {
  isInternetAvailable(): Promise<boolean>;
  isWifiAvailable(): Promise<boolean>;
  isBluetoothEnabled(): Promise<boolean>;
  getConnectionType(): Promise<'wifi' | 'cellular' | 'ethernet' | 'unknown' | 'none'>;

  onConnectivityChange(handler: (isConnected: boolean) => void): void;
}
