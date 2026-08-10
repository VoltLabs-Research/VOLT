import useAIConversationPanel from '@/modules/ai/components/AIConversationPanelContent/use-shared-ai-conversation-panel';
import AIConversationAlerts from '@/modules/ai/components/AIConversationPanelContent/AIConversationAlerts';
import { useChatSurfaceStore } from '@/modules/ai/store/use-chat-surface-store';
import { IconButton, Tooltip } from '@voltstack/bravais';
import PanelHeader from '@/shared/ui/components/PanelHeader';
import { useCallback, useEffect, useId, useRef } from 'react';
import { Expand, Plus, Sparkles } from 'lucide-react';
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
        <div className='flex flex-row items-center gap-1'>
            <Tooltip content='New conversation' placement='top'>
                <IconButton
                    aria-label='Start new conversation'
                    onClick={() => handleCreateConversation().catch(console.warn)}
                    disabled={noProviderConfigured || isProviderCatalogLoading}
                >
                    <Plus size={16} />
                </IconButton>
            </Tooltip>

            <Tooltip content='Open full AI page' placement='top'>
                <IconButton aria-label='Open full AI page' onClick={openAIPage}>
                    <Expand size={16} />
                </IconButton>
            </Tooltip>
        </div>
    );

    return (
        <div className='bg-surface border border-border flex flex-col fixed bottom-4 right-4 z-20 ai-floating-assistant' ref={panelRef} role='dialog' aria-modal='false' aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} onKeyDown={handlePanelKeyDown}>
            <span className='sr-only' id={titleId}>Volt AI assistant</span>
            <span className='sr-only' id={descriptionId}>
                Floating assistant dialog. Press Escape to close. Tab moves between controls inside the dialog.
            </span>
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
        </div>
    );
};

const AIFloatingAssistantPanel = () => {
    const isOpen = useChatSurfaceStore((state) => state.isWidgetOpen);
    const closeWidget = useChatSurfaceStore((state) => state.closeWidget);
    const toggleWidget = useChatSurfaceStore((state) => state.toggleWidget);
    const triggerRef = useRef<HTMLButtonElement>(null);
    let triggerClassName = 'dashboard-ai-trigger';

    if (isOpen) {
        triggerClassName = 'dashboard-ai-trigger is-active';
    }

    let panelContent: ReactNode = null;
    if (isOpen) {
        panelContent = (
            <AIFloatingAssistantPanelContent
                onClose={closeWidget}
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
                    onClick={toggleWidget}
                >
                    <Sparkles size={18} />
                </IconButton>
            </Tooltip>

            {panelContent}
        </>
    );
};

export default AIFloatingAssistantPanel;
