export interface StoragePort {
  initialize(): Promise<void>;
  close(): Promise<void>;

  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;

  clear(): Promise<void>;

  execute(sql: string, params?: unknown[]): Promise<unknown[]>;
  executeBatch(operations: Array<{sql: string; params?: unknown[]}>): Promise<void>;
}
