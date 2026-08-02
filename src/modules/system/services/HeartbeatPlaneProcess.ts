import { errorMessage } from '@shared/application/utilities/error-message';
import { singleton } from '@shared/application/utilities/singleton';
import { getConfig } from '@core/config/daemon';
import { getRuntimeRoleCoordinator } from '@core/bootstrap/RuntimeRoleCoordinator';
import { PlaneProcessSupervisor } from '@shared/infrastructure/planes/PlaneProcessSupervisor';
import { logger } from '@shared/infrastructure/logger';
import type { ChildProcess } from 'node:child_process';
import type { DaemonConfig } from '@core/config/daemon';
import type { RuntimeRoleCoordinator } from '@core/bootstrap/RuntimeRoleCoordinator';

const RESTART_DELAY_MS = 2_000;
const SNAPSHOT_INTERVAL_MIN_MS = 1_000;
const SNAPSHOT_INTERVAL_MAX_MS = 10_000;

export class HeartbeatPlaneProcess extends PlaneProcessSupervisor {
    private runtimeSnapshotTimer: ReturnType<typeof setInterval> | null = null;

    constructor(
        private readonly config: DaemonConfig,
        private readonly runtimeRoleCoordinator: RuntimeRoleCoordinator
    ) {
        super({
            label: 'heartbeat-plane',
            script: 'heartbeat-plane',
            restartDelayMs: RESTART_DELAY_MS,
            env: { TEAM_CLUSTER_HEARTBEAT_PLANE: '1' }
        });
    }

    start(): void {
        if (this.child) return;
        this.stopping = false;
        this.spawnProcess();
        this.startRuntimeSnapshotPublisher();
    }

    stop(): void {
        if (this.runtimeSnapshotTimer) {
            clearInterval(this.runtimeSnapshotTimer);
            this.runtimeSnapshotTimer = null;
        }
        this.stopProcess();
    }

    publishRuntimeSnapshot(): void {
        const child = this.child;
        if (!child?.connected) return;

        try {
            child.send({
                type: 'runtime-config',
                runtimeConfig: this.runtimeRoleCoordinator.getSnapshot()
            });
        } catch (error) {
            logger.warn(`Failed to publish runtime snapshot to heartbeat plane: ${errorMessage(error)}`);
        }
    }

    protected override onProcessSpawned(_child: ChildProcess): void {
        this.publishRuntimeSnapshot();
    }

    private startRuntimeSnapshotPublisher(): void {
        if (this.runtimeSnapshotTimer) return;

        const intervalMs = Math.max(
            SNAPSHOT_INTERVAL_MIN_MS,
            Math.min(this.config.metricsIntervalMs, SNAPSHOT_INTERVAL_MAX_MS)
        );
        this.runtimeSnapshotTimer = setInterval(() => {
            this.publishRuntimeSnapshot();
        }, intervalMs);
        this.runtimeSnapshotTimer.unref();
    }
}

export const getHeartbeatPlaneProcess = singleton((): HeartbeatPlaneProcess => new HeartbeatPlaneProcess(getConfig(), getRuntimeRoleCoordinator()));
