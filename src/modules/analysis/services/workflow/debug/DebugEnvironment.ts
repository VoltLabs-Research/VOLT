import { singleton } from '@shared/application/utilities/singleton';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { DAEMON_PATHS } from '@core/config/paths';
import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { WorkflowSession } from '@modules/analysis/services/workflow/WorkflowSession';
import { downloadCompressedDump } from '@modules/analysis/services/workflow/dump-download';
import type { WorkflowExecutionContext } from '@shared/contracts/types/workflow.types';
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
        storageClusterId: string
    ): Promise<DebugEnvironmentState> {
        const workflowSession = new WorkflowSession(context);

        const selectedDump = workflowSession.resolveSelectedDump();
        if (!selectedDump) {
            throw new Error('No selected trajectory dump is available for debug execution');
        }

        const dumpPath = await downloadCompressedDump(
            this.objectStore,
            selectedDump.dump.path,
            storageClusterId,
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

export const getDebugEnvironment = singleton((): DebugEnvironment => new DebugEnvironment(getObjectStore()));
