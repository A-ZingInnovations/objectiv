/**
 * Ambient module shims: sql.js has no bundled types; `process` is used in a
 * couple of renderer spots where a Vite shim injects `env` values.
 */

declare module 'sql.js' {
  export type SqlValue = number | string | Uint8Array | null;
  export type QueryResult = {
    columns: string[];
    values: SqlValue[][];
  };
  export type QueryParams = SqlValue | SqlValue[];
  export interface Database {
    exec(
      sql: string,
      params?: QueryParams,
      bindTable?: string
    ): QueryResult[];
    run(sql: string, params?: QueryParams): void;
    close(): void;
    export(): Uint8Array;
  }
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }
  export interface InitSqlJsOptions {
    locateFile?: (file: string) => string;
    [key: string]: unknown;
  }
  const initSqlJs: (config?: InitSqlJsOptions) => Promise<SqlJsStatic>;
  export default initSqlJs;
}

declare module 'sql.js/dist/sql-wasm.wasm' {
  const url: string;
  export default url;
}

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}
declare const process: {
  env: NodeJS.ProcessEnv;
  [key: string]: unknown;
};
