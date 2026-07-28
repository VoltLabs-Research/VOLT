import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import Trajectory from '@modules/trajectory/models/Trajectory';
import Analysis from '@modules/analysis/models/Analysis';
import Plugin from '@modules/plugin/models/Plugin';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import { SceneArtifactSourceType, SceneArtifactStatus } from '@shared/contracts/types/SceneArtifact';
import type { SceneArtifactParams } from '@shared/contracts/types/SceneArtifact';
import type { SceneArtifactMetadata } from '@modules/trajectory/contracts/domain/scene-artifact';

@Entity('trajectory_scene_artifacts')
@Index(['trajectory'])
@Index(['storageClusterId'])
@Index(['analysis'])
@Index(['plugin'])
@Index(['sourceType'])
@Index(['timestep'])
@Index(['trajectory', 'sourceType', 'createdAt'])
@Index(['trajectory', 'timestep', 'sourceType'])
@Index(['analysis', 'sourceType', 'createdAt'])
@Index(['storageClusterId', 'sourceType', 'createdAt'])
export default class SceneArtifact extends BaseModel{
    @ManyToOne(() => Trajectory, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'trajectory' })
    trajectoryRef?: Trajectory;

    @ReferenceColumn()
    trajectory!: string;

    @ManyToOne(() => TeamCluster, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'storageClusterId' })
    storageClusterIdRef?: TeamCluster;

    @ReferenceColumn()
    storageClusterId!: string;

    @ManyToOne(() => Analysis, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'analysis' })
    analysisRef?: Analysis;

    @ReferenceColumn({ nullable: true })
    analysis!: string | null;

    @ManyToOne(() => Plugin, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'plugin' })
    pluginRef?: Plugin;

    @ReferenceColumn({ nullable: true })
    plugin!: string | null;

    @Column({
        type: 'simple-enum',
        enum: SceneArtifactSourceType
    })
    sourceType!: SceneArtifactSourceType;

    @Column('integer')
    timestep!: number;

    @Column({
        type: 'varchar',
        unique: true
    })
    objectName!: string;

    @Column('varchar')
    storageBucket!: string;

    @Column({
        type: 'simple-json',
        default: '{}'
    })
    params!: SceneArtifactParams;

    @Column('varchar')
    displayName!: string;

    @Column({
        type: 'simple-enum',
        enum: SceneArtifactStatus,
        default: SceneArtifactStatus.Ready
    })
    status!: SceneArtifactStatus;

    @Column({
        type: 'simple-json',
        default: '{}'
    })
    metadata!: SceneArtifactMetadata;
}
