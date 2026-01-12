import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/Result";
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { IChatRepository } from "../../../domain/port/IChatRepository";
import { UpdateGroupInfoInputDTO, UpdateGroupInfoOutputDTO } from "../../dtos/chat/UpdateGroupInfoDTO";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { ChatProps } from "../../../domain/entities/Chat";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";

@injectable()
export default class UpdateGroupInfoUseCase implements IUseCase<UpdateGroupInfoInputDTO, UpdateGroupInfoOutputDTO, ApplicationError>{
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository
    ){}

    async execute(input: UpdateGroupInfoInputDTO): Promise<Result<UpdateGroupInfoOutputDTO, ApplicationError>>{
        const { userId, chatId, groupName, groupDescription } = input;
        const chat = await this.chatRepo.findById(input.chatId);

        if(!chat){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.CHAT_NOT_FOUND,
                'Chat not found'
            ));
        }

        if(!chat.isAdmin(userId)){
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTH_UNAUTHORIZED,
                'Only admins can update info'
            ));
        }

        const updateData: Partial<ChatProps> = {};
        if(groupName) updateData.groupName = groupName;
        if(groupDescription) updateData.groupDescription = groupDescription;

        const updatedChat = await this.chatRepo.updateById(input.chatId, updateData);
        if(!updatedChat){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'Chat not found after update'
            ));
        }

        return Result.ok(updatedChat.props);
    }
};