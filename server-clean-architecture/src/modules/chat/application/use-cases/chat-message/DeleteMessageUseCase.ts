import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { inject, injectable } from "tsyringe";
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { IChatMessageRepository } from "../../../domain/port/IChatMessageRepository";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { DeleteMessageInputDTO } from "../../dtos/chat-message/DeleteMessageDTO";

@injectable()
export default class DeleteMessageUseCase implements IUseCase<DeleteMessageInputDTO, null, ApplicationError>{
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository
    ){}

    async execute(input: DeleteMessageInputDTO): Promise<Result<null, ApplicationError>>{
        const { messageId, userId } = input;
        const message = await this.messageRepo.findById(messageId);
        if(!message){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Chat message not found'
            ));
        }

        if(!message.isSender(userId)){
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.MESSAGE_FORBIDDEN,
                'Not owner'
            ));
        }

        await this.messageRepo.updateById(messageId, {
            deleted: true
        });

        return Result.ok(null);
    }
};