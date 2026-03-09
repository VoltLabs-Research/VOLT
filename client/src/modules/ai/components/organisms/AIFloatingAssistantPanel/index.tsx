import AIComposer from '@/modules/ai/components/organisms/AIComposer';
import AIConversationThread from '@/modules/ai/components/organisms/AIConversationThread';
import useAIPage from '@/modules/ai/hooks/use-ai-page';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import IconButton from '@/shared/presentation/components/IconButton';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IoAddOutline, IoCloseOutline, IoExpandOutline, IoSparklesOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
import type { SelectOption } from '@/shared/presentation/components/Select';
import type { ReactNode } from 'react';
import './AIFloatingAssistantPanel.css';

interface AIFloatingAssistantPanelContentProps {
    onClose: () => void;
};

const AIFloatingAssistantPanelContent = ({ onClose }: AIFloatingAssistantPanelContentProps) => {
    const navigate = useNavigate();
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
        loadConversations,
        loadProviderCatalog,
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
        if (!conversationId || !pendingMessageRef.current) return;

        const pendingMessage = pendingMessageRef.current;
        pendingMessageRef.current = null;

        handleSendMessage(pendingMessage).catch(() => {
            pendingMessageRef.current = pendingMessage;
            setMessageDraft(pendingMessage);
        });
    }, [conversationId, handleSendMessage]);

    const modelOptions: SelectOption[] = useMemo(() => {
        return availableModelsForProvider.map((model) => {
            let description = model.providerName;
            if (model.description) {
                description = `${model.providerName} · ${model.description}`;
            }

            return {
                value: `${model.provider}::${model.id}`,
                title: model.name,
                description
            };
        });
    }, [availableModelsForProvider]);

    const handleSend = async () => {
        const draftToSend = messageDraft;

        if (!draftToSend.trim()) {
            return;
        }

        setMessageDraft('');
        try {
            if (!conversationId) {
                pendingMessageRef.current = draftToSend;
                await handleCreateConversation(draftToSend);
                return;
            }

            await handleSendMessage(draftToSend);
        } catch {
            setMessageDraft(draftToSend);
        }
    };

    const shouldRenderStarterInput = !isMessagesLoading && messages.length === 0;

    const handleOpenTabularArtifact = (artifact: AIMessageArtifact) => {
        if (!conversationId) {
            return;
        }

        navigate(`/dashboard/ai/${conversationId}?artifactId=${encodeURIComponent(artifact.id)}`);
        onClose();
    };

    const openAIPage = () => {
        let targetPath = '/dashboard/ai';
        if (conversationId) {
            targetPath = `/dashboard/ai/${conversationId}`;
        }

        navigate(targetPath);
        onClose();
    };

    const handleRetry = () => {
        if (conversationId) {
            loadConversationMessages(conversationId).catch(console.warn);
        }
    };

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
                disabled={!canSendMessage || isProviderCatalogLoading || noProviderConfigured}
                isSending={isSendingMessage}
                error={sendMessageError}
            />
        );
    }

    let content: ReactNode = (
        <>
            <AIConversationThread
                conversationId={conversationId}
                messages={messages}
                isLoading={isMessagesLoading}
                isResponding={isSendingMessage}
                error={messagesError}
                onOpenTableArtifact={handleOpenTabularArtifact}
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
                    disabled={!canSendMessage || isProviderCatalogLoading || noProviderConfigured}
                    isSending={isSendingMessage}
                    error={sendMessageError}
                />
            )}
        </>
    );

    if (accessDenied) {
        content = (
            <Container className='d-flex flex-center flex-1'>
                <RecoveryState
                    title='Access denied'
                    description={accessDeniedMessage ?? 'You do not have permission to use the AI assistant.'}
                    tone={RecoveryStateTone.AccessDenied}
                />
            </Container>
        );
    } else if (!selectedTeam?._id) {
        content = (
            <Container className='d-flex flex-center flex-1'>
                <EmptyState
                    title='No team selected'
                    description='Select a team to use the AI assistant.'
                />
            </Container>
        );
    } else if (noProviderConfigured) {
        content = (
            <Container className='d-flex flex-center flex-1'>
                <EmptyState
                    title='No AI provider configured'
                    description='Enable at least one provider with a valid API key in team integrations.'
                    buttonText='Open integrations'
                    buttonOnClick={() => navigate('/dashboard/settings/integrations')}
                />
            </Container>
        );
    }

    return (
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
                        <IconButton onClick={onClose}>
                            <IoCloseOutline size={16} />
                        </IconButton>
                    </Tooltip>
                </Container>
            </Container>

            {providerCatalogError && (
                <Container className='ai-floating-assistant-alert'>
                    <RecoveryState
                        title='Unable to load AI providers'
                        description={providerCatalogError}
                        tone={RecoveryStateTone.Error}
                        onRetry={() => {
                            loadProviderCatalog().catch(() => undefined);
                        }}
                    />
                </Container>
            )}

            {conversationsError && (
                <Container className='ai-floating-assistant-alert'>
                    <RecoveryState
                        title='Unable to load conversations'
                        description={conversationsError}
                        tone={RecoveryStateTone.Error}
                        onRetry={() => {
                            loadConversations().catch(() => undefined);
                        }}
                    />
                </Container>
            )}

            {content}
        </Container>
    );
};

const AIFloatingAssistantPanel = () => {
    const [isOpen, setIsOpen] = useState(false);
    let triggerClassName = 'dashboard-ai-trigger';

    if (isOpen) {
        triggerClassName = 'dashboard-ai-trigger is-active';
    }

    let panelContent: ReactNode = null;
    if (isOpen) {
        panelContent = <AIFloatingAssistantPanelContent onClose={() => setIsOpen(false)} />;
    }

    return (
        <>
            <Tooltip content='Volt AI' placement='bottom'>
                <IconButton
                    className={triggerClassName}
                    onClick={() => setIsOpen((current) => !current)}
                >
                    <IoSparklesOutline size={18} />
                </IconButton>
            </Tooltip>

            {panelContent}
        </>
    );
};

export default AIFloatingAssistantPanel;
