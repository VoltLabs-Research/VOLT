// Node's `fs`, synchronous at its core: every call is a round trip to this worker's file system
// service (fs/service.ts), which owns the OPFS directory the worker mounted. The promise and callback
// APIs and the streams are built on the synchronous calls.
import { Readable, Writable } from 'stream';
import pathModule from 'path';
import { ownBuffer } from './own-buffer';
import { callFs } from './fs/client';
import { readStdinSync } from './stdio';
import { errnoOf } from './os';
import { constants } from './fs/constants';

export { constants };

interface EntryMetadata {
    kind: 'file' | 'directory';
    size: number;
    mtimeMs: number;
    birthtimeMs: number;
    mode: number;
}


const normalize = (target: unknown): string => {
    const value = target instanceof URL ? decodeURIComponent(target.pathname) : Buffer.isBuffer(target) ? target.toString() : String(target);
    return pathModule.resolve(process.cwd(), value);
};

export class Stats {
    dev = 1;
    ino = 0;
    nlink = 1;
    uid = 1000;
    gid = 1000;
    rdev = 0;
    blksize = 4096;
    blocks: number;
    size: number;
    mode: number;
    atimeMs: number;
    mtimeMs: number;
    ctimeMs: number;
    birthtimeMs: number;
    atime: Date;
    mtime: Date;
    ctime: Date;
    birthtime: Date;

    constructor(entry: EntryMetadata){
        this.size = entry.size;
        this.mode = entry.mode;
        this.blocks = Math.ceil(entry.size / 512);
        this.atimeMs = entry.mtimeMs;
        this.mtimeMs = entry.mtimeMs;
        this.ctimeMs = entry.mtimeMs;
        this.birthtimeMs = entry.birthtimeMs;
        this.atime = new Date(entry.mtimeMs);
        this.mtime = new Date(entry.mtimeMs);
        this.ctime = new Date(entry.mtimeMs);
        this.birthtime = new Date(entry.birthtimeMs);
    }

    isFile(): boolean { return (this.mode & constants.S_IFMT) === constants.S_IFREG; }
    isDirectory(): boolean { return (this.mode & constants.S_IFMT) === constants.S_IFDIR; }
    isSymbolicLink(): boolean { return false; }
    isFIFO(): boolean { return (this.mode & constants.S_IFMT) === constants.S_IFIFO; }
    isSocket(): boolean { return false; }
    isBlockDevice(): boolean { return false; }
    isCharacterDevice(): boolean { return false; }
}

export class Dirent {
    readonly name: string;
    readonly parentPath: string;
    readonly path: string;
    private readonly kind: EntryMetadata['kind'];

    constructor(name: string, parentPath: string, kind: EntryMetadata['kind']){
        this.name = name;
        this.parentPath = parentPath;
        this.path = parentPath;
        this.kind = kind;
    }

    isFile(): boolean { return this.kind === 'file'; }
    isDirectory(): boolean { return this.kind === 'directory'; }
    isSymbolicLink(): boolean { return false; }
    isFIFO(): boolean { return false; }
    isSocket(): boolean { return false; }
    isBlockDevice(): boolean { return false; }
    isCharacterDevice(): boolean { return false; }
}

type Encoding = BufferEncoding | 'buffer' | null | undefined;
type EncodingOption = Encoding | { encoding?: Encoding; flag?: string | number; mode?: number };

const encodingOf = (options: EncodingOption): Encoding => (
    typeof options === 'string' || options === null || options === undefined ? options : options.encoding
);

const decode = (bytes: Uint8Array, encoding: Encoding): string | Buffer => {
    const buffer = ownBuffer(bytes);
    return encoding && encoding !== 'buffer' ? buffer.toString(encoding) : buffer;
};

const toBytes = (data: unknown, encoding: Encoding = 'utf8'): Uint8Array => {
    if(typeof data === 'string'){
        return Buffer.from(data, encoding && encoding !== 'buffer' ? encoding : 'utf8');
    }
    if(data instanceof Uint8Array){
        return data;
    }
    if(ArrayBuffer.isView(data)){
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    if(data instanceof ArrayBuffer){
        return new Uint8Array(data);
    }
    throw new TypeError('The "data" argument must be of type string or an instance of Buffer, TypedArray, or DataView');
};

interface OpenFlags {
    write: boolean;
    create: boolean;
    truncate: boolean;
    append: boolean;
    exclusive: boolean;
}

const flagsOf = (flags: string | number | undefined): OpenFlags => {
    if(typeof flags === 'number'){
        return {
            write: (flags & (constants.O_WRONLY | constants.O_RDWR)) !== 0,
            create: (flags & constants.O_CREAT) !== 0,
            truncate: (flags & constants.O_TRUNC) !== 0,
            append: (flags & constants.O_APPEND) !== 0,
            exclusive: (flags & constants.O_EXCL) !== 0
        };
    }
    const value = flags ?? 'r';
    return {
        write: /[wa+]/.test(value),
        create: /[wa]/.test(value),
        truncate: value.startsWith('w'),
        append: value.startsWith('a'),
        exclusive: value.includes('x')
    };
};

// --- synchronous API ------------------------------------------------------------------------

export const existsSync = (target: unknown): boolean => {
    try{
        return Boolean(callFs('exists', [normalize(target)]).value);
    }catch{
        return false;
    }
};

export const statSync = (target: unknown, options?: { throwIfNoEntry?: boolean; bigint?: boolean }): Stats | undefined => {
    const resolved = normalize(target);
    if(options?.throwIfNoEntry === false && !existsSync(resolved)){
        return undefined;
    }
    return new Stats(callFs('stat', [resolved]).value as EntryMetadata);
};

export const lstatSync = statSync;

export const accessSync = (target: unknown): void => {
    callFs('stat', [normalize(target)]);
};

export const realpathSync = Object.assign((target: unknown): string => {
    const resolved = normalize(target);
    callFs('stat', [resolved]);
    return resolved;
}, { native: (target: unknown): string => realpathSync(target) });

type ReaddirOptions = { withFileTypes?: boolean; recursive?: boolean; encoding?: Encoding } | BufferEncoding;

export const readdirSync = (target: unknown, options?: ReaddirOptions): string[] | Dirent[] => {
    const resolved = normalize(target);
    const withFileTypes = typeof options === 'object' && Boolean(options?.withFileTypes);
    if(typeof options === 'object' && options?.recursive){
        const entries = callFs('readdirRecursive', [resolved]).value as [string, EntryMetadata['kind']][];
        return withFileTypes
            ? entries.map(([key, kind]) => new Dirent(pathModule.basename(key), pathModule.dirname(key), kind))
            : entries.map(([key]) => key.slice(resolved === '/' ? 1 : resolved.length + 1));
    }
    const entries = callFs('readdir', [resolved]).value as [string, EntryMetadata['kind']][];
    return withFileTypes
        ? entries.map(([name, kind]) => new Dirent(name, resolved, kind))
        : entries.map(([name]) => name);
};

export const mkdirSync = (target: unknown, options?: { recursive?: boolean; mode?: number } | number): string | undefined => (
    (callFs('mkdir', [normalize(target), typeof options === 'object' && Boolean(options?.recursive)]).value as string | null) ?? undefined
);

export const rmSync = (target: unknown, options?: { recursive?: boolean; force?: boolean }): void => {
    callFs('rm', [normalize(target), Boolean(options?.recursive), Boolean(options?.force)]);
};

export const rmdirSync = (target: unknown, options?: { recursive?: boolean }): void => {
    callFs('rmdir', [normalize(target), Boolean(options?.recursive)]);
};

export const unlinkSync = (target: unknown): void => {
    callFs('unlink', [normalize(target)]);
};

export const renameSync = (from: unknown, to: unknown): void => {
    callFs('rename', [normalize(from), normalize(to)]);
};

export const copyFileSync = (from: unknown, to: unknown, mode = 0): void => {
    callFs('copyFile', [normalize(from), normalize(to), (mode & constants.COPYFILE_EXCL) !== 0]);
};

export const cpSync = (from: unknown, to: unknown, options?: { recursive?: boolean }): void => {
    const source = normalize(from);
    const target = normalize(to);
    if((statSync(source) as Stats).isFile()){
        copyFileSync(source, target);
        return;
    }
    if(!options?.recursive){
        throw Object.assign(new Error(`EISDIR: illegal operation on a directory, cp '${source}'`), { code: 'ERR_FS_EISDIR' });
    }
    mkdirSync(target, { recursive: true });
    for(const name of readdirSync(source) as string[]){
        cpSync(pathModule.join(source, name), pathModule.join(target, name), options);
    }
};

export const openSync = (target: unknown, flags?: string | number): number => (
    callFs('open', [normalize(target), flagsOf(flags)]).value as number
);

export const closeSync = (fd: number): void => {
    if(!isStandardStream(fd)){
        callFs('close', [fd]);
    }
};

type ReadOptions = { offset?: number; length?: number; position?: number | bigint | null };

// Descriptors 0-2 are the process's standard streams (src/platform/stdio.ts), not files.
const STDIN_FD = 0;
const STDOUT_FD = 1;

const isStandardStream = (fd: number): boolean => fd >= 0 && fd <= 2;

const badDescriptor = (syscall: string): Error => Object.assign(new Error(`EBADF: bad file descriptor, ${syscall}`), {
    code: 'EBADF',
    errno: errnoOf('EBADF'),
    syscall
});

const readDescriptor = (fd: number, target: Uint8Array, at: number | null): number => {
    if(isStandardStream(fd)){
        if(fd !== STDIN_FD){
            throw badDescriptor('read');
        }
        return readStdinSync(target);
    }
    const { body } = callFs('read', [fd, target.byteLength, at]);
    target.set(body);
    return body.byteLength;
};

const writeDescriptor = (fd: number, bytes: Uint8Array, at: number | null): number => {
    if(isStandardStream(fd)){
        if(fd === STDIN_FD){
            throw badDescriptor('write');
        }
        (fd === STDOUT_FD ? process.stdout : process.stderr).write(bytes);
        return bytes.byteLength;
    }
    return callFs('write', [fd, at], bytes).value as number;
};

export const readSync = (fd: number, buffer: Uint8Array, offsetOrOptions?: number | ReadOptions, length?: number, position?: number | bigint | null): number => {
    const options: ReadOptions = typeof offsetOrOptions === 'object' ? offsetOrOptions : { offset: offsetOrOptions, length, position };
    const offset = options.offset ?? 0;
    const count = options.length ?? buffer.byteLength - offset;
    const at = options.position === null || options.position === undefined ? null : Number(options.position);
    return readDescriptor(fd, buffer.subarray(offset, offset + count), at);
};

export const writeSync = (fd: number, data: Uint8Array | string, offsetOrPosition?: number | null, lengthOrEncoding?: number | BufferEncoding, position?: number | null): number => {
    if(typeof data === 'string'){
        const at = typeof offsetOrPosition === 'number' ? offsetOrPosition : null;
        return writeDescriptor(fd, toBytes(data, typeof lengthOrEncoding === 'string' ? lengthOrEncoding : 'utf8'), at);
    }
    const offset = offsetOrPosition ?? 0;
    const length = typeof lengthOrEncoding === 'number' ? lengthOrEncoding : data.byteLength - offset;
    return writeDescriptor(fd, data.subarray(offset, offset + length), position ?? null);
};

// Vectored I/O is one request for all the buffers, as writev(2)/readv(2) are one system call.
export const writevSync = (fd: number, buffers: readonly Uint8Array[], position?: number | null): number => (
    writeDescriptor(fd, Buffer.concat(buffers), position ?? null)
);

export const readvSync = (fd: number, buffers: readonly Uint8Array[], position?: number | null): number => {
    const total = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
    const body = new Uint8Array(total).subarray(0, readDescriptor(fd, new Uint8Array(total), position ?? null));
    let offset = 0;
    for(const buffer of buffers){
        if(offset >= body.byteLength){
            break;
        }
        const chunk = body.subarray(offset, offset + buffer.byteLength);
        buffer.set(chunk);
        offset += chunk.byteLength;
    }
    return body.byteLength;
};

// A standard stream is a pipe, as a spawned process's are.
export const fstatSync = (fd: number): Stats => new Stats(isStandardStream(fd)
    ? { kind: 'file', size: 0, mtimeMs: Date.now(), birthtimeMs: 0, mode: constants.S_IFIFO | 0o600 }
    : callFs('fstat', [fd]).value as EntryMetadata);

export const ftruncateSync = (fd: number, length = 0): void => {
    callFs('ftruncate', [fd, length]);
};

export const truncateSync = (target: unknown, length = 0): void => {
    callFs('truncate', [normalize(target), length]);
};

export const fsyncSync = (): void => {};

export const fdatasyncSync = fsyncSync;

export const readFileSync = (target: unknown, options?: EncodingOption): string | Buffer => {
    if(typeof target === 'number'){
        const size = fstatSync(target).size;
        const buffer = Buffer.alloc(size);
        const read = readSync(target, buffer, 0, size, 0);
        return decode(buffer.subarray(0, read), encodingOf(options));
    }
    return decode(callFs('readFile', [normalize(target)]).body, encodingOf(options));
};

export const writeFileSync = (target: unknown, data: unknown, options?: EncodingOption): void => {
    const flag = typeof options === 'object' && options !== null ? options.flag : undefined;
    if(typeof target === 'number'){
        writeSync(target, toBytes(data, encodingOf(options) ?? 'utf8'));
        return;
    }
    callFs('writeFile', [normalize(target), flagsOf(flag ?? 'w').append], toBytes(data, encodingOf(options) ?? 'utf8'));
};

export const appendFileSync = (target: unknown, data: unknown, options?: EncodingOption): void => {
    callFs('writeFile', [normalize(target), true], toBytes(data, encodingOf(options) ?? 'utf8'));
};

export const utimesSync = (target: unknown, _atime: unknown, mtime: number | string | Date): void => {
    const mtimeMs = mtime instanceof Date ? mtime.getTime() : Number(mtime) * 1000;
    callFs('utimes', [normalize(target), mtimeMs]);
};

export const chmodSync = (target: unknown, mode: number | string): void => {
    callFs('chmod', [normalize(target), typeof mode === 'string' ? parseInt(mode, 8) : mode]);
};

export const chownSync = (): void => {};

// Permissions and owners are kept per path; a descriptor's are its file's, which OPFS does not
// track through descriptors.
export const fchmodSync = (): void => {};

export const fchownSync = chownSync;

// A descriptor's times are its file's, set by path (utimesSync).
export const futimesSync = (): void => {};

// The origin's storage has no fixed size the file system could report synchronously: it is reported
// as a large disk with that much free.
export const statfsSync = (): { type: number; bsize: number; blocks: number; bfree: number; bavail: number; files: number; ffree: number } => {
    const blocks = 64 * 1024 ** 3 / 4096;
    return { type: 0, bsize: 4096, blocks, bfree: blocks, bavail: blocks, files: 1 << 20, ffree: 1 << 20 };
};

let temporaryCounter = 0;

export const mkdtempSync = (prefix: string): string => {
    for(;;){
        temporaryCounter += 1;
        const target = normalize(`${prefix}${Math.random().toString(36).slice(2, 8)}${temporaryCounter.toString(36)}`);
        if(!existsSync(target)){
            mkdirSync(target);
            return target;
        }
    }
};

export const readlinkSync = (target: unknown): never => {
    throw Object.assign(new Error(`EINVAL: invalid argument, readlink '${normalize(target)}'`), { code: 'EINVAL', syscall: 'readlink', errno: errnoOf('EINVAL') });
};

export const symlinkSync = (): never => {
    throw Object.assign(new Error('EPERM: symbolic links are not supported on OPFS'), { code: 'EPERM', syscall: 'symlink', errno: errnoOf('EPERM') });
};

export const linkSync = symlinkSync;

// --- promise API ----------------------------------------------------------------------------

const deferred = <A extends unknown[], T>(operation: (...args: A) => T) => (
    (...args: A): Promise<T> => new Promise((resolve, reject) => {
        queueMicrotask(() => {
            try{
                resolve(operation(...args));
            }catch(error){
                reject(error);
            }
        });
    })
);

interface ReadStreamOptions {
    start?: number;
    end?: number;
    highWaterMark?: number;
    encoding?: BufferEncoding;
    fd?: number | FileHandle;
    autoClose?: boolean;
}

interface WriteStreamOptions {
    flags?: string;
    start?: number;
    encoding?: BufferEncoding;
    fd?: number | FileHandle;
    autoClose?: boolean;
}

class FileHandle {
    readonly fd: number;

    constructor(fd: number){
        this.fd = fd;
    }

    read = deferred((buffer: Uint8Array | ({ buffer?: Uint8Array } & ReadOptions) = Buffer.alloc(16_384), offset?: number, length?: number, position?: number | null) => {
        const target = buffer instanceof Uint8Array ? buffer : buffer.buffer ?? Buffer.alloc(16_384);
        const options: ReadOptions = buffer instanceof Uint8Array ? { offset, length, position } : buffer;
        return { bytesRead: readSync(this.fd, target, options), buffer: target };
    });

    write = deferred((data: Uint8Array | string, offsetOrPosition?: number | null, lengthOrEncoding?: number | BufferEncoding, position?: number | null) => (
        { bytesWritten: writeSync(this.fd, data, offsetOrPosition, lengthOrEncoding, position), buffer: data }
    ));

    readv = deferred((buffers: Uint8Array[], position?: number | null) => (
        { bytesRead: readvSync(this.fd, buffers, position), buffers }
    ));

    writev = deferred((buffers: Uint8Array[], position?: number | null) => (
        { bytesWritten: writevSync(this.fd, buffers, position), buffers }
    ));

    readFile = deferred((options?: EncodingOption) => readFileSync(this.fd, options));

    writeFile = deferred((data: unknown, options?: EncodingOption) => writeFileSync(this.fd, data, options));

    appendFile = this.writeFile;

    stat = deferred(() => fstatSync(this.fd));

    truncate = deferred((length?: number) => ftruncateSync(this.fd, length));

    sync = deferred(() => undefined);

    datasync = this.sync;

    chmod = this.sync;

    close = deferred(() => closeSync(this.fd));

    createReadStream(options?: ReadStreamOptions): ReadStream {
        return new ReadStream(null, { ...options, fd: this.fd });
    }

    createWriteStream(options?: WriteStreamOptions): WriteStream {
        return new WriteStream(null, { ...options, fd: this.fd });
    }

    [Symbol.asyncDispose](): Promise<void> {
        return this.close();
    }
}

const descriptorOf = (target: unknown): unknown => target instanceof FileHandle ? target.fd : target;

export const promises = {
    constants,
    access: deferred(accessSync),
    stat: deferred((target: unknown) => statSync(target) as Stats),
    lstat: deferred((target: unknown) => statSync(target) as Stats),
    realpath: deferred(realpathSync),
    readdir: deferred(readdirSync),
    mkdir: deferred(mkdirSync),
    mkdtemp: deferred(mkdtempSync),
    readFile: deferred((target: unknown, options?: EncodingOption) => readFileSync(descriptorOf(target), options)),
    writeFile: deferred((target: unknown, data: unknown, options?: EncodingOption) => writeFileSync(descriptorOf(target), data, options)),
    appendFile: deferred(appendFileSync),
    rm: deferred(rmSync),
    rmdir: deferred(rmdirSync),
    unlink: deferred(unlinkSync),
    rename: deferred(renameSync),
    copyFile: deferred(copyFileSync),
    cp: deferred(cpSync),
    truncate: deferred(truncateSync),
    utimes: deferred(utimesSync),
    chmod: deferred(chmodSync),
    chown: deferred(chownSync),
    lchown: deferred(chownSync),
    symlink: deferred(symlinkSync),
    link: deferred(symlinkSync),
    readlink: deferred(readlinkSync),
    open: deferred((target: unknown, flags?: string | number) => new FileHandle(openSync(target, flags)))
};

// --- streams --------------------------------------------------------------------------------

const closeOwned = (fd: number | null): void => {
    if(fd === null){
        return;
    }
    try{
        closeSync(fd);
    }catch{
        // The descriptor was closed already; a stream releases it once.
    }
};

// Node's fs streams destroy themselves once done, which closes their descriptor and emits 'close'.
// The stream module here is readable-stream 3, whose default is to do neither, so whatever waits for
// 'close' (archiver's output, for one) would wait forever.
const NODE_FS_STREAM_LIFECYCLE = { autoDestroy: true, emitClose: true } as const;

export class ReadStream extends Readable {
    readonly path: string | null;
    bytesRead = 0;
    pending = true;
    fd: number | null = null;
    private position: number;
    private readonly end: number;
    private readonly chunkSize: number;
    private readonly ownsDescriptor: boolean;

    constructor(target: unknown, options: ReadStreamOptions = {}){
        super({ highWaterMark: options.highWaterMark ?? 64 * 1024, encoding: options.encoding, ...NODE_FS_STREAM_LIFECYCLE });
        this.path = target === null || target === undefined ? null : normalize(target);
        this.position = options.start ?? 0;
        this.end = options.end === undefined ? Infinity : options.end + 1;
        this.chunkSize = options.highWaterMark ?? 1024 * 1024;
        this.ownsDescriptor = options.fd === undefined && options.autoClose !== false;
        const given = options.fd instanceof FileHandle ? options.fd.fd : options.fd;
        queueMicrotask(() => {
            try{
                this.fd = given ?? openSync(this.path, 'r');
                this.pending = false;
                this.emit('open', this.fd);
                this.emit('ready');
            }catch(error){
                this.destroy(error as Error);
            }
        });
    }

    override _read(): void {
        if(this.fd === null){
            this.once('open', () => this._read());
            return;
        }
        try{
            const length = Math.min(this.chunkSize, this.end - this.position);
            if(length <= 0){
                this.push(null);
                return;
            }
            const buffer = Buffer.alloc(length);
            const read = readSync(this.fd, buffer, 0, length, this.position);
            if(read === 0){
                this.push(null);
                return;
            }
            this.position += read;
            this.bytesRead += read;
            this.push(buffer.subarray(0, read));
        }catch(error){
            this.destroy(error as Error);
        }
    }

    override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
        if(this.ownsDescriptor){
            closeOwned(this.fd);
            this.fd = null;
        }
        callback(error);
    }

    close(callback?: (error?: Error | null) => void): void {
        this.destroy();
        if(callback){
            this.once('close', () => callback(null));
        }
    }
}

export class WriteStream extends Writable {
    readonly path: string | null;
    bytesWritten = 0;
    pending = true;
    fd: number | null = null;
    private position: number | null;
    private readonly ownsDescriptor: boolean;

    constructor(target: unknown, options: WriteStreamOptions = {}){
        super({ decodeStrings: true, ...NODE_FS_STREAM_LIFECYCLE });
        this.path = target === null || target === undefined ? null : normalize(target);
        this.position = options.start ?? null;
        this.ownsDescriptor = options.fd === undefined && options.autoClose !== false;
        const given = options.fd instanceof FileHandle ? options.fd.fd : options.fd;
        queueMicrotask(() => {
            try{
                this.fd = given ?? openSync(this.path, options.flags ?? 'w');
                this.pending = false;
                this.emit('open', this.fd);
                this.emit('ready');
            }catch(error){
                this.destroy(error as Error);
            }
        });
    }

    override _write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        if(this.fd === null){
            this.once('open', () => this._write(chunk, encoding, callback));
            return;
        }
        try{
            const written = writeSync(this.fd, chunk, 0, chunk.byteLength, this.position);
            if(this.position !== null){
                this.position += written;
            }
            this.bytesWritten += written;
            callback();
        }catch(error){
            callback(error as Error);
        }
    }

    override _final(callback: (error?: Error | null) => void): void {
        if(this.fd === null){
            this.once('open', () => this._final(callback));
            return;
        }
        callback();
    }

    override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
        if(this.ownsDescriptor){
            closeOwned(this.fd);
            this.fd = null;
        }
        callback(error);
    }

    close(callback?: (error?: Error | null) => void): void {
        this.end(callback);
    }
}

export const createReadStream = (target: unknown, options?: ReadStreamOptions | BufferEncoding): ReadStream => (
    new ReadStream(target, typeof options === 'string' ? { encoding: options } : options)
);

export const createWriteStream = (target: unknown, options?: WriteStreamOptions | BufferEncoding): WriteStream => (
    new WriteStream(target, typeof options === 'string' ? { encoding: options } : options)
);

// --- callback API ---------------------------------------------------------------------------

type NodeCallback = (error: NodeJS.ErrnoException | null, ...results: unknown[]) => void;

// Node's callback form of a synchronous call; `spread` passes an array result as separate arguments,
// as fs.read and fs.write do.
const withCallback = <A extends unknown[], T>(operation: (...args: A) => T, spread = false) => (
    (...args: unknown[]): void => {
        const callback = typeof args[args.length - 1] === 'function' ? args.pop() as NodeCallback : null;
        queueMicrotask(() => {
            let result: T;
            try{
                result = operation(...(args as A));
            }catch(error){
                callback?.(error as NodeJS.ErrnoException);
                return;
            }
            if(spread && Array.isArray(result)){
                callback?.(null, ...result);
            }else{
                callback?.(null, result);
            }
        });
    }
);

export const access = withCallback(accessSync);
export const stat = withCallback((target: unknown) => statSync(target) as Stats);
export const lstat = stat;
export const realpath = Object.assign(withCallback(realpathSync), { native: withCallback(realpathSync) });
export const readdir = withCallback(readdirSync);
export const mkdir = withCallback(mkdirSync);
export const mkdtemp = withCallback(mkdtempSync);
export const readFile = withCallback(readFileSync);
export const writeFile = withCallback(writeFileSync);
export const appendFile = withCallback(appendFileSync);
export const rm = withCallback(rmSync);
export const rmdir = withCallback(rmdirSync);
export const unlink = withCallback(unlinkSync);
export const rename = withCallback(renameSync);
export const copyFile = withCallback(copyFileSync);
export const cp = withCallback(cpSync);
export const truncate = withCallback(truncateSync);
export const utimes = withCallback(utimesSync);
export const futimes = withCallback(futimesSync);
export const chmod = withCallback(chmodSync);
export const fchmod = futimes;
export const chown = withCallback(chownSync);
export const fchown = chown;
export const lchown = chown;
export const symlink = withCallback(symlinkSync);
export const link = symlink;
export const readlink = withCallback(readlinkSync);
export const open = withCallback(openSync);
export const close = withCallback(closeSync);
export const fstat = withCallback(fstatSync);
export const ftruncate = withCallback(ftruncateSync);
export const fsync = withCallback(fsyncSync);
export const fdatasync = fsync;
export const read = withCallback((fd: number, buffer: Uint8Array, offset: number, length: number, position: number | null) => (
    [readSync(fd, buffer, offset, length, position), buffer]
), true);
export const write = withCallback((fd: number, data: Uint8Array | string, offsetOrPosition?: number | null, lengthOrEncoding?: number | BufferEncoding, position?: number | null) => (
    [writeSync(fd, data, offsetOrPosition, lengthOrEncoding, position), data]
), true);
export const writev = withCallback((fd: number, buffers: readonly Uint8Array[], position?: number | null) => (
    [writevSync(fd, buffers, position), buffers]
), true);
export const readv = withCallback((fd: number, buffers: readonly Uint8Array[], position?: number | null) => (
    [readvSync(fd, buffers, position), buffers]
), true);
export const exists = (target: unknown, callback: (exists: boolean) => void): void => {
    queueMicrotask(() => callback(existsSync(target)));
};

export const watch = (): never => {
    throw Object.assign(new Error('fs.watch is not supported on OPFS'), { code: 'ENOSYS' });
};
export const watchFile = watch;
export const unwatchFile = (): void => {};

const fs = {
    constants, promises, Stats, Dirent, ReadStream, WriteStream,
    statSync, lstatSync, existsSync, accessSync, realpathSync, readdirSync, mkdirSync, rmSync, rmdirSync,
    unlinkSync, renameSync, copyFileSync, cpSync, openSync, closeSync, readSync, writeSync, readvSync, writevSync, fstatSync,
    ftruncateSync, truncateSync, fsyncSync, fdatasyncSync, readFileSync, writeFileSync, appendFileSync,
    utimesSync, futimesSync, chmodSync, chownSync, fchmodSync, fchownSync, statfsSync, mkdtempSync, readlinkSync, symlinkSync, linkSync,
    access, stat, lstat, realpath, readdir, mkdir, mkdtemp, readFile, writeFile, appendFile, rm, rmdir,
    unlink, rename, copyFile, cp, truncate, utimes, futimes, chmod, fchmod, chown, fchown, lchown, symlink,
    link, readlink, open, close, fstat, ftruncate, fsync, fdatasync, read, write, readv, writev, exists,
    createReadStream, createWriteStream, watch, watchFile, unwatchFile,
    F_OK: constants.F_OK, R_OK: constants.R_OK, W_OK: constants.W_OK, X_OK: constants.X_OK
};

export default fs;
