import { cn } from '@heroui/react';
import AIArtifactSpreadsheetPanel from '@/modules/ai/components/AIArtifactSpreadsheetPanel';
import AIComposer from '@/modules/ai/components/AIComposer';
import AIConversationSidebar from '@/modules/ai/components/AIConversationSidebar';
import AIConversationThread from '@/modules/ai/components/AIConversationThread';
import ResizeHandle from '@/modules/canvas/components/ResizeHandle';
import useResizable from '@/modules/canvas/hooks/use-resizable';
import { useAIChatContext } from '@/modules/ai/providers/AIChatProvider';
import { toAIModelSelectOptions } from '@/modules/ai/utils/model-options';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { EmptyState } from '@voltstack/bravais';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import useTip from '@/shared/tips/use-tip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { AIMessageArtifact } from '@volt/contracts/modules/ai/domain';
import type { ReactNode } from 'react';
import type { Params } from 'react-router-dom';
import './AIPage.css';
interface AIPageRouteParams extends Params {
    conversationId?: string;
}

const AIPage = () => {
    useTip('ai-spreadsheet-panel');

    const navigate = useNavigate();
    const { conversationId } = useParams<AIPageRouteParams>();
    const { canAccess } = useTeamPermissions();
    const [openArtifact, setOpenArtifact] = useState<AIMessageArtifact | null>(null);
    const didCollapseSidebar = useRef(false);

    const spreadsheetPanel = useResizable({
        direction: 'horizontal',
        initialSize: 520,
        minSize: 320,
        maxSize: 900,
        growPositive: false
    });

    const {
        selectedTeam,
        availableModelsForProvider,
        selectedModel,
        conversations,
        messages,
        isConversationsLoading,
        isMessagesLoading,
        isProviderCatalogLoading,
        isSendingMessage,
        noProviderConfigured,
        conversationsError,
        messagesError,
        providerCatalogError,
        sendMessageError,
        canSendMessage,
        accessDenied,
        accessDeniedMessage,
        loadProviderCatalog,
        setSelectedModel,
        handleSelectConversation,
        handleCreateConversation,
        handleDeleteConversation,
        handleRenameConversation,
        addToolApprovalResponse,
        loadConversationMessages,
        activeConversationId,
        setActiveConversationId,
        messageDraft,
        setMessageDraft,
        handleSend,
        stopStreaming
    } = useAIChatContext();

    const prevActiveConversationIdRef = useRef<string | undefined>(activeConversationId);

    useEffect(() => {
        const providerChanged = prevActiveConversationIdRef.current !== activeConversationId;
        prevActiveConversationIdRef.current = activeConversationId;

        if (conversationId === activeConversationId) {
            return;
        }

        if (providerChanged) {
            navigate(activeConversationId ? `/dashboard/ai/${activeConversationId}` : '/dashboard/ai');
            return;
        }

        setActiveConversationId(conversationId);
    }, [conversationId, activeConversationId, navigate, setActiveConversationId]);

    const canCreate = canAccess(['ai-conversation:create']);
    const canUpdate = canAccess(['ai-conversation:update']);
    const canDelete = canAccess(['ai-conversation:delete']);

    const modelOptions = useMemo(() => toAIModelSelectOptions(availableModelsForProvider), [availableModelsForProvider]);

    const handleOpenTableArtifact = useCallback((artifact: AIMessageArtifact) => {
        setOpenArtifact(artifact);
        didCollapseSidebar.current = true;
        window.dispatchEvent(new CustomEvent('volt:request-sidebar-collapse'));
    }, []);

    const handleCloseArtifactPanel = useCallback(() => {
        setOpenArtifact(null);
        if (didCollapseSidebar.current) {
            window.dispatchEvent(new CustomEvent('volt:request-sidebar-expand'));
            didCollapseSidebar.current = false;
        }
    }, []);

    useEffect(() => {
        return () => {
            if (didCollapseSidebar.current) {
                window.dispatchEvent(new CustomEvent('volt:request-sidebar-expand'));
            }
        };
    }, []);

    useEffect(() => {
        handleCloseArtifactPanel();
    }, [conversationId, handleCloseArtifactPanel]);

    const handleCreate = () => {
        handleCreateConversation().catch(console.warn);
    };

    let workspaceClassName = 'ai-page-workspace';
    if (!isMessagesLoading && messages.length === 0) {
        workspaceClassName += ' is-empty';
    }

    const handleRetry = () => {
        if (conversationId) {
            loadConversationMessages(conversationId).catch(console.warn);
        }
    };

    if (accessDenied) {
        return (
            <RecoveryState
                title='Access denied'
                description={accessDeniedMessage ?? 'You do not have permission to use AI conversations.'}
                tone={RecoveryStateTone.AccessDenied}
            />
        );
    }

    let workspaceContent: ReactNode = (
        <div className={cn('flex flex-row items-center flex-1', workspaceClassName)}>
            <div className='flex flex-col flex-1 ai-page-chat-pane'>
                <AIConversationThread
                    conversationId={conversationId}
                    messages={messages}
                    isLoading={isMessagesLoading}
                    isResponding={isSendingMessage}
                    error={messagesError}
                    onOpenTableArtifact={handleOpenTableArtifact}
                    addToolApprovalResponse={addToolApprovalResponse}
                    onRetry={handleRetry}
                />

                <AIComposer
                    value={messageDraft}
                    modelOptions={modelOptions}
                    selectedModel={selectedModel}
                    onChange={setMessageDraft}
                    onModelChange={setSelectedModel}
                    onSend={handleSend}
                    onStop={stopStreaming}
                    disabled={!canSendMessage || !canCreate || isProviderCatalogLoading || noProviderConfigured}
                    isSending={isSendingMessage}
                    error={sendMessageError}
                />
            </div>

            {openArtifact && (
                <>
                    <ResizeHandle
                        direction='horizontal'
                        isDragging={spreadsheetPanel.isDragging}
                        label='Resize spreadsheet panel'
                        controls='ai-artifact-spreadsheet-panel'
                        {...spreadsheetPanel.handleProps}
                    />
                    <div className='flex' id='ai-artifact-spreadsheet-panel'>
                        <AIArtifactSpreadsheetPanel
                            artifact={openArtifact}
                            onClose={handleCloseArtifactPanel}
                            width={spreadsheetPanel.size}
                        />
                    </div>
                </>
            )}
        </div>
    );

    if (!selectedTeam?._id) {
        workspaceContent = (
            <div className='flex flex-1 items-center justify-center'>
                <EmptyState
                    title='No team selected'
                    description='Select a team to start an AI conversation.'
                />
            </div>
        );
    } else if (noProviderConfigured) {
        workspaceContent = (
            <div className='flex flex-1 items-center justify-center'>
                <EmptyState
                    title='No AI provider configured'
                    description='Enable at least one provider with a valid API key in team integrations to start chatting.'
                    buttonText='Open integrations'
                    buttonOnClick={() => navigate('/dashboard/settings/integrations')}
                />
            </div>
        );
    }

    return (
        <div className='flex flex-row items-center h-full ai-page'>
            <AIConversationSidebar
                conversations={conversations}
                activeConversationId={conversationId}
                isLoading={isConversationsLoading}
                error={conversationsError}
                onCreateConversation={handleCreate}
                onSelectConversation={handleSelectConversation}
                onDeleteConversation={handleDeleteConversation}
                onRenameConversation={handleRenameConversation}
                canCreate={canCreate}
                canUpdate={canUpdate}
                canDelete={canDelete}
            />

            <div className='flex flex-col h-full flex-1 ai-page-main'>
                {providerCatalogError && (
                    <div className='ai-page-inline-alert'>
                        <RecoveryState
                            title='Unable to load AI providers'
                            description={providerCatalogError}
                            tone={RecoveryStateTone.Error}
                            onRetry={() => {
                                loadProviderCatalog().catch(() => undefined);
                            }}
                        />
                    </div>
                )}

                {workspaceContent}
            </div>
        </div>
    );
};

export default AIPage;
