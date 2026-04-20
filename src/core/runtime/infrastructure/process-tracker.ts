import type { ChildProcess } from 'node:child_process';

const SIGKILL_GRACE_PERIOD_MS = 5_000;

const activeProcesses = new Map<string, ChildProcess>();

export const registerProcess = (jobId: string, process: ChildProcess): void => {
    activeProcesses.set(jobId, process);
};

export const unregisterProcess = (jobId: string, expected?: ChildProcess): void => {
    if (expected && activeProcesses.get(jobId) !== expected) return;
    activeProcesses.delete(jobId);
};

export const stopProcess = (jobId: string): boolean => {
    const child = activeProcesses.get(jobId);
    if (!child) return false;

    activeProcesses.delete(jobId);

    if (child.exitCode !== null || child.signalCode !== null || child.killed) {
        return false;
    }

    try {
        child.kill('SIGTERM');
    } catch {
        return true;
    }

    setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
            try { child.kill('SIGKILL'); } catch { /* ignore */ }
        }
    }, SIGKILL_GRACE_PERIOD_MS).unref();

    return true;
};
