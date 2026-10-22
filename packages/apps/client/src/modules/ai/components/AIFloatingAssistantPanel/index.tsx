import AIConversationPanelContent from '@/modules/ai/components/AIConversationPanelContent';
import { useChatSurfaceStore } from '@/modules/ai/store/use-chat-surface-store';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { Button, Tooltip } from '@heroui/react';
import PanelHeader from '@/shared/ui/components/PanelHeader';
import { FOCUSABLE_BASE_SELECTOR } from '@/shared/ui/utils/focusable';
import { useCallback, useEffect, useId, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Expand, Plus, Sparkles } from 'lucide-react';
import type { AITableArtifact } from '@/modules/ai/contracts/artifacts';
import type { AIConversation } from '@volt/contracts/modules/ai/domain';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';

interface AIFloatingAssistantPanelContentProps {
    onClose: () => void;
    triggerRef: RefObject<HTMLButtonElement | null>;
}

const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
    if (!container) {
        return [];
    }

    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_BASE_SELECTOR))
        .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
};

const AIFloatingAssistantPanelContent = ({ onClose, triggerRef }: AIFloatingAssistantPanelContentProps) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const descriptionId = useId();
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const active = useChatSurfaceStore((state) => state.active);
    const setActive = useChatSurfaceStore((state) => state.setActive);
    const showArtifact = useChatSurfaceStore((state) => state.showArtifact);
    const conversationId = active?.conversationId ?? null;

    const openAIPage = useCallback(() => {
        navigate(conversationId ? `/dashboard/ai/${conversationId}` : '/dashboard/ai');
        onClose();
    }, [conversationId, navigate, onClose]);

    // A spreadsheet needs the room of the AI page: the table opens there, beside the conversation.
    const handleOpenTableArtifact = useCallback((artifact: AITableArtifact) => {
        showArtifact(artifact);
        openAIPage();
    }, [openAIPage, showArtifact]);

    const handleStarted = useCallback((conversation: AIConversation) => {
        setActive({
            conversationId: conversation._id,
            teamId: conversation.teamId
        });
    }, [setActive]);

    useEffect(() => {
        const triggerElement = triggerRef.current;
        const focusableElements = getFocusableElements(panelRef.current);
        const target = focusableElements[0] ?? panelRef.current;

        target?.focus();

        return () => {
            triggerElement?.focus();
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
                    onPress={() => setActive(null)}
                    isDisabled={conversationId === null}
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
        <div className='ai-floating-assistant glass-surface fixed z-[80] flex flex-col overflow-hidden rounded-3xl bg-overlay shadow-overlay h-[min(38rem,calc(100dvh-6rem))] w-[min(26rem,calc(100vw-2rem))] right-[max(1rem,env(safe-area-inset-right,0px))] bottom-[max(1rem,env(safe-area-inset-bottom,0px))] origin-bottom-right animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-[180ms] ease-out-fluid max-md:h-[min(72vh,calc(100dvh-5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))] max-md:w-[calc(100vw-max(1rem,env(safe-area-inset-left,0px)+env(safe-area-inset-right,0px)))] max-md:right-[max(0.5rem,env(safe-area-inset-right,0px))] max-md:bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))]' ref={panelRef} role='dialog' aria-modal='false' aria-label='Volt AI assistant' aria-describedby={descriptionId} tabIndex={-1} onKeyDown={handlePanelKeyDown}>
            <span className='sr-only' id={descriptionId}>
                Floating assistant dialog. Press Escape to close. Tab moves between controls inside the dialog.
            </span>
            <PanelHeader
                title='Volt AI'
                actions={headerActions}
                onClose={onClose}
            />
            <AIConversationPanelContent
                conversation={active}
                teamId={teamId}
                onStarted={handleStarted}
                onOpenTableArtifact={handleOpenTableArtifact}
            />
        </div>
    );
};

interface AIFloatingAssistantPanelProps {
    // A trigger sized for a toolbar of small icon buttons, as the canvas has.
    compact?: boolean;
}

const AIFloatingAssistantPanel = ({ compact = false }: AIFloatingAssistantPanelProps) => {
    const isOpen = useChatSurfaceStore((state) => state.isWidgetOpen);
    const closeWidget = useChatSurfaceStore((state) => state.closeWidget);
    const toggleWidget = useChatSurfaceStore((state) => state.toggleWidget);
    const triggerRef = useRef<HTMLButtonElement>(null);

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
                    size={compact ? 'sm' : undefined}
                    aria-label={isOpen ? 'Close Volt AI assistant' : 'Open Volt AI assistant'}
                    className={isOpen ? 'bg-foreground/8 text-foreground' : undefined}
                    onPress={toggleWidget}
                >
                    <Sparkles size={compact ? 14 : 18} aria-hidden='true' />
                </Button>
                <Tooltip.Content placement='bottom'>Volt AI</Tooltip.Content>
            </Tooltip>

            {panelContent}
        </>
    );
};

export default AIFloatingAssistantPanel;
