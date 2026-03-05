import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoAddOutline, IoCloseOutline, IoExpandOutline, IoSparklesOutline } from 'react-icons/io5';
import type { AIMessageArtifact } from '@/modules/ai/presentation/utils/message-artifacts';
import AIComposer from '@/modules/ai/presentation/components/organisms/AIComposer';
import AIConversationThread from '@/modules/ai/presentation/components/organisms/AIConversationThread';
import useAIPage from '@/modules/ai/presentation/hooks/use-ai-page';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import IconButton from '@/shared/presentation/components/IconButton';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { type SelectOption } from '@/shared/presentation/components/Select';
import Tooltip from '@/shared/presentation/components/Tooltip';
import './AIFloatingAssistantPanel.css';

const AIFloatingAssistantPanel = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [conversationId, setConversationId] = useState<string | undefined>();
    const [messageDraft, setMessageDraft] = useState('');
    const pendingMessageRef = useRef<string | null>(null);

    const {
        selectedTeam,
        messages,
        availableModelsForProvider,
        selectedModel,
        isMessagesLoading,
        isProviderCatalogLoading,
        isSendingMessage,
        conversationsError,
        messagesError,
        providerCatalogError,
        sendMessageError,
        noProviderConfigured,
        canSendMessage,
        accessDenied,
        accessDeniedMessage,
        setSelectedModel,
        handleCreateConversation,
        addToolApprovalResponse,
        handleSendMessage,
        loadConversationMessages
    } = useAIPage(conversationId, {
        navigateOnConversationChange: false,
        onConversationChange: setConversationId
    });

    useEffect(() => {
        if (!isOpen) {
            setConversationId(undefined);
            setMessageDraft('');
            pendingMessageRef.current = null;
        }
    }, [isOpen]);

    useEffect(() => {
        if (!conversationId || !pendingMessageRef.current) return;
        const message = pendingMessageRef.current;
        pendingMessageRef.current = null;
        handleSendMessage(message).catch(() => {
            setMessageDraft(message);
        });
    }, [conversationId, handleSendMessage]);

    const modelOptions: SelectOption[] = useMemo(() => (
        availableModelsForProvider.map((model) => ({
            value: `${model.provider}::${model.id}`,
            title: model.name,
            description: model.description
                ? `${model.providerName} · ${model.description}`
                : model.providerName
        }))
    ), [availableModelsForProvider]);

    const handleSend = async () => {
        const draftToSend = messageDraft;
        if (!draftToSend.trim()) {
            return;
        }

        setMessageDraft('');
        try {
            if (!conversationId) {
                pendingMessageRef.current = draftToSend;
                await handleCreateConversation();
                return;
            }
            await handleSendMessage(draftToSend);
        } catch {
            pendingMessageRef.current = null;
            setMessageDraft(draftToSend);
        }
    };

    const shouldRenderStarterInput = !isMessagesLoading && messages.length === 0;

    const handleOpenTabularArtifact = (artifact: AIMessageArtifact) => {
        if (!conversationId) {
            return;
        }

        navigate(`/dashboard/ai/${conversationId}?artifactId=${encodeURIComponent(artifact.id)}`);
        setIsOpen(false);
    };

    const openAIPage = () => {
        navigate(conversationId ? `/dashboard/ai/${conversationId}` : '/dashboard/ai');
        setIsOpen(false);
    };

    return (
        <>
            <Tooltip content='Volt AI' placement='bottom'>
                <IconButton
                    className={`dashboard-ai-trigger ${isOpen ? 'is-active' : ''}`}
                    onClick={() => setIsOpen((current) => !current)}
                >
                    <IoSparklesOutline size={18} />
                </IconButton>
            </Tooltip>

            {isOpen && (
                <Container className='ai-floating-assistant glass-bg p-fixed bottom-1 right-1 z-20 d-flex column'>
                    <Container className='d-flex items-center content-between ai-floating-assistant-header'>
                        <Container className='d-flex items-center gap-025'>
                            <Tooltip content='New conversation' placement='top'>
                                <IconButton
                                    onClick={() => handleCreateConversation().catch(console.warn)}
                                    disabled={noProviderConfigured || isProviderCatalogLoading}
                                >
                                    <IoAddOutline size={16} />
                                </IconButton>
                            </Tooltip>

                            <Tooltip content='Open full AI page' placement='top'>
                                <IconButton onClick={openAIPage}>
                                    <IoExpandOutline size={16} />
                                </IconButton>
                            </Tooltip>

                            <Tooltip content='Close assistant' placement='top'>
                                <IconButton onClick={() => setIsOpen(false)}>
                                    <IoCloseOutline size={16} />
                                </IconButton>
                            </Tooltip>
                        </Container>
                    </Container>

                    {providerCatalogError && (
                        <Container className='ai-floating-assistant-alert'>
                            <Paragraph className='font-size-1 color-danger'>{providerCatalogError}</Paragraph>
                        </Container>
                    )}

                    {conversationsError && (
                        <Container className='ai-floating-assistant-alert'>
                            <Paragraph className='font-size-1 color-danger'>{conversationsError}</Paragraph>
                        </Container>
                    )}

                    {accessDenied ? (
                        <Container className='d-flex flex-center flex-1'>
                            <AccessDenied description={accessDeniedMessage} showBack={false} />
                        </Container>
                    ) : !selectedTeam?._id ? (
                        <Container className='d-flex flex-center flex-1'>
                            <EmptyState
                                title='No team selected'
                                description='Select a team to use the AI assistant.'
                            />
                        </Container>
                    ) : noProviderConfigured ? (
                        <Container className='d-flex flex-center flex-1'>
                            <EmptyState
                                title='No AI provider configured'
                                description='Enable at least one provider with a valid API key in team integrations.'
                                buttonText='Open integrations'
                                buttonOnClick={() => navigate('/dashboard/settings/integrations')}
                            />
                        </Container>
                    ) : (
                        <>
                            <AIConversationThread
                                conversationId={conversationId}
                                messages={messages}
                                isLoading={isMessagesLoading}
                                isResponding={isSendingMessage}
                                error={messagesError}
                                onOpenTableArtifact={handleOpenTabularArtifact}
                                addToolApprovalResponse={addToolApprovalResponse}
                                starterInput={shouldRenderStarterInput ? (
                                    <AIComposer
                                        value={messageDraft}
                                        modelOptions={modelOptions}
                                        selectedModel={selectedModel}
                                        onChange={setMessageDraft}
                                        onModelChange={setSelectedModel}
                                        onSend={handleSend}
                                        disabled={!canSendMessage || isProviderCatalogLoading || noProviderConfigured}
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
                                    disabled={!canSendMessage || isProviderCatalogLoading || noProviderConfigured}
                                    isSending={isSendingMessage}
                                    error={sendMessageError}
                                />
                            )}
                        </>
                    )}
                </Container>
            )}
        </>
    );
};

export default AIFloatingAssistantPanel;
