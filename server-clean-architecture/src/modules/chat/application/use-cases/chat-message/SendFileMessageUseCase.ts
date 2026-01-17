import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { inject, injectable } from "tsyringe";
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { SendFileMessageInputDTO, SendFileMessageOutputDTO } from "../../dtos/chat-message/SendFileMessageDTO";
import { SendChatMessageUseCase } from "./SendChatMessageUseCase";
import { ChatMessageMetadata, ChatMessageType } from "../../../domain/entities/ChatMessage";

@injectable()
export class SendFileMessageUseCase implements IUseCase<SendFileMessageInputDTO, SendFileMessageOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.SendChatMessageUseCase)
        private sendChatMessage: SendChatMessageUseCase
    ) { }

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