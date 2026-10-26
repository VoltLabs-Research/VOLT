import {
    Button,
    DropdownItem,
    DropdownMenu,
    DropdownPopover,
    DropdownRoot,
    Popover,
    Tooltip
} from '@heroui/react';
import { Download, Ellipsis, LayoutGrid, Moon, Share2, Sun } from 'lucide-react';
import { lazy, Suspense, useRef, useState } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { MAX_VIEWPORT_PANES } from '@/modules/canvas/store/editor/model-slice';
import { Theme, useTheme } from '@/shared/ui/hooks/use-theme';
import ScreenshotMenuPopover from '../ScreenshotMenuPopover';
import TrajectorySharePanel from '../TrajectorySharePanel';
import useDownloadAnalysisListings from '../../hooks/use-download-analysis-listings';

// Loaded on its own: most visits to the canvas never open the assistant.
const AIFloatingAssistantPanel = lazy(() => import('@/modules/ai/components/AIFloatingAssistantPanel'));

interface CanvasToolbarShareInfo {
    trajectoryId: string;
    isPublic: boolean;
    canManageVisibility: boolean;
}

interface CanvasToolbarActionsProps {
    analysisId?: string;
    canDownloadAnalysis: boolean;
    share?: CanvasToolbarShareInfo;
}

const CanvasToolbarActions = ({ analysisId, canDownloadAnalysis, share }: CanvasToolbarActionsProps) => {
    const { download, isDownloading } = useDownloadAnalysisListings();
    const paneCount = useEditorStore((state) => state.viewportPanes.length);
    const addViewportPane = useEditorStore((state) => state.addViewportPane);
    const { theme, setTheme } = useTheme();
    // A shared trajectory opens to anyone; the assistant and sharing are for those signed in to a team.
    const isSignedIn = Boolean(useCurrentUser());
    // The share panel opens from the menu, so it anchors to the menu's trigger.
    const moreRef = useRef<HTMLDivElement>(null);
    const [isShareOpen, setIsShareOpen] = useState(false);

    const isDarkTheme = theme === Theme.Dark;
    const canAddPane = paneCount < MAX_VIEWPORT_PANES;
    const canDownload = canDownloadAnalysis && Boolean(analysisId);
    const canShare = Boolean(share && isSignedIn);

    return (
        <div className='flex flex-row items-center gap-0.5'>
            <Tooltip>
                <Button
                    variant='ghost'
                    size='sm'
                    isIconOnly
                    aria-label='Add scene pane'
                    isDisabled={!canAddPane}
                    onPress={() => addViewportPane()}
                >
                    <LayoutGrid size={14} aria-hidden='true' />
                </Button>
                <Tooltip.Content placement='bottom'>
                    {canAddPane ? 'Add empty scene pane' : `Maximum of ${MAX_VIEWPORT_PANES} scene panes`}
                </Tooltip.Content>
            </Tooltip>
            <ScreenshotMenuPopover />
            {isSignedIn && (
                <Suspense fallback={null}>
                    <AIFloatingAssistantPanel compact />
                </Suspense>
            )}
            <div ref={moreRef} className='flex'>
                <DropdownRoot>
                    <Button variant='ghost' size='sm' isIconOnly aria-label='More actions'>
                        <Ellipsis size={14} aria-hidden='true' />
                    </Button>
                    <DropdownPopover placement='bottom end'>
                        <DropdownMenu aria-label='More actions'>
                            {canDownload ? (
                                <DropdownItem
                                    id='download-analysis'
                                    textValue='Download analysis as CSV'
                                    onAction={() => analysisId && void download({ analysisId })}
                                >
                                    <Download size={14} aria-hidden='true' />
                                    {isDownloading ? 'Downloading…' : 'Download analysis as CSV'}
                                </DropdownItem>
                            ) : null}
                            {canShare ? (
                                <DropdownItem id='share' textValue='Share trajectory' onAction={() => setIsShareOpen(true)}>
                                    <Share2 size={14} aria-hidden='true' />
                                    Share trajectory
                                </DropdownItem>
                            ) : null}
                            <DropdownItem
                                id='theme'
                                textValue={isDarkTheme ? 'Light mode' : 'Dark mode'}
                                onAction={() => setTheme(isDarkTheme ? Theme.Light : Theme.Dark)}
                            >
                                {isDarkTheme ? <Sun size={14} aria-hidden='true' /> : <Moon size={14} aria-hidden='true' />}
                                {isDarkTheme ? 'Light mode' : 'Dark mode'}
                            </DropdownItem>
                        </DropdownMenu>
                    </DropdownPopover>
                </DropdownRoot>
            </div>
            {canShare && share && (
                <Popover.Content
                    triggerRef={moreRef}
                    isOpen={isShareOpen}
                    onOpenChange={setIsShareOpen}
                    placement='bottom end'
                >
                    <Popover.Dialog
                        id={`trajectory-share-${share.trajectoryId}`}
                        aria-label='Share trajectory'
                        className='flex max-h-[360px] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden p-2'
                    >
                        <TrajectorySharePanel
                            trajectoryId={share.trajectoryId}
                            isPublic={share.isPublic}
                            canManageVisibility={share.canManageVisibility}
                            onClose={() => setIsShareOpen(false)}
                        />
                    </Popover.Dialog>
                </Popover.Content>
            )}
        </div>
    );
};

export default CanvasToolbarActions;
