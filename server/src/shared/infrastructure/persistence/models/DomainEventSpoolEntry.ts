import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { JSON_COLUMN_TYPE } from '@shared/infrastructure/persistence/column-types';

@Entity('domain_event_spool')
@Index(['createdAt'])
export default class DomainEventSpoolEntry extends BaseEntity {
    @PrimaryColumn('varchar', { length: 64 })
    id!: string;

    @Column('varchar', { length: 128 })
    name!: string;

    @Column({ type: JSON_COLUMN_TYPE })
    payload!: Record<string, unknown>;

    @CreateDateColumn()
    createdAt!: Date;
}
