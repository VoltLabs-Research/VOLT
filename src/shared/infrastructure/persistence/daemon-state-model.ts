import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

/**
 * An expiring string entry: admission counters, ingest claims and preview leases.
 *
 * Expiry is a column and every read filters on it, so a lapsed entry is invisible
 * the moment its deadline passes. The sweeper only reclaims space.
 */
@Entity('daemon_state_entries')
@Index(['expiresAt'])
export class DaemonStateEntry {
    @PrimaryColumn('varchar', { length: 512 })
    key!: string;

    @Column('text')
    value!: string;

    @Column({
        type: 'timestamptz',
        nullable: true
    })
    expiresAt!: Date | null;
}

/**
 * One element of an ordered list, consumed from the head.
 *
 * `position` is assigned by the writer rather than derived from insertion order,
 * because a list is rewritten whole and its order is the caller's, not the
 * database's.
 */
@Entity('daemon_state_list_items')
@Index(['key', 'position'])
@Index(['expiresAt'])
export class DaemonStateListItem {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id!: string;

    @Column('varchar', { length: 512 })
    key!: string;

    @Column('int')
    position!: number;

    @Column('text')
    value!: string;

    @Column({
        type: 'timestamptz',
        nullable: true
    })
    expiresAt!: Date | null;
}
