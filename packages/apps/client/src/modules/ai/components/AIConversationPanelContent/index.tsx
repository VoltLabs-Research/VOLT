import AIComposer from '@/modules/ai/components/AIComposer';
import AIConversationThread, { PromptStarter } from '@/modules/ai/components/AIConversationThread';
import { conversationQuery } from '@/modules/ai/hooks/queries';
import useAIModelSelection from '@/modules/ai/hooks/use-ai-model-selection';
import { useChatSession } from '@/modules/ai/hooks/use-chat-session';
import useConversations from '@/modules/ai/hooks/use-conversations';
import useTranscript from '@/modules/ai/hooks/use-transcript';
import { NEW_CONVERSATION_DRAFT, useChatSurfaceStore } from '@/modules/ai/store/use-chat-surface-store';
import { chatErrorCopy } from '@/modules/ai/utils/chat-errors';
import { toAIModelSelectOptions } from '@/modules/ai/utils/model-options';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AITableArtifact } from '@/modules/ai/contracts/artifacts';
import type { ActiveConversation } from '@/modules/ai/store/use-chat-surface-store';
import type { SelectOption } from '@/shared/contracts/form-field';
import type { AIConversation } from '@volt/contracts/modules/ai/domain';

type ModelSelection = ReturnType<typeof useAIModelSelection>;

interface ComposerModel {
    options: SelectOption[];
    selection: ModelSelection;
}

const useDraft = (key: string) => {
    const draft = useChatSurfaceStore((state) => state.drafts[key] ?? '');
    const setDraft = useChatSurfaceStore((state) => state.setDraft);

    return [draft, (text: string) => setDraft(key, text)] as const;
};

interface ConversationSessionProps {
    conversation: ActiveConversation;
    model: ComposerModel;
    canSend: boolean;
    onOpenTableArtifact?: (artifact: AITableArtifact) => void;
}

const ConversationSession = ({ conversation, model, canSend, onOpenTableArtifact }: ConversationSessionProps) => {
    const { conversationId, teamId } = conversation;
    const session = useChatSession(conversationId);
    const transcript = useTranscript(teamId, conversationId, session);
    const [draft, setDraft] = useDraft(conversationId);
    const takeTurn = useChatSurfaceStore((state) => state.takeTurn);
    const detail = conversationQuery({
        teamId,
        conversationId
    });
    const { choice, prefer } = model.selection;
    const { canAsk, send } = session;

    const stored = detail.data;
    useEffect(() => {
        if (stored?.provider && stored.model) {
            prefer({
                provider: stored.provider,
                model: stored.model
            });
        }
    }, [stored?._id, stored?.provider, stored?.model, prefer]);

    // A conversation started from the composer holds its first message until the socket has
    // joined it, the only state in which the server takes a turn.
    useEffect(() => {
        if (!canAsk || choice === null) return;

        const text = takeTurn(conversationId);
        if (text !== null) send(text, choice);
    }, [canAsk, choice, conversationId, send, takeTurn]);

    const handleSend = () => {
        if (!canSend || choice === null) return;
        if (send(draft, choice)) setDraft('');
    };

    const notice = chatErrorCopy(session.error) ?? chatErrorCopy(session.failure);

    return (
        <>
            <AIConversationThread
                messages={session.messages}
                isLoading={transcript.loading}
                isStreaming={session.isStreaming}
                canDecide={canSend && canAsk}
                loadError={transcript.error ? chatErrorCopy(transcript.error) : null}
                hasEarlier={transcript.hasEarlier}
                isLoadingEarlier={transcript.loadingEarlier}
                onLoadEarlier={transcript.loadEarlier}
                onRetry={transcript.reload}
                onDecide={session.decide}
                onOpenTableArtifact={onOpenTableArtifact}
            />

            <AIComposer
                value={draft}
                modelOptions={model.options}
                selectedModel={model.selection.selectedModel}
                onChange={(text) => {
                    setDraft(text);
                    if (session.error) session.clearError();
                }}
                onModelChange={model.selection.setSelectedModel}
                onSend={handleSend}
                onStop={session.stop}
                disabled={!canSend || !canAsk || choice === null}
                isSending={session.isStreaming}
                error={notice}
            />
        </>
    );
};

interface ConversationStarterProps {
    model: ComposerModel;
    canSend: boolean;
    onStarted: (conversation: AIConversation) => void;
}

const ConversationStarter = ({ model, canSend, onStarted }: ConversationStarterProps) => {
    const [draft, setDraft] = useDraft(NEW_CONVERSATION_DRAFT);
    const { start, isStarting } = useConversations();
    const { choice } = model.selection;

    const handleSend = () => {
        if (!canSend || choice === null || isStarting || draft.trim() === '') return;

        void start(draft).then((conversation) => {
            if (conversation === null) return;

            setDraft('');
            onStarted(conversation);
        });
    };

    return (
        <>
            <PromptStarter />

            <AIComposer
                value={draft}
                modelOptions={model.options}
                selectedModel={model.selection.selectedModel}
                onChange={setDraft}
                onModelChange={model.selection.setSelectedModel}
                onSend={handleSend}
                disabled={!canSend || choice === null || isStarting}
                isSending={isStarting}
            />
        </>
    );
};

interface AIConversationPanelContentProps {
    // Null shows a composer that starts a new conversation with its first message.
    conversation: ActiveConversation | null;
    teamId: string | null;
    onStarted: (conversation: AIConversation) => void;
    onOpenTableArtifact?: (artifact: AITableArtifact) => void;
}

const AIConversationPanelContent = ({ conversation, teamId, onStarted, onOpenTableArtifact }: AIConversationPanelContentProps) => {
    const navigate = useNavigate();
    const { canAccess, isScopeReady } = useTeamPermissions();
    const selection = useAIModelSelection(conversation?.teamId ?? teamId);
    const options = useMemo(() => toAIModelSelectOptions(selection.availableModelsForProvider), [selection.availableModelsForProvider]);

    if (isScopeReady && !canAccess(['ai-conversation:read'])) {
        return (
            <div className='flex flex-1 items-center justify-center'>
                <RecoveryState
                    title='Access denied'
                    description='Your role in this team cannot use Volt AI.'
                    tone={RecoveryStateTone.AccessDenied}
                    requiredPermissions={['ai-conversation:read']}
                />
            </div>
        );
    }

    if (!teamId && !conversation) {
        return (
            <div className='flex flex-1 items-center justify-center'>
                <RecoveryState
                    title='No team selected'
                    description='Select a team to use Volt AI.'
                />
            </div>
        );
    }

    if (selection.providerCatalogError) {
        return (
            <div className='flex flex-1 items-center justify-center'>
                <RecoveryState
                    title='Unable to load AI providers'
                    description={selection.providerCatalogError}
                    tone={RecoveryStateTone.Error}
                    onRetry={() => {
                        selection.loadProviderCatalog().catch(() => undefined);
                    }}
                />
            </div>
        );
    }

    if (selection.noProviderConfigured) {
        return (
            <div className='flex flex-1 items-center justify-center'>
                <RecoveryState
                    title='No AI provider configured'
                    description='Enable at least one provider with a valid API key in team integrations.'
                    tone={RecoveryStateTone.Info}
                    retryLabel='Open integrations'
                    onRetry={() => navigate('/dashboard/settings/integrations')}
                />
            </div>
        );
    }

    const model: ComposerModel = {
        options,
        selection
    };
    const canSend = isScopeReady && canAccess(['ai-conversation:create']) && !selection.isProviderCatalogLoading;

    if (conversation === null) {
        return <ConversationStarter model={model} canSend={canSend} onStarted={onStarted} />;
    }

    return (
        <ConversationSession
            key={conversation.conversationId}
            conversation={conversation}
            model={model}
            canSend={canSend}
            onOpenTableArtifact={onOpenTableArtifact}
        />
    );
};


export default AIConversationPanelContent;
