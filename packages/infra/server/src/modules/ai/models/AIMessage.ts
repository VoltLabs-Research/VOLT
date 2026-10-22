import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/persistence/BaseModel';
import { ReferenceColumn } from '@shared/persistence/ReferenceColumn';
import AIConversation from '@modules/ai/models/AIConversation';
import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import type { ChatMessagePart } from '@volt/contracts/modules/ai/chat';

@Entity('ai_chat_messages')
@Index(['conversationId', 'position'], { unique: true })
export default class AIMessage extends BaseModel{
    @ManyToOne(() => AIConversation, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'conversationId' })
    conversationIdRef?: AIConversation;

    @ReferenceColumn()
    conversationId!: string;

    // Order within the conversation. createdAt cannot order it: SQLite keeps whole seconds.
    @Column('integer')
    position!: number;

    @Column({
        type: 'simple-enum',
        enum: AIMessageRole
    })
    role!: AIMessageRole;

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    parts!: ChatMessagePart[];
}
