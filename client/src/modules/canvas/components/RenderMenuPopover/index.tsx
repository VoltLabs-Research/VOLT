import useCanvasRenderGroups from '../CanvasRenderSections/useCanvasRenderGroups';
import RenderGroupSubmenuContent from './RenderGroupSubmenuContent';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { VIEWPORT_FLOATING_BUTTON_CLASS } from '../ViewportFloatingControls/floating-button';
import { Button, Tooltip } from '@heroui/react';
import { Monitor } from 'lucide-react';
import { useMemo } from 'react';
import type { MenuOption } from '@/shared/contracts/menu';

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
            id='viewport-render-menu'
            trigger={compact ? (
                /*
                 * The wrapping span is `ContextMenuPopover`'s trigger element — it is the
                 * node that receives the popover ref, `data-popover-trigger` and the
                 * click handlers — so it has to stay outside the Tooltip.
                 */
                <span className='inline-flex items-center justify-center'>
                    <Tooltip>
                        <Button
                            variant='ghost'
                            size='sm'
                            isIconOnly
                            className={VIEWPORT_FLOATING_BUTTON_CLASS}
                            aria-label='Render settings'
                        >
                            <Monitor size={14} />
                        </Button>
                        <Tooltip.Content placement='bottom'>Render</Tooltip.Content>
                    </Tooltip>
                </span>
            ) : (
                <Tooltip>
                    <Button
                        variant='ghost'
                        size='sm'
                        className='text-xs'
                        aria-label='Render settings'
                    >
                        <Monitor size={12} className='shrink-0' />
                        Render
                    </Button>
                    <Tooltip.Content placement='bottom'>Render settings</Tooltip.Content>
                </Tooltip>
            )}
            options={options}
            triggerAction='click'
            ariaLabel='Render settings'
            menuLabel='Render settings'
            size='sm'
        />
    );
};

export default RenderMenuPopover;
