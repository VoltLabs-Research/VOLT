import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

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
