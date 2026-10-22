import AIArtifactSpreadsheetPanel from '@/modules/ai/components/AIArtifactSpreadsheetPanel';
import AIConversationPanelContent from '@/modules/ai/components/AIConversationPanelContent';
import ResizeHandle from '@/modules/canvas/components/ResizeHandle';
import useResizable from '@/modules/canvas/hooks/use-resizable';
import useConversations from '@/modules/ai/hooks/use-conversations';
import { useChatSurfaceStore } from '@/modules/ai/store/use-chat-surface-store';
import useTip from '@/shared/tips/use-tip';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DASHBOARD_LAYOUT_EVENTS } from '@/modules/dashboard/utils/layout-events';
import type { AITableArtifact } from '@/modules/ai/contracts/artifacts';
import type { ActiveConversation } from '@/modules/ai/store/use-chat-surface-store';
import type { AIConversation } from '@volt/contracts/modules/ai/domain';
import type { Params } from 'react-router-dom';

interface AIPageRouteParams extends Params {
    conversationId?: string;
}

const AIPage = () => {
    useTip('ai-spreadsheet-panel');

    const navigate = useNavigate();
    const { conversationId } = useParams<AIPageRouteParams>();
    const { teamId, conversations } = useConversations();
    const active = useChatSurfaceStore((state) => state.active);
    const setActive = useChatSurfaceStore((state) => state.setActive);
    const artifact = useChatSurfaceStore((state) => state.artifact);
    const showArtifact = useChatSurfaceStore((state) => state.showArtifact);
    const closeArtifact = useChatSurfaceStore((state) => state.closeArtifact);
    const didCollapseSidebar = useRef(false);

    const spreadsheetPanel = useResizable({
        direction: 'horizontal',
        initialSize: 520,
        minSize: 320,
        maxSize: 900,
        growPositive: false
    });

    // The route names the conversation; the team that owns it comes from the listing, from whoever
    // opened it, or else the selected team, under which a new conversation was just created.
    const conversation = useMemo<ActiveConversation | null>(() => {
        if (!conversationId) return null;

        const owner = conversations.find((listed) => listed._id === conversationId)?.teamId
            ?? (active?.conversationId === conversationId ? active.teamId : teamId);

        return owner
            ? {
                conversationId,
                teamId: owner
            }
            : null;
    }, [active, conversationId, conversations, teamId]);

    // The page follows its route and hands the conversation to the floating panel; a conversation
    // the panel switches to while the page is open becomes the route.
    const lastActiveId = useRef(active?.conversationId ?? null);
    useEffect(() => {
        const activeId = active?.conversationId ?? null;
        const panelSwitched = lastActiveId.current !== activeId;
        lastActiveId.current = activeId;

        if ((conversationId ?? null) === activeId) {
            if (conversation !== null) setActive(conversation);
            return;
        }

        if (panelSwitched) {
            navigate(activeId ? `/dashboard/ai/${activeId}` : '/dashboard/ai');
            return;
        }

        setActive(conversation);
    }, [active, conversation, conversationId, navigate, setActive]);

    const handleStarted = useCallback((started: AIConversation) => {
        navigate(`/dashboard/ai/${started._id}`);
    }, [navigate]);

    const handleOpenTableArtifact = useCallback((opened: AITableArtifact) => {
        showArtifact(opened);
        didCollapseSidebar.current = true;
        window.dispatchEvent(new CustomEvent(DASHBOARD_LAYOUT_EVENTS.requestSidebarCollapse));
    }, [showArtifact]);

    const handleCloseArtifactPanel = useCallback(() => {
        closeArtifact();
        if (didCollapseSidebar.current) {
            window.dispatchEvent(new CustomEvent(DASHBOARD_LAYOUT_EVENTS.requestSidebarExpand));
            didCollapseSidebar.current = false;
        }
    }, [closeArtifact]);

    useEffect(() => () => {
        if (didCollapseSidebar.current) {
            window.dispatchEvent(new CustomEvent(DASHBOARD_LAYOUT_EVENTS.requestSidebarExpand));
        }
    }, []);

    // A table opened from the floating panel arrives with the page; one left from another
    // conversation does not stay open over this one.
    const shownConversationId = useRef(conversationId);
    useEffect(() => {
        if (shownConversationId.current === conversationId) return;

        shownConversationId.current = conversationId;
        handleCloseArtifactPanel();
    }, [conversationId, handleCloseArtifactPanel]);

    return (
        <div className='flex h-full min-w-0 flex-col overflow-hidden'>
            <div className='flex min-h-0 flex-1 flex-row items-stretch max-md:flex-col'>
                <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
                    <AIConversationPanelContent
                        conversation={conversation}
                        teamId={teamId}
                        onStarted={handleStarted}
                        onOpenTableArtifact={handleOpenTableArtifact}
                    />
                </div>

                {artifact && (
                    <>
                        <ResizeHandle
                            direction='horizontal'
                            isDragging={spreadsheetPanel.isDragging}
                            label='Resize spreadsheet panel'
                            controls='ai-artifact-spreadsheet-panel'
                            {...spreadsheetPanel.handleProps}
                        />
                        <div className='flex' id='ai-artifact-spreadsheet-panel'>
                            <AIArtifactSpreadsheetPanel
                                key={artifact.id}
                                artifact={artifact}
                                onClose={handleCloseArtifactPanel}
                                width={spreadsheetPanel.size}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AIPage;
