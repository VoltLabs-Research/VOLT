import AIComposer from '@/modules/ai/components/AIComposer';
import AIConversationThread from '@/modules/ai/components/AIConversationThread';
import useAIPage from '@/modules/ai/hooks/use-ai-page';
import EmptyState from '@/shared/presentation/primitives/EmptyState';
import VisuallyHidden from '@/shared/presentation/primitives/VisuallyHidden';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import Box from '@/shared/presentation/primitives/Box';
import IconButton from '@/shared/presentation/primitives/IconButton';
import Row from '@/shared/presentation/primitives/Row';
import Surface from '@/shared/presentation/primitives/Surface';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { IoAddOutline, IoExpandOutline, IoSparklesOutline } from 'react-icons/io5';
import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
import type { SelectOption } from '@/shared/presentation/primitives/Select';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import './AIFloatingAssistantPanel.css';
import { useNavigate } from 'react-router-dom';
interface AIFloatingAssistantPanelContentProps {
    onClose: () => void;
    triggerRef: RefObject<HTMLButtonElement | null>;
};

const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
    if (!container) {
        return [];
    }

    const focusableSelector = [
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
};

const AIFloatingAssistantPanelContent = ({ onClose, triggerRef }: AIFloatingAssistantPanelContentProps) => {
    const navigate = useNavigate();
    const [conversationId, setConversationId] = useState<string | undefined>();
    const [messageDraft, setMessageDraft] = useState('');
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const descriptionId = useId();

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
        if (!conversationId) return;

        const pendingMessage = sessionStorage.getItem('volt:ai:pending-message');
        if (!pendingMessage) return;

        sessionStorage.removeItem('volt:ai:pending-message');

        handleSendMessage(pendingMessage).catch(() => {
            sessionStorage.setItem('volt:ai:pending-message', pendingMessage);
            setMessageDraft(pendingMessage);
        });
    }, [conversationId, handleSendMessage]);

    useEffect(() => {
        const focusableElements = getFocusableElements(panelRef.current);
        const target = focusableElements[0] ?? panelRef.current;

        target?.focus();

        return () => {
            triggerRef.current?.focus();
        };
    }, [triggerRef]);

    const modelOptions: SelectOption[] = useMemo(() => {
        return availableModelsForProvider.map((model) => ({
            value: `${model.provider}::${model.id}`,
            title: model.name,
            description: model.providerName
        }));
    }, [availableModelsForProvider]);

    const handleSend = async () => {
        const draftToSend = messageDraft;

        if (!draftToSend.trim()) {
            return;
        }

        setMessageDraft('');
        try {
            if (!conversationId) {
                sessionStorage.setItem('volt:ai:pending-message', draftToSend);
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

    const handlePanelKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
            return;
        }

        if (event.key !== 'Tab') {
            return;
        }

        const focusableElements = getFocusableElements(panelRef.current);
        if (focusableElements.length === 0) {
            event.preventDefault();
            panelRef.current?.focus();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (event.shiftKey && activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        }

        if (!event.shiftKey && activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    }, [onClose]);

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
            <Box display='flex' flex='1' className='flex-center'>
                <RecoveryState
                    title='Access denied'
                    description={accessDeniedMessage ?? 'You do not have permission to use the AI assistant.'}
                    tone={RecoveryStateTone.AccessDenied}
                />
            </Box>
        );
    } else if (!selectedTeam?._id) {
        content = (
            <Box display='flex' flex='1' className='flex-center'>
                <EmptyState
                    title='No team selected'
                    description='Select a team to use the AI assistant.'
                />
            </Box>
        );
    } else if (noProviderConfigured) {
        content = (
            <Box display='flex' flex='1' className='flex-center'>
                <EmptyState
                    title='No AI provider configured'
                    description='Enable at least one provider with a valid API key in team integrations.'
                    buttonText='Open integrations'
                    buttonOnClick={() => navigate('/dashboard/settings/integrations')}
                />
            </Box>
        );
    }

    const headerActions = (
        <Row gap='025'>
            <Tooltip content='New conversation' placement='top'>
                <IconButton
                    aria-label='Start new conversation'
                    onClick={() => handleCreateConversation().catch(console.warn)}
                    disabled={noProviderConfigured || isProviderCatalogLoading}
                >
                    <IoAddOutline size={16} />
                </IconButton>
            </Tooltip>

            <Tooltip content='Open full AI page' placement='top'>
                <IconButton aria-label='Open full AI page' onClick={openAIPage}>
                    <IoExpandOutline size={16} />
                </IconButton>
            </Tooltip>
        </Row>
    );

    return (
        <Surface ref={panelRef} variant='glass' display='flex' direction='column' position='fixed' bottom='1' right='1' zIndex='20' className='ai-floating-assistant' role='dialog' aria-modal='false' aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} onKeyDown={handlePanelKeyDown}>
            <VisuallyHidden id={titleId}>Volt AI assistant</VisuallyHidden>
            <VisuallyHidden id={descriptionId}>
                Floating assistant dialog. Press Escape to close. Tab moves between controls inside the dialog.
            </VisuallyHidden>
            <PanelHeader
                actions={headerActions}
                onClose={onClose}
                className='ai-floating-assistant-header'
            />

            {providerCatalogError && (
                <Box className='ai-floating-assistant-alert'>
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

            {conversationsError && (
                <Box className='ai-floating-assistant-alert'>
                    <RecoveryState
                        title='Unable to load conversations'
                        description={conversationsError}
                        tone={RecoveryStateTone.Error}
                        onRetry={() => {
                            loadConversations().catch(() => undefined);
                        }}
                    />
                </Box>
            )}

            {content}
        </Surface>
    );
};

const AIFloatingAssistantPanel = () => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    let triggerClassName = 'dashboard-ai-trigger';

    if (isOpen) {
        triggerClassName = 'dashboard-ai-trigger is-active';
    }

    let panelContent: ReactNode = null;
    if (isOpen) {
        panelContent = (
            <AIFloatingAssistantPanelContent
                onClose={() => setIsOpen(false)}
                triggerRef={triggerRef}
            />
        );
    }

    return (
        <>
            <Tooltip content='Volt AI' placement='bottom'>
                <IconButton
                    ref={triggerRef}
                    aria-label={isOpen ? 'Close Volt AI assistant' : 'Open Volt AI assistant'}
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
