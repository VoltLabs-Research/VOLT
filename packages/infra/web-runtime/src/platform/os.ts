// Node's `os` for a worker: a Linux machine with the browser's cores and memory. The errno table is
// the one every platform module reports its errors with, as Node does (errors carry -errno).
export const errno = {
    EPERM: 1,
    ENOENT: 2,
    EIO: 5,
    EBADF: 9,
    EAGAIN: 11,
    ENOMEM: 12,
    EACCES: 13,
    EBUSY: 16,
    EEXIST: 17,
    EXDEV: 18,
    ENOTDIR: 20,
    EISDIR: 21,
    EINVAL: 22,
    EMFILE: 24,
    ENOSPC: 28,
    EPIPE: 32,
    ENOSYS: 38,
    ENOTEMPTY: 39,
    ENOTSUP: 95,
    EADDRINUSE: 98,
    ECONNRESET: 104,
    ETIMEDOUT: 110,
    ECONNREFUSED: 111
} as const;

export type ErrnoCode = keyof typeof errno;

// The errno a Node error with this code carries; -1 for codes outside the table.
export const errnoOf = (code: string): number => -(errno[code as ErrnoCode] ?? 1);

const signals = {
    SIGHUP: 1,
    SIGINT: 2,
    SIGQUIT: 3,
    SIGKILL: 9,
    SIGUSR1: 10,
    SIGUSR2: 12,
    SIGPIPE: 13,
    SIGALRM: 14,
    SIGTERM: 15
} as const;

const priority = {
    PRIORITY_LOW: 19,
    PRIORITY_BELOW_NORMAL: 10,
    PRIORITY_NORMAL: 0,
    PRIORITY_ABOVE_NORMAL: -7,
    PRIORITY_HIGH: -14,
    PRIORITY_HIGHEST: -20
} as const;

export const constants = { errno, signals, priority, UV_UDP_REUSEADDR: 4 };

const GIB = 1024 ** 3;
// navigator.deviceMemory is a rounded lower bound in GiB, and absent outside Chromium.
const totalBytes = ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4) * GIB;

export const EOL = '\n';
export const devNull = '/dev/null';
export const platform = (): string => process.platform;
export const type = (): string => 'Linux';
export const arch = (): string => process.arch;
export const machine = (): string => process.arch;
export const release = (): string => navigator.userAgent;
export const version = (): string => navigator.userAgent;
export const endianness = (): 'LE' => 'LE';
export const hostname = (): string => 'localhost';
export const homedir = (): string => process.env.HOME ?? '/home/volt';
export const tmpdir = (): string => process.env.TMPDIR ?? '/tmp';
export const uptime = (): number => performance.now() / 1000;
export const loadavg = (): number[] => [0, 0, 0];
export const availableParallelism = (): number => navigator.hardwareConcurrency || 1;
export const totalmem = (): number => totalBytes;
// The browser does not expose free memory; the JS heap limit is the closest bound when it is known.
export const freemem = (): number => {
    const memory = (performance as Performance & { memory?: { jsHeapSizeLimit: number; usedJSHeapSize: number } }).memory;
    return memory ? Math.max(0, memory.jsHeapSizeLimit - memory.usedJSHeapSize) : totalBytes / 2;
};
export const cpus = (): Array<{ model: string; speed: number; times: Record<'user' | 'nice' | 'sys' | 'idle' | 'irq', number> }> => (
    Array.from({ length: availableParallelism() }, () => ({
        model: 'wasm32',
        speed: 0,
        times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 }
    }))
);
export const networkInterfaces = (): Record<string, never[]> => ({});
export const userInfo = (): { uid: number; gid: number; username: string; homedir: string; shell: null } => ({
    uid: 1000,
    gid: 1000,
    username: 'volt',
    homedir: homedir(),
    shell: null
});
// Workers have no scheduling priority to change.
export const getPriority = (): number => 0;
export const setPriority = (): void => {};

export default {
    EOL,
    devNull,
    constants,
    platform,
    type,
    arch,
    machine,
    release,
    version,
    endianness,
    hostname,
    homedir,
    tmpdir,
    uptime,
    loadavg,
    availableParallelism,
    totalmem,
    freemem,
    cpus,
    networkInterfaces,
    userInfo,
    getPriority,
    setPriority
};
