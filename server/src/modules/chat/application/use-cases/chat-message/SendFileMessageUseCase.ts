import { SendFileMessageInputDTO, SendFileMessageOutputDTO } from '@modules/chat/application/dtos/chat-message/SendFileMessageDTO';
import { ChatMessageMetadata, ChatMessageType } from '@modules/chat/domain/entities/chat-message/ChatMessage';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SendChatMessageUseCase } from './SendChatMessageUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';

@injectable()
export class SendFileMessageUseCase implements IUseCase<SendFileMessageInputDTO, SendFileMessageOutputDTO, ApplicationError> {
    constructor(
        @inject(SendChatMessageUseCase)
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
