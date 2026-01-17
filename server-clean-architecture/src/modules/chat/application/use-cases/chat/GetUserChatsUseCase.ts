import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/ports/Result";
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { IChatRepository } from "../../../domain/port/IChatRepository";
import { GetUserChatsInputDTO, GetUserChatsOutputDTO } from "../../dtos/chat/GetUserChatsDTO";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";

@injectable()
export class GetUserChatsUseCase implements IUseCase<GetUserChatsInputDTO, GetUserChatsOutputDTO[], ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository,
    ) { }

    async execute(input: GetUserChatsInputDTO): Promise<Result<GetUserChatsOutputDTO[], ApplicationError>> {
        const result = await this.chatRepo.findChatsByUserId(input.userId);
        return Result.ok(result);
    }
};