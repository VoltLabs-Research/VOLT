import { Fragment, useState, useCallback } from 'react';
import Container from '@/shared/presentation/components/Container';
import useCanvasUrlState from '../../../hooks/use-canvas-url-state';
import MenuPopover from '../../molecules/MenuPopover';
import { buildMenus } from '../../molecules/TopToolbarMenus';
import WorkspaceTabs from '../../molecules/WorkspaceTabs';
import './TopToolbar.css';

const TopToolbar = () => {
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const { searchParams, updateSearchParams, activeWorkspace, setActiveWorkspace } = useCanvasUrlState();
    const showStatusBar = searchParams.get('statusBar') !== 'false';
    const setShowStatusBar = (value: boolean) => updateSearchParams({ statusBar: value ? 'true' : 'false' });

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
            <Container className="canvas-toolbar-logo d-flex items-center">
                <h1 className="canvas-volt">VOLT</h1>
            </Container>

            <nav className="canvas-toolbar-menus px-025 d-flex gap-025 items-center" aria-label="Main menu">
                {menus.map((menu) => (
                    <MenuPopover
                        key={menu.label}
                        menu={menu}
                        openMenu={openMenu}
                        onOpenChange={setOpenMenu}
                    />
                ))}
            </nav>

            <WorkspaceTabs activeWorkspace={activeWorkspace} onSelect={setActiveWorkspace} />

            <Container className="canvas-toolbar-info d-flex items-center gap-05 content-end w-max  ">
                {['Scene', 'ViewLayer'].map((label, i) => (
                    <Fragment key={label}>
                        {i > 0 && <Container className="canvas-toolbar-divider-v" />}
                        <span className="canvas-toolbar-info-text">{label}</span>
                    </Fragment>
                ))}
            </Container>
        </header>
    );
};

export default TopToolbar;
