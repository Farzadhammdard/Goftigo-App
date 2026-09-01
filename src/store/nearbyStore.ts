import {create} from 'zustand';
import type {NearbyDevice} from '../core/types/models';

interface NearbyState {
  isScanning: boolean;
  discoveredDevices: NearbyDevice[];
  pendingConnectionId: string | null;
  activeConnections: Record<string, {deviceId: string; connectedAt: number}>;
  lastScanTime: number | null;
  error: string | null;

  setScanning: (scanning: boolean) => void;
  addDevice: (device: NearbyDevice) => void;
  removeDevice: (deviceId: string) => void;
  clearDevices: () => void;
  setPendingConnection: (connectionId: string | null) => void;
  addConnection: (connectionId: string, deviceId: string) => void;
  removeConnection: (connectionId: string) => void;
  setError: (error: string | null) => void;
  setLastScanTime: (time: number) => void;
}

export const useNearbyStore = create<NearbyState>((set) => ({
  isScanning: false,
  discoveredDevices: [],
  pendingConnectionId: null,
  activeConnections: {},
  lastScanTime: null,
  error: null,

  setScanning: (isScanning) => set({isScanning}),

  addDevice: (device) =>
    set((state) => {
      const existing = state.discoveredDevices.findIndex(
        (d) => d.deviceId === device.deviceId,
      );
      if (existing >= 0) {
        const updated = [...state.discoveredDevices];
        updated[existing] = device;
        return {discoveredDevices: updated};
      }
      return {
        discoveredDevices: [...state.discoveredDevices, device],
      };
    }),

  removeDevice: (deviceId) =>
    set((state) => ({
      discoveredDevices: state.discoveredDevices.filter(
        (d) => d.deviceId !== deviceId,
      ),
    })),

  clearDevices: () => set({discoveredDevices: []}),

  setPendingConnection: (pendingConnectionId) => set({pendingConnectionId}),

  addConnection: (connectionId, deviceId) =>
    set((state) => ({
      activeConnections: {
        ...state.activeConnections,
        [connectionId]: {deviceId, connectedAt: Date.now()},
      },
    })),

  removeConnection: (connectionId) =>
    set((state) => {
      const {[connectionId]: _, ...rest} = state.activeConnections;
      return {activeConnections: rest};
    }),

  setError: (error) => set({error}),

  setLastScanTime: (lastScanTime) => set({lastScanTime}),
}));
