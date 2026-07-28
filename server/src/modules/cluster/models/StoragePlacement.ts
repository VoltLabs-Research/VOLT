import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import Team from '@modules/team/models/Team';
import { StoragePlacementScopeType, StoragePlacementState } from '@modules/cluster/contracts/domain/storage-placement';
import type { StoragePlacementBucketRef } from '@shared/domain/contracts/team-cluster';

@Entity('storage_placements')
@Index(['team'])
@Index(['scopeId'])
@Index(['primaryClusterId'])
@Index(['scopeType', 'scopeId'], { unique: true })
@Index(['team', 'primaryClusterId', 'state'])
export default class StoragePlacement extends BaseModel{
    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @Column({
        type: 'simple-enum',
        enum: StoragePlacementScopeType
    })
    scopeType!: StoragePlacementScopeType;

    @ReferenceColumn()
    scopeId!: string;

    @ReferenceColumn()
    primaryClusterId!: string;

    @Column({
        type: 'simple-array',
        nullable: true
    })
    replicaClusterIds!: string[] | null;

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    buckets!: StoragePlacementBucketRef[];

    @Column({
        type: 'simple-enum',
        enum: StoragePlacementState,
        default: StoragePlacementState.Active
    })
    state!: StoragePlacementState;

    @Column({
        type: Date,
        nullable: true
    })
    lastVerifiedAt!: Date | null;

    @Column({
        type: 'integer',
        nullable: true
    })
    bytesUsed!: number | null;

    @Column({
        type: Date,
        nullable: true
    })
    lastAccessedAt!: Date | null;
}
