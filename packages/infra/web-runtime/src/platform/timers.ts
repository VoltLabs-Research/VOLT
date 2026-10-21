// Node's `timers`, which are also its globals: handles with ref()/unref() and refresh(), where browser
// timers return numbers. Handles convert to their numeric id, as Node's do, for code that keeps it.
const browserScope: WindowOrWorkerGlobalScope = globalThis;
const nativeSetTimeout = browserScope.setTimeout.bind(globalThis);
const nativeClearTimeout = browserScope.clearTimeout.bind(globalThis);
const nativeSetInterval = browserScope.setInterval.bind(globalThis);
const nativeClearInterval = browserScope.clearInterval.bind(globalThis);

type TimerCallback = (...args: unknown[]) => void;

export class Timeout {
    private id: number;

    constructor(
        private readonly callback: TimerCallback,
        private readonly delay: number | undefined,
        private readonly args: unknown[],
        private readonly repeat: boolean
    ){
        this.id = this.schedule();
    }

    private schedule(): number {
        return this.repeat
            ? nativeSetInterval(this.callback, this.delay, ...this.args)
            : nativeSetTimeout(this.callback, this.delay, ...this.args);
    }

    // Restarts the timer with its original delay, as Node's does (engine.io's heartbeat relies on it).
    refresh(): this {
        this.close();
        this.id = this.schedule();
        return this;
    }

    ref(): this { return this; }
    unref(): this { return this; }
    hasRef(): boolean { return true; }

    close(): void {
        if(this.repeat){
            nativeClearInterval(this.id);
        }else{
            nativeClearTimeout(this.id);
        }
    }

    [Symbol.toPrimitive](): number { return this.id; }
}

const clear = (handle: unknown): void => {
    if(handle instanceof Timeout){
        handle.close();
    }else if(typeof handle === 'number'){
        nativeClearTimeout(handle);
    }
};

export const setTimeout = (callback: TimerCallback, delay?: number, ...args: unknown[]): Timeout => new Timeout(callback, delay, args, false);
export const setInterval = (callback: TimerCallback, delay?: number, ...args: unknown[]): Timeout => new Timeout(callback, delay, args, true);
export const setImmediate = (callback: TimerCallback, ...args: unknown[]): Timeout => new Timeout(callback, 0, args, false);
export const clearTimeout = clear;
export const clearInterval = clear;
export const clearImmediate = clear;

const timers = { setTimeout, setInterval, setImmediate, clearTimeout, clearInterval, clearImmediate };

export default timers;
