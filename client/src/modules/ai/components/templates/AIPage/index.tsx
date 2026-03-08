import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
import AIComposer from '@/modules/ai/components/organisms/AIComposer';
import AIConversationSidebar from '@/modules/ai/components/organisms/AIConversationSidebar';
import AIConversationThread from '@/modules/ai/components/organisms/AIConversationThread';
import AIArtifactSpreadsheetPanel from '@/modules/ai/components/organisms/AIArtifactSpreadsheetPanel';
import ResizeHandle from '@/modules/canvas/components/atoms/ResizeHandle';
import useResizable from '@/modules/canvas/hooks/use-resizable';
import useAIPage from '@/modules/ai/hooks/use-ai-page';
import usePermission from '@/shared/presentation/hooks/use-permission';
import Container from '@/shared/presentation/components/Container';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Paragraph from '@/shared/presentation/components/Paragraph';
import type { SelectOption } from '@/shared/presentation/components/Select';
import './AIPage.css';

const AIPage = () => {
    const navigate = useNavigate();
    const { conversationId } = useParams<{ conversationId?: string }>();
    const [messageDraft, setMessageDraft] = useState('');
    const [openArtifact, setOpenArtifact] = useState<AIMessageArtifact | null>(null);
    const pendingMessageRef = useRef<string | null>(null);
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
        setSelectedModel,
        handleSelectConversation,
        handleCreateConversation,
        handleDeleteConversation,
        handleRenameConversation,
        addToolApprovalResponse,
        handleSendMessage,
        loadConversationMessages
    } = useAIPage(conversationId);
    const canCreate = usePermission(['ai-conversation:create']);
    const canUpdate = usePermission(['ai-conversation:update']);
    const canDelete = usePermission(['ai-conversation:delete']);

    const modelOptions: SelectOption[] = useMemo(() => (
        availableModelsForProvider.map((model) => ({
            value: `${model.provider}::${model.id}`,
            title: model.name,
            description: model.description
                ? `${model.providerName} · ${model.description}`
                : model.providerName
        }))
    ), [availableModelsForProvider]);

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
                pendingMessageRef.current = normalizedText;
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

    useEffect(() => {
        if (!conversationId || !canSendMessage) {
            return;
        }

        const text = pendingMessageRef.current;

        if (!text) {
            return;
        }

        pendingMessageRef.current = null;
        handleSendMessage(text).catch(() => {
            pendingMessageRef.current = text;
            setMessageDraft(text);
        });
    }, [canSendMessage, conversationId, handleSendMessage]);

    if (accessDenied) {
        return <AccessDenied description={accessDeniedMessage} />;
    }

    return (
        <Container className='d-flex h-max ai-page'>
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

            <Container className='d-flex column h-max flex-1 ai-page-main'>
                {providerCatalogError && (
                    <Container className='ai-page-inline-alert'>
                        <Paragraph className='font-size-1 color-danger'>{providerCatalogError}</Paragraph>
                    </Container>
                )}

                {!selectedTeam?._id ? (
                    <Container className='d-flex flex-center flex-1'>
                        <EmptyState
                            title='No team selected'
                            description='Select a team to start an AI conversation.'
                        />
                    </Container>
                ) : noProviderConfigured ? (
                    <Container className='d-flex flex-center flex-1'>
                        <EmptyState
                            title='No AI provider configured'
                            description='Enable at least one provider with a valid API key in team integrations to start chatting.'
                            buttonText='Open integrations'
                            buttonOnClick={() => navigate('/dashboard/settings/integrations')}
                        />
                    </Container>
                ) : (
                    <>
                        <Container className='d-flex flex-1 ai-page-workspace'>
                            <Container className='d-flex column flex-1 ai-page-chat-pane'>
                                <AIConversationThread
                                    conversationId={conversationId}
                                    messages={messages}
                                    isLoading={isMessagesLoading}
                                    isResponding={isSendingMessage}
                                    error={messagesError}
                                    onOpenTableArtifact={handleOpenTableArtifact}
                                    activeTableArtifactId={openArtifact?.id || null}
                                    addToolApprovalResponse={addToolApprovalResponse}
                                    starterInput={shouldRenderStarterInput ? (
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
                                    ) : null}
                                    onRetry={() => {
                                        if (conversationId) {
                                            loadConversationMessages(conversationId).catch(console.warn);
                                        }
                                    }}
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
                            </Container>

                            {openArtifact && (
                                <>
                                    <ResizeHandle
                                        direction='horizontal'
                                        isDragging={spreadsheetPanel.isDragging}
                                        onPointerDown={spreadsheetPanel.handleProps.onPointerDown}
                                    />
                                    <AIArtifactSpreadsheetPanel
                                        artifact={openArtifact}
                                        onClose={handleCloseArtifactPanel}
                                        width={spreadsheetPanel.size}
                                    />
                                </>
                            )}
                        </Container>
                    </>
                )}
            </Container>
        </Container>
    );
};

export default AIPage;
