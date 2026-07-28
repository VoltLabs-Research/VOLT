import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';

@Entity('chats')
@Index(['participants', 'team'])
@Index(['isGroup'])
@Index(['team', 'isActive'])
export default class Chat extends BaseModel{
    @Column({
        type: 'simple-array',
        nullable: true
    })
    participants!: string[] | null;

    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @ReferenceColumn({ nullable: true })
    lastMessage!: string | null;

    @Column({
        type: Date,
        nullable: true
    })
    lastMessageAt!: Date | null;

    @Column({
        type: 'boolean',
        default: true
    })
    isActive!: boolean;

    @Column({
        type: 'boolean',
        default: false
    })
    isGroup!: boolean;

    @Column({
        type: 'varchar',
        nullable: true
    })
    groupName!: string | null;

    @Column({
        type: 'varchar',
        default: ''
    })
    groupDescription!: string;

    @Column({
        type: 'simple-array',
        nullable: true
    })
    admins!: string[] | null;

    @ManyToOne(() => User, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'createdBy' })
    createdByRef?: User;

    @ReferenceColumn({ nullable: true })
    createdBy!: string | null;
}
