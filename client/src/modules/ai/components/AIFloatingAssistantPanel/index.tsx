import useAIConversationPanel from '@/modules/ai/components/AIConversationPanelContent/use-ai-conversation-panel';
import AIConversationAlerts from '@/modules/ai/components/AIConversationPanelContent/AIConversationAlerts';
import VisuallyHidden from '@/shared/presentation/primitives/VisuallyHidden';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import IconButton from '@/shared/presentation/primitives/IconButton';
import Row from '@/shared/presentation/primitives/Row';
import Surface from '@/shared/presentation/primitives/Surface';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { IoAddOutline, IoExpandOutline, IoSparklesOutline } from 'react-icons/io5';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import './AIFloatingAssistantPanel.css';
interface AIFloatingAssistantPanelContentProps {
    onClose: () => void;
    triggerRef: RefObject<HTMLButtonElement | null>;
}

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
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const descriptionId = useId();

    const {
        conversationsError,
        providerCatalogError,
        noProviderConfigured,
        loadConversations,
        loadProviderCatalog,
        handleCreateConversation,
        isProviderCatalogLoading,
        openAIPage,
        conversationPanelContent
    } = useAIConversationPanel({ onNavigateAway: onClose });

    useEffect(() => {
        const focusableElements = getFocusableElements(panelRef.current);
        const target = focusableElements[0] ?? panelRef.current;

        target?.focus();

        return () => {
            triggerRef.current?.focus();
        };
    }, [triggerRef]);

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

            <AIConversationAlerts
                className='ai-floating-assistant-alert'
                providerCatalogError={providerCatalogError}
                conversationsError={conversationsError}
                loadProviderCatalog={loadProviderCatalog}
                loadConversations={loadConversations}
            />

            {conversationPanelContent}
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
