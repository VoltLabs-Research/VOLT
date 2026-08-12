import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';
import Trajectory from '@modules/trajectory/models/Trajectory';
import Plugin from '@modules/plugin/models/Plugin';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import { AnalysisArtifactStatus, AnalysisStatus } from '@modules/analysis/contracts/analysis';
import type {
    AnalysisChildAnalysis,
    AnalysisConfig,
    AnalysisExpectedArtifact,
    AnalysisStage
} from '@shared/contracts/types/AnalysisProps';

@Entity('analyses')
@Index(['computeClusterId'])
@Index(['storageClusterId'])
@Index(['pipelineStageHash'])
@Index(['pipelineRunId'])
@Index(['team', 'createdAt'])
@Index(['trajectory', 'createdAt'])
@Index(['plugin', 'team', 'trajectory', 'computeClusterId'])
@Index(['trajectory', 'storageClusterId', 'createdAt'])
@Index(['team', 'storageClusterId', 'createdAt'])
export default class Analysis extends BaseModel{
    @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'plugin' })
    pluginRef?: Plugin;

    @ReferenceColumn()
    plugin!: string;

    @Column('varchar')
    pluginDisplayName!: string;

    @ManyToOne(() => TeamCluster, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'computeClusterId' })
    computeClusterIdRef?: TeamCluster;

    @ReferenceColumn({ nullable: true })
    computeClusterId!: string | null;

    @ManyToOne(() => TeamCluster, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'storageClusterId' })
    storageClusterIdRef?: TeamCluster;

    @ReferenceColumn({ nullable: true })
    storageClusterId!: string | null;

    @Column('simple-json')
    config!: AnalysisConfig;

    @Column({
        type: 'varchar',
        nullable: true
    })
    pipelineStageHash!: string | null;

    /**
     * The pipeline execution this analysis was a stage of. Null on analyses
     * created before runs were recorded, so readers must keep a path for
     * ungrouped rows. Intentionally not a relation: deleting a run must never
     * cascade into the results it produced.
     */
    @ReferenceColumn({ nullable: true })
    pipelineRunId!: string | null;

    @Column({
        type: 'integer',
        nullable: true
    })
    pipelineStageIndex!: number | null;

    @Column({
        type: 'integer',
        default: 0
    })
    totalFrames!: number;

    @Column({
        type: 'simple-enum',
        enum: AnalysisStatus,
        default: AnalysisStatus.Pending
    })
    status!: AnalysisStatus;

    @Column({
        type: 'simple-enum',
        enum: AnalysisArtifactStatus,
        default: AnalysisArtifactStatus.Pending
    })
    artifactStatus!: AnalysisArtifactStatus;

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    expectedArtifacts!: AnalysisExpectedArtifact[];

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    stages!: AnalysisStage[];

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    childAnalyses!: AnalysisChildAnalysis[];

    @Column({
        type: Date,
        nullable: true
    })
    startedAt!: Date | null;

    @Column({
        type: Date,
        nullable: true
    })
    finishedAt!: Date | null;

    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @ManyToOne(() => Trajectory, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'trajectory' })
    trajectoryRef?: Trajectory;

    @ReferenceColumn()
    trajectory!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'createdBy' })
    createdByRef?: User;

    @ReferenceColumn()
    createdBy!: string;
}
