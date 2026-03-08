export interface IScriptingSessionLockLease {
    release(): Promise<void>;
};

export interface IScriptingSessionLock {
    acquire(key: string, ttlMs: number): Promise<IScriptingSessionLockLease | null>;
};
