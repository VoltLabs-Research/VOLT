import { withTimeout } from '@shared/infrastructure/observability/daemon-instrumentation';
import { logger } from '@shared/infrastructure/logger';
import { Writable } from 'node:stream';
import type { DaemonTraceContext } from '@shared/infrastructure/observability/daemon-instrumentation';
import type Docker from 'dockerode';

export interface DockerExecOptions {
    operationName?: string;
    timeoutMs?: number;
    traceContext?: DaemonTraceContext;
}

const MAX_EXEC_BUFFER_SIZE = 10 * 1024 * 1024;
const DEFAULT_DOCKER_EXEC_TIMEOUT_MS = 120_000;

const collectExecOutput = async (
    docker: Docker,
    containerId: string,
    command: string[],
    stdin: string | undefined
): Promise<string> => {
    const hasStdin = stdin !== undefined;
    const container = docker.getContainer(containerId);
    const dockerExec = await container.exec({
        Cmd: command,
        AttachStdin: hasStdin,
        AttachStdout: true,
        AttachStderr: true
    });
    const stream = await dockerExec.start({
        hijack: true,
        stdin: hasStdin
    });
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let truncated = false;

    const sink = new Writable({
        write: (chunk, _encoding, callback) => {
            if (!truncated) {
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

                if (totalBytes + buffer.length > MAX_EXEC_BUFFER_SIZE) {
                    chunks.push(buffer.subarray(0, MAX_EXEC_BUFFER_SIZE - totalBytes));
                    totalBytes = MAX_EXEC_BUFFER_SIZE;
                    truncated = true;
                } else {
                    chunks.push(buffer);
                    totalBytes += buffer.length;
                }
            }

            callback();
        }
    });

    docker.modem.demuxStream(stream, sink, sink);

    if (hasStdin) {
        stream.write(stdin);
        stream.end();
    }

    await new Promise<void>((resolve, reject) => {
        stream.once('end', resolve);
        stream.once('error', reject);
    });

    const output = truncated
        ? Buffer.concat(chunks).toString('utf8') + '\n... [TRUNCATED] ...'
        : Buffer.concat(chunks).toString('utf8');

    const inspection = await dockerExec.inspect();
    if (inspection.ExitCode && inspection.ExitCode !== 0) {
        throw new Error(output || `Command failed with exit code ${inspection.ExitCode}`);
    }

    return output;
};

export const runContainerExec = async (
    docker: Docker,
    containerId: string,
    command: string[],
    stdin?: string,
    options: DockerExecOptions = {}
): Promise<string> => {
    const {
        operationName = 'docker-exec',
        timeoutMs = DEFAULT_DOCKER_EXEC_TIMEOUT_MS,
        traceContext
    } = options;

    try {
        return await withTimeout(() => collectExecOutput(docker, containerId, command, stdin), {
            operation: operationName,
            timeoutMs,
            payload: {
                command: command.join(' '),
                containerId
            },
            traceContext
        });
    } catch (error) {
        logger.warn('Docker exec operation failed');
        throw error;
    }
};
