import { setTimeout as delay } from 'node:timers/promises';
import type { Duplex } from 'node:stream';
import type Docker from 'dockerode';

interface RuntimeTerminalSize {
    rows: number;
    cols: number;
}

interface RuntimeTerminalExec {
    resize(size: RuntimeTerminalSize): Promise<void>;
}

export interface RuntimeTerminalAttachment {
    stream: Duplex;
    exec: RuntimeTerminalExec;
    close(): Promise<void>;
}

interface TerminalCloseOptions {
    interruptDelayMs?: number;
    pollIntervalMs?: number;
    timeoutMs?: number;
}

const TERMINAL_CLOSE_TIMEOUT_MS = 5_000;
const TERMINAL_CLOSE_POLL_INTERVAL_MS = 100;
const TERMINAL_INTERRUPT_EXIT_DELAY_MS = 100;

const isWritableTerminalStreamOpen = (stream: Duplex): boolean => {
    return !stream.destroyed && !stream.writableEnded;
};

const writeToTerminalStream = async (stream: Duplex, data: string): Promise<void> => {
    if (!isWritableTerminalStreamOpen(stream) || data.length === 0) {
        return;
    }

    await new Promise<void>((resolve, reject) => {
        stream.write(data, (error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
};

const endTerminalStream = async (stream: Duplex, data: string): Promise<void> => {
    if (!isWritableTerminalStreamOpen(stream)) {
        return;
    }

    await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
            stream.off('error', onError);
            reject(error);
        };

        stream.once('error', onError);
        stream.end(data, () => {
            stream.off('error', onError);
            resolve();
        });
    });
};

const waitForTerminalExecExit = async (
    dockerExec: Pick<Docker.Exec, 'inspect'>,
    timeoutMs: number,
    pollIntervalMs: number
): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
        const inspection = await dockerExec.inspect();
        if (!inspection.Running) {
            return true;
        }

        await delay(pollIntervalMs);
    }

    return false;
};

const closeTerminalExec = async (
    stream: Duplex,
    dockerExec: Pick<Docker.Exec, 'inspect'>,
    options: TerminalCloseOptions = {}
): Promise<void> => {
    const interruptDelayMs = options.interruptDelayMs ?? TERMINAL_INTERRUPT_EXIT_DELAY_MS;
    const pollIntervalMs = options.pollIntervalMs ?? TERMINAL_CLOSE_POLL_INTERVAL_MS;
    const timeoutMs = options.timeoutMs ?? TERMINAL_CLOSE_TIMEOUT_MS;

    const execAlreadyStopped = await waitForTerminalExecExit(dockerExec, 0, pollIntervalMs);
    if (!execAlreadyStopped) {
        try {
            await writeToTerminalStream(stream, '\u0003');
            await delay(interruptDelayMs);
        } catch {
        }

        try {
            await endTerminalStream(stream, 'exit\n');
        } catch {
        }
    }

    const exited = execAlreadyStopped || await waitForTerminalExecExit(dockerExec, timeoutMs, pollIntervalMs);
    if (!exited) {
        if (!stream.destroyed) {
            stream.destroy();
        }

        throw new Error('Terminal exec did not exit after close sequence');
    }

    if (!stream.destroyed) {
        stream.destroy();
    }
};

export const attachContainerTerminal = async (container: Docker.Container): Promise<RuntimeTerminalAttachment> => {
    const dockerExec = await container.exec({
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Cmd: ['/bin/sh'],
        Env: ['TERM=xterm-256color']
    });
    const stream = await dockerExec.start({
        hijack: true,
        stdin: true
    });
    let closePromise: Promise<void> | null = null;

    return {
        stream,
        exec: {
            resize: ({ rows, cols }) => dockerExec.resize({
                h: rows,
                w: cols
            })
        },
        close: () => {
            closePromise ??= closeTerminalExec(stream, dockerExec);
            return closePromise;
        }
    };
};
