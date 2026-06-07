import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import { BookOpen, Braces, FileCode, PlugZap } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';
import { useNavigate } from 'react-router-dom';
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
                label: 'Connect new cluster',
                icon: PlugZap,
                onClick: () => navigate('/onboarding/cluster/setup')
            },
            {
                label: 'Read the docs',
                icon: BookOpen,
                onClick: () => openExternalUrl('https://docs.voltcloud.dev')
            },
            {
                label: 'Open Source Ecosystem',
                icon: Braces,
                onClick: () => openExternalUrl('https://github.com/voltlabs-research')
            },
            {
                label: 'API Spec',
                icon: FileCode,
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
                <div className='d-flex column flex-1 min-h-0 vh-max'>
                    {children}
                </div>
            )}
        />
    );
};

export default GlobalContextMenu;
