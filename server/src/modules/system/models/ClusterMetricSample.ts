import { BaseEntity, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

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
