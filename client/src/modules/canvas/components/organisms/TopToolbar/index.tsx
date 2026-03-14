import { buildMenus } from '../../molecules/TopToolbarMenus';
import { useScreenshotStore } from '@/modules/canvas/stores/use-screenshot-store';
import useCanvasUrlState from '../../../hooks/use-canvas-url-state';
import MenuPopover from '../../molecules/MenuPopover';
import WorkspaceTabs from '../../molecules/WorkspaceTabs';

import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import { memo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';
import UserMenuPopover from '@/modules/auth/components/molecules/UserMenuPopover';
import useTrajectoryFilePicker from '@/modules/trajectory/hooks/trajectory/use-trajectory-file-picker';
import Avatar from '@/shared/presentation/components/Avatar';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';

import './TopToolbar.css';

const TopToolbar = () => {
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const navigate = useNavigate();
    const user = useCurrentUser();
    const { searchParams, updateSearchParams } = useCanvasUrlState();
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
        useScreenshotStore.getState().requestCapture();
    }, []);

    const menus = buildMenus({
        showStatusBar,
        onToggleFullscreen: handleToggleFullscreen,
        onToggleStatusBar: () => setShowStatusBar(!showStatusBar),
        onScreenshot: handleScreenshot,
        onImport: openFilePicker
    });

    return (
        <header className="canvas-top-toolbar d-flex items-stretch u-select-none">
            <input
                ref={fileInputRef}
                type='file'
                multiple
                hidden
                onChange={handlePickerChange}
            />
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
                <span className="canvas-toolbar-logo-mark font-size-1 color-primary font-weight-6" aria-hidden="true">V</span>
                <h1 className="canvas-volt font-size-075 color-secondary">Volt</h1>
            </a>

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

            <WorkspaceTabs />

            <Container className="canvas-toolbar-info d-flex items-center content-end w-max">
                <UserMenuPopover
                    onSettingsClick={handleSettingsClick}
                    onSignOut={handleSignOut}
                    isSigningOut={isSigningOut}
                        trigger={
                        <Button variant='ghost' intent='neutral' iconOnly aria-label='Open user menu' title='Open user menu' className="canvas-toolbar-user-trigger cursor-pointer">
                            <Avatar user={user} size="xs" />
                        </Button>
                    }
                />
            </Container>
        </header>
    );
};

export default memo(TopToolbar);
