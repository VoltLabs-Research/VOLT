// The file system service: a dedicated worker that owns one OPFS directory and answers the
// synchronous fs calls of the workers attached to it (a backend, and the plugin workers it starts).
// Files are read and written through FileSystemSyncAccessHandles, which only a dedicated worker may
// open; the directory tree and file metadata are kept in memory once mounted.
import {
    STATE_REQUEST,
    STATE_RESPONSE,
    DATA_BYTES,
    decodeMessage,
    encodeMessage
} from './channel';
import type { FsChannelBuffers, FsReply, FsRequest } from './channel';

interface Entry {
    kind: 'file' | 'directory';
    size: number;
    mtimeMs: number;
    birthtimeMs: number;
    mode: number;
}

interface Descriptor {
    path: string;
    position: number;
    append: boolean;
}

export interface FsServiceMountMessage {
    kind: 'mount';
    directory: string;
}

// A worker's channel, and the port its own workers' channels are attached through.
export interface FsServiceAttachMessage {
    kind: 'attach';
    buffers: FsChannelBuffers;
    port: MessagePort;
}

class FsError extends Error {
    constructor(readonly code: string, readonly syscall: string, readonly path: string, description: string){
        super(`${code}: ${description}, ${syscall} '${path}'`);
    }
}

const DESCRIPTIONS: Record<string, string> = {
    ENOENT: 'no such file or directory',
    EEXIST: 'file already exists',
    ENOTDIR: 'not a directory',
    EISDIR: 'illegal operation on a directory',
    ENOTEMPTY: 'directory not empty',
    EBADF: 'bad file descriptor',
    EINVAL: 'invalid argument'
};

const fail = (code: string, syscall: string, path: string): never => {
    throw new FsError(code, syscall, path, DESCRIPTIONS[code] ?? code);
};

const scope = globalThis as unknown as {
    postMessage(message: unknown): void;
    addEventListener(type: 'message', listener: (event: MessageEvent<FsServiceMountMessage | FsServiceAttachMessage>) => void): void;
};

const tree = new Map<string, Entry>();
const directories = new Map<string, FileSystemDirectoryHandle>();
const descriptors = new Map<number, Descriptor>();
let nextDescriptor = 3;

// Open sync handles, most recently used last. A file has at most one (OPFS locks it), shared by all
// descriptors on it; idle ones stay open up to the limit, since opening is the expensive step.
const openHandles = new Map<string, FileSystemSyncAccessHandle>();
const OPEN_HANDLE_LIMIT = 64;

const segments = (path: string): string[] => path.split('/').filter(Boolean);
const parentOf = (path: string): string => {
    const index = path.lastIndexOf('/');
    return index <= 0 ? '/' : path.slice(0, index);
};
const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1);
const now = (): number => Date.now();
const directoryEntry = (): Entry => ({ kind: 'directory', size: 4096, mtimeMs: now(), birthtimeMs: now(), mode: 0o40755 });

const descendantsOf = (path: string): string[] => {
    const prefix = path === '/' ? '/' : `${path}/`;
    return [...tree.keys()].filter((key) => key !== path && key.startsWith(prefix));
};

const childrenOf = (path: string): string[] => {
    const prefix = path === '/' ? '/' : `${path}/`;
    return descendantsOf(path).map((key) => key.slice(prefix.length)).filter((name) => !name.includes('/')).sort();
};

const lookup = (path: string, syscall: string): Entry => tree.get(path) ?? fail('ENOENT', syscall, path);

const requireParent = (path: string, syscall: string): void => {
    const parent = tree.get(parentOf(path));
    if(!parent){
        fail('ENOENT', syscall, path);
    }else if(parent.kind !== 'directory'){
        fail('ENOTDIR', syscall, path);
    }
};

const directoryHandle = async (path: string): Promise<FileSystemDirectoryHandle> => {
    const cached = directories.get(path);
    if(cached){
        return cached;
    }
    const parent = await directoryHandle(parentOf(path));
    const handle = await parent.getDirectoryHandle(baseName(path), { create: true });
    directories.set(path, handle);
    return handle;
};

const syncHandle = async (path: string): Promise<FileSystemSyncAccessHandle> => {
    const open = openHandles.get(path);
    if(open){
        openHandles.delete(path);
        openHandles.set(path, open);
        return open;
    }
    const parent = await directoryHandle(parentOf(path));
    const file = await parent.getFileHandle(baseName(path), { create: true });
    const handle = await file.createSyncAccessHandle();
    openHandles.set(path, handle);
    const inUse = new Set([...descriptors.values()].map((descriptor) => descriptor.path));
    for(const [candidate, idle] of openHandles){
        if(openHandles.size <= OPEN_HANDLE_LIMIT){
            break;
        }
        if(!inUse.has(candidate) && candidate !== path){
            idle.close();
            openHandles.delete(candidate);
        }
    }
    return handle;
};

const releaseHandles = (paths: string[]): void => {
    for(const path of paths){
        openHandles.get(path)?.close();
        openHandles.delete(path);
        directories.delete(path);
    }
};

const walk = async (handle: FileSystemDirectoryHandle, prefix: string): Promise<void> => {
    for await (const [name, child] of (handle as FileSystemDirectoryHandle & { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()){
        const path = `${prefix}/${name}`;
        if(child.kind === 'directory'){
            tree.set(path, directoryEntry());
            directories.set(path, child as FileSystemDirectoryHandle);
            await walk(child as FileSystemDirectoryHandle, path);
        }else{
            const file = await (child as FileSystemFileHandle).getFile();
            tree.set(path, { kind: 'file', size: file.size, mtimeMs: file.lastModified, birthtimeMs: file.lastModified, mode: 0o100644 });
        }
    }
};

const mount = async (directory: string): Promise<void> => {
    let handle = await navigator.storage.getDirectory();
    for(const name of segments(directory)){
        handle = await handle.getDirectoryHandle(name, { create: true });
    }
    tree.set('/', directoryEntry());
    directories.set('/', handle);
    await walk(handle, '');
};

const touch = (path: string, size: number): void => {
    const entry = tree.get(path);
    tree.set(path, {
        kind: 'file',
        size,
        mtimeMs: now(),
        birthtimeMs: entry?.birthtimeMs ?? now(),
        mode: entry?.mode ?? 0o100644
    });
};

const createFile = async (path: string, syscall: string): Promise<void> => {
    requireParent(path, syscall);
    await syncHandle(path);
    touch(path, 0);
};

const requireDescriptor = (fd: number, syscall: string): Descriptor => descriptors.get(fd) ?? fail('EBADF', syscall, String(fd));

interface OpenFlags {
    write: boolean;
    create: boolean;
    truncate: boolean;
    append: boolean;
    exclusive: boolean;
}

const removeTree = async (path: string, recursive: boolean, syscall: string): Promise<void> => {
    const entry = lookup(path, syscall);
    const descendants = descendantsOf(path);
    if(entry.kind === 'directory' && descendants.length > 0 && !recursive){
        fail('ENOTEMPTY', syscall, path);
    }
    releaseHandles([path, ...descendants]);
    const parent = await directoryHandle(parentOf(path));
    await parent.removeEntry(baseName(path), { recursive: entry.kind === 'directory' });
    for(const key of [path, ...descendants]){
        tree.delete(key);
    }
};

const copyContents = async (from: string, to: string): Promise<void> => {
    const source = await syncHandle(from);
    const size = source.getSize();
    const bytes = new Uint8Array(size);
    source.read(bytes, { at: 0 });
    const target = await syncHandle(to);
    target.truncate(0);
    target.write(bytes, { at: 0 });
    target.flush();
    touch(to, size);
    const sourceEntry = lookup(from, 'copyfile');
    const targetEntry = lookup(to, 'copyfile');
    tree.set(to, { ...targetEntry, mode: sourceEntry.mode });
};

// The synchronous operations backend workers call. Each returns a JSON value and optionally bytes.
const operations: Record<string, (args: unknown[], body: Uint8Array) => Promise<{ value: unknown; body?: Uint8Array }>> = {
    async stat([path]){
        return { value: lookup(path as string, 'stat') };
    },
    async exists([path]){
        return { value: tree.has(path as string) };
    },
    async readdir([path]){
        const entry = lookup(path as string, 'scandir');
        if(entry.kind !== 'directory'){
            fail('ENOTDIR', 'scandir', path as string);
        }
        return { value: childrenOf(path as string).map((name) => [name, (tree.get(`${path === '/' ? '' : path}/${name}`) as Entry).kind]) };
    },
    async readdirRecursive([path]){
        lookup(path as string, 'scandir');
        return { value: descendantsOf(path as string).sort().map((key) => [key, (tree.get(key) as Entry).kind]) };
    },
    async mkdir([path, recursive]){
        const target = path as string;
        const existing = tree.get(target);
        if(existing){
            if(recursive && existing.kind === 'directory'){
                return { value: null };
            }
            fail('EEXIST', 'mkdir', target);
        }
        if(!recursive){
            requireParent(target, 'mkdir');
            await directoryHandle(target);
            tree.set(target, directoryEntry());
            return { value: null };
        }
        let first: string | null = null;
        let current = '';
        for(const name of segments(target)){
            current = `${current}/${name}`;
            const entry = tree.get(current);
            if(entry?.kind === 'file'){
                fail('ENOTDIR', 'mkdir', target);
            }
            if(!entry){
                await directoryHandle(current);
                tree.set(current, directoryEntry());
                first ??= current;
            }
        }
        return { value: first };
    },
    async rm([path, recursive, force]){
        if(!tree.has(path as string) && force){
            return { value: null };
        }
        await removeTree(path as string, Boolean(recursive), 'rm');
        return { value: null };
    },
    async rmdir([path, recursive]){
        if(lookup(path as string, 'rmdir').kind !== 'directory'){
            fail('ENOTDIR', 'rmdir', path as string);
        }
        await removeTree(path as string, Boolean(recursive), 'rmdir');
        return { value: null };
    },
    async unlink([path]){
        if(lookup(path as string, 'unlink').kind === 'directory'){
            fail('EISDIR', 'unlink', path as string);
        }
        await removeTree(path as string, false, 'unlink');
        return { value: null };
    },
    async rename([from, to]){
        const source = from as string;
        const target = to as string;
        const entry = lookup(source, 'rename');
        requireParent(target, 'rename');
        if(source === target){
            return { value: null };
        }
        const existing = tree.get(target);
        if(existing?.kind === 'directory' && entry.kind === 'file'){
            fail('EISDIR', 'rename', target);
        }
        if(existing){
            await removeTree(target, true, 'rename');
        }
        // OPFS has no rename every browser implements: entries are recreated under the new path.
        const moved = [source, ...descendantsOf(source).sort()];
        for(const key of moved){
            const destination = target + key.slice(source.length);
            const value = tree.get(key) as Entry;
            if(value.kind === 'directory'){
                await directoryHandle(destination);
                tree.set(destination, value);
            }else{
                await copyContents(key, destination);
                tree.set(destination, { ...value, size: (tree.get(destination) as Entry).size });
            }
        }
        for(const descriptor of descriptors.values()){
            if(descriptor.path === source || descriptor.path.startsWith(`${source}/`)){
                descriptor.path = target + descriptor.path.slice(source.length);
            }
        }
        await removeTree(source, true, 'rename');
        return { value: null };
    },
    async copyFile([from, to, exclusive]){
        const source = from as string;
        const target = to as string;
        if(lookup(source, 'copyfile').kind === 'directory'){
            fail('EISDIR', 'copyfile', source);
        }
        if(exclusive && tree.has(target)){
            fail('EEXIST', 'copyfile', target);
        }
        requireParent(target, 'copyfile');
        await copyContents(source, target);
        return { value: null };
    },
    async open([path, flags]){
        const target = path as string;
        const mode = flags as OpenFlags;
        const existing = tree.get(target);
        if(existing && mode.exclusive){
            fail('EEXIST', 'open', target);
        }
        if(!existing){
            if(!mode.create){
                fail('ENOENT', 'open', target);
            }
            await createFile(target, 'open');
        }else if(existing.kind === 'directory' && mode.write){
            fail('EISDIR', 'open', target);
        }
        if(existing?.kind === 'file'){
            const handle = await syncHandle(target);
            if(mode.truncate){
                handle.truncate(0);
                touch(target, 0);
            }
        }
        const fd = nextDescriptor;
        nextDescriptor += 1;
        descriptors.set(fd, { path: target, position: 0, append: mode.append });
        return { value: fd };
    },
    async close([fd]){
        const descriptor = requireDescriptor(fd as number, 'close');
        descriptors.delete(fd as number);
        openHandles.get(descriptor.path)?.flush();
        return { value: null };
    },
    async read([fd, length, position]){
        const descriptor = requireDescriptor(fd as number, 'read');
        if(lookup(descriptor.path, 'read').kind === 'directory'){
            fail('EISDIR', 'read', descriptor.path);
        }
        const at = typeof position === 'number' ? position : descriptor.position;
        const handle = await syncHandle(descriptor.path);
        const bytes = new Uint8Array(Math.max(0, Math.min(length as number, handle.getSize() - at)));
        const read = bytes.byteLength > 0 ? handle.read(bytes, { at }) : 0;
        if(typeof position !== 'number'){
            descriptor.position = at + read;
        }
        return { value: read, body: bytes.subarray(0, read) };
    },
    async write([fd, position], body){
        const descriptor = requireDescriptor(fd as number, 'write');
        const handle = await syncHandle(descriptor.path);
        const at = descriptor.append ? handle.getSize() : typeof position === 'number' ? position : descriptor.position;
        const written = handle.write(body, { at });
        if(typeof position !== 'number' || descriptor.append){
            descriptor.position = at + written;
        }
        touch(descriptor.path, handle.getSize());
        return { value: written };
    },
    async fstat([fd]){
        return { value: lookup(requireDescriptor(fd as number, 'fstat').path, 'fstat') };
    },
    async ftruncate([fd, length]){
        const descriptor = requireDescriptor(fd as number, 'ftruncate');
        const handle = await syncHandle(descriptor.path);
        handle.truncate(length as number);
        touch(descriptor.path, length as number);
        return { value: null };
    },
    async truncate([path, length]){
        if(lookup(path as string, 'open').kind === 'directory'){
            fail('EISDIR', 'open', path as string);
        }
        const handle = await syncHandle(path as string);
        handle.truncate(length as number);
        touch(path as string, length as number);
        return { value: null };
    },
    async readFile([path]){
        const target = path as string;
        if(lookup(target, 'open').kind === 'directory'){
            fail('EISDIR', 'read', target);
        }
        const handle = await syncHandle(target);
        const bytes = new Uint8Array(handle.getSize());
        handle.read(bytes, { at: 0 });
        return { value: bytes.byteLength, body: bytes };
    },
    async writeFile([path, append], body){
        const target = path as string;
        const existing = tree.get(target);
        if(existing?.kind === 'directory'){
            fail('EISDIR', 'open', target);
        }
        if(!existing){
            await createFile(target, 'open');
        }
        const handle = await syncHandle(target);
        if(!append){
            handle.truncate(0);
        }
        handle.write(body, { at: append ? handle.getSize() : 0 });
        handle.flush();
        touch(target, handle.getSize());
        return { value: null };
    },
    async utimes([path, mtimeMs]){
        const entry = lookup(path as string, 'utime');
        tree.set(path as string, { ...entry, mtimeMs: mtimeMs as number });
        return { value: null };
    },
    async chmod([path, mode]){
        const entry = lookup(path as string, 'chmod');
        tree.set(path as string, { ...entry, mode: (entry.mode & 0o170000) | ((mode as number) & 0o7777) });
        return { value: null };
    }
};

let queue: Promise<unknown> = Promise.resolve();

// Requests from every attached worker run one at a time, so the tree and the handles never interleave.
const execute = (request: FsRequest, body: Uint8Array): Promise<{ reply: FsReply; body?: Uint8Array }> => {
    const run = async (): Promise<{ reply: FsReply; body?: Uint8Array }> => {
        const operation = operations[request.op];
        if(!operation){
            return { reply: { ok: false, code: 'ENOSYS', message: `fs: unknown operation ${request.op}`, syscall: request.op } };
        }
        try{
            const result = await operation(request.args, body);
            return { reply: { ok: true, value: result.value }, body: result.body };
        }catch(error){
            if(error instanceof FsError){
                return { reply: { ok: false, code: error.code, message: error.message, syscall: error.syscall, path: error.path } };
            }
            const message = error instanceof Error ? error.message : String(error);
            return { reply: { ok: false, code: 'EIO', message: `EIO: ${message}`, syscall: request.op } };
        }
    };
    const result = queue.then(run);
    queue = result.catch(() => undefined);
    return result;
};

const concat = (parts: Uint8Array[]): Uint8Array => {
    if(parts.length === 1){
        return parts[0];
    }
    const joined = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
    let offset = 0;
    for(const part of parts){
        joined.set(part, offset);
        offset += part.byteLength;
    }
    return joined;
};

const waitForRequest = async (control: Int32Array): Promise<void> => {
    for(;;){
        const state = Atomics.load(control, 0);
        if(state === STATE_REQUEST){
            return;
        }
        const waiting = Atomics.waitAsync(control, 0, state);
        if(waiting.async){
            await waiting.value;
        }
    }
};

const respond = (control: Int32Array, length: number, more: boolean): void => {
    control[1] = length;
    control[2] = more ? 1 : 0;
    Atomics.store(control, 0, STATE_RESPONSE);
    Atomics.notify(control, 0);
};

const serve = async (buffers: FsChannelBuffers): Promise<void> => {
    const control = new Int32Array(buffers.control);
    const data = new Uint8Array(buffers.data);
    for(;;){
        const parts: Uint8Array[] = [];
        for(;;){
            await waitForRequest(control);
            parts.push(data.slice(0, control[1]));
            if(control[2] === 0){
                break;
            }
            respond(control, 0, false);
        }
        const message = concat(parts);
        const { header, body } = decodeMessage<FsRequest>(message);
        const result = await execute(header, body);
        const reply = encodeMessage(result.reply, result.body);
        for(let offset = 0; ; ){
            const length = Math.min(DATA_BYTES, reply.byteLength - offset);
            data.set(reply.subarray(offset, offset + length));
            offset += length;
            const more = offset < reply.byteLength;
            respond(control, length, more);
            if(!more){
                break;
            }
            await waitForRequest(control);
        }
    }
};

let mounted: Promise<void> | null = null;

const attach = (message: FsServiceAttachMessage): void => {
    message.port.onmessage = (event: MessageEvent<FsServiceAttachMessage>) => attach(event.data);
    void (mounted ?? Promise.resolve()).then(() => serve(message.buffers));
};

scope.addEventListener('message', (event) => {
    const message = event.data;
    if(message.kind === 'mount'){
        mounted = mount(message.directory);
        mounted.then(() => scope.postMessage({ kind: 'mounted' }), (error: Error) => scope.postMessage({ kind: 'failed', message: error.message }));
    }else if(message.kind === 'attach'){
        attach(message);
    }
});
