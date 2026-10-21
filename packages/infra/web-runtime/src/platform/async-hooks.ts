// Browsers have no async context propagation yet (TC39 AsyncContext), so the store is visible to
// synchronous code inside run() and to nothing that resumes after an await. The backends keep only
// request tracing there, which is then absent from logs; nothing depends on it for correctness.
export class AsyncLocalStorage<T> {
    private store: T | undefined;

    getStore(): T | undefined {
        return this.store;
    }

    run<R>(store: T, callback: (...args: unknown[]) => R, ...args: unknown[]): R {
        const previous = this.store;
        this.store = store;
        try{
            return callback(...args);
        }finally{
            this.store = previous;
        }
    }

    exit<R>(callback: (...args: unknown[]) => R, ...args: unknown[]): R {
        const previous = this.store;
        this.store = undefined;
        try{
            return callback(...args);
        }finally{
            this.store = previous;
        }
    }

    enterWith(store: T): void {
        this.store = store;
    }

    disable(): void {
        this.store = undefined;
    }
}

export class AsyncResource {
    constructor(readonly type: string){}

    runInAsyncScope<R>(callback: (...args: unknown[]) => R, thisArg?: unknown, ...args: unknown[]): R {
        return callback.apply(thisArg, args);
    }

    bind<F extends (...args: never[]) => unknown>(callback: F): F {
        return callback;
    }

    emitDestroy(): this {
        return this;
    }

    static bind<F extends (...args: never[]) => unknown>(callback: F): F {
        return callback;
    }
}

export const createHook = (): { enable(): void; disable(): void } => ({ enable(){}, disable(){} });

export const executionAsyncId = (): number => 1;

export const triggerAsyncId = (): number => 0;

export default { AsyncLocalStorage, AsyncResource, createHook, executionAsyncId, triggerAsyncId };
