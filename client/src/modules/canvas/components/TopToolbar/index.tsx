import { buildMenus } from '../TopToolbarMenus';
import { useScreenshotStore } from '@/modules/canvas/stores/use-screenshot-store';
import useCanvasUrlState from '../../hooks/use-canvas-url-state';
import CanvasPluginSearch from '../CanvasPluginSearch';
import MenuPopover from '../MenuPopover';
import TrajectorySharePanelPopover from '../TrajectorySharePanelPopover';
import WorkspacePeerAvatars from '../WorkspacePeerAvatars';
import WorkspaceTabs from '../WorkspaceTabs';

import EditableTrajectoryName from '@/modules/trajectory/components/EditableTrajectoryName';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { memo, useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import useTrajectoryFilePicker from '@/modules/trajectory/hooks/trajectory/use-trajectory-file-picker';
import useShortcutDiscovery from '@/shared/tips/use-shortcut-discovery';
import { ChevronLeft } from 'lucide-react';
import IconButton from '@/shared/presentation/primitives/IconButton';
import Row from '@/shared/presentation/primitives/Row';

import './TopToolbar.css';

import type { WorkspacePresenceUser } from '@/modules/canvas/collaboration/use-canvas-workspace';
import type { ReactNode } from 'react';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';
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
    const handleBack = useCallback(() => navigate(-1), [navigate]);
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

    return (
        <header className="canvas-top-toolbar d-flex items-stretch u-select-none">
            <input
                ref={fileInputRef}
                type='file'
                multiple
                hidden
                onChange={handlePickerChange}
            />
            <Row flex='1' className="canvas-toolbar-left">
                <IconButton
                    variant='ghost'
                    size='sm'
                    aria-label='Back to dashboard'
                    title='Back to dashboard'
                    onClick={handleBack}
                >
                    <ChevronLeft size={16} aria-hidden='true' />
                </IconButton>
                {trajectory && (
                    <div
                        className="canvas-toolbar-logo canvas-toolbar-trajectory d-flex items-center"
                        title={trajectory.name}
                    >
                        <EditableTrajectoryName
                            trajectoryId={trajectory._id}
                            name={trajectory.name}
                            className="canvas-toolbar-trajectory-name"
                        />
                    </div>
                )}

                <nav className="canvas-toolbar-menus px-1 d-flex gap-025 items-center" aria-label="Canvas primary navigation">
                    {menus.map((menu) => (
                        <MenuPopover
                            key={menu.label}
                            menu={menu}
                            openMenu={openMenu}
                            onOpenChange={setOpenMenu}
                        />
                    ))}
                </nav>

                <WorkspaceTabs
                    disableAuxWorkspaces={localGlbMode}
                    showScriptingWorkspace={canMutateCanvas}
                />
            </Row>

            <Row justify='center' flex='1' className="canvas-toolbar-center">
                {canMutateCanvas && <CanvasPluginSearch />}
            </Row>

            <Row gap='025' flex='1' justify='end' className="canvas-toolbar-info">
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
            </Row>
        </header>
    );
};

export default memo(TopToolbar);
