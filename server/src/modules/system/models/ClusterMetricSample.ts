import { BaseEntity, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One heartbeat sample from a cluster.
 *
 * The body stays opaque `jsonb` because callers read whole samples and the shape
 * tracks whatever the daemon reports; only the two columns that queries filter
 * and order by are promoted out of it.
 */
@Entity('cluster_metric_samples')
@Index(['clusterId', 'recordedAt'])
@Index(['recordedAt'])
export default class ClusterMetricSample extends BaseEntity {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id!: string;

    @Column('varchar', { length: 128 })
    clusterId!: string;

    @Column('timestamptz')
    recordedAt!: Date;

    @Column('jsonb')
    payload!: Record<string, unknown>;
}
