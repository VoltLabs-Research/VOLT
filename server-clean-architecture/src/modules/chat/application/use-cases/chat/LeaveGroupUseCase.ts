import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/ports/Result";
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { IChatRepository } from "../../../domain/port/IChatRepository";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { LeaveGroupInputDTO } from "../../dtos/chat/LeaveGroupDTO";
import { ErrorCodes } from "@/src/core/constants/error-codes";

@injectable()
export default class LeaveGroupUseCase implements IUseCase<LeaveGroupInputDTO, null, ApplicationError>{
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository
    ){}

    async execute(input: LeaveGroupInputDTO): Promise<Result<null, ApplicationError>>{
        const { chatId, participantId } = input;
        const chat = await this.chatRepo.findById(chatId);
        if(!chat || !chat.props.isGroup){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.CHAT_NOT_FOUND,
                'Chat not found'
            ));
        }

        const newParticipants = chat.props.participants.filter((participant) => participant !== participantId);
        const newAdmins = chat.props.admins.filter((admin) => admin !== participantId);
        const isActive = newParticipants.length < 2 ? false : true;

        const updatedChat = await this.chatRepo.updateById(chatId, {
            participants: newParticipants,
            admins: newAdmins,
            isActive
        });

        if(!updatedChat){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.CHAT_NOT_FOUND,
                'Chat not found'
            ));
        }

        return Result.ok(null);
    }
};