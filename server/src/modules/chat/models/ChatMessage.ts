import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import Chat from '@modules/chat/models/Chat';
import User from '@modules/auth/models/User';
import { ChatMessageType } from '@volt/contracts/modules/chat/domain';
import type { ChatMessageMetadata } from '@volt/contracts/modules/chat/domain';
import type { ChatReactionProps } from '@modules/chat/contracts/chat-message';

@Entity('chat_messages')
@Index(['chat', 'createdAt'])
@Index(['sender'])
@Index(['readBy'])
export default class ChatMessage extends BaseModel{
    @ManyToOne(() => Chat, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'chat' })
    chatRef?: Chat;

    @ReferenceColumn()
    chat!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sender' })
    senderRef?: User;

    @ReferenceColumn()
    sender!: string;

    @Column('varchar')
    content!: string;

    @Column({
        type: 'simple-enum',
        enum: ChatMessageType,
        default: ChatMessageType.Text
    })
    messageType!: ChatMessageType;

    @Column({
        type: 'simple-array',
        nullable: true
    })
    readBy!: string[] | null;

    @Column({
        type: 'simple-json',
        nullable: true
    })
    metadata!: ChatMessageMetadata | null;

    @Column({
        type: 'boolean',
        default: false
    })
    deleted!: boolean;

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    reactions!: ChatReactionProps[];
}
