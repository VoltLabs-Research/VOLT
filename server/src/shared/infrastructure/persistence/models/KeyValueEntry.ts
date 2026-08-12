import { BaseEntity, Column, Entity, Index, PrimaryColumn } from 'typeorm';

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
