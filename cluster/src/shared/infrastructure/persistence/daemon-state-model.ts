import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { AUTO_INCREMENT_COLUMN_TYPE, TIMESTAMP_COLUMN_TYPE } from '@shared/infrastructure/persistence/column-types';

@Entity('daemon_state_entries')
@Index(['expiresAt'])
export class DaemonStateEntry {
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

@Entity('daemon_state_list_items')
@Index(['key', 'position'])
@Index(['expiresAt'])
export class DaemonStateListItem {
    @PrimaryGeneratedColumn('increment', { type: AUTO_INCREMENT_COLUMN_TYPE })
    id!: string;

    @Column('varchar', { length: 512 })
    key!: string;

    @Column('int')
    position!: number;

    @Column('text')
    value!: string;

    @Column({
        type: TIMESTAMP_COLUMN_TYPE,
        nullable: true
    })
    expiresAt!: Date | null;
}
