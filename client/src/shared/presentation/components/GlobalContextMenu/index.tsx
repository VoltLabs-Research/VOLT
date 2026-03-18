import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import Container from '@/shared/presentation/components/Container';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MouseEvent, ReactNode } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';

interface GlobalContextMenuProps {
    children: ReactNode;
};

const EXTERNAL_LINK_FEATURES = 'noopener,noreferrer';
const EDITABLE_TARGET_SELECTOR = 'input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"]';

const GlobalContextMenu = ({ children }: GlobalContextMenuProps) => {
    const navigate = useNavigate();

    const openExternalUrl = useCallback((url: string) => {
        window.open(url, '_blank', EXTERNAL_LINK_FEATURES);
    }, []);

    const shouldOpenOnContextMenu = useCallback((event: MouseEvent<Element>) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
            return true;
        }

        return target.closest(EDITABLE_TARGET_SELECTOR) === null;
    }, []);

    const menuOptions = useMemo<MenuOption[]>(() => {
        return [
            {
                label: 'Startpage',
                onClick: () => navigate('/start')
            },
            {
                label: 'Connect new cluster',
                onClick: () => navigate('/onboarding/cluster/setup')
            },
            {
                label: 'Read the docs',
                onClick: () => openExternalUrl('https://docs.voltcloud.dev')
            },
            {
                label: 'Open Source Ecosystem',
                onClick: () => openExternalUrl('https://github.com/voltlabs-research')
            },
            {
                label: 'API Spec',
                onClick: () => openExternalUrl('https://server.voltcloud.dev/api-docs')
            }
        ];
    }, [navigate, openExternalUrl]);

    return (
        <ContextMenuPopover
            id='global-context-menu'
            options={menuOptions}
            shouldOpenOnContextMenu={shouldOpenOnContextMenu}
            trigger={(
                <Container className='d-flex column flex-1 min-h-0'>
                    {children}
                </Container>
            )}
        />
    );
};

export default GlobalContextMenu;
