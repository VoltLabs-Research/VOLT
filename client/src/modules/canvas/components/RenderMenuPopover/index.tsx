import useCanvasRenderGroups from '../CanvasRenderSections/useCanvasRenderGroups';
import RenderGroupSubmenuContent from './RenderGroupSubmenuContent';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
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
            .filter((group) => group.visible !== false)
            .map((group) => ({
                label: group.title,
                submenuContent: <RenderGroupSubmenuContent group={group} />
            }));
    }, [renderGroups]);

    return (
        <ContextMenuPopover
            id='viewport-render-menu'
            trigger={compact ? (
                <button
                    type='button'
                    className='no-highlight inline-flex size-[30px] min-h-[30px] min-w-[30px] transform-gpu cursor-pointer select-none items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted [transition:transform_250ms_ease,background-color_100ms_cubic-bezier(0,0,0.2,1)] motion-reduce:transition-none hover:bg-default hover:text-foreground focus-visible:text-foreground active:scale-[0.98] active:bg-default disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 max-md:size-[34px] max-md:min-h-[34px] max-md:min-w-[34px] [&>svg]:pointer-events-none [&>svg]:size-4 [&>svg]:shrink-0'
                    title='Render'
                    aria-label='Render settings'
                >
                    <Monitor size={14} />
                </button>
            ) : (
                <button
                    type='button'
                    className='no-highlight inline-flex h-9 w-fit transform-gpu cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl border-0 bg-transparent px-3 text-xs font-medium text-default-foreground [transition:transform_250ms_ease,background-color_100ms_cubic-bezier(0,0,0.2,1)] motion-reduce:transition-none hover:bg-default active:scale-[0.98] active:bg-default disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:h-8 [&>svg]:pointer-events-none [&>svg]:-mx-0.5 [&>svg]:size-4 [&>svg]:shrink-0'
                    title='Render settings'
                    aria-label='Render settings'
                >
                    <Monitor size={12} className='shrink-0' />
                    Render
                </button>
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
