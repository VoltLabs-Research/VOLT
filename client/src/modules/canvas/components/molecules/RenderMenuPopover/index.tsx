import useCanvasRenderGroups from '../../organisms/CanvasRenderSections/useCanvasRenderGroups';
import RenderGroupSubmenuContent from './RenderGroupSubmenuContent';
import Button from '@/shared/presentation/components/Button';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import { Monitor } from 'lucide-react';
import { useMemo } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';

import './RenderMenuPopover.css';

const RenderMenuPopover = () => {
    const renderGroups = useCanvasRenderGroups();

    const options = useMemo<MenuOption[]>(() => {
        return renderGroups
            .filter((group) => group.visible !== false && group.id !== 'camera')
            .map((group) => ({
                label: group.title,
                submenuContent: <RenderGroupSubmenuContent group={group} />
            }));
    }, [renderGroups]);

    return (
        <ContextMenuPopover
            id="viewport-render-menu"
            trigger={(
                <Button
                    variant="ghost"
                    intent="canvas"
                    shape="rounded"
                    size="sm"
                    className="font-size-05 canvas-btn-compact"
                    leftIcon={<span className="d-flex items-center content-center f-shrink-0"><Monitor size={12} /></span>}
                    aria-label="Render settings"
                    title="Render settings"
                >
                    Render
                </Button>
            )}
            options={options}
            triggerAction="click"
            ariaLabel="Render settings"
            menuLabel="Render settings"
            size="sm"
        />
    );
};

export default RenderMenuPopover;
