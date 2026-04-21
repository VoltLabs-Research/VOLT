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
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';
import UserMenuPopover from '@/modules/auth/components/UserMenuPopover';
import useTrajectoryFilePicker from '@/modules/trajectory/hooks/trajectory/use-trajectory-file-picker';
import Button from '@/shared/presentation/components/Button';
import ThemeToggleButton from '@/shared/presentation/components/ThemeToggleButton';
import useShortcutDiscovery from '@/shared/tips/use-shortcut-discovery';
import { HiOutlineDotsVertical } from 'react-icons/hi';

import './TopToolbar.css';

import type { WorkspacePresenceUser } from '@/modules/canvas/collaboration/use-canvas-workspace';
import type { ReactNode } from 'react';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

interface TopToolbarShareInfo {
    trajectoryId: string;
    isPublic: boolean;
    canManageVisibility: boolean;
};

interface TopToolbarProps {
    trajectory?: Trajectory | null;
    canExport?: boolean;
    canDownloadAnalyses?: boolean;
    onExport?: () => void;
    onDownloadAnalyses?: () => void;
    localGlbMode?: boolean;
    workspacePeers?: WorkspacePresenceUser[];
    workspaceActiveOwnerId?: string;
    onSelectWorkspacePeer?: (peerId: string) => void;
    share?: TopToolbarShareInfo;
    contextualActions?: ReactNode;
}

const TopToolbar = ({
    trajectory,
    canExport = false,
    canDownloadAnalyses = false,
    onExport,
    onDownloadAnalyses,
    localGlbMode = false,
    workspacePeers,
    workspaceActiveOwnerId,
    onSelectWorkspacePeer,
    share,
    contextualActions
}: TopToolbarProps) => {
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const navigate = useNavigate();
    const user = useCurrentUser();
    const { searchParams, updateSearchParams } = useCanvasUrlState();
    const { recordSlowAction: recordScreenshotShortcutTip } = useShortcutDiscovery('canvas-screenshot-shortcut');
    const showStatusBar = searchParams.get('statusBar') !== 'false';
    const setShowStatusBar = (value: boolean) => updateSearchParams({ statusBar: value ? 'true' : 'false' });

    const navigateToDashboard = useCallback(() => navigate('/dashboard'), [navigate]);
    const { fileInputRef, handlePickerChange, openFilePicker } = useTrajectoryFilePicker(navigateToDashboard);

    const handleSignOut = () => {
        try {
            setIsSigningOut(true);
            useAuthStore.getState().signOut();
        } catch {
            sileo.error({ title: 'Sign out failed', description: 'Please try again.' });
        } finally {
            setIsSigningOut(false);
        }
    };

    const handleSettingsClick = () => {
        navigate('/dashboard/settings/general');
    };

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
        onExport,
        onDownloadAnalyses,
        canExport,
        canDownloadAnalyses
    });

    const canShowPeers = Boolean(onSelectWorkspacePeer && ((workspacePeers?.length ?? 0) > 0 || (!localGlbMode && selfPresence)));

    return (
        <header className="canvas-top-toolbar d-flex items-stretch u-select-none">
            <input
                ref={fileInputRef}
                type='file'
                multiple
                hidden
                onChange={handlePickerChange}
            />
            <div className="volt-container canvas-toolbar-left d-flex items-center flex-1">
                {trajectory ? (
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
                ) : (
                    <a
                        className="canvas-toolbar-logo d-flex items-center"
                        href="/dashboard"
                        aria-label="Go to Volt dashboard"
                        title="Back to Dashboard"
                        onClick={(event) => {
                            event.preventDefault();
                            navigate('/dashboard');
                        }}
                    >
                        <span className="canvas-toolbar-logo-mark font-size-1 color-primary font-weight-6" aria-hidden="true">VOLT</span>
                    </a>
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

                <WorkspaceTabs disableAuxWorkspaces={localGlbMode} />
            </div>

            <div className="volt-container canvas-toolbar-center d-flex items-center content-center flex-1">
                <CanvasPluginSearch />
            </div>

            <div className="volt-container canvas-toolbar-info d-flex items-center gap-025 flex-1 content-end">
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
                <ThemeToggleButton className="canvas-toolbar-theme-toggle" />
                <UserMenuPopover
                    onSettingsClick={handleSettingsClick}
                    onSignOut={handleSignOut}
                    isSigningOut={isSigningOut}
                    trigger={
                        <Button variant='ghost' intent='neutral' iconOnly aria-label='Open user menu' title='Open user menu' className="canvas-toolbar-user-trigger cursor-pointer">
                            <HiOutlineDotsVertical size={16} />
                        </Button>
                    }
                />
            </div>
        </header>
    );
};

export default memo(TopToolbar);
