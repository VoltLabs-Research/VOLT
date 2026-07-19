import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, Param, Query, CurrentUser } from '@shared/http/params';
import { protect } from '@modules/auth/middlewares/authentication';
import { checkTeamMembership } from '@modules/team/middlewares/check-team-membership';
import { uploadChatSingleFile } from '@shared/infrastructure/http/middleware/upload';
import { uploadToStorage } from '@modules/chat/middlewares/upload-to-storage';
import ChatService from '@modules/chat/services/ChatService';
import { chatRoutes } from '@volt/contracts/modules/chat/routes';
import type {
    CreateGroupChatInput,
    AddUsersToGroupInput,
    RemoveUsersFromGroupInput,
    UpdateGroupInfoInput,
    UpdateGroupAdminsInput,
    SendChatMessageInput,
    EditMessageInput,
    ToggleMessageReactionInput
} from '@volt/contracts/modules/chat/http';

interface ChatFileBody {
    fileData: {
        filename: string;
        originalName: string;
        size: number;
        mimetype: string;
        url: string;
    };
}

@Middleware(protect)
export default class ChatController extends Controller {
    #service = new ChatService();

    

    @Route(chatRoutes.listUserChats)
    listUserChats(@CurrentUser() userId: string) {
        return this.#service.getUserChats(userId);
    }

    @Route(chatRoutes.getOrCreate)
    @Middleware(checkTeamMembership)
    getOrCreate(
        @Param('teamId') teamId: string,
        @Param('targetUserId') targetUserId: string,
        @CurrentUser() userId: string
    ) {
        return this.#service.getOrCreateChat(userId, targetUserId, teamId);
    }

    @Route(chatRoutes.createGroup)
    @Status(201)
    createGroup(@CurrentUser() userId: string, @Body() body: CreateGroupChatInput) {
        return this.#service.createGroupChat(userId, body);
    }

    @Route(chatRoutes.addUsersToGroup)
    addUsersToGroup(@Param('chatId') chatId: string, @CurrentUser() userId: string, @Body() body: AddUsersToGroupInput) {
        return this.#service.addUsersToGroup(userId, chatId, body.userIds);
    }

    @Route(chatRoutes.removeUsersFromGroup)
    removeUsersFromGroup(@Param('chatId') chatId: string, @CurrentUser() userId: string, @Body() body: RemoveUsersFromGroupInput) {
        return this.#service.removeUsersFromGroup(userId, chatId, body.userIds);
    }

    @Route(chatRoutes.updateGroupInfo)
    updateGroupInfo(@Param('chatId') chatId: string, @CurrentUser() userId: string, @Body() body: UpdateGroupInfoInput) {
        return this.#service.updateGroupInfo(userId, chatId, body);
    }

    @Route(chatRoutes.updateGroupAdmins)
    updateGroupAdmins(@Param('chatId') chatId: string, @CurrentUser() userId: string, @Body() body: UpdateGroupAdminsInput) {
        return this.#service.updateGroupAdmins(userId, chatId, body);
    }

    @Route(chatRoutes.leaveGroup)
    async leaveGroup(@Param('chatId') chatId: string, @CurrentUser() userId: string) {
        await this.#service.leaveGroup(userId, chatId);
    }

    

    @Route(chatRoutes.listMessages)
    listMessages(@Param('chatId') chatId: string, @CurrentUser() userId: string, @Query() query: Record<string, string>) {
        return this.#service.getChatMessages(userId, chatId, query);
    }

    @Route(chatRoutes.sendMessage)
    @Status(201)
    sendMessage(@Param('chatId') chatId: string, @CurrentUser() userId: string, @Body() body: SendChatMessageInput) {
        return this.#service.sendChatMessage(userId, chatId, body);
    }

    @Route(chatRoutes.editMessage)
    editMessage(
        @Param('chatId') chatId: string,
        @Param('messageId') messageId: string,
        @CurrentUser() userId: string,
        @Body() body: EditMessageInput
    ) {
        return this.#service.editMessage(userId, chatId, messageId, body.content);
    }

    @Route(chatRoutes.deleteMessage)
    async deleteMessage(@Param('chatId') chatId: string, @Param('messageId') messageId: string, @CurrentUser() userId: string) {
        await this.#service.deleteMessage(userId, chatId, messageId);
    }

    @Route(chatRoutes.markMessagesAsRead)
    async markMessagesAsRead(@Param('chatId') chatId: string, @CurrentUser() userId: string) {
        await this.#service.markMessagesAsRead(userId, chatId);
    }

    @Route(chatRoutes.toggleMessageReaction)
    toggleMessageReaction(
        @Param('chatId') chatId: string,
        @Param('messageId') messageId: string,
        @CurrentUser() userId: string,
        @Body() body: ToggleMessageReactionInput
    ) {
        return this.#service.toggleMessageReaction(userId, chatId, messageId, body.emoji);
    }

    @Route(chatRoutes.sendFileMessage)
    @Status(201)
    @Middleware(uploadChatSingleFile('file'), uploadToStorage)
    sendFileMessage(@Param('chatId') chatId: string, @CurrentUser() userId: string, @Body() body: ChatFileBody) {
        return this.#service.sendFileMessage(userId, chatId, body.fileData);
    }
}
