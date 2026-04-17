import type { TeamClusterEffectiveCapabilities } from '@/contracts';

interface RuntimeCapabilitySnapshotProvider {
    getSnapshot(): {
        effectiveCapabilities: TeamClusterEffectiveCapabilities;
    };
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

    ensureAcceptsComputeJobs(command: string): void {
        this.ensureCapability(
            command,
            (capabilities) => capabilities.acceptsComputeJobs,
            'RUNTIME_COMPUTE_DISABLED',
            'Compute capability is disabled or draining'
        );
    }

    ensureAcceptsStorageWrites(command: string): void {
        this.ensureCapability(
            command,
            (capabilities) => capabilities.acceptsStorageWrites,
            'RUNTIME_STORAGE_WRITE_DISABLED',
            'Storage writes are disabled or draining'
        );
    }

    ensureServesStorageReads(command: string): void {
        this.ensureCapability(
            command,
            (capabilities) => capabilities.servesStorageReads,
            'RUNTIME_STORAGE_READ_DISABLED',
            'Storage reads are disabled for the current effective role'
        );
    }

    ensureAcceptsPluginWarmup(command: string): void {
        this.ensureCapability(
            command,
            (capabilities) => capabilities.acceptsComputeJobs,
            'RUNTIME_PLUGIN_WARMUP_DISABLED',
            'Plugin warmup is disabled because compute capability is not accepting work'
        );
    }

    ensureTrajectoryNativeEnabled(command: string): void {
        this.ensureAcceptsComputeJobs(command);
    }

    private ensureCapability(
        command: string,
        predicate: (capabilities: TeamClusterEffectiveCapabilities) => boolean,
        code: string,
        message: string
    ): void {
        const snapshot = this.runtimeSnapshotProvider.getSnapshot();
        if (predicate(snapshot.effectiveCapabilities)) {
            return;
        }

        throw new RuntimeCapabilityError(
            code,
            `Command "${command}" rejected: ${message}`
        );
    }
}
