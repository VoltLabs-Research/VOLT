import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { JsonObject } from '@shared/contracts/types/json';

export const QUEUE_JOB_STATES = ['waiting', 'delayed', 'active', 'completed', 'failed'] as const;

export type QueueJobState = typeof QUEUE_JOB_STATES[number];

/** The states in which the queue still owns a job, so its key cannot be reused. */
export const NON_TERMINAL_QUEUE_JOB_STATES: readonly QueueJobState[] = ['waiting', 'delayed', 'active'];

/**
 * One unit of queued work.
 *
 * `jobKey` is the identity the rest of the system knows a job by — an analysis id,
 * a frame id — while `id` is this row's own. They are separate because a key may
 * legitimately be enqueued again after its previous run reached a terminal state,
 * and the partial unique index below is what allows exactly that and no more.
 */
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

    @Column('varchar', { length: 16, default: 'waiting' })
    state!: QueueJobState;

    @Column('int', { default: 0 })
    attemptsMade!: number;

    @Column('int', { default: 1 })
    maxAttempts!: number;

    /** Mirrors the caller's backoff request so a retry can be re-scheduled without it. */
    @Column('varchar', { length: 32, nullable: true })
    backoffType!: string | null;

    @Column('int', { nullable: true })
    backoffDelayMs!: number | null;

    /**
     * How many times this job was reclaimed from a worker that stopped renewing
     * its lease. One reclaim is a hiccup; a second means the job itself is what
     * kills the worker, so it is failed rather than handed out again.
     */
    @Column('int', { default: 0 })
    stalledCount!: number;

    @Column('jsonb', { nullable: true })
    progress!: JsonObject | number | null;

    /** When the job becomes eligible; a delay is a `runAt` in the future. */
    @Column('timestamptz')
    runAt!: Date;

    /** Lease deadline while active. Past it, the job is reclaimable. */
    @Column('timestamptz', { nullable: true })
    lockedUntil!: Date | null;

    @Column('varchar', { length: 64, nullable: true })
    lockedBy!: string | null;

    @Column('text', { nullable: true })
    failedReason!: string | null;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
