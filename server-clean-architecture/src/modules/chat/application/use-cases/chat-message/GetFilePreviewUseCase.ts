import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { inject, injectable } from "tsyringe";
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { SendFileMessageInputDTO, SendFileMessageOutputDTO } from "../../dtos/chat-message/SendFileMessageDTO";
import SendChatMessageUseCase from "./SendChatMessageUseCase";
import { ChatMessageMetadata, ChatMessageType } from "../../../domain/entities/ChatMessage";
import { GetFilePreviewInputDTO, GetFilePreviewOutputDTO } from "../../dtos/chat-message/GetFilePreviewDTO";

@injectable()
export default class GetChatFileUseCase implements IUseCase<GetFilePreviewInputDTO, GetFilePreviewOutputDTO, ApplicationError>{
    // TODO:
};