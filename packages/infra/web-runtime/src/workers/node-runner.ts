// The entry of the runner's worker: runs a CommonJS program of the file system as `node <script>`
// does, its `require` resolving Node's built-ins to the runtime's and other modules to files next to
// it or in node_modules. The program ends when it calls process.exit, as the programs built for this
// runtime do: a browser worker's event loop never reports itself idle, which is when Node would end.
import assert from 'assert';
import asyncHooks from 'async_hooks';
import buffer from 'buffer';
import childProcess from 'child_process';
import crypto from 'crypto';
import events from 'events';
import fs from 'fs';
import fsPromises from 'fs/promises';
import http from 'http';
import http2 from 'http2';
import https from 'https';
import net from 'net';
import os from 'os';
import path from 'path';
import perfHooks from 'perf_hooks';
import processModule from 'process';
import querystring from 'querystring';
import readline from 'readline';
import stream from 'stream';
import streamPromises from 'stream/promises';
import stringDecoder from 'string_decoder';
import timers from 'timers';
import tty from 'tty';
import url from 'url';
import util from 'util';
import utilTypes from 'util/types';
import workerThreads from 'worker_threads';
import zlib from 'zlib';

const BUILTINS: Record<string, unknown> = {
    assert,
    async_hooks: asyncHooks,
    buffer,
    child_process: childProcess,
    crypto,
    events,
    fs,
    'fs/promises': fsPromises,
    http,
    http2,
    https,
    net,
    os,
    path,
    perf_hooks: perfHooks,
    process: processModule,
    querystring,
    readline,
    stream,
    'stream/promises': streamPromises,
    string_decoder: stringDecoder,
    timers,
    tty,
    url,
    util,
    'util/types': utilTypes,
    worker_threads: workerThreads,
    zlib
};

interface CommonJsModule {
    id: string;
    filename: string;
    path: string;
    exports: unknown;
    loaded: boolean;
    children: CommonJsModule[];
    require: NodeRequire;
}

const cache: Record<string, CommonJsModule> = {};
let mainModule: CommonJsModule | undefined;

const EXTENSIONS = ['.js', '.cjs', '.json'];

const isFile = (file: string): boolean => fs.statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;
const isDirectory = (file: string): boolean => fs.statSync(file, { throwIfNoEntry: false })?.isDirectory() ?? false;

// Node's resolution of a path: the file, the file with a known extension, or the directory's
// package main or index.
const resolveFile = (candidate: string): string | null => {
    if(isFile(candidate)){
        return candidate;
    }
    for(const extension of EXTENSIONS){
        if(isFile(candidate + extension)){
            return candidate + extension;
        }
    }
    if(isDirectory(candidate)){
        const manifest = path.join(candidate, 'package.json');
        const main = isFile(manifest) ? (JSON.parse(fs.readFileSync(manifest, 'utf8')) as { main?: string }).main : undefined;
        return (main && resolveFile(path.resolve(candidate, main))) || resolveFile(path.join(candidate, 'index'));
    }
    return null;
};

const notFound = (request: string, parent: string): Error => Object.assign(
    new Error(`Cannot find module '${request}'\nRequire stack:\n- ${parent}`),
    { code: 'MODULE_NOT_FOUND' }
);

const builtinName = (request: string): string | null => {
    const name = request.startsWith('node:') ? request.slice('node:'.length) : request;
    return name in BUILTINS ? name : null;
};

// The folders Node searches after node_modules: NODE_PATH's, the user's, and $PREFIX/lib/node, where
// the machine's global packages are (src/platform/global-packages.ts).
const globalFolders = (): string[] => [
    ...(process.env.NODE_PATH ?? '').split(':').filter(Boolean),
    ...(process.env.HOME ? [path.join(process.env.HOME, '.node_modules'), path.join(process.env.HOME, '.node_libraries')] : []),
    path.resolve(path.dirname(process.execPath), '..', 'lib', 'node')
];

const resolveRequest = (request: string, parent: string): string => {
    const directory = path.dirname(parent);
    if(request.startsWith('./') || request.startsWith('../') || request.startsWith('/') || request === '.' || request === '..'){
        const file = resolveFile(path.resolve(directory, request));
        if(file){
            return file;
        }
        throw notFound(request, parent);
    }
    for(let current = directory; ; current = path.dirname(current)){
        const file = resolveFile(path.join(current, 'node_modules', request));
        if(file){
            return file;
        }
        if(current === path.dirname(current)){
            break;
        }
    }
    for(const folder of globalFolders()){
        const file = resolveFile(path.join(folder, request));
        if(file){
            return file;
        }
    }
    throw notFound(request, parent);
};

const createRequire = (module: CommonJsModule): NodeRequire => {
    const require = ((request: string) => {
        const builtin = builtinName(request);
        if(builtin){
            return BUILTINS[builtin];
        }
        const child = load(resolveRequest(request, module.filename));
        module.children.push(child);
        return child.exports;
    }) as NodeRequire;
    require.resolve = Object.assign(
        (request: string) => builtinName(request) ?? resolveRequest(request, module.filename),
        { paths: () => null }
    ) as NodeRequire['resolve'];
    require.cache = cache as unknown as NodeRequire['cache'];
    require.main = mainModule as unknown as NodeRequire['main'];
    return require;
};

const load = (filename: string): CommonJsModule => {
    const cached = cache[filename];
    if(cached){
        return cached;
    }
    const module = { id: filename, filename, path: path.dirname(filename), exports: {}, loaded: false, children: [] } as unknown as CommonJsModule;
    module.require = createRequire(module);
    cache[filename] = module;
    mainModule ??= module;
    if(filename.endsWith('.json')){
        module.exports = JSON.parse(fs.readFileSync(filename, 'utf8'));
    }else{
        // The interpreter line is a comment to the kernel, not JavaScript.
        const source = fs.readFileSync(filename, 'utf8').replace(/^#!.*/, '');
        const wrapper = new Function('exports', 'require', 'module', '__filename', '__dirname', `${source}\n//# sourceURL=${filename}`);
        wrapper.call(module.exports, module.exports, module.require, module, filename, module.path);
    }
    module.loaded = true;
    return module;
};

load(path.resolve(process.argv[1]));
