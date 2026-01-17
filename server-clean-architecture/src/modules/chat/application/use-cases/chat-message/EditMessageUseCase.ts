import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { inject, injectable } from "tsyringe";
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { IChatMessageRepository } from "../../../domain/port/IChatMessageRepository";
import { EditMessageInputDTO, EditMessageOutputDTO } from "../../dtos/chat-message/EditMessageDTO";
import { ErrorCodes } from "@/src/core/constants/error-codes";

@injectable()
export class EditMessageUseCase implements IUseCase<EditMessageInputDTO, EditMessageOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository
    ) { }

    async execute(input: EditMessageInputDTO): Promise<Result<EditMessageOutputDTO, ApplicationError>> {
        const { messageId, userId, content } = input;
        const message = await this.messageRepo.findById(messageId);
        if (!message) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Chat message not found'
            ));
        }

        if (message.isSender(userId)) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Not owner'
            ));
        }

        const updatedMessage = await this.messageRepo.updateById(messageId, {
            content
        });

        if (!updatedMessage) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Chat message not found'
            ));
        }

        return Result.ok(updatedMessage.props);
    }
};