import AIArtifactSpreadsheetPanel from '@/modules/ai/components/AIArtifactSpreadsheetPanel';
import AIComposer from '@/modules/ai/components/AIComposer';
import AIConversationSidebar from '@/modules/ai/components/AIConversationSidebar';
import AIConversationThread from '@/modules/ai/components/AIConversationThread';
import ResizeHandle from '@/modules/canvas/components/ResizeHandle';
import useResizable from '@/modules/canvas/hooks/use-resizable';
import useAIPage from '@/modules/ai/hooks/use-ai-page';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import EmptyState from '@/shared/presentation/components/EmptyState';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import useTip from '@/shared/tips/use-tip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
import type { SelectOption } from '@/shared/presentation/components/Select';
import type { ReactNode } from 'react';
import type { Params } from 'react-router-dom';
import './AIPage.css';

interface AIPageRouteParams extends Params {
    conversationId?: string;
};

const AIPage = () => {
    useTip('ai-spreadsheet-panel');

    const navigate = useNavigate();
    const { conversationId } = useParams<AIPageRouteParams>();
    const { canAccess } = useTeamPermissions();
    const [messageDraft, setMessageDraft] = useState('');
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
        handleSendMessage,
        loadConversationMessages
    } = useAIPage(conversationId);
    const canCreate = canAccess(['ai-conversation:create']);
    const canUpdate = canAccess(['ai-conversation:update']);
    const canDelete = canAccess(['ai-conversation:delete']);

    const modelOptions: SelectOption[] = useMemo(() => {
        return availableModelsForProvider.map((model) => ({
            value: `${model.provider}::${model.id}`,
            title: model.name,
            description: model.providerName
        }));
    }, [availableModelsForProvider]);

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

    // Restore sidebar if user navigates away while the spreadsheet panel is open
    useEffect(() => {
        return () => {
            if (didCollapseSidebar.current) {
                window.dispatchEvent(new CustomEvent('volt:request-sidebar-expand'));
            }
        };
    }, []);

    const handleCreate = () => {
        handleCreateConversation().catch(console.warn);
    };

    const handleDelete = async (targetConversationId: string) => {
        await handleDeleteConversation(targetConversationId);
    };

    const handleRename = async (targetConversationId: string, title: string) => {
        await handleRenameConversation(targetConversationId, title);
    };

    const handleSend = async () => {
        const draftToSend = messageDraft;
        const normalizedText = draftToSend.trim();

        if (!normalizedText) {
            return;
        }

        setMessageDraft('');
        try {
            if (!conversationId) {
                sessionStorage.setItem('volt:ai:pending-message', normalizedText);
                await handleCreateConversation(normalizedText);
                return;
            }

            await handleSendMessage(normalizedText);
        } catch {
            setMessageDraft(normalizedText);
        }
    };

    const shouldRenderStarterInput = !isMessagesLoading && messages.length === 0;
    const noProviderConfigured = availableModelsForProvider.length === 0 && !isProviderCatalogLoading;

    const handleRetry = () => {
        if (conversationId) {
            loadConversationMessages(conversationId).catch(console.warn);
        }
    };

    useEffect(() => {
        if (!conversationId || !canSendMessage) {
            return;
        }

        const text = sessionStorage.getItem('volt:ai:pending-message');

        if (!text) {
            return;
        }

        sessionStorage.removeItem('volt:ai:pending-message');
        handleSendMessage(text).catch(() => {
            sessionStorage.setItem('volt:ai:pending-message', text);
            setMessageDraft(text);
        });
    }, [canSendMessage, conversationId, handleSendMessage]);

    if (accessDenied) {
        return (
            <RecoveryState
                title='Access denied'
                description={accessDeniedMessage ?? 'You do not have permission to use AI conversations.'}
                tone={RecoveryStateTone.AccessDenied}
            />
        );
    }

    let starterInput: ReactNode = null;
    if (shouldRenderStarterInput) {
        starterInput = (
            <AIComposer
                value={messageDraft}
                modelOptions={modelOptions}
                selectedModel={selectedModel}
                onChange={setMessageDraft}
                onModelChange={setSelectedModel}
                onSend={handleSend}
                disabled={!canSendMessage || !canCreate || isProviderCatalogLoading || noProviderConfigured}
                isSending={isSendingMessage}
                error={sendMessageError}
            />
        );
    }

    let workspaceContent: ReactNode = (
        <>
            <div className='volt-container d-flex flex-1 ai-page-workspace'>
                <div className='volt-container d-flex column flex-1 ai-page-chat-pane'>
                    <AIConversationThread
                        conversationId={conversationId}
                        messages={messages}
                        isLoading={isMessagesLoading}
                        isResponding={isSendingMessage}
                        error={messagesError}
                        onOpenTableArtifact={handleOpenTableArtifact}
                        activeTableArtifactId={openArtifact?.id || null}
                        addToolApprovalResponse={addToolApprovalResponse}
                        starterInput={starterInput}
                        onRetry={handleRetry}
                    />

                    {!shouldRenderStarterInput && (
                        <AIComposer
                            value={messageDraft}
                            modelOptions={modelOptions}
                            selectedModel={selectedModel}
                            onChange={setMessageDraft}
                            onModelChange={setSelectedModel}
                            onSend={handleSend}
                            disabled={!canSendMessage || !canCreate || isProviderCatalogLoading || noProviderConfigured}
                            isSending={isSendingMessage}
                            error={sendMessageError}
                        />
                    )}
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
                        <div id='ai-artifact-spreadsheet-panel' className='volt-container d-flex'>
                            <AIArtifactSpreadsheetPanel
                                artifact={openArtifact}
                                onClose={handleCloseArtifactPanel}
                                width={spreadsheetPanel.size}
                            />
                        </div>
                    </>
                )}
            </div>
        </>
    );

    if (!selectedTeam?._id) {
        workspaceContent = (
            <div className='volt-container d-flex flex-center flex-1'>
                <EmptyState
                    title='No team selected'
                    description='Select a team to start an AI conversation.'
                />
            </div>
        );
    } else if (noProviderConfigured) {
        workspaceContent = (
            <div className='volt-container d-flex flex-center flex-1'>
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
        <div className='volt-container d-flex h-max ai-page'>
            <AIConversationSidebar
                conversations={conversations}
                activeConversationId={conversationId}
                isLoading={isConversationsLoading}
                error={conversationsError}
                onCreateConversation={handleCreate}
                onSelectConversation={handleSelectConversation}
                onDeleteConversation={handleDelete}
                onRenameConversation={handleRename}
                canCreate={canCreate}
                canUpdate={canUpdate}
                canDelete={canDelete}
            />

            <div className='volt-container d-flex column h-max flex-1 ai-page-main'>
                {providerCatalogError && (
                    <div className='volt-container ai-page-inline-alert'>
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
