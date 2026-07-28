import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import AIConversation from '@modules/ai/models/AIConversation';
import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import type {
    AIMessageModelInfo,
    AIMessageParts,
    AIMessageTokenUsage
} from '@modules/ai/contracts/domain/ai-message';

@Entity('ai_messages')
@Index(['conversationId'])
@Index(['conversationId', 'createdAt'])
export default class AIMessage extends BaseModel{
    @ManyToOne(() => AIConversation, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'conversationId' })
    conversationIdRef?: AIConversation;

    @ReferenceColumn()
    conversationId!: string;

    @Column({
        type: 'simple-enum',
        enum: AIMessageRole
    })
    role!: AIMessageRole;

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    parts!: AIMessageParts;

    @Column({
        type: 'varchar',
        default: ''
    })
    content!: string;

    @Column({
        type: 'simple-json',
        nullable: true
    })
    modelInfo!: AIMessageModelInfo | null;

    @Column({
        type: 'simple-json',
        nullable: true
    })
    tokenUsage!: AIMessageTokenUsage | null;
}
