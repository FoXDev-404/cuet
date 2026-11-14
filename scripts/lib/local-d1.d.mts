export declare function executeLocalD1(sql: string): void;
export declare function executeLocalD1WithRetry(sql: string): void;
export declare function queryLocalD1<T = Record<string, unknown>>(sql: string): T[];
