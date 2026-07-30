import { Column, Entity, Index } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import type {
    AnalysisProvenanceInputFrameMetadata,
    AnalysisProvenanceParameters
} from '@modules/analysis/contracts/analysis-provenance';

@Entity('analysis_provenances')
@Index(['pluginName'])
@Index(['executedAt'])
@Index(['trajectoryId'])
@Index(['pluginName', 'pluginVersion', 'inputFrameContentHash'])
@Index(['trajectoryId', 'executedAt'])
export default class AnalysisProvenance extends BaseModel{
    @Column('varchar')
    pluginName!: string;

    @Column('varchar')
    pluginVersion!: string;

    @Column('simple-json')
    parameters!: AnalysisProvenanceParameters;

    @Column('varchar')
    inputFrameContentHash!: string;

    @Column('simple-json')
    inputFrameMetadata!: AnalysisProvenanceInputFrameMetadata;

    @Column('varchar')
    trajectoryId!: string;

    @Column('varchar')
    coreToolkitVersion!: string;

    @Column({
        type: 'integer',
        nullable: true
    })
    rngSeed!: number | null;

    @Column({ type: Date })
    executedAt!: Date;

    @ReferenceColumn()
    executedBy!: string;

    @Column('integer')
    executionTimeMs!: number;

    @Column({
        type: 'simple-array',
        nullable: true
    })
    outputArtifactIds!: string[] | null;

    @Column('varchar')
    reproductionCommand!: string;
}
