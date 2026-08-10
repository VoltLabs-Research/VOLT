import useCameraGroup from '../CanvasRenderSections/groups/camera';
import CanvasRenderSubsectionContent from '../CanvasRenderSections/CanvasRenderSubsectionContent';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { VIEWPORT_FLOATING_BUTTON_CLASS } from '../ViewportFloatingControls/floating-button';
import { Button, Tooltip } from '@heroui/react';
import { Settings } from 'lucide-react';
import { useMemo } from 'react';
import type { MenuOption } from '@/shared/contracts/menu';

interface CameraMenuPopoverProps {
    compact?: boolean;
}

const CameraMenuPopover = ({ compact = false }: CameraMenuPopoverProps) => {
    const cameraGroup = useCameraGroup();

    const options = useMemo<MenuOption[]>(() => {
        return cameraGroup.subsections
            .filter((subsection) => subsection.visible !== false)
            .map((subsection) => ({
                label: subsection.label,
                submenuContent: (
                    <div className='flex min-w-[260px] flex-col gap-2 px-2 py-1'>
                        <CanvasRenderSubsectionContent subsection={subsection} />
                    </div>
                )
            }));
    }, [cameraGroup.subsections]);

    return (
        <ContextMenuPopover
            id='viewport-camera-menu'
            trigger={compact ? (
                /*
                 * The span is `ContextMenuPopover`'s trigger element — it takes the popover
                 * ref, `data-popover-trigger` and the click handlers — so it stays outside
                 * the Tooltip.
                 */
                <span className='inline-flex items-center justify-center'>
                    <Tooltip>
                        <Button
                            variant='ghost'
                            size='sm'
                            isIconOnly
                            className={VIEWPORT_FLOATING_BUTTON_CLASS}
                            aria-label='Camera settings'
                        >
                            <Settings size={14} />
                        </Button>
                        <Tooltip.Content placement='bottom'>Camera</Tooltip.Content>
                    </Tooltip>
                </span>
            ) : (
                <Tooltip>
                    <Button
                        variant='ghost'
                        size='sm'
                        className='text-xs'
                        aria-label='Camera settings'
                    >
                        <Settings size={12} className='shrink-0' />
                        Camera
                    </Button>
                    <Tooltip.Content placement='bottom'>Camera settings</Tooltip.Content>
                </Tooltip>
            )}
            options={options}
            triggerAction='click'
            ariaLabel='Camera settings'
            menuLabel='Camera settings'
            size='sm'
        />
    );
};

export default CameraMenuPopover;
