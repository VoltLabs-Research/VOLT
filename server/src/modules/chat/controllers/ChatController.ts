import type ChatService from '@modules/chat/services/ChatService';
import type { AddUsersToGroupInputDTO } from '@modules/chat/dtos/chat/AddUsersToGroupDTO';
import type { CreateGroupChatInputDTO } from '@modules/chat/dtos/chat/CreateGroupChatDTO';
import type { GetOrCreateChatInputDTO } from '@modules/chat/dtos/chat/GetOrCreateChatDTO';
import type { GetUserChatsInputDTO } from '@modules/chat/dtos/chat/GetUserChatsDTO';
import type { LeaveGroupInputDTO } from '@modules/chat/dtos/chat/LeaveGroupDTO';
import type { RemoveUsersFromGroupInputDTO } from '@modules/chat/dtos/chat/RemoveUsersFromGroupDTO';
import type { UpdateGroupAdminsInputDTO } from '@modules/chat/dtos/chat/UpdateGroupAdminsDTO';
import type { UpdateGroupInfoInputDTO } from '@modules/chat/dtos/chat/UpdateGroupInfoDTO';
import type { DeleteMessageInputDTO } from '@modules/chat/dtos/chat-message/DeleteMessageDTO';
import type { EditMessageInputDTO } from '@modules/chat/dtos/chat-message/EditMessageDTO';
import type { GetChatMessagesInputDTO } from '@modules/chat/dtos/chat-message/GetChatMessagesDTO';
import type { MarkMessageAsReadInputDTO } from '@modules/chat/dtos/chat-message/MarkMessageAsReadDTO';
import type { SendChatMessageInputDTO } from '@modules/chat/dtos/chat-message/SendChatMessageDTO';
import type { SendFileMessageInputDTO } from '@modules/chat/dtos/chat-message/SendFileMessageDTO';
import type { ToggleMessageReactionInputDTO } from '@modules/chat/dtos/chat-message/ToggleMessageReactionDTO';
import { CHAT_TOKENS } from '@modules/chat/di/ChatTokens';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * The single HTTP controller for the chat module. One Express handler per route,
 * assembling the service input exactly as `buildControllerParams` did for the
 * generated controllers, delegating to {@link ChatService}, and responding via
 * {@link BaseResponse} with the original status codes. NoContent handlers send
 * an empty body, matching the generated controllers' behaviour. Handlers are
 * arrow-function properties so `this` stays bound when passed by reference to
 * the router. Thrown `ApplicationError`s propagate to `httpErrorMiddleware` via
 * Express 5 async forwarding.
 */
@injectable()
export default class ChatController {
    constructor(
        @inject(CHAT_TOKENS.ChatService) private readonly chatService: ChatService
    ) {}

    getUserChats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetUserChatsInputDTO;
        const value = await this.chatService.getUserChats(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getOrCreate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetOrCreateChatInputDTO;
        const value = await this.chatService.getOrCreateChat(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    createGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as CreateGroupChatInputDTO;
        const value = await this.chatService.createGroupChat(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    addUsersToGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as AddUsersToGroupInputDTO;
        const value = await this.chatService.addUsersToGroup(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    removeUsersFromGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as RemoveUsersFromGroupInputDTO;
        const value = await this.chatService.removeUsersFromGroup(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    updateGroupInfo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as UpdateGroupInfoInputDTO;
        const value = await this.chatService.updateGroupInfo(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    updateGroupAdmins = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as UpdateGroupAdminsInputDTO;
        const value = await this.chatService.updateGroupAdmins(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    leaveGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as LeaveGroupInputDTO;
        await this.chatService.leaveGroup(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };

    getChatMessages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetChatMessagesInputDTO;
        const value = await this.chatService.getChatMessages(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    sendChatMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as SendChatMessageInputDTO;
        const value = await this.chatService.sendChatMessage(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    editMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as EditMessageInputDTO;
        const value = await this.chatService.editMessage(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as DeleteMessageInputDTO;
        await this.chatService.deleteMessage(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };

    markMessagesAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as MarkMessageAsReadInputDTO;
        await this.chatService.markMessagesAsRead(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };

    toggleMessageReaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ToggleMessageReactionInputDTO;
        const value = await this.chatService.toggleMessageReaction(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    sendFileMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as SendFileMessageInputDTO;
        const value = await this.chatService.sendFileMessage(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };
}
