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

export const currentPlatformTag = (): string =>
    `${SYSTEM_TAGS[os.platform()] ?? os.platform()}-${MACHINE_TAGS[os.arch()] ?? os.arch()}`;
