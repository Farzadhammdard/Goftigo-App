declare module 'sql.js' {
  export interface Database {
    prepare(sql: string): Statement;
    run(sql: string, params?: any[]): void;
    exec(sql: string): any[];
    export(): Uint8Array;
    close(): void;
  }
  export interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, any>;
    free(): void;
  }
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }
  export default function initSqlJs(config?: any): Promise<SqlJsStatic>;
}
