import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { inject, injectable } from "tsyringe";
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { IChatMessageRepository } from "../../../domain/port/IChatMessageRepository";
import { GetChatMessagesInputDTO, GetChatMessagesOutputDTO } from "../../dtos/chat-message/GetChatMessagesDTO";

@injectable()
export default class GetChatMessagesUseCase implements IUseCase<GetChatMessagesInputDTO, GetChatMessagesOutputDTO, ApplicationError>{
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository
    ){}

    async execute(input: GetChatMessagesInputDTO): Promise<Result<GetChatMessagesOutputDTO, ApplicationError>>{
        // TODO: verify chat access
        const { chatId } = input;
        const messages = await this.messageRepo.findAll({ filter: { chat: chatId }, limit: 100, page: 1 });
        return Result.ok(messages);
    }
};