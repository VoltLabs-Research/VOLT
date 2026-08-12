import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('domain_event_spool')
@Index(['createdAt'])
export default class DomainEventSpoolEntry extends BaseEntity {
    @PrimaryColumn('varchar', { length: 64 })
    id!: string;

    @Column('varchar', { length: 128 })
    name!: string;

    @Column('jsonb')
    payload!: Record<string, unknown>;

    @CreateDateColumn()
    createdAt!: Date;
}
