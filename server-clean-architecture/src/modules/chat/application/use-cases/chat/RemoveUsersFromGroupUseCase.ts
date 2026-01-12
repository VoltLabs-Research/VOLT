import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { inject, injectable } from "tsyringe";
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { IChatRepository } from "../../../domain/port/IChatRepository";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { RemoveUsersFromGroupInputDTO, RemoveUsersFromGroupOutputDTO } from "../../dtos/chat/RemoveUsersFromGroupDTO";

@injectable()
export default class RemoveUsersFromGroupUseCase implements IUseCase<RemoveUsersFromGroupInputDTO, RemoveUsersFromGroupOutputDTO, ApplicationError>{
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository
    ){}

    async execute(input: RemoveUsersFromGroupInputDTO): Promise<Result<RemoveUsersFromGroupOutputDTO, ApplicationError>>{
        const { requesterId, chatId, userIdsToRemove } = input;
        const chat = await this.chatRepo.findById(chatId);

        if(!chat || !chat.props.isGroup){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.CHAT_NOT_FOUND,
                'Chat not found'
            ));
        }

        const newParticipants = chat.props.participants.filter((participant) => !userIdsToRemove.includes(participant));
        if(newParticipants.length < 2){
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.CHAT_GROUP_MIN_PARTICIPANTS,
                'The group must have at least 2 members'
            ));
        }

        const newAdmins = chat.props.admins.filter((admin) => !input.userIdsToRemove.includes(admin));
        const updatedChat = await this.chatRepo.updateById(chatId, {
            participants: newParticipants,
            admins: newAdmins
        });

        if(!updatedChat){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.CHAT_NOT_FOUND,
                'Chat not found'
            ));
        }

        return Result.ok(updatedChat.props);
    }
};