import { IChatRepository } from "../../../domain/port/IChatRepository";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { GetOrCreateChatInputDTO, GetOrCreateChatOutputDTO } from "../../dtos/chat/GetOrCreateChatDTO";
import { injectable, inject } from 'tsyringe';
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";

@injectable()
export default class GetOrCreateChatUseCase implements IUseCase<GetOrCreateChatInputDTO, GetOrCreateChatOutputDTO, ApplicationError>{
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository
    ){}

    async execute(input: GetOrCreateChatInputDTO): Promise<Result<GetOrCreateChatOutputDTO, ApplicationError>>{
        const { userId, targetUserId, teamId } = input;
        const result = await this.chatRepo.findOrCreateChat(userId, targetUserId, teamId);
        return Result.ok(result.props);
    }
};