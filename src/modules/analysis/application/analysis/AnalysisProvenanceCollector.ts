import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { logAndSwallow } from '@/support/error/errorMessage';
import type { EventDispatcher } from '@/core/events/EventDispatcher';
import { AnalysisProvenanceRecordedEvent } from '@/modules/analysis/domain/provenance-event';
import type { AnalysisProvenance } from '@/modules/analysis/contracts/provenance-types';
import type { AnalysisJobExecutionData, AnalysisJobMetadata } from '@/modules/analysis/contracts/http-analysis';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const CORETOOLKIT_VERSION = '2.0.0';

const computeFileHash = async (filePath: string): Promise<string> => {
    try {
        const buf = await fs.readFile(filePath);
        return crypto.createHash('sha256').update(buf).digest('hex');
    } catch {
        return '';
    }
};

/** Extract RNG seed from plugin job config if one is present (e.g. kmeans=36, MultiSOM=1982). */
const extractRngSeed = (config: Record<string, unknown>): number | undefined => {
    const candidates = ['rng_seed', 'seed', 'random_seed'];
    for (const key of candidates) {
        const value = config[key];
        if (typeof value === 'number') {
            return value;
        }
    }
    return undefined;
};

@Service('analysisProvenanceCollector')
export class AnalysisProvenanceCollector {
    constructor(private readonly eventDispatcher: EventDispatcher) {}

    async recordCompletion(input: {
        executionData: AnalysisJobExecutionData;
        metadata: AnalysisJobMetadata;
        startedAt: number;
        outputArtifactIds: string[];
        inputParquetPath?: string;
    }): Promise<void> {
        const { executionData, metadata, startedAt, outputArtifactIds, inputParquetPath } = input;
        const { identity } = executionData;

        const inputFrameContentHash = inputParquetPath
            ? await computeFileHash(inputParquetPath)
            : '';

        const config: Record<string, unknown> =
            typeof metadata.config === 'object' && metadata.config !== null
                ? metadata.config as Record<string, unknown>
                : {};

        const provenance: AnalysisProvenance = {
            pluginName: metadata.plugin,
            pluginVersion: '1.0.0',
            parameters: config,
            inputFrameContentHash,
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
            { analysisId: identity.analysisId, plugin: provenance.pluginName },
            'Analysis provenance emitted'
        );
    }
}
