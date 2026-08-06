import { BaseEntity, Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * A single expiring string entry: the counters, receipts, locks and cached
 * projections that used to live in Redis's key space.
 *
 * Expiry is a column rather than a background contract, so every read filters on
 * it and a row that is past its deadline is invisible the moment it lapses. The
 * sweeper only reclaims space; it is never what makes expiry correct.
 */
@Entity('key_value_entries')
@Index(['expiresAt'])
export default class KeyValueEntry extends BaseEntity {
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
