import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { JsonObject } from '@shared/contracts/types/json';

const QUEUE_JOB_STATES = ['waiting', 'delayed', 'active', 'completed', 'failed'] as const;

export type QueueJobState = typeof QUEUE_JOB_STATES[number];

@Entity('queue_jobs')
@Index(['queue', 'state', 'runAt'])
@Index(['state', 'lockedUntil'])
@Index(['jobKey'])
@Index(['queue', 'jobKey'], {
    unique: true,
    where: `state IN ('waiting', 'delayed', 'active')`
})
export class QueueJob {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column('varchar', { length: 64 })
    queue!: string;

    @Column('varchar', { length: 256 })
    jobKey!: string;

    @Column('jsonb')
    payload!: JsonObject;

    @Column('varchar', {
        length: 16,
        default: 'waiting'
    })
    state!: QueueJobState;

    @Column('int', { default: 0 })
    attemptsMade!: number;

    @Column('int', { default: 1 })
    maxAttempts!: number;

    @Column('varchar', {
        length: 32,
        nullable: true
    })
    backoffType!: string | null;

    @Column('int', { nullable: true })
    backoffDelayMs!: number | null;

    @Column('int', { default: 0 })
    stalledCount!: number;

    @Column('timestamptz')
    runAt!: Date;

    @Column('timestamptz', { nullable: true })
    lockedUntil!: Date | null;

    @Column('varchar', {
        length: 64,
        nullable: true
    })
    lockedBy!: string | null;

    @Column('text', { nullable: true })
    failedReason!: string | null;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
