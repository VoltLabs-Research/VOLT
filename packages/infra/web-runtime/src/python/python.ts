// The runtime's python3: CPython compiled to WebAssembly (Pyodide), run as Node runs it. Python sees
// the process's file system (src/platform/fs, through Emscripten's NODEFS), reads and writes the
// process's standard streams and ends with its exit code, so a backend runs it as python3 runs on a
// machine. `-m venv` creates a virtual environment whose interpreter is a copy of this program's
// executable (src/platform/child-process.ts runs a copy as the program it is); `-m pip` installs
// packages into the running environment with micropip; `-m volt_kernel` serves a notebook (kernel.ts).
import { baseExecutable, createEnvironment, finalize, flushStreams, importOwnModule, isExitStatus, loadMicropip, processEnv, startPython } from './interpreter';
import type { Python } from './interpreter';
import { runKernel } from './kernel';
import path from 'path';

interface PyodideInternals {
    _module: { _run_main(): number };
}

const VENV_USAGE = 'usage: venv [--system-site-packages] [--clear] [--prompt PROMPT] ENV_DIR [ENV_DIR ...]';

// The module python3's command line runs with -m, past the interpreter's own options: null when it
// runs a script, a command (-c) or its standard input instead.
const moduleOf = (args: string[]): { name: string; args: string[] } | null => {
    for(let index = 0; index < args.length; index += 1){
        const arg = args[index];
        if(arg.startsWith('--') && arg !== '--'){
            if(arg === '--check-hash-based-pycs'){
                index += 1;
            }
            continue;
        }
        // A script, standard input, or the end of the options.
        if(arg === '--' || arg === '-' || !arg.startsWith('-')){
            return null;
        }
        // A cluster of single-letter options; -W and -X take the rest, or the next argument.
        for(let at = 1; at < arg.length; at += 1){
            const option = arg[at];
            if(option === 'c'){
                return null;
            }
            if(option === 'm'){
                const rest = arg.slice(at + 1);
                if(rest){
                    return { name: rest, args: args.slice(index + 1) };
                }
                return args[index + 1] ? { name: args[index + 1], args: args.slice(index + 2) } : null;
            }
            if(option === 'W' || option === 'X'){
                if(at === arg.length - 1){
                    index += 1;
                }
                break;
            }
        }
    }
    return null;
};

// `python3 -m venv [options] DIR...`, which needs no interpreter running.
const venv = (executable: string, args: string[]): number => {
    const directories: string[] = [];
    const options = { clear: false, systemSitePackages: false };
    for(let index = 0; index < args.length; index += 1){
        const arg = args[index];
        if(arg === '--clear'){
            options.clear = true;
        }else if(arg === '--system-site-packages'){
            options.systemSitePackages = true;
        }else if(arg === '--prompt'){
            index += 1;
        }else if(arg === '-h' || arg === '--help'){
            process.stdout.write(`${VENV_USAGE}\n`);
            return 0;
        }else if(!arg.startsWith('-')){
            directories.push(path.resolve(arg));
        }
    }
    if(directories.length === 0){
        process.stderr.write(`${VENV_USAGE}\nvenv: error: the following arguments are required: ENV_DIR\n`);
        return 2;
    }
    const base = baseExecutable(executable);
    for(const directory of directories){
        createEnvironment(directory, base, options);
    }
    return 0;
};

// `python3 -m pip ...`: micropip's installs are asynchronous, so pip runs from here rather than as
// Python's main module.
const pip = async (python: Python, args: string[]): Promise<number> => {
    await loadMicropip(python);
    try{
        return await importOwnModule(python, '_volt_pip').main(args) as number;
    }finally{
        flushStreams(python);
    }
};

const run = async (): Promise<number> => {
    const [executable, ...args] = process.argv.slice(1);
    const module = moduleOf(args);
    if(module?.name === 'venv'){
        return venv(executable, module.args);
    }
    if(module?.name === 'volt_kernel'){
        return runKernel(executable, module.args);
    }
    // PYTHONINSPECT keeps an interpreter Pyodide embeds from exiting on SystemExit; this one exits.
    const python = await startPython(executable, args, { ...processEnv(), PYTHONINSPECT: '' });
    if(module?.name === 'pip'){
        return pip(python, module.args);
    }
    // Python's main: what the command line asks for (a script, -c, -m, or standard input), with the
    // script's directory as sys.path[0] rather than the working directory Pyodide puts there.
    python.runPython('import sys\nif sys.path and sys.path[0] == "":\n    del sys.path[0]');
    try{
        const code = (python as unknown as PyodideInternals)._module._run_main();
        finalize(python);
        return code;
    }catch(error){
        // SystemExit: Python exited, as it does on a machine, and finalized itself.
        if(isExitStatus(error)){
            return error.status;
        }
        throw error;
    }
};

run().then(
    (code) => process.exit(code),
    (error: unknown) => {
        if(isExitStatus(error)){
            process.exit(error.status);
        }
        process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
        process.exit(1);
    }
);
