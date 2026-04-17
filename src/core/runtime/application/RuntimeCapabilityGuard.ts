import type { TeamClusterEffectiveCapabilities } from '@/core/runtime/contracts/teamClusterRuntime';

interface RuntimeCapabilitySnapshot {
    effectiveCapabilities: TeamClusterEffectiveCapabilities;
}

interface RuntimeCapabilitySnapshotProvider {
    getSnapshot(): RuntimeCapabilitySnapshot;
}

export class RuntimeCapabilityError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly statusCode: number = 409
    ) {
        super(message);
        Object.setPrototypeOf(this, RuntimeCapabilityError.prototype);
    }
}

export class RuntimeCapabilityGuard {
    constructor(
        private readonly runtimeSnapshotProvider: RuntimeCapabilitySnapshotProvider
    ) {}

    readonly ensureAcceptsComputeJobs = (command: string): void => {
        const snapshot = this.runtimeSnapshotProvider.getSnapshot();
        if (snapshot.effectiveCapabilities.acceptsComputeJobs) {
            return;
        }

        throw new RuntimeCapabilityError(
            'RUNTIME_COMPUTE_DISABLED',
            `Command "${command}" rejected: Compute capability is disabled or draining`
        );
    };

    readonly ensureAcceptsStorageWrites = (command: string): void => {
        const snapshot = this.runtimeSnapshotProvider.getSnapshot();
        if (snapshot.effectiveCapabilities.acceptsStorageWrites) {
            return;
        }

        throw new RuntimeCapabilityError(
            'RUNTIME_STORAGE_WRITE_DISABLED',
            `Command "${command}" rejected: Storage writes are disabled or draining`
        );
    };

    readonly ensureServesStorageReads = (command: string): void => {
        const snapshot = this.runtimeSnapshotProvider.getSnapshot();
        if (snapshot.effectiveCapabilities.servesStorageReads) {
            return;
        }

        throw new RuntimeCapabilityError(
            'RUNTIME_STORAGE_READ_DISABLED',
            `Command "${command}" rejected: Storage reads are disabled for the current effective role`
        );
    };

    readonly ensureAcceptsPluginWarmup = (command: string): void => {
        const snapshot = this.runtimeSnapshotProvider.getSnapshot();
        if (snapshot.effectiveCapabilities.acceptsComputeJobs) {
            return;
        }

        throw new RuntimeCapabilityError(
            'RUNTIME_PLUGIN_WARMUP_DISABLED',
            `Command "${command}" rejected: Plugin warmup is disabled because compute capability is not accepting work`
        );
    };

    readonly ensureTrajectoryNativeEnabled = (command: string): void => {
        const snapshot = this.runtimeSnapshotProvider.getSnapshot();
        if (snapshot.effectiveCapabilities.acceptsComputeJobs) {
            return;
        }

        throw new RuntimeCapabilityError(
            'RUNTIME_COMPUTE_DISABLED',
            `Command "${command}" rejected: Compute capability is disabled or draining`
        );
    };
}
