// Node's `fs` on the Origin Private File System. Each worker mounts its own directory, the way the
// server and the daemon each own a data directory on the desktop. File contents are read and written
// asynchronously through OPFS; the tree itself (names, kinds, sizes, times) is kept in memory after
// mountFs() walks it, which is what lets existsSync/statSync/readdirSync/mkdirSync answer
// synchronously. Mutations update the tree immediately and are applied to OPFS in order.
import { Readable, Writable } from 'stream';
import pathModule from 'path';

interface Entry {
    kind: 'file' | 'directory';
    size: number;
    mtimeMs: number;
    birthtimeMs: number;
    mode: number;
}

const tree = new Map<string, Entry>();
let root: FileSystemDirectoryHandle | null = null;
let queue: Promise<unknown> = Promise.resolve();

// Every OPFS mutation runs after the ones issued before it, so a write never races the mkdir or
// rename that preceded it.
const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation);
    queue = result.catch(() => undefined);
    return result;
};

const fsError = (code: string, syscall: string, target: string, message: string): NodeJS.ErrnoException => (
    Object.assign(new Error(`${code}: ${message}, ${syscall} '${target}'`), {
        code,
        syscall,
        path: target,
        errno: { ENOENT: -2, EEXIST: -17, ENOTDIR: -20, EISDIR: -21, ENOTEMPTY: -39, EBADF: -9, EINVAL: -22 }[code] ?? -1
    })
);

const normalize = (target: unknown): string => {
    const value = target instanceof URL ? target.pathname : Buffer.isBuffer(target) ? target.toString() : String(target);
    return pathModule.resolve(process.cwd(), value);
};

const segments = (target: string): string[] => target.split('/').filter(Boolean);

const now = (): number => Date.now();

const directoryEntry = (): Entry => ({ kind: 'directory', size: 4096, mtimeMs: now(), birthtimeMs: now(), mode: 0o40755 });

const requireRoot = (): FileSystemDirectoryHandle => {
    if(!root){
        throw new Error('fs: mountFs() has not completed');
    }
    return root;
};

const walk = async (handle: FileSystemDirectoryHandle, prefix: string): Promise<void> => {
    for await (const [name, child] of (handle as FileSystemDirectoryHandle & { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()){
        const childPath = `${prefix}/${name}`;
        if(child.kind === 'directory'){
            tree.set(childPath, directoryEntry());
            await walk(child as FileSystemDirectoryHandle, childPath);
        }else{
            const file = await (child as FileSystemFileHandle).getFile();
            tree.set(childPath, { kind: 'file', size: file.size, mtimeMs: file.lastModified, birthtimeMs: file.lastModified, mode: 0o100644 });
        }
    }
};

export const mountFs = async (directory: string): Promise<void> => {
    const storageRoot = await navigator.storage.getDirectory();
    root = await storageRoot.getDirectoryHandle(directory, { create: true });
    tree.clear();
    tree.set('/', directoryEntry());
    await walk(root, '');
};

const directoryHandle = async (target: string, create = false): Promise<FileSystemDirectoryHandle> => {
    let handle = requireRoot();
    for(const name of segments(target)){
        handle = await handle.getDirectoryHandle(name, { create });
    }
    return handle;
};

const fileHandle = async (target: string, create = false): Promise<FileSystemFileHandle> => {
    const parent = await directoryHandle(pathModule.dirname(target), create);
    return parent.getFileHandle(pathModule.basename(target), { create });
};

const lookup = (target: string, syscall: string): Entry => {
    const entry = tree.get(target);
    if(!entry){
        throw fsError('ENOENT', syscall, target, 'no such file or directory');
    }
    return entry;
};

const requireParentDirectory = (target: string, syscall: string): void => {
    const parent = tree.get(pathModule.dirname(target));
    if(!parent){
        throw fsError('ENOENT', syscall, target, 'no such file or directory');
    }
    if(parent.kind !== 'directory'){
        throw fsError('ENOTDIR', syscall, target, 'not a directory');
    }
};

const childrenOf = (target: string): string[] => {
    const prefix = target === '/' ? '/' : `${target}/`;
    const names: string[] = [];
    for(const key of tree.keys()){
        if(key !== target && key.startsWith(prefix) && !key.slice(prefix.length).includes('/')){
            names.push(key.slice(prefix.length));
        }
    }
    return names.sort();
};

const descendantsOf = (target: string): string[] => {
    const prefix = `${target}/`;
    return [...tree.keys()].filter((key) => key.startsWith(prefix));
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

    constructor(entry: Entry){
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

    isFile(): boolean { return (this.mode & 0o170000) === 0o100000; }
    isDirectory(): boolean { return (this.mode & 0o170000) === 0o040000; }
    isSymbolicLink(): boolean { return false; }
    isFIFO(): boolean { return false; }
    isSocket(): boolean { return false; }
    isBlockDevice(): boolean { return false; }
    isCharacterDevice(): boolean { return false; }
}

export class Dirent {
    readonly name: string;
    readonly parentPath: string;
    readonly path: string;
    private readonly kind: Entry['kind'];

    constructor(name: string, parentPath: string, kind: Entry['kind']){
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

export const constants = {
    F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1,
    O_RDONLY: 0, O_WRONLY: 1, O_RDWR: 2, O_CREAT: 64, O_EXCL: 128, O_TRUNC: 512, O_APPEND: 1024,
    S_IFMT: 0o170000, S_IFREG: 0o100000, S_IFDIR: 0o040000, S_IFLNK: 0o120000,
    COPYFILE_EXCL: 1, COPYFILE_FICLONE: 2, UV_FS_O_FILEMAP: 0
};

type Encoding = BufferEncoding | null | undefined;
type EncodingOption = Encoding | { encoding?: Encoding; flag?: string };

const encodingOf = (options: EncodingOption): Encoding => (
    typeof options === 'string' || options === null || options === undefined ? options : options.encoding
);

const decode = (bytes: Uint8Array, encoding: Encoding): string | Buffer => {
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return encoding ? buffer.toString(encoding) : buffer;
};

const toBytes = (data: unknown, encoding: Encoding = 'utf8'): Uint8Array => {
    if(typeof data === 'string'){
        return Buffer.from(data, encoding ?? 'utf8');
    }
    if(data instanceof Uint8Array){
        return data;
    }
    if(ArrayBuffer.isView(data)){
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    throw new TypeError('The "data" argument must be of type string or an instance of Buffer, TypedArray, or DataView');
};

// --- synchronous API: answered from the tree ------------------------------------------------

export const existsSync = (target: unknown): boolean => tree.has(normalize(target));

export const statSync = (target: unknown, options?: { throwIfNoEntry?: boolean }): Stats | undefined => {
    const resolved = normalize(target);
    const entry = tree.get(resolved);
    if(!entry){
        if(options?.throwIfNoEntry === false){
            return undefined;
        }
        throw fsError('ENOENT', 'stat', resolved, 'no such file or directory');
    }
    return new Stats(entry);
};

export const lstatSync = statSync;

export const accessSync = (target: unknown): void => {
    const resolved = normalize(target);
    lookup(resolved, 'access');
};

export const realpathSync = Object.assign((target: unknown): string => {
    const resolved = normalize(target);
    lookup(resolved, 'realpath');
    return resolved;
}, { native: (target: unknown): string => realpathSync(target) });

export const readdirSync = (target: unknown, options?: { withFileTypes?: boolean } | BufferEncoding): string[] | Dirent[] => {
    const resolved = normalize(target);
    const entry = lookup(resolved, 'scandir');
    if(entry.kind !== 'directory'){
        throw fsError('ENOTDIR', 'scandir', resolved, 'not a directory');
    }
    const names = childrenOf(resolved);
    if(typeof options === 'object' && options?.withFileTypes){
        return names.map((name) => new Dirent(name, resolved, lookup(pathModule.join(resolved, name), 'scandir').kind));
    }
    return names;
};

const createDirectories = (resolved: string, recursive: boolean): string | undefined => {
    const existing = tree.get(resolved);
    if(existing){
        if(recursive && existing.kind === 'directory'){
            return undefined;
        }
        throw fsError('EEXIST', 'mkdir', resolved, 'file already exists');
    }
    if(!recursive){
        requireParentDirectory(resolved, 'mkdir');
        tree.set(resolved, directoryEntry());
        void enqueue(() => directoryHandle(resolved, true));
        return undefined;
    }
    let first: string | undefined;
    let current = '';
    for(const name of segments(resolved)){
        current = `${current}/${name}`;
        const entry = tree.get(current);
        if(entry?.kind === 'file'){
            throw fsError('ENOTDIR', 'mkdir', resolved, 'not a directory');
        }
        if(!entry){
            tree.set(current, directoryEntry());
            first ??= current;
        }
    }
    void enqueue(() => directoryHandle(resolved, true));
    return first;
};

export const mkdirSync = (target: unknown, options?: { recursive?: boolean; mode?: number } | number): string | undefined => (
    createDirectories(normalize(target), typeof options === 'object' && Boolean(options?.recursive))
);

// --- asynchronous API -----------------------------------------------------------------------

const readBytes = async (resolved: string, start = 0, end?: number): Promise<Uint8Array> => {
    const entry = lookup(resolved, 'open');
    if(entry.kind === 'directory'){
        throw fsError('EISDIR', 'read', resolved, 'illegal operation on a directory');
    }
    await queue;
    const file = await (await fileHandle(resolved)).getFile();
    return new Uint8Array(await file.slice(start, end).arrayBuffer());
};

const writeBytes = (resolved: string, bytes: Uint8Array, append: boolean): Promise<void> => {
    requireParentDirectory(resolved, 'open');
    const existing = tree.get(resolved);
    if(existing?.kind === 'directory'){
        throw fsError('EISDIR', 'open', resolved, 'illegal operation on a directory');
    }
    const size = append && existing ? existing.size + bytes.byteLength : bytes.byteLength;
    tree.set(resolved, { kind: 'file', size, mtimeMs: now(), birthtimeMs: existing?.birthtimeMs ?? now(), mode: existing?.mode ?? 0o100644 });
    const copy = bytes.slice();
    return enqueue(async () => {
        const writable = await (await fileHandle(resolved, true)).createWritable({ keepExistingData: append });
        if(append){
            await writable.seek((await (await fileHandle(resolved)).getFile()).size);
        }
        await writable.write(copy);
        await writable.close();
    });
};

const removeEntry = (resolved: string, recursive: boolean): Promise<void> => {
    const entry = lookup(resolved, 'rm');
    if(entry.kind === 'directory'){
        const descendants = descendantsOf(resolved);
        if(descendants.length > 0 && !recursive){
            throw fsError('ENOTEMPTY', 'rmdir', resolved, 'directory not empty');
        }
        for(const key of descendants){
            tree.delete(key);
        }
    }
    tree.delete(resolved);
    return enqueue(async () => {
        const parent = await directoryHandle(pathModule.dirname(resolved));
        await parent.removeEntry(pathModule.basename(resolved), { recursive });
    });
};

const copyFileContents = async (from: string, to: string): Promise<void> => {
    const source = await (await fileHandle(from)).getFile();
    const writable = await (await fileHandle(to, true)).createWritable();
    await writable.write(source);
    await writable.close();
};

const renameEntry = (from: string, to: string): Promise<void> => {
    const entry = lookup(from, 'rename');
    requireParentDirectory(to, 'rename');
    const moved = [from, ...descendantsOf(from)];
    const target = tree.get(to);
    if(target?.kind === 'directory' && entry.kind === 'file'){
        throw fsError('EISDIR', 'rename', to, 'illegal operation on a directory');
    }
    const replaced = target ? [to, ...descendantsOf(to)] : [];
    for(const key of replaced){
        tree.delete(key);
    }
    const entries = moved.map((key) => [key, tree.get(key) as Entry] as const);
    for(const [key] of entries){
        tree.delete(key);
    }
    for(const [key, value] of entries){
        tree.set(to + key.slice(from.length), value);
    }
    // OPFS has no rename that every browser implements, so the entries are copied and the source removed.
    return enqueue(async () => {
        if(replaced.length > 0){
            await (await directoryHandle(pathModule.dirname(to))).removeEntry(pathModule.basename(to), { recursive: true });
        }
        for(const [key, value] of entries){
            if(value.kind === 'directory'){
                await directoryHandle(to + key.slice(from.length), true);
            }
        }
        for(const [key, value] of entries){
            if(value.kind === 'file'){
                await copyFileContents(key, to + key.slice(from.length));
            }
        }
        await (await directoryHandle(pathModule.dirname(from))).removeEntry(pathModule.basename(from), { recursive: true });
    });
};

// File descriptors: reads go to the committed file, writes to an open writable that is committed on close.
interface Descriptor {
    path: string;
    position: number;
    writable: FileSystemWritableFileStream | null;
    pendingSize: number;
}

const descriptors = new Map<number, Descriptor>();
let nextDescriptor = 10;

const requireDescriptor = (fd: number, syscall: string): Descriptor => {
    const descriptor = descriptors.get(fd);
    if(!descriptor){
        throw fsError('EBADF', syscall, String(fd), 'bad file descriptor');
    }
    return descriptor;
};

const flagsOf = (flags: string | number | undefined): { create: boolean; truncate: boolean; append: boolean; write: boolean; exclusive: boolean } => {
    const value = typeof flags === 'number' ? flags : flags ?? 'r';
    if(typeof value === 'number'){
        return {
            write: (value & (constants.O_WRONLY | constants.O_RDWR)) !== 0,
            create: (value & constants.O_CREAT) !== 0,
            truncate: (value & constants.O_TRUNC) !== 0,
            append: (value & constants.O_APPEND) !== 0,
            exclusive: (value & constants.O_EXCL) !== 0
        };
    }
    return {
        write: /[wa+]/.test(value),
        create: /[wa]/.test(value),
        truncate: value.startsWith('w'),
        append: value.startsWith('a'),
        exclusive: value.includes('x')
    };
};

const openDescriptor = async (target: unknown, flags?: string | number): Promise<number> => {
    const resolved = normalize(target);
    const mode = flagsOf(flags);
    const existing = tree.get(resolved);
    if(existing && mode.exclusive){
        throw fsError('EEXIST', 'open', resolved, 'file already exists');
    }
    if(!existing && !mode.create){
        throw fsError('ENOENT', 'open', resolved, 'no such file or directory');
    }
    if(existing?.kind === 'directory' && mode.write){
        throw fsError('EISDIR', 'open', resolved, 'illegal operation on a directory');
    }
    if(!existing){
        await writeBytes(resolved, new Uint8Array(0), false);
    }else if(mode.truncate){
        await writeBytes(resolved, new Uint8Array(0), false);
    }
    const descriptor: Descriptor = {
        path: resolved,
        position: mode.append ? lookup(resolved, 'open').size : 0,
        writable: null,
        pendingSize: lookup(resolved, 'open').size
    };
    if(mode.write){
        await queue;
        descriptor.writable = await (await fileHandle(resolved)).createWritable({ keepExistingData: true });
    }
    const fd = nextDescriptor;
    nextDescriptor += 1;
    descriptors.set(fd, descriptor);
    return fd;
};

const writeDescriptor = async (fd: number, bytes: Uint8Array, position: number | null | undefined): Promise<number> => {
    const descriptor = requireDescriptor(fd, 'write');
    if(!descriptor.writable){
        throw fsError('EBADF', 'write', descriptor.path, 'bad file descriptor');
    }
    const at = typeof position === 'number' ? position : descriptor.position;
    await descriptor.writable.write({ type: 'write', position: at, data: bytes.slice() });
    if(typeof position !== 'number'){
        descriptor.position = at + bytes.byteLength;
    }
    descriptor.pendingSize = Math.max(descriptor.pendingSize, at + bytes.byteLength);
    const entry = lookup(descriptor.path, 'write');
    tree.set(descriptor.path, { ...entry, size: descriptor.pendingSize, mtimeMs: now() });
    return bytes.byteLength;
};

const readDescriptor = async (fd: number, buffer: Uint8Array, offset: number, length: number, position: number | null | undefined): Promise<number> => {
    const descriptor = requireDescriptor(fd, 'read');
    const at = typeof position === 'number' ? position : descriptor.position;
    const bytes = await readBytes(descriptor.path, at, at + length);
    buffer.set(bytes, offset);
    if(typeof position !== 'number'){
        descriptor.position = at + bytes.byteLength;
    }
    return bytes.byteLength;
};

const closeDescriptor = async (fd: number): Promise<void> => {
    const descriptor = requireDescriptor(fd, 'close');
    descriptors.delete(fd);
    if(descriptor.writable){
        await descriptor.writable.close();
    }
};

const truncateFile = async (resolved: string, length = 0): Promise<void> => {
    const entry = lookup(resolved, 'open');
    tree.set(resolved, { ...entry, size: length, mtimeMs: now() });
    await enqueue(async () => {
        const writable = await (await fileHandle(resolved)).createWritable({ keepExistingData: true });
        await writable.truncate(length);
        await writable.close();
    });
};

class FileHandle {
    readonly fd: number;

    constructor(fd: number){
        this.fd = fd;
    }

    async read(buffer: Uint8Array | { buffer?: Uint8Array; offset?: number; length?: number; position?: number | null } = Buffer.alloc(16_384), offset = 0, length?: number, position?: number | null): Promise<{ bytesRead: number; buffer: Uint8Array }> {
        if(!(buffer instanceof Uint8Array)){
            const target = buffer.buffer ?? Buffer.alloc(16_384);
            return this.read(target, buffer.offset ?? 0, buffer.length ?? target.byteLength, buffer.position);
        }
        const bytesRead = await readDescriptor(this.fd, buffer, offset, length ?? buffer.byteLength - offset, position);
        return { bytesRead, buffer };
    }

    async write(data: Uint8Array | string, offsetOrPosition?: number | null, lengthOrEncoding?: number | BufferEncoding, position?: number | null): Promise<{ bytesWritten: number; buffer: Uint8Array | string }> {
        if(typeof data === 'string'){
            const bytesWritten = await writeDescriptor(this.fd, toBytes(data, typeof lengthOrEncoding === 'string' ? lengthOrEncoding : 'utf8'), offsetOrPosition);
            return { bytesWritten, buffer: data };
        }
        const offset = offsetOrPosition ?? 0;
        const length = typeof lengthOrEncoding === 'number' ? lengthOrEncoding : data.byteLength - offset;
        const bytesWritten = await writeDescriptor(this.fd, data.subarray(offset, offset + length), position);
        return { bytesWritten, buffer: data };
    }

    async writeFile(data: unknown, options?: EncodingOption): Promise<void> {
        await writeDescriptor(this.fd, toBytes(data, encodingOf(options) ?? 'utf8'), null);
    }

    async readFile(options?: EncodingOption): Promise<string | Buffer> {
        return decode(await readBytes(requireDescriptor(this.fd, 'read').path), encodingOf(options));
    }

    async stat(): Promise<Stats> {
        return new Stats(lookup(requireDescriptor(this.fd, 'fstat').path, 'fstat'));
    }

    async truncate(length = 0): Promise<void> {
        const descriptor = requireDescriptor(this.fd, 'ftruncate');
        if(descriptor.writable){
            await descriptor.writable.truncate(length);
            descriptor.pendingSize = length;
            const entry = lookup(descriptor.path, 'ftruncate');
            tree.set(descriptor.path, { ...entry, size: length });
            return;
        }
        await truncateFile(descriptor.path, length);
    }

    async sync(): Promise<void> {}

    async datasync(): Promise<void> {}

    async chmod(): Promise<void> {}

    async close(): Promise<void> {
        await closeDescriptor(this.fd);
    }

    createReadStream(options?: ReadStreamOptions): ReadStream {
        return createReadStream(requireDescriptor(this.fd, 'read').path, options);
    }

    createWriteStream(options?: WriteStreamOptions): WriteStream {
        return createWriteStream(requireDescriptor(this.fd, 'write').path, { ...options, flags: 'r+' });
    }

    [Symbol.asyncDispose](): Promise<void> {
        return this.close();
    }
}

const readdirAsync = async (target: unknown, options?: { withFileTypes?: boolean; recursive?: boolean } | BufferEncoding): Promise<string[] | Dirent[]> => {
    if(typeof options === 'object' && options?.recursive){
        const resolved = normalize(target);
        lookup(resolved, 'scandir');
        const keys = descendantsOf(resolved).sort();
        if(options.withFileTypes){
            return keys.map((key) => new Dirent(pathModule.basename(key), pathModule.dirname(key), lookup(key, 'scandir').kind));
        }
        return keys.map((key) => key.slice(resolved.length + 1));
    }
    return readdirSync(target, options);
};

let temporaryCounter = 0;

export const promises = {
    constants,
    async access(target: unknown): Promise<void> {
        accessSync(target);
    },
    async stat(target: unknown): Promise<Stats> {
        return statSync(target) as Stats;
    },
    async lstat(target: unknown): Promise<Stats> {
        return statSync(target) as Stats;
    },
    async realpath(target: unknown): Promise<string> {
        return realpathSync(target);
    },
    async readdir(target: unknown, options?: { withFileTypes?: boolean; recursive?: boolean } | BufferEncoding): Promise<string[] | Dirent[]> {
        return readdirAsync(target, options);
    },
    async mkdir(target: unknown, options?: { recursive?: boolean; mode?: number } | number): Promise<string | undefined> {
        const first = mkdirSync(target, options);
        await queue;
        return first;
    },
    async mkdtemp(prefix: string): Promise<string> {
        temporaryCounter += 1;
        const target = `${prefix}${Date.now().toString(36)}${temporaryCounter.toString(36)}`;
        await promises.mkdir(target);
        return normalize(target);
    },
    async readFile(target: unknown, options?: EncodingOption): Promise<string | Buffer> {
        if(target instanceof FileHandle){
            return target.readFile(options);
        }
        return decode(await readBytes(normalize(target)), encodingOf(options));
    },
    async writeFile(target: unknown, data: unknown, options?: EncodingOption): Promise<void> {
        if(target instanceof FileHandle){
            return target.writeFile(data, options);
        }
        const append = typeof options === 'object' && options?.flag?.startsWith('a');
        await writeBytes(normalize(target), toBytes(data, encodingOf(options) ?? 'utf8'), Boolean(append));
    },
    async appendFile(target: unknown, data: unknown, options?: EncodingOption): Promise<void> {
        await writeBytes(normalize(target), toBytes(data, encodingOf(options) ?? 'utf8'), true);
    },
    async rm(target: unknown, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
        const resolved = normalize(target);
        if(!tree.has(resolved) && options?.force){
            return;
        }
        await removeEntry(resolved, Boolean(options?.recursive));
    },
    async rmdir(target: unknown, options?: { recursive?: boolean }): Promise<void> {
        await removeEntry(normalize(target), Boolean(options?.recursive));
    },
    async unlink(target: unknown): Promise<void> {
        const resolved = normalize(target);
        if(lookup(resolved, 'unlink').kind === 'directory'){
            throw fsError('EISDIR', 'unlink', resolved, 'illegal operation on a directory');
        }
        await removeEntry(resolved, false);
    },
    async rename(from: unknown, to: unknown): Promise<void> {
        await renameEntry(normalize(from), normalize(to));
    },
    async copyFile(from: unknown, to: unknown, mode = 0): Promise<void> {
        const source = normalize(from);
        const target = normalize(to);
        if(mode & constants.COPYFILE_EXCL && tree.has(target)){
            throw fsError('EEXIST', 'copyfile', target, 'file already exists');
        }
        requireParentDirectory(target, 'copyfile');
        const entry = lookup(source, 'copyfile');
        tree.set(target, { ...entry, mtimeMs: now() });
        await enqueue(() => copyFileContents(source, target));
    },
    async cp(from: unknown, to: unknown, options?: { recursive?: boolean }): Promise<void> {
        const source = normalize(from);
        const target = normalize(to);
        const entry = lookup(source, 'cp');
        if(entry.kind === 'file'){
            return promises.copyFile(source, target);
        }
        if(!options?.recursive){
            throw fsError('EISDIR', 'cp', source, 'illegal operation on a directory');
        }
        await promises.mkdir(target, { recursive: true });
        for(const name of childrenOf(source)){
            await promises.cp(pathModule.join(source, name), pathModule.join(target, name), options);
        }
    },
    async truncate(target: unknown, length = 0): Promise<void> {
        await truncateFile(normalize(target), length);
    },
    async open(target: unknown, flags?: string | number): Promise<FileHandle> {
        return new FileHandle(await openDescriptor(target, flags));
    },
    async utimes(target: unknown, _atime: unknown, mtime: number | Date): Promise<void> {
        const resolved = normalize(target);
        const entry = lookup(resolved, 'utime');
        tree.set(resolved, { ...entry, mtimeMs: mtime instanceof Date ? mtime.getTime() : mtime * 1000 });
    },
    async chmod(target: unknown, mode: number): Promise<void> {
        const resolved = normalize(target);
        const entry = lookup(resolved, 'chmod');
        tree.set(resolved, { ...entry, mode: (entry.mode & constants.S_IFMT) | (mode & 0o7777) });
    },
    async chown(): Promise<void> {},
    async symlink(): Promise<void> {
        throw new Error('fs: symbolic links are not supported on OPFS');
    },
    async readlink(target: unknown): Promise<string> {
        throw fsError('EINVAL', 'readlink', normalize(target), 'invalid argument');
    }
};

// --- streams --------------------------------------------------------------------------------

interface ReadStreamOptions {
    start?: number;
    end?: number;
    highWaterMark?: number;
    encoding?: BufferEncoding;
    fd?: FileHandle | number;
}

export class ReadStream extends Readable {
    readonly path: string;
    bytesRead = 0;
    pending = true;
    private position: number;
    private readonly end: number;
    private readonly chunkSize: number;

    constructor(target: unknown, options: ReadStreamOptions = {}){
        super({ highWaterMark: options.highWaterMark ?? 64 * 1024, encoding: options.encoding });
        this.path = normalize(target);
        this.position = options.start ?? 0;
        this.end = options.end === undefined ? Infinity : options.end + 1;
        this.chunkSize = options.highWaterMark ?? 1024 * 1024;
        queueMicrotask(() => {
            if(!tree.has(this.path)){
                this.destroy(fsError('ENOENT', 'open', this.path, 'no such file or directory'));
                return;
            }
            this.pending = false;
            this.emit('open', 0);
            this.emit('ready');
        });
    }

    override _read(): void {
        const until = Math.min(this.end, this.position + this.chunkSize);
        readBytes(this.path, this.position, until === Infinity ? undefined : until).then((bytes) => {
            if(bytes.byteLength === 0){
                this.push(null);
                return;
            }
            this.position += bytes.byteLength;
            this.bytesRead += bytes.byteLength;
            this.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
            if(this.position >= this.end){
                this.push(null);
            }
        }, (error: Error) => this.destroy(error));
    }

    close(callback?: (error?: Error | null) => void): void {
        this.destroy();
        if(callback){
            this.once('close', () => callback(null));
        }
    }
}

interface WriteStreamOptions {
    flags?: string;
    start?: number;
    encoding?: BufferEncoding;
}

export class WriteStream extends Writable {
    readonly path: string;
    bytesWritten = 0;
    pending = true;
    private readonly opened: Promise<FileHandle>;

    constructor(target: unknown, options: WriteStreamOptions = {}){
        super({ decodeStrings: true });
        this.path = normalize(target);
        this.opened = promises.open(this.path, options.flags ?? 'w');
        this.opened.then(async (handle) => {
            if(options.start !== undefined){
                requireDescriptor(handle.fd, 'write').position = options.start;
            }
            this.pending = false;
            this.emit('open', handle.fd);
            this.emit('ready');
        }, (error: Error) => this.destroy(error));
    }

    override _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        this.opened
            .then((handle) => writeDescriptor(handle.fd, chunk, null))
            .then((written) => {
                this.bytesWritten += written;
                callback();
            }, callback);
    }

    override _final(callback: (error?: Error | null) => void): void {
        this.opened.then((handle) => handle.close()).then(() => callback(), callback);
    }

    override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
        this.opened.then((handle) => descriptors.has(handle.fd) ? handle.close() : undefined).then(() => callback(error), () => callback(error));
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

// --- callback API: the promise API with Node's (error, result) callbacks -------------------

type Callback<T> = (error: NodeJS.ErrnoException | null, result?: T) => void;

const withCallback = <A extends unknown[], T>(operation: (...args: A) => Promise<T>) => (
    (...args: [...A, Callback<T>] | A): void => {
        const callback = args[args.length - 1];
        if(typeof callback !== 'function'){
            void operation(...(args as A)).catch(() => undefined);
            return;
        }
        operation(...(args.slice(0, -1) as A)).then(
            (result) => (callback as Callback<T>)(null, result),
            (error: NodeJS.ErrnoException) => (callback as Callback<T>)(error)
        );
    }
);

export const access = withCallback(promises.access);
export const stat = withCallback(promises.stat);
export const lstat = withCallback(promises.lstat);
export const realpath = Object.assign(withCallback(promises.realpath), { native: withCallback(promises.realpath) });
export const readdir = withCallback(promises.readdir);
export const mkdir = withCallback(promises.mkdir);
export const mkdtemp = withCallback(promises.mkdtemp);
export const readFile = withCallback(promises.readFile);
export const writeFile = withCallback(promises.writeFile);
export const appendFile = withCallback(promises.appendFile);
export const rm = withCallback(promises.rm);
export const rmdir = withCallback(promises.rmdir);
export const unlink = withCallback(promises.unlink);
export const rename = withCallback(promises.rename);
export const copyFile = withCallback(promises.copyFile);
export const truncate = withCallback(promises.truncate);
export const utimes = withCallback(promises.utimes);
export const chmod = withCallback(promises.chmod);
export const chown = withCallback(promises.chown);
export const lchown = chown;
export const fchmod = withCallback(async () => undefined);
export const fchown = fchmod;
export const fsync = withCallback(async () => undefined);
export const symlink = withCallback(promises.symlink);
export const readlink = withCallback(promises.readlink);
export const exists = (target: unknown, callback: (exists: boolean) => void): void => {
    queueMicrotask(() => callback(existsSync(target)));
};
export const open = withCallback(openDescriptor);
export const close = withCallback(closeDescriptor);
export const fstat = withCallback(async (fd: number) => new Stats(lookup(requireDescriptor(fd, 'fstat').path, 'fstat')));
export const ftruncate = withCallback(async (fd: number, length?: number) => new FileHandle(fd).truncate(length));
export const read = (fd: number, buffer: Uint8Array, offset: number, length: number, position: number | null, callback: (error: NodeJS.ErrnoException | null, bytesRead?: number, buffer?: Uint8Array) => void): void => {
    readDescriptor(fd, buffer, offset, length, position).then((bytesRead) => callback(null, bytesRead, buffer), (error: NodeJS.ErrnoException) => callback(error));
};
export const write = (fd: number, data: Uint8Array | string, ...rest: unknown[]): void => {
    const callback = rest.find((arg): arg is (error: NodeJS.ErrnoException | null, written?: number, data?: unknown) => void => typeof arg === 'function');
    const bytes = typeof data === 'string' ? toBytes(data) : data.subarray(typeof rest[0] === 'number' ? rest[0] : 0, typeof rest[1] === 'number' ? (typeof rest[0] === 'number' ? rest[0] : 0) + rest[1] : undefined);
    const position = typeof data === 'string' ? (typeof rest[0] === 'number' ? rest[0] : null) : (typeof rest[2] === 'number' ? rest[2] : null);
    writeDescriptor(fd, bytes, position).then((written) => callback?.(null, written, data), (error: NodeJS.ErrnoException) => callback?.(error));
};

const unsupportedSync = (name: string) => (): never => {
    throw new Error(`fs.${name} is not available in the browser; use the asynchronous API`);
};

export const readlinkSync = (target: unknown): never => {
    throw fsError('EINVAL', 'readlink', normalize(target), 'invalid argument');
};

export const readFileSync = unsupportedSync('readFileSync');
export const writeFileSync = unsupportedSync('writeFileSync');
export const appendFileSync = unsupportedSync('appendFileSync');
export const openSync = unsupportedSync('openSync');
export const closeSync = unsupportedSync('closeSync');
export const readSync = unsupportedSync('readSync');
export const writeSync = unsupportedSync('writeSync');
export const fstatSync = unsupportedSync('fstatSync');
export const copyFileSync = unsupportedSync('copyFileSync');
export const renameSync = unsupportedSync('renameSync');
export const unlinkSync = unsupportedSync('unlinkSync');
export const rmSync = unsupportedSync('rmSync');
export const rmdirSync = unsupportedSync('rmdirSync');
export const mkdtempSync = unsupportedSync('mkdtempSync');
export const watch = unsupportedSync('watch');
export const watchFile = unsupportedSync('watchFile');
export const unwatchFile = (): void => {};

const fs = {
    constants, promises, Stats, Dirent, ReadStream, WriteStream,
    existsSync, statSync, lstatSync, accessSync, realpathSync, readdirSync, mkdirSync,
    access, stat, lstat, realpath, readdir, mkdir, mkdtemp, readFile, writeFile, appendFile, rm, rmdir,
    unlink, rename, copyFile, truncate, utimes, chmod, chown, lchown, fchmod, fchown, fsync, symlink,
    readlink, exists, open, close, fstat, ftruncate, read, write, createReadStream, createWriteStream,
    readlinkSync, readFileSync, writeFileSync, appendFileSync, openSync, closeSync, readSync, writeSync, fstatSync,
    copyFileSync, renameSync, unlinkSync, rmSync, rmdirSync, mkdtempSync, watch, watchFile, unwatchFile,
    F_OK: constants.F_OK, R_OK: constants.R_OK, W_OK: constants.W_OK, X_OK: constants.X_OK
};

export default fs;
