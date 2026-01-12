import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { IChatRepository } from "../../../domain/port/IChatRepository";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { AddUsersToGroupInputDTO, AddUsersToGroupOutputDTO } from "../../dtos/chat/AddUsersToGroupDTO";

@injectable()
export default class AddUsersToGroupUseCase implements IUseCase<AddUsersToGroupInputDTO, AddUsersToGroupOutputDTO, ApplicationError>{
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository
    ){}

    async execute(input: AddUsersToGroupInputDTO): Promise<Result<AddUsersToGroupOutputDTO, ApplicationError>>{
        const { requesterId, chatId, userIdsToAdd } = input;
        const chat = await this.chatRepo.findById(chatId);

        if(!chat){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.CHAT_NOT_FOUND,
                'Chat not found'
            ));
        }

        if(!chat.isAdmin(requesterId)){
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTH_UNAUTHORIZED,
                'Unauthorized'
            ));
        }

        // TODO: this.teamRepo.validateMembers(teamId, userIdsToaADd)
        const newParticipants = new Set([ ...chat.props.participants, ...userIdsToAdd ]);

        const updatedChat = await this.chatRepo.updateById(chat.id, { participants: Array.from(newParticipants) });
        if(!updatedChat){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'Chat not found after update'
            ));
        }

        return Result.ok(updatedChat.props);
    }
};