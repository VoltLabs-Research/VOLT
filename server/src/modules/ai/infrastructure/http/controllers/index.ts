import { container } from 'tsyringe';
import ListAIConversationsController from './ListAIConversationsController';
import CreateAIConversationController from './CreateAIConversationController';
import CreateAIConversationWithMessageController from './CreateAIConversationWithMessageController';
import ListAIConversationMessagesController from './ListAIConversationMessagesController';
import SendAIConversationMessageController from './SendAIConversationMessageController';
import StreamAIConversationMessageController from './StreamAIConversationMessageController';
import UpdateAIConversationController from './UpdateAIConversationController';
import DeleteAIConversationController from './DeleteAIConversationController';

export default {
    listConversations: container.resolve(ListAIConversationsController),
    createConversation: container.resolve(CreateAIConversationController),
    createConversationWithMessage: container.resolve(CreateAIConversationWithMessageController),
    listMessages: container.resolve(ListAIConversationMessagesController),
    sendMessage: container.resolve(SendAIConversationMessageController),
    streamMessage: container.resolve(StreamAIConversationMessageController),
    updateConversation: container.resolve(UpdateAIConversationController),
    deleteConversation: container.resolve(DeleteAIConversationController)
};
