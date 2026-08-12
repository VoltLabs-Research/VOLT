import { BaseEntity, Column, Entity, Index, PrimaryColumn } from 'typeorm';

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
