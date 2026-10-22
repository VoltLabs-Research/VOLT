// Node's `module` as Emscripten's ES module output uses it in Node: createRequire() for the
// built-ins Pyodide's pyodide.asm.mjs loads with require(), resolved to the runtime's.
import childProcess from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import tty from 'tty';
import url from 'url';
import ws from '../platform/ws';

const BUILTINS: Record<string, unknown> = { child_process: childProcess, crypto, fs, path, tty, url, ws };

export const createRequire = (): ((request: string) => unknown) => (request: string) => {
    const name = request.startsWith('node:') ? request.slice('node:'.length) : request;
    if(!(name in BUILTINS)){
        throw Object.assign(new Error(`Cannot find module '${request}'`), { code: 'MODULE_NOT_FOUND' });
    }
    return BUILTINS[name];
};

export default { createRequire };
