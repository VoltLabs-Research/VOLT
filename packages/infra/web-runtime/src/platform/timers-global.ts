// Node timers return objects with ref()/unref(); browser timers return numbers. The backends call
// unref() on maintenance timers, so the globals hand out Node-shaped handles that still convert to
// the numeric id for clearTimeout.
class Timeout {
    constructor(readonly id: number){}

    ref(): this { return this; }
    unref(): this { return this; }
    hasRef(): boolean { return true; }
    refresh(): this { return this; }
    close(): void { nativeClearTimeout(this.id); }
    [Symbol.toPrimitive](): number { return this.id; }
}

const browserScope: WindowOrWorkerGlobalScope = globalThis;
const nativeSetTimeout = browserScope.setTimeout.bind(globalThis);
const nativeClearTimeout = browserScope.clearTimeout.bind(globalThis);
const nativeSetInterval = browserScope.setInterval.bind(globalThis);
const nativeClearInterval = browserScope.clearInterval.bind(globalThis);

const idOf = (handle: unknown): number | undefined => (
    handle instanceof Timeout ? handle.id : typeof handle === 'number' ? handle : undefined
);

const install = (): void => {
    Object.assign(globalThis, {
        setTimeout: (callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => new Timeout(nativeSetTimeout(callback, delay, ...args)),
        clearTimeout: (handle: unknown) => nativeClearTimeout(idOf(handle)),
        setInterval: (callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => new Timeout(nativeSetInterval(callback, delay, ...args)),
        clearInterval: (handle: unknown) => nativeClearInterval(idOf(handle)),
        setImmediate: (callback: (...args: unknown[]) => void, ...args: unknown[]) => new Timeout(nativeSetTimeout(callback, 0, ...args)),
        clearImmediate: (handle: unknown) => nativeClearTimeout(idOf(handle))
    });
};

install();

export {};
