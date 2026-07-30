import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import Team from '@modules/team/models/Team';
import { ClusterTransferJobReason, ClusterTransferJobState } from '@modules/cluster/contracts/cluster-transfer-job';
import { StoragePlacementScopeType } from '@modules/cluster/contracts/storage-placement';
import type { StoragePlacementBucketRef } from '@shared/domain/contracts/team-cluster';
import type {
    ClusterTransferJobCursor,
    ClusterTransferJobStats
} from '@volt/contracts/modules/cluster/domain';

@Entity('cluster_transfer_jobs')
@Index(['team'])
@Index(['scopeId'])
@Index(['sourceClusterId'])
@Index(['destinationClusterId'])
@Index(['requestedBy'])
@Index(['team', 'state', 'updatedAt'])
@Index(['team', 'scopeType', 'scopeId', 'state'])
@Index(['destinationClusterId', 'state', 'updatedAt'])
@Index(['scopeType', 'scopeId', 'state'], {
    unique: true,
    where: '"state" IN (\'queued\', \'freezing\', \'copying\', \'verifying\', \'switching\', \'cleaning\')'
})
export default class ClusterTransferJob extends BaseModel{
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
    sourceClusterId!: string;

    @ReferenceColumn()
    destinationClusterId!: string;

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    buckets!: StoragePlacementBucketRef[];

    @Column({
        type: 'simple-enum',
        enum: ClusterTransferJobState,
        default: ClusterTransferJobState.Queued
    })
    state!: ClusterTransferJobState;

    @Column({
        type: 'simple-enum',
        enum: ClusterTransferJobReason,
        default: ClusterTransferJobReason.Manual
    })
    reason!: ClusterTransferJobReason;

    @Column({
        type: 'boolean',
        default: true
    })
    cleanupSource!: boolean;

    @ReferenceColumn()
    requestedBy!: string;

    @Column({
        type: 'simple-json',
        default: '{"bucketIndex":0,"lastObjectKey":null}'
    })
    cursor!: ClusterTransferJobCursor;

    @Column({
        type: 'simple-json',
        default: '{"copiedObjects":0,"copiedBytes":0,"verifiedObjects":0,"verifiedBytes":0,"deletedObjects":0}'
    })
    stats!: ClusterTransferJobStats;

    @Column({
        type: 'varchar',
        nullable: true
    })
    errorCode!: string | null;

    @Column({
        type: 'varchar',
        nullable: true
    })
    errorMessage!: string | null;

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

    @Column({
        type: 'varchar',
        nullable: true
    })
    claimedBy!: string | null;

    @Column({
        type: Date,
        nullable: true
    })
    claimExpiresAt!: Date | null;
}
