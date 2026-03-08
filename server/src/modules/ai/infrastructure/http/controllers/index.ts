import CreateAIConversationController from './CreateAIConversationController';
import DeleteAIConversationController from './DeleteAIConversationController';
import ListAIConversationMessagesController from './ListAIConversationMessagesController';
import ListAIConversationsController from './ListAIConversationsController';
import SendAIConversationMessageController from './SendAIConversationMessageController';
import StreamAIConversationMessageController from './StreamAIConversationMessageController';
import UpdateAIConversationController from './UpdateAIConversationController';
import { container } from 'tsyringe';

export default {
    listConversations: container.resolve(ListAIConversationsController),
    createConversation: container.resolve(CreateAIConversationController),
    listMessages: container.resolve(ListAIConversationMessagesController),
    sendMessage: container.resolve(SendAIConversationMessageController),
    streamMessage: container.resolve(StreamAIConversationMessageController),
    updateConversation: container.resolve(UpdateAIConversationController),
    deleteConversation: container.resolve(DeleteAIConversationController)
};
