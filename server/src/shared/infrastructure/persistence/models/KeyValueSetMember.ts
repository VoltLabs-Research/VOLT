import { BaseEntity, Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * One member of an unordered set, keyed by (set, member).
 *
 * A row per member rather than a serialized array in `key_value_entries`: the
 * sets here are indexes that concurrent writers add to and remove from
 * independently — projected job ids, terminal receipts, canvas workspace owners —
 * and a read-modify-write of one array would lose additions under concurrency.
 */
@Entity('key_value_set_members')
@Index(['expiresAt'])
export default class KeyValueSetMember extends BaseEntity {
    @PrimaryColumn('varchar', { length: 512 })
    key!: string;

    @PrimaryColumn('varchar', { length: 512 })
    member!: string;

    @Column({
        type: 'timestamptz',
        nullable: true
    })
    expiresAt!: Date | null;
}
