import { memo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Container from '@/shared/presentation/components/Container';
import Avatar from '@/shared/presentation/components/Avatar';
import Button from '@/shared/presentation/components/Button';
import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';
import { useCurrentUser } from '@/modules/auth/presentation/hooks/use-current-user';
import UserMenuPopover from '@/modules/auth/presentation/components/molecules/UserMenuPopover';
import { openModal } from '@/shared/presentation/components/Modal';
import { SCREENSHOT_MODAL_ID } from '../../organisms/ScreenshotModal';
import useCanvasUrlState from '../../../hooks/use-canvas-url-state';
import useTrajectoryFilePicker from '@/modules/trajectory/presentation/hooks/trajectory/use-trajectory-file-picker';
import MenuPopover from '../../molecules/MenuPopover';
import { buildMenus } from '../../molecules/TopToolbarMenus';
import WorkspaceTabs from '../../molecules/WorkspaceTabs';
import { sileo } from 'sileo';
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
        openModal(SCREENSHOT_MODAL_ID);
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
            <Container
                className="canvas-toolbar-logo d-flex items-center cursor-pointer"
                onClick={() => navigate('/dashboard')}
                title="Back to Dashboard"
            >
                <h1 className="canvas-volt font-size-05 color-secondary">VOLT</h1>
            </Container>

            <nav className="canvas-toolbar-menus px-1 d-flex gap-025 items-center" aria-label="Main menu">
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
                        <Button variant='ghost' intent='neutral' iconOnly className="cursor-pointer" style={{ background: 'none', border: 'none', padding: 0 }}>
                            <Avatar user={user} size="xs" />
                        </Button>
                    }
                />
            </Container>
        </header>
    );
};

export default memo(TopToolbar);
