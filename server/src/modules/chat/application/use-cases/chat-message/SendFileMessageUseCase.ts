import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { SendFileMessageInputDTO, SendFileMessageOutputDTO } from '@modules/chat/application/dtos/chat-message/SendFileMessageDTO';
import { SendChatMessageUseCase } from './SendChatMessageUseCase';
import { ChatMessageMetadata, ChatMessageType } from '@modules/chat/domain/entities/ChatMessage';

@injectable()
export class SendFileMessageUseCase implements IUseCase<SendFileMessageInputDTO, SendFileMessageOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.SendChatMessageUseCase)
        private sendChatMessage: SendChatMessageUseCase
    ){}

    async execute(input: SendFileMessageInputDTO): Promise<Result<SendFileMessageOutputDTO, ApplicationError>> {
        const { fileData, userId, chatId } = input;

        const metadata: ChatMessageMetadata = {
            fileName: fileData.originalName,
            fileSize: fileData.size,
            fileType: fileData.mimetype,
            fileUrl: fileData.url,
            filePath: fileData.filename
        };

        return await this.sendChatMessage.execute({
            userId,
            chatId,
            content: fileData.originalName,
            messageType: ChatMessageType.File,
            metadata
        });
    }
};