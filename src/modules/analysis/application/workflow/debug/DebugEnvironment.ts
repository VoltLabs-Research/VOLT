import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '@/core/storage/contracts/http-object-store';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { WorkflowSession } from '@/modules/analysis/application/workflow/WorkflowSession';
import { downloadCompressedDump } from '@/modules/analysis/application/workflow/dump-download';
import type { WorkflowExecutionContext } from '@/modules/analysis/contracts/workflow.types';
import { mkdir } from 'node:fs/promises';
import { dir as createTempDir } from 'tmp-promise';

interface DebugDump {
    path: string;
    originalPath?: string;
    timestep: number;
    natoms: number;
    simulationCell: string;
}

export interface DebugEnvironmentState {
    selectedDump: DebugDump;
    selectedDumpIndex: number;
    dumpPath: string;
    outputDir: string;
}

export class DebugEnvironment {
    constructor(
        private readonly objectStore: ClusterObjectStore
    ) {}

    async prepare(
        sessionId: string,
        context: WorkflowExecutionContext,
        storageClusterId?: string
    ): Promise<DebugEnvironmentState> {
        const workflowSession = new WorkflowSession(context);
        const resolvedStorageClusterId = storageClusterId || VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID;
        if (!storageClusterId) {
            logger.warn(
                { sessionId, fallbackOwnerClusterId: resolvedStorageClusterId },
                'Missing trajectory storage cluster id for debug session, falling back to Volt server owner'
            );
        }

        const selectedDump = workflowSession.resolveSelectedDump();
        if (!selectedDump) {
            throw new Error('No selected trajectory dump is available for debug execution');
        }

        const dumpPath = await downloadCompressedDump(
            this.objectStore,
            selectedDump.dump.path,
            resolvedStorageClusterId,
            DAEMON_PATHS.analysisDumps
        );
        await mkdir(DAEMON_PATHS.analysisOutput, { recursive: true });
        const outputDir = (await createTempDir({
            tmpdir: DAEMON_PATHS.analysisOutput,
            prefix: `debug-${sessionId}-`,
            unsafeCleanup: true
        })).path;

        workflowSession.applyLocalizedDumpSelection(selectedDump, dumpPath, outputDir);

        return {
            selectedDump: selectedDump.dump,
            selectedDumpIndex: selectedDump.index,
            dumpPath,
            outputDir
        };
    }
}
