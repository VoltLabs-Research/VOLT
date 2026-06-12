import AIArtifactSpreadsheetPanel from '@/modules/ai/components/AIArtifactSpreadsheetPanel';
import AIComposer from '@/modules/ai/components/AIComposer';
import AIConversationSidebar from '@/modules/ai/components/AIConversationSidebar';
import AIConversationThread from '@/modules/ai/components/AIConversationThread';
import ResizeHandle from '@/modules/canvas/components/ResizeHandle';
import useResizable from '@/modules/canvas/hooks/use-resizable';
import { useAIChatContext } from '@/modules/ai/providers/AIChatProvider';
import { toAIModelSelectOptions } from '@/modules/ai/utilities/model-options';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { EmptyState, Box, Row, Stack } from '@voltstack/bravais';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import useTip from '@/shared/tips/use-tip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
import type { ReactNode } from 'react';
import type { Params } from 'react-router-dom';
import './AIPage.css';
interface AIPageRouteParams extends Params {
    conversationId?: string;
}

const UNSET_CONVERSATION_ID = Symbol('unset-conversation-id');

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

    const prevConversationIdRef = useRef<string | undefined | typeof UNSET_CONVERSATION_ID>(UNSET_CONVERSATION_ID);
    const prevActiveConversationIdRef = useRef<string | undefined>(activeConversationId);

    useEffect(() => {
        const urlChanged = prevConversationIdRef.current !== conversationId;
        const providerChanged = prevActiveConversationIdRef.current !== activeConversationId;

        prevConversationIdRef.current = conversationId;
        prevActiveConversationIdRef.current = activeConversationId;

        if (conversationId === activeConversationId) {
            return;
        }

        if (providerChanged) {
            if (activeConversationId) {
                navigate(`/dashboard/ai/${activeConversationId}`);
            } else {
                navigate('/dashboard/ai');
            }
            return;
        }

        if (urlChanged) {
            setActiveConversationId(conversationId);
        }
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

    // Restore sidebar if user navigates away while the spreadsheet panel is open
    useEffect(() => {
        return () => {
            if (didCollapseSidebar.current) {
                window.dispatchEvent(new CustomEvent('volt:request-sidebar-expand'));
            }
        };
    }, []);

    // The page stays mounted across /dashboard/ai/* navigations, so an artifact
    // opened in one conversation must not linger when switching to another.
    useEffect(() => {
        handleCloseArtifactPanel();
    }, [conversationId, handleCloseArtifactPanel]);

    const handleCreate = () => {
        handleCreateConversation().catch(console.warn);
    };

    const handleDelete = async (targetConversationId: string) => {
        await handleDeleteConversation(targetConversationId);
    };

    const handleRename = async (targetConversationId: string, title: string) => {
        await handleRenameConversation(targetConversationId, title);
    };

    const noProviderConfigured = availableModelsForProvider.length === 0 && !isProviderCatalogLoading;
    const isThreadEmpty = !isMessagesLoading && messages.length === 0;

    // Row renders `items-center` by default. Only the empty/starter state may
    // center vertically; with messages the pane must stretch so the thread
    // starts at the top and the composer pins to the bottom.
    let workspaceClassName = 'ai-page-workspace';
    if (isThreadEmpty) {
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
        <>
            <Row flex='1' className={workspaceClassName}>
                <Stack flex='1' className='ai-page-chat-pane'>
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
                </Stack>

                {openArtifact && (
                    <>
                        <ResizeHandle
                            direction='horizontal'
                            isDragging={spreadsheetPanel.isDragging}
                            label='Resize spreadsheet panel'
                            controls='ai-artifact-spreadsheet-panel'
                            {...spreadsheetPanel.handleProps}
                        />
                        <Box id='ai-artifact-spreadsheet-panel' display='flex'>
                            <AIArtifactSpreadsheetPanel
                                artifact={openArtifact}
                                onClose={handleCloseArtifactPanel}
                                width={spreadsheetPanel.size}
                            />
                        </Box>
                    </>
                )}
            </Row>
        </>
    );

    if (!selectedTeam?._id) {
        workspaceContent = (
            <Box display='flex' flex='1' className='flex-center'>
                <EmptyState
                    title='No team selected'
                    description='Select a team to start an AI conversation.'
                />
            </Box>
        );
    } else if (noProviderConfigured) {
        workspaceContent = (
            <Box display='flex' flex='1' className='flex-center'>
                <EmptyState
                    title='No AI provider configured'
                    description='Enable at least one provider with a valid API key in team integrations to start chatting.'
                    buttonText='Open integrations'
                    buttonOnClick={() => navigate('/dashboard/settings/integrations')}
                />
            </Box>
        );
    }

    return (
        <Row height='max' className='ai-page'>
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

            <Stack height='max' flex='1' className='ai-page-main'>
                {providerCatalogError && (
                    <Box className='ai-page-inline-alert'>
                        <RecoveryState
                            title='Unable to load AI providers'
                            description={providerCatalogError}
                            tone={RecoveryStateTone.Error}
                            onRetry={() => {
                                loadProviderCatalog().catch(() => undefined);
                            }}
                        />
                    </Box>
                )}

                {workspaceContent}
            </Stack>
        </Row>
    );
};

export default AIPage;
