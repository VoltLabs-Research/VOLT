import { memo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Container from '@/shared/presentation/components/Container';
import Avatar from '@/shared/presentation/components/Avatar';
import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';
import UserMenuPopover from '@/modules/auth/presentation/components/molecules/UserMenuPopover';
import useCanvasUrlState from '../../../hooks/use-canvas-url-state';
import MenuPopover from '../../molecules/MenuPopover';
import { buildMenus } from '../../molecules/TopToolbarMenus';
import WorkspaceTabs from '../../molecules/WorkspaceTabs';
import './TopToolbar.css';

const TopToolbar = () => {
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const { searchParams, updateSearchParams } = useCanvasUrlState();
    const showStatusBar = searchParams.get('statusBar') !== 'false';
    const setShowStatusBar = (value: boolean) => updateSearchParams({ statusBar: value ? 'true' : 'false' });

    const handleSignOut = () => {
        try {
            setIsSigningOut(true);
            useAuthStore.getState().signOut();
        } catch (error) {
            console.error('Sign out failed', error);
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
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `volt-screenshot-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }, []);

    const menus = buildMenus({
        showStatusBar,
        onToggleFullscreen: handleToggleFullscreen,
        onToggleStatusBar: () => setShowStatusBar(!showStatusBar),
        onScreenshot: handleScreenshot
    });

    return (
        <header className="canvas-top-toolbar d-flex items-stretch u-select-none">
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
                        <button className="cursor-pointer" style={{ background: 'none', border: 'none', padding: 0 }}>
                            <Avatar user={user} size="xs" />
                        </button>
                    }
                />
            </Container>
        </header>
    );
};

export default memo(TopToolbar);
