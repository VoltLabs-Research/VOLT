import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Holding area for domain events whose payload will not fit in a NOTIFY.
 *
 * A row lives only between the publish and the subscriber that reads it, so this
 * is a hand-off buffer and not an event log. Rows are deleted on read; the
 * sweeper covers the case where nothing was listening.
 */
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
