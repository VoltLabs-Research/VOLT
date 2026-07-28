import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import { TrajectoryStatus } from '@shared/contracts/types/Trajectory';
import type { TrajectoryStats } from '@shared/contracts/types/Trajectory';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import User from '@modules/auth/models/User';

@Entity('trajectories')
@Index(['storageClusterId'])
@Index(['team', 'folder', 'createdAt'])
@Index(['team', 'storageClusterId', 'createdAt'])
@Index(['team', 'isPublic', 'updatedAt'])
export default class Trajectory extends BaseModel{
    @Column('varchar')
    name!: string;

    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @ManyToOne(() => CatalogFolder, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'folder' })
    folderRef?: CatalogFolder;

    @ReferenceColumn({ nullable: true })
    folder!: string | null;

    @ManyToOne(() => TeamCluster, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'storageClusterId' })
    storageClusterIdRef?: TeamCluster;

    @ReferenceColumn()
    storageClusterId!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'createdBy' })
    createdByRef?: User;

    @ReferenceColumn()
    createdBy!: string;

    @Column({
        type: 'simple-enum',
        enum: TrajectoryStatus,
        default: TrajectoryStatus.Queued
    })
    status!: TrajectoryStatus;

    @Column({
        type: 'boolean',
        default: true
    })
    isPublic!: boolean;

    @Column({
        type: 'integer',
        default: 0
    })
    rasterSceneViews!: number;

    @Column({
        type: 'boolean',
        default: false
    })
    hasPreview!: boolean;

    @Column({
        type: 'simple-json',
        default: '{"totalFiles":0,"totalSize":0}'
    })
    stats!: TrajectoryStats;
}
