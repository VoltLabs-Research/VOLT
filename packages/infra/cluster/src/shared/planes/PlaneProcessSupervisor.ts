import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { logger } from '@shared/logger';
import { applyPreferredPlaneProcessPriority } from '@shared/utilities/process-priority';

interface PlaneProcessOptions {
    label: string;
    script: string;
    restartDelayMs: number;
    args?: readonly string[];
    env?: NodeJS.ProcessEnv;
    advancedSerialization?: boolean;
}

// This file sits in <source root>/shared/planes both in src and in the compiled dist.
const SOURCE_ROOT = path.resolve(__dirname, '..', '..');

const resolveProcessCommand = (script: string, extraArgs: readonly string[]): { execPath: string; args: string[] } => {
    if (__filename.endsWith('.js')) {
        const scriptPath = path.join(SOURCE_ROOT, `${script}.js`);
        if (!existsSync(scriptPath)) {
            throw new Error(`Plane script missing: ${scriptPath}`);
        }
        return {
            execPath: process.execPath,
            args: [scriptPath, ...extraArgs]
        };
    }

    const tsx = process.platform === 'win32'
        ? path.resolve(process.cwd(), 'node_modules', '.bin', 'tsx.cmd')
        : path.resolve(process.cwd(), 'node_modules', '.bin', 'tsx');

    return {
        execPath: tsx,
        args: [path.join(SOURCE_ROOT, `${script}.ts`), ...extraArgs]
    };
};

export abstract class PlaneProcessSupervisor {
    protected child: ChildProcess | null = null;
    protected stopping = false;
    private restartTimer: ReturnType<typeof setTimeout> | null = null;

    protected constructor(private readonly plane: PlaneProcessOptions) {}

    protected spawnProcess(): void {
        const { label, env, advancedSerialization, restartDelayMs, script, args = [] } = this.plane;
        const command = resolveProcessCommand(script, args);

        const child = spawn(command.execPath, command.args, {
            cwd: process.cwd(),
            env: {
                ...process.env,
                ...env
            },
            stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
            windowsHide: true,
            ...(advancedSerialization ? { serialization: 'advanced' as const } : {})
        });

        this.child = child;
        logger.info(`${label} spawned pid=${child.pid ?? 'unknown'} script=${command.args[0]}`);
        applyPreferredPlaneProcessPriority(child.pid, label);

        child.stdout?.on('data', (chunk: Buffer) => {
            process.stdout.write(`[${label}] ${chunk.toString('utf8')}`);
        });
        child.stderr?.on('data', (chunk: Buffer) => {
            process.stderr.write(`[${label}] ${chunk.toString('utf8')}`);
        });
        child.on('error', (error) => {
            this.onProcessError(error);
        });
        child.on('exit', (code, signal) => {
            if (this.child === child) {
                this.child = null;
            }

            this.onProcessExit(code, signal);

            if (this.stopping) return;

            logger.warn(`${label} exited code=${code ?? 'null'} signal=${signal ?? 'none'}; restarting`);
            this.restartTimer = setTimeout(() => {
                this.restartTimer = null;
                this.spawnProcess();
            }, restartDelayMs);
            this.restartTimer.unref();
        });

        this.onProcessSpawned(child);
    }

    protected stopProcess(): void {
        this.stopping = true;
        this.clearRestartTimer();

        const child = this.child;
        this.child = null;
        child?.kill('SIGTERM');
    }

    protected clearRestartTimer(): void {
        if (!this.restartTimer) return;
        clearTimeout(this.restartTimer);
        this.restartTimer = null;
    }

    protected onProcessSpawned(_child: ChildProcess): void {}

    protected onProcessExit(_code: number | null, _signal: NodeJS.Signals | null): void {}

    protected onProcessError(error: Error): void {
        logger.error({ err: error }, `@${this.plane.label}: process error`);
    }
}
