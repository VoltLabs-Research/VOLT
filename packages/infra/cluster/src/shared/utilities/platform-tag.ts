import os from 'node:os';

const SYSTEM_TAGS: Record<string, string> = {
    linux: 'linux',
    darwin: 'darwin',
    win32: 'windows'
};

const MACHINE_TAGS: Record<string, string> = {
    x64: 'x86_64',
    arm64: 'arm64',
    ia32: 'i686'
};

// On a wasm32 machine (the browser's runtime) programs run whatever system hosts it, so plugins
// publish those builds as wasm-wasm32, naming no system. Node's typings know no wasm32.
export const currentPlatformTag = (): string => {
    const machine: string = os.arch();
    return machine === 'wasm32'
        ? 'wasm-wasm32'
        : `${SYSTEM_TAGS[os.platform()] ?? os.platform()}-${MACHINE_TAGS[machine] ?? machine}`;
};
