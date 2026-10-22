import { Button, Tooltip } from '@heroui/react';
import { Download, LayoutGrid } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { MAX_VIEWPORT_PANES } from '@/modules/canvas/store/editor/model-slice';
import ScreenshotMenuPopover from '../ScreenshotMenuPopover';
import useDownloadAnalysisListings from '../../hooks/use-download-analysis-listings';

// Loaded on its own: most visits to the canvas never open the assistant.
const AIFloatingAssistantPanel = lazy(() => import('@/modules/ai/components/AIFloatingAssistantPanel'));

interface CanvasToolbarActionsProps {
    analysisId?: string;
    canDownloadAnalysis: boolean;
}

const CanvasToolbarActions = ({ analysisId, canDownloadAnalysis }: CanvasToolbarActionsProps) => {
    const { download, isDownloading } = useDownloadAnalysisListings();
    const paneCount = useEditorStore((state) => state.viewportPanes.length);
    const addViewportPane = useEditorStore((state) => state.addViewportPane);
    // A shared trajectory opens to anyone; the assistant is for those signed in to a team.
    const isSignedIn = Boolean(useCurrentUser());

    return (
        <div className='flex flex-row items-center gap-1'>
            <Tooltip>
                <Button
                    variant='ghost'
                    size='sm'
                    isIconOnly
                    aria-label='Add scene pane'
                    isDisabled={paneCount >= MAX_VIEWPORT_PANES}
                    onPress={() => addViewportPane()}
                >
                    <LayoutGrid size={14} aria-hidden='true' />
                </Button>
                <Tooltip.Content placement='bottom'>
                    {paneCount >= MAX_VIEWPORT_PANES ? 'Maximum of 4 scene panes' : 'Add empty scene pane'}
                </Tooltip.Content>
            </Tooltip>
            <ScreenshotMenuPopover />
            {canDownloadAnalysis && analysisId && (
                <Tooltip>
                    <Button
                        variant='ghost'
                        size='sm'
                        isIconOnly
                        aria-label='Download analysis'
                        isPending={isDownloading}
                        onPress={() => void download({ analysisId })}
                    >
                        <Download size={14} aria-hidden='true' />
                    </Button>
                    <Tooltip.Content placement='bottom'>Download every listing and sub-listing as CSV</Tooltip.Content>
                </Tooltip>
            )}
            {isSignedIn && (
                <Suspense fallback={null}>
                    <AIFloatingAssistantPanel compact />
                </Suspense>
            )}
        </div>
    );
};

export default CanvasToolbarActions;
