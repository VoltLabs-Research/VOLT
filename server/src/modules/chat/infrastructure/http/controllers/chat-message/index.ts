import DeleteMessageController from './DeleteMessageController';
import EditMessageController from './EditMessageController';
import GetChatMessagesController from './GetChatMessagesController';
import MarkMessagesAsReadController from './MarkMessagesAsReadController';
import SendChatMessageController from './SendChatMessageController';
import SendFileMessageController from './SendFileMessageController';
import ToggleMessageReactionController from './ToggleMessageReactionController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    delete: DeleteMessageController,
    editMessage: EditMessageController,
    getChatMessages: GetChatMessagesController,
    markMessagesAsRead: MarkMessagesAsReadController,
    sendChatMessage: SendChatMessageController,
    sendFileMessage: SendFileMessageController,
    toggleMessageReaction: ToggleMessageReactionController
});