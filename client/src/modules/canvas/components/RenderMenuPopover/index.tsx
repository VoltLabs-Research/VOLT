import useCanvasRenderGroups from '../CanvasRenderSections/useCanvasRenderGroups';
import RenderGroupSubmenuContent from './RenderGroupSubmenuContent';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import { Button, Row, Tooltip } from '@voltstack/bravais';
import { Monitor } from 'lucide-react';
import { useMemo } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';

import './RenderMenuPopover.css';

interface RenderMenuPopoverProps {
    compact?: boolean;
}

const RenderMenuPopover = ({ compact = false }: RenderMenuPopoverProps) => {
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
            trigger={compact ? (
                <span className='d-inline-flex flex-center'>
                    <Tooltip content="Render" placement="bottom">
                        <Button
                            variant="ghost"
                            intent="canvas"
                            shape="rounded"
                            size="sm"
                            iconOnly
                            className="canvas-viewport-floating-btn"
                            aria-label="Render settings"
                        >
                            <Monitor size={14} />
                        </Button>
                    </Tooltip>
                </span>
            ) : (
                <Button
                    variant="ghost"
                    intent="canvas"
                    shape="rounded"
                    size="sm"
                    className="font-size-05 canvas-btn-compact"
                    leftIcon={<Row as='span' justify='center' shrink='0'><Monitor size={12} /></Row>}
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
