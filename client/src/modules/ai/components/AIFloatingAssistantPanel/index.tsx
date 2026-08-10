import useAIConversationPanel from '@/modules/ai/components/AIConversationPanelContent/use-shared-ai-conversation-panel';
import AIConversationAlerts from '@/modules/ai/components/AIConversationPanelContent/AIConversationAlerts';
import { useChatSurfaceStore } from '@/modules/ai/store/use-chat-surface-store';
import { Button, Tooltip, cn } from '@heroui/react';
import PanelHeader from '@/shared/ui/components/PanelHeader';
import { useCallback, useEffect, useId, useRef } from 'react';
import { Expand, Plus, Sparkles } from 'lucide-react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';

/**
 * `ai-floating-assistant` is the one class name in this file that MUST stay on the DOM: the
 * composer and the thread re-express this sheet's descendant overrides as
 * `[.ai-floating-assistant_&]:` variants, and that selector is what keeps them winning
 * against the components' own utilities.
 *
 * The entrance animation is the old `ai-floating-assistant-in` keyframes expressed through
 * tw-animate-css, which HeroUI already imports. `slide-in-from-bottom-2` is exactly the
 * 8px the keyframes translated, `zoom-in-95` is within a percent of their 0.96, and
 * `ease-out-fluid` IS `cubic-bezier(.32, .72, 0, 1)` — the same curve, by token. The
 * sheet's own reduced-motion opt-out is now the global one in `index.css`.
 */
const PANEL = 'ai-floating-assistant fixed z-[80] flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--overlay-shadow)] h-[min(640px,calc(100dvh-6rem))] w-[min(420px,calc(100vw-2rem))] right-[max(1rem,env(safe-area-inset-right,0px))] bottom-[max(1rem,env(safe-area-inset-bottom,0px))] origin-bottom-right animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-[180ms] ease-out-fluid max-md:h-[min(72vh,calc(100dvh-5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))] max-md:w-[calc(100vw-max(1rem,env(safe-area-inset-left,0px)+env(safe-area-inset-right,0px)))] max-md:right-[max(0.5rem,env(safe-area-inset-right,0px))] max-md:bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))]';

const PANEL_ALERT = 'border-b border-border bg-danger-soft px-3 py-2';

/**
 * `.dashboard-ai-trigger` carries no styling of its own any more, but it stays on the DOM:
 * `modules/dashboard/components/DashboardHeader/DashboardHeader.css` still names it inside a
 * `:not()` list, and that sheet is another agent's to migrate.
 */
const TRIGGER = 'dashboard-ai-trigger';

/** `.dashboard-ai-trigger.is-active` — the accent is the foreground, over a soft info fill. */
const TRIGGER_ACTIVE = 'is-active bg-info-soft text-foreground';

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
            <Tooltip>
                <Button
                    isIconOnly
                    variant='ghost'
                    aria-label='Start new conversation'
                    onPress={() => handleCreateConversation().catch(console.warn)}
                    isDisabled={noProviderConfigured || isProviderCatalogLoading}
                >
                    <Plus size={16} />
                </Button>
                <Tooltip.Content placement='top'>New conversation</Tooltip.Content>
            </Tooltip>

            <Tooltip>
                <Button isIconOnly variant='ghost' aria-label='Open full AI page' onPress={openAIPage}>
                    <Expand size={16} />
                </Button>
                <Tooltip.Content placement='top'>Open full AI page</Tooltip.Content>
            </Tooltip>
        </div>
    );

    return (
        <div className={PANEL} ref={panelRef} role='dialog' aria-modal='false' aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} onKeyDown={handlePanelKeyDown}>
            <span className='sr-only' id={titleId}>Volt AI assistant</span>
            <span className='sr-only' id={descriptionId}>
                Floating assistant dialog. Press Escape to close. Tab moves between controls inside the dialog.
            </span>
            <PanelHeader
                actions={headerActions}
                onClose={onClose}
            />

            <AIConversationAlerts
                className={PANEL_ALERT}
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
    const triggerClassName = cn(TRIGGER, isOpen && TRIGGER_ACTIVE);

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
            <Tooltip>
                <Button
                    ref={triggerRef}
                    isIconOnly
                    variant='ghost'
                    aria-label={isOpen ? 'Close Volt AI assistant' : 'Open Volt AI assistant'}
                    className={triggerClassName}
                    onPress={toggleWidget}
                >
                    <Sparkles size={18} />
                </Button>
                <Tooltip.Content placement='bottom'>Volt AI</Tooltip.Content>
            </Tooltip>

            {panelContent}
        </>
    );
};

export default AIFloatingAssistantPanel;
