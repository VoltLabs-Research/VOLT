import AIComposer from '@/modules/ai/components/AIComposer';
import AIConversationThread from '@/modules/ai/components/AIConversationThread';
import EmptyState from '@/shared/presentation/primitives/EmptyState';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Box from '@/shared/presentation/primitives/Box';
import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
import type { SelectOption } from '@/shared/presentation/primitives/Select';
import type { UIMessage } from 'ai';

interface ToolApprovalResponseParams {
    id: string;
    approved: boolean;
    reason?: string;
};

interface AIConversationPanelContentProps {
    conversationId?: string;
    messages: UIMessage[];
    isMessagesLoading: boolean;
    isSendingMessage: boolean;
    messagesError?: string | null;
    messageDraft: string;
    modelOptions: SelectOption[];
    selectedModel: string | null;
    canSendMessage: boolean;
    isProviderCatalogLoading: boolean;
    noProviderConfigured: boolean;
    sendMessageError?: string | null;
    selectedTeamId?: string;
    accessDenied: boolean;
    accessDeniedMessage?: string | null;
    addToolApprovalResponse?: (params: ToolApprovalResponseParams) => void;
    onMessageDraftChange: (message: string) => void;
    onModelChange: (model: string) => void;
    onSend: () => void;
    onOpenTableArtifact: (artifact: AIMessageArtifact) => void;
    onRetry: () => void;
    onOpenIntegrations: () => void;
}

const AIConversationPanelContent = ({
    conversationId,
    messages,
    isMessagesLoading,
    isSendingMessage,
    messagesError,
    messageDraft,
    modelOptions,
    selectedModel,
    canSendMessage,
    isProviderCatalogLoading,
    noProviderConfigured,
    sendMessageError,
    selectedTeamId,
    accessDenied,
    accessDeniedMessage,
    addToolApprovalResponse,
    onMessageDraftChange,
    onModelChange,
    onSend,
    onOpenTableArtifact,
    onRetry,
    onOpenIntegrations
}: AIConversationPanelContentProps) => {
    if (accessDenied) {
        return (
            <Box display='flex' flex='1' className='flex-center'>
                <RecoveryState
                    title='Access denied'
                    description={accessDeniedMessage ?? 'You do not have permission to use the AI assistant.'}
                    tone={RecoveryStateTone.AccessDenied}
                />
            </Box>
        );
    }

    if (!selectedTeamId) {
        return (
            <Box display='flex' flex='1' className='flex-center'>
                <EmptyState
                    title='No team selected'
                    description='Select a team to use the AI assistant.'
                />
            </Box>
        );
    }

    if (noProviderConfigured) {
        return (
            <Box display='flex' flex='1' className='flex-center'>
                <EmptyState
                    title='No AI provider configured'
                    description='Enable at least one provider with a valid API key in team integrations.'
                    buttonText='Open integrations'
                    buttonOnClick={onOpenIntegrations}
                />
            </Box>
        );
    }

    const shouldRenderStarterInput = !isMessagesLoading && messages.length === 0;
    const composer = (
        <AIComposer
            value={messageDraft}
            modelOptions={modelOptions}
            selectedModel={selectedModel}
            onChange={onMessageDraftChange}
            onModelChange={onModelChange}
            onSend={onSend}
            disabled={!canSendMessage || isProviderCatalogLoading || noProviderConfigured}
            isSending={isSendingMessage}
            error={sendMessageError}
        />
    );

    return (
        <>
            <AIConversationThread
                conversationId={conversationId}
                messages={messages}
                isLoading={isMessagesLoading}
                isResponding={isSendingMessage}
                error={messagesError}
                onOpenTableArtifact={onOpenTableArtifact}
                addToolApprovalResponse={addToolApprovalResponse}
                starterInput={shouldRenderStarterInput ? composer : null}
                onRetry={onRetry}
            />

            {!shouldRenderStarterInput && composer}
        </>
    );
};

export default AIConversationPanelContent;
