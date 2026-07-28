import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import Team from '@modules/team/models/Team';
import { TrajectoryCloneJobState } from '@modules/trajectory/contracts/domain/trajectory-clone-job';
import type { TrajectoryCloneJobStats } from '@modules/trajectory/contracts/domain/trajectory-clone-job';

@Entity('trajectory_clone_jobs')
@Index(['team'])
@Index(['sourceTrajectoryId'])
@Index(['destinationTrajectoryId'])
@Index(['destinationClusterId'])
@Index(['requestedBy'])
@Index(['team', 'state', 'updatedAt'])
@Index(['destinationTrajectoryId', 'state'])
export default class TrajectoryCloneJob extends BaseModel{
    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @Column('varchar')
    sourceTrajectoryId!: string;

    @Column('varchar')
    destinationTrajectoryId!: string;

    @Column({
        type: 'varchar',
        nullable: true
    })
    sourceClusterId!: string | null;

    @Column('varchar')
    destinationClusterId!: string;

    @Column({
        type: 'simple-enum',
        enum: TrajectoryCloneJobState,
        default: TrajectoryCloneJobState.Queued
    })
    state!: TrajectoryCloneJobState;

    @Column({
        type: 'simple-json',
        default: '{"totalFrames":0,"copiedFrames":0,"copiedBytes":0}'
    })
    stats!: TrajectoryCloneJobStats;

    @Column('varchar')
    requestedBy!: string;

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
