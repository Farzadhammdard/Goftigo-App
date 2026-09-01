import {create} from 'zustand';
import type {
  DiagnosticCheck,
  DiagnosticsReport,
  DiagnosticCheckName,
} from '../core/types/diagnostics';

interface DiagnosticsState {
  checks: Record<DiagnosticCheckName, DiagnosticCheck>;
  report: DiagnosticsReport | null;
  isRunning: boolean;

  updateCheck: (name: DiagnosticCheckName, check: DiagnosticCheck) => void;
  setReport: (report: DiagnosticsReport) => void;
  setRunning: (running: boolean) => void;
  getCheck: (name: DiagnosticCheckName) => DiagnosticCheck | null;
}

const createDefaultCheck = (name: DiagnosticCheckName, displayName: string): DiagnosticCheck => ({
  name,
  displayName,
  status: 'unknown',
  message: 'Not checked',
  technicalDetails: '',
  recommendedAction: null,
  lastCheckedAt: 0,
});

const defaultChecks: Record<DiagnosticCheckName, DiagnosticCheck> = {
  internet: createDefaultCheck('internet', 'Internet'),
  api: createDefaultCheck('api', 'API Server'),
  websocket: createDefaultCheck('websocket', 'WebSocket'),
  account: createDefaultCheck('account', 'Account'),
  storage: createDefaultCheck('storage', 'Local Storage'),
  permissions: createDefaultCheck('permissions', 'Permissions'),
  bluetooth: createDefaultCheck('bluetooth', 'Bluetooth'),
  nearby: createDefaultCheck('nearby', 'Nearby Discovery'),
  local_network: createDefaultCheck('local_network', 'Local Network'),
  p2p: createDefaultCheck('p2p', 'P2P Connection'),
  notifications: createDefaultCheck('notifications', 'Notifications'),
  audio: createDefaultCheck('audio', 'Audio'),
  background_tasks: createDefaultCheck('background_tasks', 'Background Tasks'),
  sync_queue: createDefaultCheck('sync_queue', 'Sync Queue'),
};

export const useDiagnosticsStore = create<DiagnosticsState>((set, get) => ({
  checks: {...defaultChecks},
  report: null,
  isRunning: false,

  updateCheck: (name, check) =>
    set((state) => ({
      checks: {...state.checks, [name]: check},
    })),

  setReport: (report) => set({report}),

  setRunning: (isRunning) => set({isRunning}),

  getCheck: (name) => get().checks[name] || null,
}));
