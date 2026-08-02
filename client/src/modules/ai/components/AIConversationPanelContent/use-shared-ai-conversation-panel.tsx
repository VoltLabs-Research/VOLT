import useConversationPanelView from '@/modules/ai/components/AIConversationPanelContent/use-conversation-panel-view';
import { useAIChatContext } from '@/modules/ai/providers/AIChatProvider';

interface UseSharedAIConversationPanelOptions {
    onNavigateAway?: () => void;
}

/** Embedded assistant panel backed by the dashboard-wide conversation, so it survives navigation. */
const useSharedAIConversationPanel = ({ onNavigateAway }: UseSharedAIConversationPanelOptions = {}) => {
    const chatContext = useAIChatContext();

    return useConversationPanelView({
        pageState: chatContext,
        conversationId: chatContext.activeConversationId,
        messageDraft: chatContext.messageDraft,
        setMessageDraft: chatContext.setMessageDraft,
        handleSend: chatContext.handleSend,
        onNavigateAway
    });
};

export default useSharedAIConversationPanel;
