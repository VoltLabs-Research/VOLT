import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import type { DaemonConfig } from '@/core/config';
import type { RuntimeRoleCoordinator } from '@/app/coordination/RuntimeRoleCoordinator';
import { applyPreferredPlaneProcessPriority } from '@/support/runtime/process-priority';

const HEARTBEAT_PROCESS_RESTART_DELAY_MS = 2_000;

@Service('heartbeatPlaneProcess')
export class HeartbeatPlaneProcess {
    private child: ChildProcess | null = null;
    private stopping = false;
    private runtimeSnapshotTimer: ReturnType<typeof setInterval> | null = null;
    private restartTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private readonly config: DaemonConfig,
        private readonly runtimeRoleCoordinator: RuntimeRoleCoordinator
    ) {}

    start(): void {
        if (this.child) return;
        this.stopping = false;
        this.spawnProcess();
        this.startRuntimeSnapshotPublisher();
    }

    stop(): void {
        this.stopping = true;
        if (this.runtimeSnapshotTimer) {
            clearInterval(this.runtimeSnapshotTimer);
            this.runtimeSnapshotTimer = null;
        }
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }

        const child = this.child;
        this.child = null;
        child?.kill('SIGTERM');
    }

    publishRuntimeSnapshot(): void {
        const child = this.child;
        if (!child || !child.connected) return;

        try {
            child.send({
                type: 'runtime-config',
                runtimeConfig: this.runtimeRoleCoordinator.getSnapshot()
            });
        } catch (error) {
            logger.warn(`Failed to publish runtime snapshot to heartbeat plane: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private spawnProcess(): void {
        const command = this.resolveProcessCommand();
        const child = spawn(command.execPath, command.args, {
            cwd: process.cwd(),
            env: {
                ...process.env,
                TEAM_CLUSTER_HEARTBEAT_PLANE: '1'
            },
            stdio: ['ignore', 'pipe', 'pipe', 'ipc']
        });

        this.child = child;
        applyPreferredPlaneProcessPriority(child.pid, 'heartbeat-plane');

        child.stdout?.on('data', (chunk: Buffer) => {
            process.stdout.write(`[heartbeat-plane] ${chunk.toString('utf8')}`);
        });
        child.stderr?.on('data', (chunk: Buffer) => {
            process.stderr.write(`[heartbeat-plane] ${chunk.toString('utf8')}`);
        });
        child.on('error', (error) => {
            logger.error({ err: error }, '@heartbeat-plane: process error');
        });
        child.on('exit', (code, signal) => {
            if (this.child === child) {
                this.child = null;
            }

            if (this.stopping) return;

            logger.warn(`Heartbeat plane exited code=${code ?? 'null'} signal=${signal ?? 'none'}; restarting`);
            this.restartTimer = setTimeout(() => {
                this.restartTimer = null;
                this.spawnProcess();
                this.publishRuntimeSnapshot();
            }, HEARTBEAT_PROCESS_RESTART_DELAY_MS);
            this.restartTimer.unref();
        });

        this.publishRuntimeSnapshot();
    }

    private startRuntimeSnapshotPublisher(): void {
        if (this.runtimeSnapshotTimer) return;

        const intervalMs = Math.max(1_000, Math.min(this.config.metricsIntervalMs, 10_000));
        this.runtimeSnapshotTimer = setInterval(() => {
            this.publishRuntimeSnapshot();
        }, intervalMs);
        this.runtimeSnapshotTimer.unref();
    }

    private resolveProcessCommand(): { execPath: string; args: string[] } {
        const runningFromDist = __filename.endsWith('.js') && __dirname.includes(`${path.sep}dist${path.sep}`);
        const scriptPath = runningFromDist
            ? path.resolve(__dirname, '..', '..', 'control-plane', 'heartbeat-process.js')
            : path.resolve(process.cwd(), 'src', 'control-plane', 'heartbeat-process.ts');

        if (runningFromDist) {
            return {
                execPath: process.execPath,
                args: [scriptPath]
            };
        }

        return {
            execPath: path.resolve(process.cwd(), 'node_modules', '.bin', 'tsx'),
            args: [scriptPath]
        };
    }
}
