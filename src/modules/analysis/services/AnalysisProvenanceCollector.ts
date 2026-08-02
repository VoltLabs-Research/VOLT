import { singleton } from '@shared/application/utilities/singleton';
import { getEventDispatcher } from '@shared/infrastructure/events/EventDispatcher';
import { logger } from '@shared/infrastructure/logger';
import { logAndSwallow } from '@shared/application/utilities/error-message';
import type { EventDispatcher } from '@shared/infrastructure/events/EventDispatcher';
import { AnalysisProvenanceRecordedEvent } from '@modules/analysis/events/analysis-events';
import type { AnalysisProvenance } from '@shared/contracts/types/provenance-types';
import type { AnalysisJobExecutionData, AnalysisJobMetadata, AnalysisValueMap } from '@shared/contracts/types/http-analysis';

const CORETOOLKIT_VERSION = '2.0.0';

const extractRngSeed = (config: AnalysisValueMap): number | undefined => {
    const candidates = ['rng_seed', 'seed', 'random_seed'];
    for (const key of candidates) {
        const value = config[key];
        if (typeof value === 'number') {
            return value;
        }
    }
    return undefined;
};

export class AnalysisProvenanceCollector {
    constructor(private readonly eventDispatcher: EventDispatcher) {}

    async recordCompletion(input: {
        executionData: AnalysisJobExecutionData;
        metadata: AnalysisJobMetadata;
        startedAt: number;
        outputArtifactIds: string[];
    }): Promise<void> {
        const { executionData, metadata, startedAt, outputArtifactIds } = input;
        const { identity } = executionData;
        const config = metadata.config;

        const provenance: AnalysisProvenance = {
            pluginName: metadata.plugin,
            pluginVersion: '1.0.0',
            parameters: config,
            inputFrameContentHash: '',
            atomCount: 0,
            frameIndex: metadata.timestep ?? 0,
            trajectoryId: identity.trajectoryId,
            analysisId: identity.analysisId,
            teamId: identity.teamId,
            coreToolkitVersion: CORETOOLKIT_VERSION,
            rngSeed: extractRngSeed(config),
            executedAt: new Date(startedAt).toISOString(),
            executedBy: identity.teamId,
            executionTimeMs: Date.now() - startedAt,
            outputArtifactIds
        };

        this.eventDispatcher.publish(new AnalysisProvenanceRecordedEvent(provenance)).catch(
            logAndSwallow('warn', { analysisId: identity.analysisId }, 'Failed to emit provenance event')
        );

        logger.info(
            {
                analysisId: identity.analysisId,
                plugin: provenance.pluginName
            },
            'Analysis provenance emitted'
        );
    }
}

export const getAnalysisProvenanceCollector = singleton((): AnalysisProvenanceCollector => new AnalysisProvenanceCollector(getEventDispatcher()));
