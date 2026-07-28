import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';

@Entity('ai_conversations')
@Index(['userId'])
@Index(['teamId'])
@Index(['isArchived'])
@Index(['teamId', 'userId', 'lastMessageAt'])
@Index(['teamId', 'userId', 'updatedAt'])
export default class AIConversation extends BaseModel{
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    userIdRef?: User;

    @ReferenceColumn()
    userId!: string;

    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'teamId' })
    teamIdRef?: Team;

    @ReferenceColumn()
    teamId!: string;

    @Column('varchar')
    title!: string;

    @Column({
        type: Date,
        nullable: true
    })
    lastMessageAt!: Date | null;

    @Column({
        type: 'varchar',
        nullable: true
    })
    lastProvider!: string | null;

    @Column({
        type: 'varchar',
        nullable: true
    })
    lastModel!: string | null;

    @Column({
        type: 'boolean',
        default: false
    })
    isArchived!: boolean;
}
