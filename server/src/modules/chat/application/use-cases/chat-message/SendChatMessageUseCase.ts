import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { IChatRepository } from '@modules/chat/domain/port/IChatRepository';
import { SendChatMessageInputDTO, SendChatMessageOutputDTO } from '@modules/chat/application/dtos/chat-message/SendChatMessageDTO';
import { IChatMessageRepository } from '@modules/chat/domain/port/IChatMessageRepository';

@injectable()
export class SendChatMessageUseCase implements IUseCase<SendChatMessageInputDTO, SendChatMessageOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository,
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository
    ){}

    async execute(input: SendChatMessageInputDTO): Promise<Result<SendChatMessageOutputDTO, ApplicationError>> {
        const { userId, chatId, content, messageType, metadata } = input;
        const message = await this.messageRepo.create({
            chat: chatId,
            sender: userId,
            content,
            messageType,
            metadata,
            readBy: [input.userId],
            reactions: [],
            deleted: false,
            createdAt: new Date()
        });

        await this.chatRepo.updateLastMessage(chatId, message.id);

        // Ensure we return the populated message so frontend can attribute it correctly immediately
        // We need to cast to any/doc to call populate because it might be the Domain Entity depending on repo implementation
        // But checking the repo, create returns the Domain Entity. The Domain Entity does not have .populate().
        // We should probably rely on the Mapper or re-fetch.
        // Actually, MongooseBaseRepository.create calls mapper.toDomain.
        // The best way here without breaking abstraction too much is to maybe just return the input userId as the sender object 
        // OR simpler: just re-fetch properly or use a repo method that creates and populates.

        // Let's see if we can just patch the props we return, 
        // OR (better) add a populate option to create, 
        // OR (easiest/safest now) findById with populate.

        const populatedMessage = await this.messageRepo.findById(message.id, { populate: 'sender' });

        if (!populatedMessage) return Result.ok(message.props); // Fallback

        return Result.ok(populatedMessage.props);
    }
};