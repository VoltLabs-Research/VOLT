import { PersistedChatMessageDTO } from '@modules/chat/application/dtos/chat-message/SendChatMessageDTO';
import { SendFileMessageInputDTO } from '@modules/chat/application/dtos/chat-message/SendFileMessageDTO';
import { ChatMessageMetadata, ChatMessageType } from '@modules/chat/domain/entities/chat-message/ChatMessage';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SendChatMessageUseCase } from './SendChatMessageUseCase';

@Singleton()
export class SendFileMessageUseCase implements IUseCase<SendFileMessageInputDTO, PersistedChatMessageDTO, ApplicationError> {
    constructor(
        
        private sendChatMessage: SendChatMessageUseCase
    ){}

    async execute(input: SendFileMessageInputDTO): Promise<Result<PersistedChatMessageDTO, ApplicationError>> {
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
