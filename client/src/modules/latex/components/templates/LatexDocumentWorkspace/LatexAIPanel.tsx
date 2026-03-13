import AIComposer from '@/modules/ai/components/organisms/AIComposer';
import AIConversationThread from '@/modules/ai/components/organisms/AIConversationThread';
import useAIPage from '@/modules/ai/hooks/use-ai-page';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import IconButton from '@/shared/presentation/components/IconButton';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoAddOutline, IoCloseOutline, IoExpandOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
import type { SelectOption } from '@/shared/presentation/components/Select';
import type { ReactNode } from 'react';

interface LatexAIPanelProps {
    documentId: string;
    documentTitle: string;
    width?: number;
    height?: number;
    onClose: () => void;
};

const buildDocumentContext = (documentId: string, documentTitle: string): string =>
    `[Context: LaTeX document "${documentTitle}", documentId: ${documentId}]\n\n`;

const LatexAIPanel = ({ documentId, documentTitle, width, height, onClose }: LatexAIPanelProps) => {
    const navigate = useNavigate();
    const [conversationId, setConversationId] = useState<string | undefined>();
    const [messageDraft, setMessageDraft] = useState('');
    const contextInjectedRef = useRef(false);

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

    // Reset context injection flag when conversation changes
    useEffect(() => {
        contextInjectedRef.current = !!conversationId;
    }, [conversationId]);

    useEffect(() => {
        if (!conversationId) return;

        const pendingMessage = sessionStorage.getItem('volt:ai:pending-message');
        if (!pendingMessage) return;

        sessionStorage.removeItem('volt:ai:pending-message');

        handleSendMessage(pendingMessage).catch(() => {
            sessionStorage.setItem('volt:ai:pending-message', pendingMessage);
            setMessageDraft(pendingMessage);
        });
    }, [conversationId, handleSendMessage]);

    const modelOptions: SelectOption[] = useMemo(() => {
        return availableModelsForProvider.map((model) => ({
            value: `${model.provider}::${model.id}`,
            title: model.name,
            description: model.providerName
        }));
    }, [availableModelsForProvider]);

    const prependContext = useCallback((text: string): string => {
        if (contextInjectedRef.current) return text;
        contextInjectedRef.current = true;
        return `${buildDocumentContext(documentId, documentTitle)}${text}`;
    }, [documentId, documentTitle]);

    const handleSend = useCallback(async () => {
        const rawDraft = messageDraft.trim();
        if (!rawDraft) return;

        setMessageDraft('');

        try {
            if (!conversationId) {
                const contextualMessage = prependContext(rawDraft);
                sessionStorage.setItem('volt:ai:pending-message', contextualMessage);
                await handleCreateConversation(rawDraft);
                return;
            }

            await handleSendMessage(prependContext(rawDraft));
        } catch {
            setMessageDraft(rawDraft);
        }
    }, [conversationId, handleCreateConversation, handleSendMessage, messageDraft, prependContext]);

    const handleNewConversation = useCallback(() => {
        contextInjectedRef.current = false;
        setConversationId(undefined);
        setMessageDraft('');
    }, []);

    const shouldRenderStarterInput = !isMessagesLoading && messages.length === 0;

    const handleOpenTabularArtifact = useCallback((artifact: AIMessageArtifact) => {
        if (!conversationId) return;
        navigate(`/dashboard/ai/${conversationId}?artifactId=${encodeURIComponent(artifact.id)}`);
        onClose();
    }, [conversationId, navigate, onClose]);

    const openAIPage = useCallback(() => {
        const targetPath = conversationId
            ? `/dashboard/ai/${conversationId}`
            : '/dashboard/ai';
        navigate(targetPath);
        onClose();
    }, [conversationId, navigate, onClose]);

    const handleRetry = useCallback(() => {
        if (conversationId) {
            loadConversationMessages(conversationId).catch(console.warn);
        }
    }, [conversationId, loadConversationMessages]);

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
        <Container className='latex-ai-panel d-flex column' style={{ width, height }}>
            <Container className='latex-ai-panel__header d-flex items-center content-between'>
                <Container className='d-flex items-center gap-025'>
                    <Tooltip content='New conversation' placement='top'>
                        <IconButton
                            variant='ghost'
                            size='sm'
                            onClick={handleNewConversation}
                            disabled={noProviderConfigured || isProviderCatalogLoading}
                        >
                            <IoAddOutline size={16} />
                        </IconButton>
                    </Tooltip>

                    <Tooltip content='Open full AI page' placement='top'>
                        <IconButton variant='ghost' size='sm' onClick={openAIPage}>
                            <IoExpandOutline size={16} />
                        </IconButton>
                    </Tooltip>
                </Container>

                <Tooltip content='Close AI panel' placement='top'>
                    <IconButton variant='ghost' size='sm' onClick={onClose}>
                        <IoCloseOutline size={16} />
                    </IconButton>
                </Tooltip>
            </Container>

            {providerCatalogError && (
                <Container className='latex-ai-panel__alert'>
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
                <Container className='latex-ai-panel__alert'>
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

export default LatexAIPanel;
