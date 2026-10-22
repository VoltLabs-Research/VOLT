import { MoreThan } from 'typeorm';
import AIConversation from '@modules/ai/models/AIConversation';
import AIMessage from '@modules/ai/models/AIMessage';
import { isAwaitingApproval } from '@modules/ai/services/chat/message-parts';
import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import type { ChatMessagePart } from '@volt/contracts/modules/ai/chat';
import ApplicationError from '@shared/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';
import type { PageRequest } from '@shared/persistence/paginate';
import { skipFor } from '@shared/persistence/paginate';

export interface ChatMessageDraft {
    id?: string;
    role: AIMessageRole;
    parts: ChatMessagePart[];
}

class ChatMessageService {
    async create(conversationId: string, draft: ChatMessageDraft): Promise<AIMessage> {
        if (draft.id !== undefined && await AIMessage.existsBy({ id: draft.id })) {
            throw ApplicationError.conflict(ErrorCodes.AI_TURN_MALFORMED, 'A message with that id already exists');
        }

        const last = await AIMessage.findOne({
            where: { conversationId },
            order: { position: 'DESC' },
            select: { position: true }
        });

        const message = await AIMessage.create({
            id: draft.id,
            conversationId,
            position: (last?.position ?? 0) + 1,
            role: draft.role,
            parts: draft.parts
        }).save();

        await AIConversation.update({ id: conversationId }, { lastMessageAt: new Date() });

        return message;
    }

    replaceParts(message: AIMessage, parts: ChatMessagePart[]): Promise<AIMessage> {
        message.parts = parts;
        return message.save();
    }

    find(conversationId: string, id: string): Promise<AIMessage | null> {
        return AIMessage.findOneBy({
            id,
            conversationId
        });
    }

    after(conversationId: string, position: number): Promise<AIMessage[]> {
        return AIMessage.find({
            where: {
                conversationId,
                position: MoreThan(position)
            },
            order: { position: 'ASC' }
        });
    }

    newest(conversationId: string, page: PageRequest): Promise<[AIMessage[], number]> {
        return AIMessage.findAndCount({
            where: { conversationId },
            order: { position: 'DESC' },
            take: page.limit,
            skip: skipFor(page)
        });
    }

    async holding(conversationId: string, approvalId: string): Promise<AIMessage> {
        const candidates = await AIMessage.find({
            where: {
                conversationId,
                role: AIMessageRole.Assistant
            },
            order: { position: 'DESC' },
            take: 20
        });

        const holding = candidates.find((message) => message.parts.some((part) => (
            isAwaitingApproval(part) && part.approval.id === approvalId
        )));
        if (holding === undefined) {
            throw ApplicationError.notFound(ErrorCodes.AI_APPROVAL_NOT_FOUND, 'No pending approval has that id');
        }

        return holding;
    }
}

export default new ChatMessageService();
