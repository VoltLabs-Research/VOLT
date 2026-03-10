import CreateAIConversationController from './CreateAIConversationController';
import DeleteAIConversationController from './DeleteAIConversationController';
import ListAIConversationMessagesController from './ListAIConversationMessagesController';
import ListAIConversationsController from './ListAIConversationsController';
import SendAIConversationMessageController from './SendAIConversationMessageController';
import StreamAIConversationMessageController from './StreamAIConversationMessageController';
import UpdateAIConversationController from './UpdateAIConversationController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    listConversations: ListAIConversationsController,
    createConversation: CreateAIConversationController,
    listMessages: ListAIConversationMessagesController,
    sendMessage: SendAIConversationMessageController,
    streamMessage: StreamAIConversationMessageController,
    updateConversation: UpdateAIConversationController,
    deleteConversation: DeleteAIConversationController
});