import AIComposer from '@/modules/ai/components/AIComposer';
import AIConversationThread from '@/modules/ai/components/AIConversationThread';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import type { AISelectOption } from '@/modules/ai/utils/model-options';
import type { AIMessageArtifact } from '@volt/contracts/modules/ai/domain';
import type { UIMessage } from 'ai';
import type { ToolApprovalResponseParams } from '@/modules/ai/contracts/tools';

interface AIConversationPanelContentProps {
    conversationId?: string;
    messages: UIMessage[];
    isMessagesLoading: boolean;
    isSendingMessage: boolean;
    messagesError?: string | null;
    messageDraft: string;
    modelOptions: AISelectOption[];
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
    onStop?: () => void;
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
    onStop,
    onOpenTableArtifact,
    onRetry,
    onOpenIntegrations
}: AIConversationPanelContentProps) => {
    if (accessDenied) {
        return (
            <div className='flex flex-1 items-center justify-center'>
                <RecoveryState
                    title='Access denied'
                    description={accessDeniedMessage ?? 'You do not have permission to use the AI assistant.'}
                    tone={RecoveryStateTone.AccessDenied}
                />
            </div>
        );
    }

    if (!selectedTeamId) {
        return (
            <div className='flex flex-1 items-center justify-center'>
                <RecoveryState
                    title='No team selected'
                    description='Select a team to use the AI assistant.'
                />
            </div>
        );
    }

    if (noProviderConfigured) {
        return (
            <div className='flex flex-1 items-center justify-center'>
                <RecoveryState
                    title='No AI provider configured'
                    description='Enable at least one provider with a valid API key in team integrations.'
                    tone={RecoveryStateTone.Info}
                    retryLabel='Open integrations'
                    onRetry={onOpenIntegrations}
                />
            </div>
        );
    }

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
                onRetry={onRetry}
            />

            <AIComposer
                value={messageDraft}
                modelOptions={modelOptions}
                selectedModel={selectedModel}
                onChange={onMessageDraftChange}
                onModelChange={onModelChange}
                onSend={onSend}
                onStop={onStop}
                disabled={!canSendMessage || isProviderCatalogLoading || noProviderConfigured}
                isSending={isSendingMessage}
                error={sendMessageError}
            />
        </>
    );
};

export default AIConversationPanelContent;
