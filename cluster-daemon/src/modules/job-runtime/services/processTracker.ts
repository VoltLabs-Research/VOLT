import type { ChildProcess } from 'node:child_process';

const activeProcesses = new Map<string, ChildProcess>();

export const registerProcess = (jobId: string, process: ChildProcess): void => {
    activeProcesses.set(jobId, process);
};

export const unregisterProcess = (jobId: string): void => {
    activeProcesses.delete(jobId);
};

export const stopProcess = (jobId: string): boolean => {
    const process = activeProcesses.get(jobId);
    if (!process) {
        return false;
    }

    process.kill('SIGTERM');
    activeProcesses.delete(jobId);
    return true;
};
