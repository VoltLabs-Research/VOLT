import useCameraGroup from '../CanvasRenderSections/groups/camera';
import CanvasRenderSubsectionContent from '../CanvasRenderSections/CanvasRenderSubsectionContent';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
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
                <button
                    type='button'
                    className='no-highlight inline-flex size-[30px] min-h-[30px] min-w-[30px] transform-gpu cursor-pointer select-none items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted [transition:transform_250ms_ease,background-color_100ms_cubic-bezier(0,0,0.2,1)] motion-reduce:transition-none hover:bg-default hover:text-foreground focus-visible:text-foreground active:scale-[0.98] active:bg-default disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 max-md:size-[34px] max-md:min-h-[34px] max-md:min-w-[34px] [&>svg]:pointer-events-none [&>svg]:size-4 [&>svg]:shrink-0'
                    title='Camera'
                    aria-label='Camera settings'
                >
                    <Settings size={14} />
                </button>
            ) : (
                <button
                    type='button'
                    className='no-highlight inline-flex h-9 w-fit transform-gpu cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl border-0 bg-transparent px-3 text-xs font-medium text-default-foreground [transition:transform_250ms_ease,background-color_100ms_cubic-bezier(0,0,0.2,1)] motion-reduce:transition-none hover:bg-default active:scale-[0.98] active:bg-default disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:h-8 [&>svg]:pointer-events-none [&>svg]:-mx-0.5 [&>svg]:size-4 [&>svg]:shrink-0'
                    title='Camera settings'
                    aria-label='Camera settings'
                >
                    <Settings size={12} className='shrink-0' />
                    Camera
                </button>
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
