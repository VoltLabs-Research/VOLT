import { useAIChatContext } from '@/modules/ai/providers/AIChatProvider';
import { useChatSurfaceStore } from '@/modules/ai/stores/use-chat-surface-store';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const AI_PAGE_PREFIX = '/dashboard/ai';

const isAIPagePath = (pathname: string): boolean => {
    return pathname === AI_PAGE_PREFIX || pathname.startsWith(`${AI_PAGE_PREFIX}/`);
};

/**
 * Continuity bridge for the AI assistant: when the user navigates AWAY from the
 * full AI page (`/dashboard/ai/:id`) while a conversation is active, pop open
 * the floating widget so the same conversation stays at hand on the next page.
 *
 * The widget and the page share the hoisted `AIChatProvider`, so the widget
 * already renders `activeConversationId` — we only need to surface it. Renders
 * nothing; it just runs the effect. Must be mounted inside `AIChatProvider`.
 */
const AIPageExitWidgetBridge = () => {
    const { pathname } = useLocation();
    const { activeConversationId } = useAIChatContext();
    const openWidget = useChatSurfaceStore((state) => state.openWidget);
    const wasOnAIPage = useRef(isAIPagePath(pathname));

    useEffect(() => {
        const onAIPage = isAIPagePath(pathname);

        // Transition out of the AI page → carry the active conversation into the
        // widget. Only when there's actually a conversation to carry.
        if (wasOnAIPage.current && !onAIPage && activeConversationId) {
            openWidget();
        }

        wasOnAIPage.current = onAIPage;
    }, [pathname, activeConversationId, openWidget]);

    return null;
};

export default AIPageExitWidgetBridge;
