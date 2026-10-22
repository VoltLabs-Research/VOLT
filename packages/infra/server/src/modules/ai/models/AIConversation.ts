import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/persistence/BaseModel';
import { Hidden } from '@shared/persistence/Hidden';
import { ReferenceColumn } from '@shared/persistence/ReferenceColumn';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';
import { AIProvider } from '@volt/contracts/modules/ai/domain';

@Entity('ai_chat_conversations')
@Index(['teamId', 'userId', 'isArchived', 'lastMessageAt'])
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
        type: 'boolean',
        default: false
    })
    isArchived!: boolean;

    @Column({
        type: 'simple-enum',
        enum: AIProvider,
        nullable: true
    })
    provider!: AIProvider | null;

    @Column({
        type: 'varchar',
        nullable: true
    })
    model!: string | null;

    @Hidden()
    @Column({
        type: 'text',
        nullable: true
    })
    summary!: string | null;

    // The position of the last message folded into summary; the model sees only what follows it.
    @Hidden()
    @Column({
        type: 'integer',
        default: 0
    })
    summarizedThrough!: number;
}
