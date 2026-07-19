import logger from '@shared/infrastructure/logger';
import AnalysisProvenanceModel from '@modules/analysis/models/AnalysisProvenanceModel';
import type { AnalysisProvenance } from '@modules/analysis/models/AnalysisMetadata';
import crypto from 'node:crypto';

export interface RecordProvenanceInput {
    pluginName: string;
    pluginVersion: string;
    parameters: Record<string, unknown>;
    inputFrameContentHash: string;
    atomCount: number;
    frameIndex: number;
    trajectoryId: string;
    coreToolkitVersion: string;
    rngSeed?: number;
    executedAt: Date;
    executedBy: string;
    executionTimeMs: number;
    outputArtifactIds: string[];
}

export interface ProvenanceReproduction {
    command: string;
    provenanceId: string;
}

export class ProvenanceNotFoundError extends Error {
    constructor() {
        super('Provenance record not found');
        this.name = 'ProvenanceNotFoundError';
    }
}

export class ProvenanceService {
    static computeHash(data: Buffer | string): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    async recordAnalysisExecution(input: RecordProvenanceInput): Promise<AnalysisProvenance> {
        const reproductionCommand = `voltcli analyze --plugin ${input.pluginName}@${input.pluginVersion} --provenance-replay`;

        const doc = await AnalysisProvenanceModel.create({
            pluginName: input.pluginName,
            pluginVersion: input.pluginVersion,
            parameters: input.parameters,
            inputFrameContentHash: input.inputFrameContentHash,
            inputFrameMetadata: {
                atomCount: input.atomCount,
                frameIndex: input.frameIndex,
                trajectoryId: input.trajectoryId
            },
            coreToolkitVersion: input.coreToolkitVersion,
            rngSeed: input.rngSeed,
            executedAt: input.executedAt,
            executedBy: input.executedBy,
            executionTimeMs: input.executionTimeMs,
            outputArtifactIds: input.outputArtifactIds,
            reproductionCommand
        });

        logger.info(
            { provenanceId: doc._id, plugin: input.pluginName, version: input.pluginVersion },
            'Analysis provenance recorded'
        );

        return doc.toObject() as unknown as AnalysisProvenance;
    }

    async getProvenance(id: string): Promise<AnalysisProvenance | null> {
        const doc = await AnalysisProvenanceModel.findById(id).lean();
        return doc as unknown as AnalysisProvenance | null;
    }

    async getRequired(id: string): Promise<AnalysisProvenance> {
        const record = await this.getProvenance(id);
        if (!record) throw new ProvenanceNotFoundError();
        return record;
    }

    async getReproduction(id: string): Promise<ProvenanceReproduction> {
        const record = await this.getRequired(id);
        return { command: record.reproductionCommand, provenanceId: id };
    }

    async queryProvenance(filters: {
        pluginName?: string;
        pluginVersion?: string;
        trajectoryId?: string;
        executedBy?: string;
        fromDate?: Date;
        toDate?: Date;
        limit?: number;
        skip?: number;
    }): Promise<AnalysisProvenance[]> {
        const query: Record<string, unknown> = {};
        if (filters.pluginName) query.pluginName = filters.pluginName;
        if (filters.pluginVersion) query.pluginVersion = filters.pluginVersion;
        if (filters.trajectoryId) query['inputFrameMetadata.trajectoryId'] = filters.trajectoryId;
        if (filters.executedBy) query.executedBy = filters.executedBy;
        if (filters.fromDate || filters.toDate) {
            const dateRange: Record<string, Date> = {};
            if (filters.fromDate) dateRange.$gte = filters.fromDate;
            if (filters.toDate) dateRange.$lte = filters.toDate;
            query.executedAt = dateRange;
        }

        const docs = await AnalysisProvenanceModel
            .find(query)
            .sort({ executedAt: -1 })
            .skip(filters.skip ?? 0)
            .limit(filters.limit ?? 50)
            .lean();

        return docs as unknown as AnalysisProvenance[];
    }
}
