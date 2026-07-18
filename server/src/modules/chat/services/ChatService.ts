import { ErrorCodes } from '@core/constants/error-codes';
import type { AddUsersToGroupInputDTO, AddUsersToGroupOutputDTO } from '@modules/chat/dtos/chat/AddUsersToGroupDTO';
import type { CreateGroupChatInputDTO, CreateGroupChatOutputDTO } from '@modules/chat/dtos/chat/CreateGroupChatDTO';
import type { GetOrCreateChatInputDTO, GetOrCreateChatOutputDTO } from '@modules/chat/dtos/chat/GetOrCreateChatDTO';
import type { GetUserChatsInputDTO } from '@modules/chat/dtos/chat/GetUserChatsDTO';
import type { LeaveGroupInputDTO } from '@modules/chat/dtos/chat/LeaveGroupDTO';
import type { RemoveUsersFromGroupInputDTO, RemoveUsersFromGroupOutputDTO } from '@modules/chat/dtos/chat/RemoveUsersFromGroupDTO';
import { GroupAdminAction } from '@modules/chat/dtos/chat/UpdateGroupAdminsDTO';
import type { UpdateGroupAdminsInputDTO, UpdateGroupAdminsOutputDTO } from '@modules/chat/dtos/chat/UpdateGroupAdminsDTO';
import type { UpdateGroupInfoInputDTO, UpdateGroupInfoOutputDTO } from '@modules/chat/dtos/chat/UpdateGroupInfoDTO';
import type { DeleteMessageInputDTO } from '@modules/chat/dtos/chat-message/DeleteMessageDTO';
import type { EditMessageInputDTO } from '@modules/chat/dtos/chat-message/EditMessageDTO';
import type { GetChatMessagesInputDTO } from '@modules/chat/dtos/chat-message/GetChatMessagesDTO';
import type { MarkMessageAsReadInputDTO } from '@modules/chat/dtos/chat-message/MarkMessageAsReadDTO';
import type { PersistedChatMessageDTO, SendChatMessageInputDTO, SendChatMessageOutputDTO } from '@modules/chat/dtos/chat-message/SendChatMessageDTO';
import type { SendFileMessageInputDTO } from '@modules/chat/dtos/chat-message/SendFileMessageDTO';
import type { ToggleMessageReactionInputDTO } from '@modules/chat/dtos/chat-message/ToggleMessageReactionDTO';
import { CreateGroupChatUseCase } from '@modules/chat/use-cases/chat/CreateGroupChatUseCase';
import { GetUserChatsUseCase } from '@modules/chat/use-cases/chat/GetUserChatsUseCase';
import { GetChatMessagesUseCase } from '@modules/chat/use-cases/chat-message/GetChatMessagesUseCase';
import { SendChatMessageUseCase } from '@modules/chat/use-cases/chat-message/SendChatMessageUseCase';
import type { ChatParticipant, ChatProps } from '@modules/chat/entities/chat/Chat';
import { ChatMessageType } from '@modules/chat/entities/chat-message/ChatMessage';
import type { ChatMessageMetadata } from '@modules/chat/entities/chat-message/ChatMessage';
import type { IChatRepository, PersistedChatDTO } from '@modules/chat/ports/chat/IChatRepository';
import type { IChatMessageRepository } from '@modules/chat/ports/chat-message/IChatMessageRepository';
import { CHAT_TOKENS } from '@modules/chat/di/ChatTokens';
import { ensureTeamMembersExist } from '@modules/chat/utilities/chat/ensureTeamMembersExist';
import { isParticipant } from '@modules/chat/utilities/chat/isParticipant';
import { resolveAccessibleChat } from '@modules/chat/utilities/chat/resolveAccessibleChat';
import { resolveGroupChat } from '@modules/chat/utilities/chat/resolveGroupChat';
import type { ISocketEmitter } from '@modules/socket/ports/ISocketEmitter';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { SOCKET_CONTRACT_TOKENS } from '@shared/contracts/tokens/SocketTokens';
import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

const toParticipantId = (participant: ChatParticipant): string => {
    if (typeof participant === 'string') {
        return participant;
    }

    if (participant._id) {
        return participant._id.toString();
    }

    return participant.toString();
};

/**
 * The single application service for the chat module. Each method folds the
 * exact logic of a previously separate use case, converting the Result error
 * channel to thrown `ApplicationError`s so Express 5 forwards them to the
 * global error middleware. `getUserChats`, `getChatMessages`, `sendChatMessage`
 * and `createGroupChat` delegate to their retained use cases (still consumed by
 * the {@link ChatCollaborationAITool}), mirroring the auth module's
 * `updateAccount` delegator. Realtime pieces (socket module, event handlers)
 * are untouched and still use the repositories / retained use cases directly.
 */
@Singleton(CHAT_TOKENS.ChatService)
export default class ChatService {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository) private readonly chatRepo: IChatRepository,
        @inject(CHAT_TOKENS.ChatMessageRepository) private readonly messageRepo: IChatMessageRepository,
        @inject(SOCKET_CONTRACT_TOKENS.SocketEmitter) private readonly socketEmitter: ISocketEmitter,
        @inject(TEAM_CONTRACT_TOKENS.TeamMemberRepository) private readonly teamMemberRepo: ITeamMemberRepository,
        @inject(GetUserChatsUseCase) private readonly getUserChatsUseCase: GetUserChatsUseCase,
        @inject(GetChatMessagesUseCase) private readonly getChatMessagesUseCase: GetChatMessagesUseCase,
        @inject(SendChatMessageUseCase) private readonly sendChatMessageUseCase: SendChatMessageUseCase,
        @inject(CreateGroupChatUseCase) private readonly createGroupChatUseCase: CreateGroupChatUseCase
    ) {}

    /**
     * Thin delegator to the retained {@link GetUserChatsUseCase} (still used by
     * the chat-collaboration AI tool). Unwraps the Result to the thrown-error
     * channel used by every other ChatService method.
     */
    async getUserChats(input: GetUserChatsInputDTO): Promise<PersistedChatDTO[]> {
        return this.getUserChatsUseCase.execute(input);
    }

    async getOrCreateChat(input: GetOrCreateChatInputDTO): Promise<GetOrCreateChatOutputDTO> {
        const { userId, targetUserId, teamId } = input;

        if (userId === targetUserId) {
            throw ApplicationError.badRequest(
                ErrorCodes.CHAT_INVALID_ACTION,
                'Cannot create chat with yourself'
            );
        }

        const result = await this.chatRepo.findOrCreateChat(userId, targetUserId, teamId);
        return toPersistedEntity(result);
    }

    /**
     * Thin delegator to the retained {@link CreateGroupChatUseCase} (still used
     * by the chat-collaboration AI tool). Unwraps the Result to the thrown-error
     * channel used by every other ChatService method.
     */
    async createGroupChat(input: CreateGroupChatInputDTO): Promise<CreateGroupChatOutputDTO> {
        return this.createGroupChatUseCase.execute(input);
    }

    async addUsersToGroup(input: AddUsersToGroupInputDTO): Promise<AddUsersToGroupOutputDTO> {
        const { userId, chatId, userIds } = input;

        const chat = await resolveGroupChat(this.chatRepo, chatId, userId, true);

        const teamId = chat.props.team;
        await ensureTeamMembersExist(this.teamMemberRepo, teamId, userIds);

        const newParticipants = new Set([...chat.props.participants, ...userIds]);

        const updatedChat = await this.chatRepo.updateById(chat._id, { participants: Array.from(newParticipants) });
        if (!updatedChat) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'Chat not found after update'
            );
        }

        this.socketEmitter.emitToRoom(`chat-${chatId}`, 'users_added_to_group', {
            chatId,
            userIds,
            addedBy: userId
        });

        return toPersistedEntity(updatedChat);
    }

    async removeUsersFromGroup(input: RemoveUsersFromGroupInputDTO): Promise<RemoveUsersFromGroupOutputDTO> {
        const { userId, chatId, userIds } = input;

        const chat = await resolveGroupChat(this.chatRepo, chatId, userId, true);

        const newParticipants = chat.props.participants.filter((participant) => !userIds.includes(toParticipantId(participant)));
        if (newParticipants.length < 2) {
            throw ApplicationError.badRequest(
                ErrorCodes.CHAT_GROUP_MIN_PARTICIPANTS,
                'The group must have at least 2 members'
            );
        }

        const newAdmins = chat.props.admins.filter((admin) => !userIds.includes(admin));
        const updatedChat = await this.chatRepo.updateById(chatId, {
            participants: newParticipants,
            admins: newAdmins
        });

        if (!updatedChat) {
            throw ApplicationError.notFound(
                ErrorCodes.CHAT_NOT_FOUND,
                'Chat not found'
            );
        }

        this.socketEmitter.emitToRoom(`chat-${chatId}`, 'users_removed_from_group', {
            chatId,
            userIds,
            removedBy: userId
        });

        return toPersistedEntity(updatedChat);
    }

    async updateGroupInfo(input: UpdateGroupInfoInputDTO): Promise<UpdateGroupInfoOutputDTO> {
        const { userId, chatId, groupName, groupDescription } = input;

        await resolveGroupChat(this.chatRepo, chatId, userId, true);

        const updateData: Partial<ChatProps> = {};
        if (groupName) updateData.groupName = groupName;
        if (groupDescription) updateData.groupDescription = groupDescription;

        const updatedChat = await this.chatRepo.updateById(chatId, updateData);
        if (!updatedChat) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'Chat not found after update'
            );
        }

        this.socketEmitter.emitToRoom(`chat-${chatId}`, 'group_info_updated', {
            chatId,
            groupName,
            groupDescription,
            updatedBy: userId
        });

        return toPersistedEntity(updatedChat);
    }

    async updateGroupAdmins(input: UpdateGroupAdminsInputDTO): Promise<UpdateGroupAdminsOutputDTO> {
        const { action, chatId, userId, targetUserIds } = input;

        const chat = await resolveGroupChat(this.chatRepo, chatId, userId, true);

        const validUsers = targetUserIds.filter((id) => isParticipant(chat, id));
        if (validUsers.length !== targetUserIds.length) {
            throw ApplicationError.badRequest(
                ErrorCodes.CHAT_USERS_NOT_IN_TEAM,
                'Users not in team'
            );
        }

        let updatedAdmins = [...chat.props.admins];
        if (action === GroupAdminAction.Add) {
            updatedAdmins = [...new Set([...updatedAdmins, ...validUsers])];
        } else if (action === GroupAdminAction.Remove) {
            updatedAdmins = updatedAdmins.filter((admin) => !validUsers.includes(admin));
            if (updatedAdmins.length === 0) {
                throw ApplicationError.badRequest(
                    ErrorCodes.CHAT_GROUP_MIN_ADMINS,
                    'At least 1 admin is required'
                );
            }
        } else {
            throw ApplicationError.badRequest(
                ErrorCodes.CHAT_INVALID_ACTION,
                'Invalid group admin action'
            );
        }

        const updatedChat = await this.chatRepo.updateById(chatId, {
            admins: updatedAdmins
        });

        if (!updatedChat) {
            throw ApplicationError.notFound(
                ErrorCodes.CHAT_NOT_FOUND,
                'Chat not found'
            );
        }

        return toPersistedEntity(updatedChat);
    }

    async leaveGroup(input: LeaveGroupInputDTO): Promise<void> {
        const { chatId, userId } = input;

        const chat = await resolveGroupChat(this.chatRepo, chatId, userId);

        const newParticipants = chat.props.participants.filter((participant) => participant !== userId);
        let newAdmins = chat.props.admins.filter((admin) => admin !== userId);

        if (newAdmins.length === 0 && chat.props.createdBy) {
            newAdmins = [chat.props.createdBy];
        }

        const isActive = newParticipants.length >= 2;

        const updatedChat = await this.chatRepo.updateById(chatId, {
            participants: newParticipants,
            admins: newAdmins,
            isActive
        });

        if (!updatedChat) {
            throw ApplicationError.notFound(
                ErrorCodes.CHAT_NOT_FOUND,
                'Chat not found'
            );
        }

        this.socketEmitter.emitToRoom(`chat-${chatId}`, 'user_left_group', {
            chatId,
            userId
        });
    }

    /**
     * Thin delegator to the retained {@link GetChatMessagesUseCase} (still used
     * by the chat-collaboration AI tool). Unwraps the Result to the thrown-error
     * channel used by every other ChatService method.
     */
    async getChatMessages(input: GetChatMessagesInputDTO): Promise<PaginatedResult<PersistedChatMessageDTO>> {
        return this.getChatMessagesUseCase.execute(input);
    }

    /**
     * Thin delegator to the retained {@link SendChatMessageUseCase} (still used
     * by the chat-collaboration AI tool and {@link sendFileMessage}). Unwraps
     * the Result to the thrown-error channel used by every other ChatService
     * method.
     */
    async sendChatMessage(input: SendChatMessageInputDTO): Promise<SendChatMessageOutputDTO> {
        return this.sendChatMessageUseCase.execute(input);
    }

    async editMessage(input: EditMessageInputDTO): Promise<PersistedChatMessageDTO> {
        const { messageId, userId, content } = input;
        const message = await this.messageRepo.findById(messageId);
        if (!message) {
            throw ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Chat message not found'
            );
        }

        if (!message.isSender(userId)) {
            throw ApplicationError.forbidden(
                ErrorCodes.MESSAGE_FORBIDDEN,
                'Not owner'
            );
        }

        const updatedMessage = await this.messageRepo.updateById(messageId, {
            content
        }, { populate: 'sender' });

        if (!updatedMessage) {
            throw ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Chat message not found'
            );
        }

        const persistedMessage = toPersistedEntity(updatedMessage);

        this.socketEmitter.emitToRoom(`chat-${input.chatId}`, 'message_edited', {
            chatId: input.chatId,
            message: persistedMessage
        });

        return persistedMessage;
    }

    async deleteMessage(input: DeleteMessageInputDTO): Promise<void> {
        const { messageId, userId } = input;
        const message = await this.messageRepo.findById(messageId);
        if (!message) {
            throw ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Chat message not found'
            );
        }

        if (!message.isSender(userId)) {
            throw ApplicationError.forbidden(
                ErrorCodes.MESSAGE_FORBIDDEN,
                'Not owner'
            );
        }

        await this.messageRepo.updateById(messageId, {
            deleted: true
        });

        this.socketEmitter.emitToRoom(`chat-${input.chatId}`, 'message_deleted', {
            chatId: input.chatId,
            messageId
        });
    }

    async markMessagesAsRead(input: MarkMessageAsReadInputDTO): Promise<void> {
        const { chatId, userId } = input;

        await resolveAccessibleChat(this.chatRepo, chatId, userId);

        await this.messageRepo.markAllAsRead(chatId, userId);

        this.socketEmitter.emitToRoom(`chat-${chatId}`, 'messages_read', {
            chatId,
            readBy: userId,
            readAt: new Date()
        });
    }

    async toggleMessageReaction(input: ToggleMessageReactionInputDTO): Promise<PersistedChatMessageDTO> {
        const { emoji, messageId, userId } = input;
        const message = await this.messageRepo.findById(messageId);
        if (!message) {
            throw ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Message not found'
            );
        }

        await resolveAccessibleChat(this.chatRepo, String(message.props.chat), userId);

        message.toggleReaction(userId, emoji);
        const updatedMessage = await this.messageRepo.updateById(messageId, {
            reactions: message.props.reactions
        }, { populate: 'sender' });

        if (!updatedMessage) {
            throw ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Chat message not found'
            );
        }

        const persistedMessage = toPersistedEntity(updatedMessage);

        this.socketEmitter.emitToRoom(`chat-${input.chatId}`, 'reaction_updated', {
            chatId: input.chatId,
            message: persistedMessage
        });

        return persistedMessage;
    }

    async sendFileMessage(input: SendFileMessageInputDTO): Promise<PersistedChatMessageDTO> {
        const { fileData, userId, chatId } = input;

        const metadata: ChatMessageMetadata = {
            fileName: fileData.originalName,
            fileSize: fileData.size,
            fileType: fileData.mimetype,
            fileUrl: fileData.url,
            filePath: fileData.filename
        };

        return this.sendChatMessageUseCase.execute({
            userId,
            chatId,
            content: fileData.originalName,
            messageType: ChatMessageType.File,
            metadata
        });
    }
}
