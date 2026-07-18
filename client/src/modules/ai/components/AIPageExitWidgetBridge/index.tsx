import { useAIChatContext } from '@/modules/ai/providers/AIChatProvider';
import { useChatSurfaceStore } from '@/modules/ai/stores/use-chat-surface-store';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const AI_PAGE_PREFIX = '/dashboard/ai';

const isAIPagePath = (pathname: string): boolean => {
    return pathname === AI_PAGE_PREFIX || pathname.startsWith(`${AI_PAGE_PREFIX}/`);
};

const AIPageExitWidgetBridge = () => {
    const { pathname } = useLocation();
    const { activeConversationId } = useAIChatContext();
    const openWidget = useChatSurfaceStore((state) => state.openWidget);
    const wasOnAIPage = useRef(isAIPagePath(pathname));

    useEffect(() => {
        const onAIPage = isAIPagePath(pathname);

        if (wasOnAIPage.current && !onAIPage && activeConversationId) {
            openWidget();
        }

        wasOnAIPage.current = onAIPage;
    }, [pathname, activeConversationId, openWidget]);

    return null;
};

export default AIPageExitWidgetBridge;
