import { BaseEntity, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { TIMESTAMP_COLUMN_TYPE } from '@shared/infrastructure/persistence/column-types';

@Entity('key_value_set_members')
@Index(['expiresAt'])
export default class KeyValueSetMember extends BaseEntity {
    @PrimaryColumn('varchar', { length: 512 })
    key!: string;

    @PrimaryColumn('varchar', { length: 512 })
    member!: string;

    @Column({
        type: TIMESTAMP_COLUMN_TYPE,
        nullable: true
    })
    expiresAt!: Date | null;
}
