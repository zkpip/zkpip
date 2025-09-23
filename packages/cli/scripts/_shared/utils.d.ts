export declare function sha256File(fp: string): Promise<string>;
export type ReadJsonOk<T> = {
    readonly ok: true;
    readonly data: T;
};
export type ReadJsonErr = {
    readonly ok: false;
    readonly err: string;
};
export declare function readJsonSafe<T>(fp: string): Promise<ReadJsonOk<T> | ReadJsonErr>;
export declare function writeJson(fp: string, data: unknown): Promise<void>;
