export type DiagnosticStatus = 'ok' | 'warning' | 'error' | 'unknown';

export interface DiagnosticCheck {
  name: string;
  displayName: string;
  status: DiagnosticStatus;
  message: string;
  technicalDetails: string;
  recommendedAction: string | null;
  lastCheckedAt: number;
}

export interface DiagnosticsReport {
  checks: DiagnosticCheck[];
  overallStatus: DiagnosticStatus;
  generatedAt: number;
  deviceInfo: DeviceInfo;
}

export interface DeviceInfo {
  platform: string;
  osVersion: string;
  appVersion: string;
  buildNumber: string;
  storageUsed: number;
  storageAvailable: number;
  totalMemory: number;
  usedMemory: number;
}

export type DiagnosticCheckName =
  | 'internet'
  | 'api'
  | 'websocket'
  | 'account'
  | 'storage'
  | 'permissions'
  | 'bluetooth'
  | 'nearby'
  | 'local_network'
  | 'p2p'
  | 'notifications'
  | 'audio'
  | 'background_tasks'
  | 'sync_queue';

export const DIAGNOSTIC_CHECK_ORDER: DiagnosticCheckName[] = [
  'internet',
  'api',
  'websocket',
  'account',
  'storage',
  'permissions',
  'bluetooth',
  'nearby',
  'local_network',
  'p2p',
  'notifications',
  'audio',
  'background_tasks',
  'sync_queue',
];
