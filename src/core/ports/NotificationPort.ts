export interface NotificationPort {
  requestPermission(): Promise<boolean>;
  hasPermission(): Promise<boolean>;

  showNotification(options: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    sound?: boolean;
    badge?: number;
  }): Promise<void>;

  cancelNotification(notificationId: string): Promise<void>;
  cancelAllNotifications(): Promise<void>;
}
