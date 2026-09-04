import { BaseEntity, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AUTO_INCREMENT_COLUMN_TYPE, JSON_COLUMN_TYPE, TIMESTAMP_COLUMN_TYPE } from '@shared/infrastructure/persistence/column-types';

@Entity('cluster_metric_samples')
@Index(['clusterId', 'recordedAt'])
@Index(['recordedAt'])
export default class ClusterMetricSample extends BaseEntity {
    @PrimaryGeneratedColumn('increment', { type: AUTO_INCREMENT_COLUMN_TYPE })
    id!: string;

    @Column('varchar', { length: 128 })
    clusterId!: string;

    @Column({ type: TIMESTAMP_COLUMN_TYPE })
    recordedAt!: Date;

    @Column({ type: JSON_COLUMN_TYPE })
    payload!: Record<string, unknown>;
}
