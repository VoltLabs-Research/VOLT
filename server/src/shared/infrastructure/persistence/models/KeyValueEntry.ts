import { BaseEntity, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { TIMESTAMP_COLUMN_TYPE } from '@shared/infrastructure/persistence/column-types';

@Entity('key_value_entries')
@Index(['expiresAt'])
export default class KeyValueEntry extends BaseEntity {
    @PrimaryColumn('varchar', { length: 512 })
    key!: string;

    @Column('text')
    value!: string;

    @Column({
        type: TIMESTAMP_COLUMN_TYPE,
        nullable: true
    })
    expiresAt!: Date | null;
}
