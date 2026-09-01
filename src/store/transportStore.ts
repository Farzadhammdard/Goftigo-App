import {create} from 'zustand';
import type {OfflineQueueEntry} from '../core/types/models';

interface TransportState {
  isOnline: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown' | 'none';
  websocketConnected: boolean;
  offlineQueue: OfflineQueueEntry[];
  selectedTransport: string | null;

  setOnline: (isOnline: boolean) => void;
  setConnectionType: (type: 'wifi' | 'cellular' | 'ethernet' | 'unknown' | 'none') => void;
  setWebSocketConnected: (connected: boolean) => void;
  addToOfflineQueue: (entry: OfflineQueueEntry) => void;
  removeFromOfflineQueue: (id: string) => void;
  updateOfflineQueueEntry: (id: string, updates: Partial<OfflineQueueEntry>) => void;
  clearOfflineQueue: () => void;
  setSelectedTransport: (transport: string | null) => void;
}

export const useTransportStore = create<TransportState>((set) => ({
  isOnline: false,
  connectionType: 'unknown',
  websocketConnected: false,
  offlineQueue: [],
  selectedTransport: null,

  setOnline: (isOnline) => set({isOnline}),
  setConnectionType: (connectionType) => set({connectionType}),
  setWebSocketConnected: (websocketConnected) => set({websocketConnected}),

  addToOfflineQueue: (entry) =>
    set((state) => ({
      offlineQueue: [...state.offlineQueue, entry],
    })),

  removeFromOfflineQueue: (id) =>
    set((state) => ({
      offlineQueue: state.offlineQueue.filter((e) => e.id !== id),
    })),

  updateOfflineQueueEntry: (id, updates) =>
    set((state) => ({
      offlineQueue: state.offlineQueue.map((e) =>
        e.id === id ? {...e, ...updates} : e,
      ),
    })),

  clearOfflineQueue: () => set({offlineQueue: []}),

  setSelectedTransport: (selectedTransport) => set({selectedTransport}),
}));
