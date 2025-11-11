declare module 'sql.js' {
  interface Database {
    run(sql: string): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  interface Statement {
    step(): boolean;
    getColumnNames(): string[];
    getAsObject(): any;
    free(): void;
    run(params?: any[]): void;
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  interface InitSqlJsOptions {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(options?: InitSqlJsOptions): Promise<SqlJsStatic>;
}
