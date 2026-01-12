import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { inject, injectable } from "tsyringe";
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { IChatRepository } from "../../../domain/port/IChatRepository";
import { SendChatMessageInputDTO, SendChatMessageOutputDTO } from "../../dtos/chat-message/SendChatMessageDTO";
import { IChatMessageRepository } from "../../../domain/port/IChatMessageRepository";

@injectable()
export default class SendChatMessageUseCase implements IUseCase<SendChatMessageInputDTO, SendChatMessageOutputDTO, ApplicationError>{
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository,
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository
    ){}

    async execute(input: SendChatMessageInputDTO): Promise<Result<SendChatMessageOutputDTO, ApplicationError>>{
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
        return Result.ok(message.props);
    }
};