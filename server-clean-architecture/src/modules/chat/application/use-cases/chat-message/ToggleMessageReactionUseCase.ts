import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { inject, injectable } from "tsyringe";
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { IChatMessageRepository } from "../../../domain/port/IChatMessageRepository";
import { ToggleMessageReactionInputDTO, ToggleMessageReactionOutputDTO } from "../../dtos/chat-message/ToggleMessageReactionDTO";
import { ErrorCodes } from "@/src/core/constants/error-codes";

@injectable()
export default class ToggleMessageReactionUseCase implements IUseCase<ToggleMessageReactionInputDTO, ToggleMessageReactionOutputDTO, ApplicationError>{
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository
    ){}

    async execute(input: ToggleMessageReactionInputDTO): Promise<Result<ToggleMessageReactionOutputDTO, ApplicationError>>{
        const { emoji, messageId, userId } = input;
        const message = await this.messageRepo.findById(messageId);
        if(!message){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Message not found'
            ));
        }

        message.toggleReaction(userId, emoji);
        const updatedMessage = await this.messageRepo.updateById(messageId, {
            reactions: message.props.reactions
        });

        if(!updatedMessage){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Chat message not found'
            ));
        }

        return Result.ok(updatedMessage.props);
    }
};