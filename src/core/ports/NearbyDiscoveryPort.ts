import type {NearbyDevice, TransportType} from '../types/models';

export interface NearbyDiscoveryPort {
  readonly isScanning: boolean;
  readonly isAvailable: boolean;

  initialize(): Promise<void>;
  destroy(): Promise<void>;

  startScanning(): Promise<void>;
  stopScanning(): Promise<void>;

  onDeviceFound(handler: (device: NearbyDevice) => void): void;
  onDeviceLost(handler: (deviceId: string) => void): void;

  sendConnectionRequest(
    deviceId: string,
    payload: string,
  ): Promise<{success: boolean; connectionId?: string; error?: string}>;

  acceptConnection(
    connectionId: string,
  ): Promise<{success: boolean; error?: string}>;

  rejectConnection(connectionId: string): Promise<void>;

  getCapabilities(): {
    supportedTransports: TransportType[];
    maxConnections: number;
  };
}
