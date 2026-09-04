import path from 'node:path';

const PATH_VARIABLE = 'PATH';

const LIBRARY_PATH_VARIABLES: Record<string, string[]> = {
    darwin: ['DYLD_LIBRARY_PATH', 'DYLD_FALLBACK_LIBRARY_PATH'],
    linux: ['LD_LIBRARY_PATH']
};

const prependEntries = (entries: string[], current: string | undefined): string =>
    current ? [...entries, current].join(path.delimiter) : entries.join(path.delimiter);

export const pathVariableName = (env: NodeJS.ProcessEnv = process.env): string =>
    Object.keys(env).find((key) => key.toUpperCase() === PATH_VARIABLE) ?? PATH_VARIABLE;

export const prependPathEntries = (entries: string[], env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => {
    const name = pathVariableName(env);
    return { [name]: prependEntries(entries, env[name]) };
};

export const sharedLibraryPathEnv = (libraryDirs: string[], env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => {
    if (process.platform === 'win32') {
        return prependPathEntries(libraryDirs, env);
    }

    const variables = LIBRARY_PATH_VARIABLES[process.platform] ?? LIBRARY_PATH_VARIABLES.linux;
    const result: NodeJS.ProcessEnv = {};
    for (const name of variables) {
        result[name] = prependEntries(libraryDirs, env[name]);
    }

    return result;
};
