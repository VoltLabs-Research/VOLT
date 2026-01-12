import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { inject, injectable } from "tsyringe";
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { IChatMessageRepository } from "../../../domain/port/IChatMessageRepository";
import { MarkMessagesAsReadInputDTO } from "../../dtos/chat-message/MarkMessageAsReadDTO";

@injectable()
export default class MarkMessagesAsReadUseCase implements IUseCase<MarkMessagesAsReadInputDTO, null, ApplicationError>{
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository
    ){}

    async execute(input: MarkMessagesAsReadInputDTO): Promise<Result<null, ApplicationError>>{
        const { chatId, userId } = input;
        await this.messageRepo.markMessageAsRead(chatId, userId);
        return Result.ok(null);
    }
};