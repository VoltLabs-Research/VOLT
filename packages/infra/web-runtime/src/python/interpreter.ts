// Pyodide started as the runtime's python3 runs: Node's code paths, over the process's file system
// and standard streams (python.ts is the program; kernel.ts serves a notebook with it).
import fs from 'fs';
import os from 'os';
import path from 'path';
import createPyodideModule from 'pyodide/pyodide.asm.mjs';
import type { PyodideAPI } from 'pyodide';
import browserProcess from '../platform/process';
import { programExecutable } from '../platform/child-process';
import { readStdinSync } from '../platform/stdio';
import pipSource from './pip.py';
import kernelSource from './kernel.py';
import matplotlibBackendSource from './matplotlib_backend.py';

// Defined by scripts/build.mjs from the Pyodide release it installs.
declare const VOLT_PYTHON_VERSION: string;

export type Python = PyodideAPI;

// Where scripts/build.mjs installs Pyodide's files (the interpreter, its standard library and lock
// file); the packages it downloads from Pyodide's CDN are kept next to them.
const PYODIDE_HOME = '/usr/local/lib/pyodide/';

const [MAJOR, MINOR] = VOLT_PYTHON_VERSION.split('.');
const LIB = `python${MAJOR}.${MINOR}`;

// The machine's interpreter, which virtual environments outside one are made from.
export const SYSTEM_PYTHON = '/usr/local/bin/python3';

// The directories of Python's own file system: its standard library and the device files.
const OWN_DIRECTORIES = new Set(['lib', 'dev', 'proc']);
// The machine's site-packages, where the interpreter outside a virtual environment installs.
const SITE_PACKAGES = `/usr/local/lib/${LIB}/site-packages`;

// Modules of the program's own, which its pip and kernel import (importOwnModule).
const OWN_MODULES_DIRECTORY = '/lib/volt';
const OWN_MODULES: Record<string, string> = {
    '_volt_pip.py': pipSource,
    'volt_kernel.py': kernelSource,
    '_volt_matplotlib.py': matplotlibBackendSource
};

interface EmscriptenFs {
    filesystems: { NODEFS: unknown };
    mkdirTree(target: string): void;
    mount(type: unknown, options: { root: string }, mountpoint: string): void;
    chdir(target: string): void;
    writeFile(target: string, data: string): void;
}

export const isExitStatus = (error: unknown): error is { status: number } => (error as { name?: string } | null)?.name === 'ExitStatus';

// The virtual environment an interpreter's executable belongs to: the directory above its bin/
// with a pyvenv.cfg, as CPython finds it.
const environmentOf = (executable: string): string | null => {
    const directory = path.dirname(path.dirname(executable));
    return fs.existsSync(path.join(directory, 'pyvenv.cfg')) ? directory : null;
};

// The interpreter a virtual environment is made from: its pyvenv.cfg's executable.
export const baseExecutable = (executable: string): string => {
    const environment = environmentOf(executable);
    if(!environment){
        return executable;
    }
    const config = String(fs.readFileSync(path.join(environment, 'pyvenv.cfg'), 'utf8'));
    return /^executable\s*=\s*(.+)$/m.exec(config)?.[1].trim() ?? executable;
};

// What Python's venv writes: pyvenv.cfg, the site-packages directory, and the interpreter in bin/
// under its names, each a copy of the base interpreter's executable.
export const createEnvironment = (directory: string, base: string, options: { clear?: boolean; systemSitePackages?: boolean } = {}): void => {
    if(options.clear){
        fs.rmSync(directory, { recursive: true, force: true });
    }
    const bin = path.join(directory, 'bin');
    fs.mkdirSync(bin, { recursive: true });
    fs.mkdirSync(path.join(directory, 'lib', LIB, 'site-packages'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'pyvenv.cfg'), [
        `home = ${path.dirname(base)}`,
        `include-system-site-packages = ${options.systemSitePackages ? 'true' : 'false'}`,
        `version = ${VOLT_PYTHON_VERSION}`,
        `executable = ${base}`,
        `command = ${base} -m venv ${directory}`,
        ''
    ].join('\n'));
    for(const name of ['python', `python${MAJOR}`, LIB]){
        const target = path.join(bin, name);
        fs.writeFileSync(target, programExecutable('python3'));
        fs.chmodSync(target, 0o755);
    }
};

// The process's file system, mounted over Python's at each of its top-level directories, the
// machine's site-packages over Python's own, and the program's modules next to the standard library.
const mountProcessFiles = (FS: EmscriptenFs): void => {
    const NODEFS = FS.filesystems.NODEFS;
    const mount = (hostDirectory: string, mountpoint: string): void => {
        FS.mkdirTree(mountpoint);
        FS.mount(NODEFS, { root: hostDirectory }, mountpoint);
    };
    fs.mkdirSync(SITE_PACKAGES, { recursive: true });
    for(const name of fs.readdirSync('/') as string[]){
        const directory = `/${name}`;
        if(!OWN_DIRECTORIES.has(name) && fs.statSync(directory)?.isDirectory()){
            mount(directory, directory);
        }
    }
    mount(SITE_PACKAGES, `/lib/${LIB}/site-packages`);
    FS.mkdirTree(OWN_MODULES_DIRECTORY);
    for(const [file, source] of Object.entries(OWN_MODULES)){
        FS.writeFile(`${OWN_MODULES_DIRECTORY}/${file}`, source);
    }
    FS.chdir(process.cwd());
};

// Python's `js` module: this worker's globals as a browser worker has them. Code that takes Node's
// APIs when it finds `process` (urllib3, whose Node requests need JavaScript promise integration)
// takes the browser's.
const pythonGlobals = new Proxy(globalThis, {
    get: (target, key) => (key === 'process' ? undefined : Reflect.get(target, key)),
    has: (target, key) => key !== 'process' && Reflect.has(target, key)
});

export const processEnv = (): Record<string, string> => Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
);

// Pyodide picks Node's code paths (files from the file system, NODEFS) when it loads in a realm
// that is not a browser's; the runtime's process says it is one.
const importPyodide = async (): Promise<typeof import('pyodide')> => {
    const isBrowser = browserProcess.browser;
    browserProcess.browser = false;
    try{
        return await import('pyodide');
    }finally{
        browserProcess.browser = isBrowser;
    }
};

// The interpreter at `executable` (its virtual environment's, when it is one's), with Python's
// command line `args` and environment `env`.
export const startPython = async (executable: string, args: string[], env: Record<string, string>): Promise<Python> => {
    const { loadPyodide } = await importPyodide();
    const python = await loadPyodide({
        indexURL: PYODIDE_HOME,
        packageCacheDir: PYODIDE_HOME,
        args,
        env: { HOME: os.homedir(), ...env },
        _sysExecutable: executable,
        stdout: (line) => process.stdout.write(`${line}\n`),
        stderr: (line) => process.stderr.write(`${line}\n`),
        jsglobals: pythonGlobals,
        createPyodideModule,
        fsInit: async (FS) => mountProcessFiles(FS as unknown as EmscriptenFs)
    });
    python.setStdin({ read: (buffer) => readStdinSync(buffer) });
    // Copies: the bytes are a view of the interpreter's memory, and output is transferred.
    python.setStdout({ write: (buffer) => {
        process.stdout.write(buffer.slice());
        return buffer.byteLength;
    } });
    python.setStderr({ write: (buffer) => {
        process.stderr.write(buffer.slice());
        return buffer.byteLength;
    } });
    return python;
};

export const flushStreams = (python: Python): void => {
    python.runPython('import sys\nsys.stdout.flush()\nsys.stderr.flush()');
};

// What the interpreter does as it exits, which Pyodide's main leaves undone: the atexit callbacks,
// then what is still buffered in the standard streams.
export const finalize = (python: Python): void => {
    python.runPython([
        'import atexit, sys',
        'atexit._run_exitfuncs()',
        'for stream in (sys.stdout, sys.stderr):',
        '    try:',
        '        stream.flush()',
        '    except Exception:',
        '        pass'
    ].join('\n'));
};

// One of the program's own modules, which only the program's own code imports: their directory is
// on sys.path in the processes that run it.
export const importOwnModule = (python: Python, name: string): ReturnType<Python['pyimport']> => {
    python.runPython(`import sys\nif ${JSON.stringify(OWN_MODULES_DIRECTORY)} not in sys.path:\n    sys.path.append(${JSON.stringify(OWN_MODULES_DIRECTORY)})`);
    return python.pyimport(name);
};

// micropip, which `pip` installs with; Pyodide keeps its wheel with the packages it downloaded.
export const loadMicropip = (python: Python): Promise<unknown> => python.loadPackage('micropip', { messageCallback: () => {} });
