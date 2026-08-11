import { buildMenus } from '../TopToolbarMenus';
import { useScreenshotStore } from '@/modules/canvas/store/use-screenshot-store';
import useCanvasUrlState from '../../hooks/use-canvas-url-state';
import CanvasPluginSearch from '../CanvasPluginSearch';
import MenuPopover from '../MenuPopover';
import TrajectorySharePanelPopover from '../TrajectorySharePanelPopover';
import WorkspacePeerAvatars from '../WorkspacePeerAvatars';
import WorkspaceTabs from '../WorkspaceTabs';

import EditableTrajectoryName from '@/modules/trajectory/components/EditableTrajectoryName';
import WindowControls from '@/shared/ui/components/WindowControls';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { memo, useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import useTrajectoryFilePicker from '@/modules/trajectory/hooks/trajectory/use-trajectory-file-picker';
import useShortcutDiscovery from '@/shared/tips/use-shortcut-discovery';
import { ChevronLeft } from 'lucide-react';
import { Button, cn } from '@heroui/react';

import type { WorkspacePresenceUser } from '@/modules/canvas/collaboration/use-canvas-workspace';
import type { ReactNode } from 'react';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import { useNavigate } from 'react-router-dom';

interface TopToolbarShareInfo {
    trajectoryId: string;
    isPublic: boolean;
    canManageVisibility: boolean;
}

interface TopToolbarProps {
    trajectory?: Trajectory | null;
    canDownloadAnalyses?: boolean;
    onDownloadAnalyses?: () => void;
    localGlbMode?: boolean;
    canMutateCanvas?: boolean;
    workspacePeers?: WorkspacePresenceUser[];
    workspaceActiveOwnerId?: string;
    onSelectWorkspacePeer?: (peerId: string) => void;
    share?: TopToolbarShareInfo;
    contextualActions?: ReactNode;
}

const temporalStore = useEditorStore.temporal;

const subscribeTemporal = (onStoreChange: () => void) => temporalStore.subscribe(onStoreChange);
const getTemporalSnapshot = () => temporalStore.getState();

const TopToolbar = ({
    trajectory,
    canDownloadAnalyses = false,
    onDownloadAnalyses,
    localGlbMode = false,
    canMutateCanvas = true,
    workspacePeers,
    workspaceActiveOwnerId,
    onSelectWorkspacePeer,
    share,
    contextualActions
}: TopToolbarProps) => {
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const navigate = useNavigate();
    const user = useCurrentUser();
    const { searchParams, updateSearchParams } = useCanvasUrlState();
    const { recordSlowAction: recordScreenshotShortcutTip } = useShortcutDiscovery('canvas-screenshot-shortcut');
    const showStatusBar = searchParams.get('statusBar') !== 'false';
    const setShowStatusBar = (value: boolean) => updateSearchParams({ statusBar: value ? 'true' : 'false' });

    const temporalState = useSyncExternalStore(subscribeTemporal, getTemporalSnapshot, getTemporalSnapshot);
    const canUndo = temporalState.pastStates.length > 0;
    const canRedo = temporalState.futureStates.length > 0;

    const handleUndo = useCallback(() => {
        temporalStore.getState().undo();
    }, []);
    const handleRedo = useCallback(() => {
        temporalStore.getState().redo();
    }, []);

    const navigateToDashboard = useCallback(() => navigate('/dashboard'), [navigate]);
    const handleBack = navigateToDashboard;
    const { fileInputRef, handlePickerChange, openFilePicker } = useTrajectoryFilePicker(navigateToDashboard);

    const handleToggleFullscreen = useCallback(() => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }, []);

    const handleScreenshot = useCallback(() => {
        recordScreenshotShortcutTip();
        useScreenshotStore.getState().requestCapture();
    }, [recordScreenshotShortcutTip]);

    const selfPresence = useMemo<WorkspacePresenceUser | undefined>(() => {
        if (!user) return undefined;
        return {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            avatar: user.avatar,
            isAnonymous: false
        };
    }, [user]);

    const menus = buildMenus({
        showStatusBar,
        allowStatusBarToggle: !localGlbMode,
        onToggleFullscreen: handleToggleFullscreen,
        onToggleStatusBar: () => setShowStatusBar(!showStatusBar),
        onScreenshot: handleScreenshot,
        onImport: openFilePicker,
        onDownloadAnalyses,
        onUndo: handleUndo,
        onRedo: handleRedo,
        canDownloadAnalyses,
        canUndo,
        canRedo
    });

    const canShowPeers = Boolean(onSelectWorkspacePeer && (workspacePeers?.length ?? 0) > 0);
    const useGuestMobileNavigation = !user && !canMutateCanvas;
    const renderBackButton = (className?: string) => (
        <Button
            variant='ghost'
            size='sm'
            isIconOnly
            className={className}
            aria-label='Back to dashboard'
            onPress={handleBack}
        >
            <ChevronLeft size={16} aria-hidden='true' />
        </Button>
    );

    const isMobileViewport = useMedia('(width < 48rem)');

    const renderToolbarOptions = (
        isMobile: boolean,
        menuIdPrefix = 'menu'
    ) => (
        <div className={isMobile ? 'flex max-md:h-[var(--canvas-header-height,40px)] max-md:w-full max-md:min-w-0 max-md:flex-nowrap max-md:items-center max-md:justify-center max-md:gap-0.5 max-md:overflow-x-auto max-md:overflow-y-hidden max-md:whitespace-nowrap max-md:px-1.5 max-md:[&>*]:shrink-0' : 'contents'}>
            <nav className='flex flex-row items-center gap-1 px-4 max-md:flex-none max-md:overflow-visible max-md:p-0 max-md:[&>*]:shrink-0' aria-label='Canvas primary navigation'>
                {isMobile && useGuestMobileNavigation && renderBackButton('hidden max-md:inline-flex max-md:size-[1.625rem] max-md:min-h-[1.625rem] max-md:min-w-[1.625rem] max-md:rounded-lg max-md:p-1')}
                {menus.map((menu) => (
                    <MenuPopover
                        key={`${menuIdPrefix}-${menu.label}`}
                        menu={menu}
                        openMenu={openMenu}
                        onOpenChange={setOpenMenu}
                        idPrefix={menuIdPrefix}
                        triggerClassName={isMobile ? 'max-md:h-[1.625rem] max-md:min-h-[1.625rem] max-md:px-1.5 max-md:text-[0.625rem]' : undefined}
                    />
                ))}
            </nav>
            <WorkspaceTabs disableAuxWorkspaces={localGlbMode} compact={isMobile} />
        </div>
    );

    return (
        <header className='absolute left-0 top-0 z-[4] block select-none bg-background right-[var(--canvas-right-overlay-size,0px)] min-h-[var(--canvas-header-height,55px)] max-md:h-[var(--canvas-header-height,40px)] max-md:min-h-[var(--canvas-header-height,40px)] max-md:overflow-hidden canvas-top-toolbar flex items-stretch'>
            {isMobileViewport && renderToolbarOptions(true, 'mobile-menu')}

            <div className='relative grid h-[var(--canvas-header-height,55px)] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-stretch max-md:hidden'>
                <input
                    ref={fileInputRef}
                    type='file'
                    multiple
                    hidden
                    onChange={handlePickerChange}
                />
                <div className={cn('flex min-w-0 flex-1 flex-row flex-nowrap items-center overflow-x-auto overflow-y-hidden max-w-[calc(100%-clamp(120px,16vw,220px)+var(--canvas-right-overlay-size,0px)/2)] [&>*]:shrink-0', useGuestMobileNavigation && 'max-md:hidden')}>
                    {renderBackButton()}
                    {trajectory && (
                        <div className='flex max-w-[260px] flex-row items-center justify-start px-3 max-md:hidden'
                            title={trajectory.name}
                        >
                            <EditableTrajectoryName
                                trajectoryId={trajectory._id}
                                name={trajectory.name}
                                className='overflow-hidden text-ellipsis whitespace-nowrap text-[0.78rem] leading-6 text-muted'
                            />
                        </div>
                    )}

                    {!isMobileViewport && renderToolbarOptions(false)}
                </div>
                <div className='pointer-events-none absolute inset-y-0 left-[calc(50%+var(--canvas-right-overlay-size,0px)/2)] flex flex-1 -translate-x-1/2 flex-row items-center justify-center [&>*]:pointer-events-auto'>
                    {canMutateCanvas && <CanvasPluginSearch />}
                </div>
                <div className='flex flex-1 flex-row items-center justify-end gap-1 pr-3 max-md:hidden'>
                    {contextualActions}
                    {canShowPeers && onSelectWorkspacePeer && (
                        <WorkspacePeerAvatars
                            peers={workspacePeers ?? []}
                            self={localGlbMode ? undefined : selfPresence}
                            activeOwnerId={workspaceActiveOwnerId}
                            onSelectPeer={onSelectWorkspacePeer}
                        />
                    )}
                    {share && user && (
                        <TrajectorySharePanelPopover
                            trajectoryId={share.trajectoryId}
                            isPublic={share.isPublic}
                            canManageVisibility={share.canManageVisibility}
                        />
                    )}
                    <WindowControls />
                </div>
            </div>
        </header>
    );
};

export default memo(TopToolbar);
