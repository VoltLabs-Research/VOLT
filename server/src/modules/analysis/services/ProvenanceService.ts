import logger from '@shared/infrastructure/logger';
import AnalysisProvenanceEntity from '@modules/analysis/models/AnalysisProvenance';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';

const QUERY_DEFAULT_LIMIT = 50;

interface RecordProvenanceInput{
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

interface ProvenanceReproduction{
    command: string;
    provenanceId: string;
}

interface QueryProvenanceFilters{
    pluginName?: string;
    pluginVersion?: string;
    trajectoryId?: string;
    executedBy?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    skip?: number;
}

export class ProvenanceNotFoundError extends Error{
    constructor(){
        super('Provenance record not found');
        this.name = 'ProvenanceNotFoundError';
    }
}

export class ProvenanceService{

    async recordAnalysisExecution(input: RecordProvenanceInput): Promise<AnalysisProvenanceEntity>{
        const reproductionCommand = `voltcli analyze --plugin ${input.pluginName}@${input.pluginVersion} --provenance-replay`;

        const provenance = await AnalysisProvenanceEntity.create({
            pluginName: input.pluginName,
            pluginVersion: input.pluginVersion,
            parameters: input.parameters,
            inputFrameContentHash: input.inputFrameContentHash,
            inputFrameMetadata: {
                atomCount: input.atomCount,
                frameIndex: input.frameIndex,
                trajectoryId: input.trajectoryId
            },
            trajectoryId: input.trajectoryId,
            coreToolkitVersion: input.coreToolkitVersion,
            rngSeed: input.rngSeed ?? null,
            executedAt: input.executedAt,
            executedBy: input.executedBy,
            executionTimeMs: input.executionTimeMs,
            outputArtifactIds: input.outputArtifactIds,
            reproductionCommand
        }).save();

        logger.info(
            {
                provenanceId: provenance.id,
                plugin: input.pluginName,
                version: input.pluginVersion
            },
            'Analysis provenance recorded'
        );

        return provenance;
    }

    async getProvenance(id: string): Promise<AnalysisProvenanceEntity | null>{
        return AnalysisProvenanceEntity.findOneBy({ id });
    }

    async getRequired(id: string): Promise<AnalysisProvenanceEntity>{
        const record = await this.getProvenance(id);
        if(!record) throw new ProvenanceNotFoundError();
        return record;
    }

    async getReproduction(id: string): Promise<ProvenanceReproduction>{
        const record = await this.getRequired(id);
        return {
            command: record.reproductionCommand,
            provenanceId: id
        };
    }

    async queryProvenance(filters: QueryProvenanceFilters): Promise<AnalysisProvenanceEntity[]>{
        const where: FindOptionsWhere<AnalysisProvenanceEntity> = {};
        if(filters.pluginName) where.pluginName = filters.pluginName;
        if(filters.pluginVersion) where.pluginVersion = filters.pluginVersion;
        if(filters.trajectoryId) where.trajectoryId = filters.trajectoryId;
        if(filters.executedBy) where.executedBy = filters.executedBy;
        if(filters.fromDate && filters.toDate){
            where.executedAt = Between(filters.fromDate, filters.toDate);
        }else if(filters.fromDate){
            where.executedAt = MoreThanOrEqual(filters.fromDate);
        }else if(filters.toDate){
            where.executedAt = LessThanOrEqual(filters.toDate);
        }

        return AnalysisProvenanceEntity.find({
            where,
            order: { executedAt: 'DESC' },
            skip: filters.skip ?? 0,
            take: filters.limit ?? QUERY_DEFAULT_LIMIT
        });
    }
}
