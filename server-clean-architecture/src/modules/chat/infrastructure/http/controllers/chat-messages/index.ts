import DeleteMessageController from './DeleteMessageController';
import EditMessageController from './EditMessageController';
import GetChatMessagesController from './GetChatMessagesController';
import GetFilePreviewController from './GetFilePreviewController';
import MarkMessagesAsReadController from './MarkMessagesAsReadController';
import SendChatMessageController from './SendChatMessageController';
import SendFileMessageController from './SendFileMessageController';
import ToggleMessageReactionController from './ToggleMessageReactionController';
import UploadFileController from './UploadFileController';
import { container } from 'tsyringe';

export default {
    delete: container.resolve(DeleteMessageController),
    editMessage: container.resolve(EditMessageController),
    getChatMessages: container.resolve(GetChatMessagesController),
    getFilePreview: container.resolve(GetFilePreviewController),
    markMessagesAsRead: container.resolve(MarkMessagesAsReadController),
    sendChatMessage: container.resolve(SendChatMessageController),
    sendFileMessage: container.resolve(SendFileMessageController),
    toggleMessageReaction: container.resolve(ToggleMessageReactionController),
    uploadFile: container.resolve(UploadFileController)
};