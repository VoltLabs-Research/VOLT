import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import User from '@modules/auth/models/User';

@Entity('notifications')
@Index(['recipient', 'createdAt'])
@Index(['recipient', 'read'])
export default class Notification extends BaseModel{
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'recipient' })
    recipientRef?: User;

    @ReferenceColumn()
    recipient!: string;

    @Column('varchar')
    title!: string;

    @Column('varchar')
    content!: string;

    @Column({
        type: 'boolean',
        default: false
    })
    read!: boolean;

    @Column({
        type: 'varchar',
        nullable: true
    })
    link!: string | null;
}
