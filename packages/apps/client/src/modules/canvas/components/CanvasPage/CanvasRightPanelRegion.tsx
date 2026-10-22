import ObjectsPanel from '../ObjectsPanel';
import ResizeHandle from '../ResizeHandle';
import { ResizeDirection } from '../../hooks/use-resizable';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { PanelRight } from 'lucide-react';
import { cn } from '@heroui/react';

import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import type useResizable from '../../hooks/use-resizable';

interface CanvasRightPanelRegionProps extends Omit<ComponentProps<typeof ObjectsPanel>, 'mode'> {
    panel: ReturnType<typeof useResizable>;
    isNarrowViewport: boolean;
    isDrawerOpen: boolean;
    onDrawerOpenChange: Dispatch<SetStateAction<boolean>>;
}

const COMPACT_ANALYSIS_MEDIA_QUERY = '(max-width: 768px)';

const PANEL_CLASS = 'relative z-[3] flex shrink-0 flex-col overflow-hidden pr-[env(safe-area-inset-right,0px)] pb-[env(safe-area-inset-bottom,0px)]';

// Under 1200px the panel is a glass drawer over the page; on phones, a floating card under its round trigger.
const DRAWER_CLASS = [
    'glass-surface absolute inset-y-0 right-0 z-[5] w-[min(400px,86vw)]! bg-overlay shadow-overlay',
    'transition-transform duration-[220ms] ease-out-fluid data-[drawer-open=false]:translate-x-full data-[drawer-open=false]:shadow-none',
    'max-md:inset-auto max-md:left-[var(--canvas-mobile-panel-left)] max-md:top-[var(--canvas-mobile-panel-top)] max-md:z-[140]',
    'max-md:h-[min(24rem,calc(100dvh_-_var(--canvas-mobile-panel-top)_-_9.25rem))] max-md:w-[min(22rem,calc(100vw_-_5.5rem))]!',
    'max-md:origin-top-left max-md:rounded-2xl max-md:bg-canvas/85 max-md:py-1 max-md:pr-0',
    'max-md:transition-[opacity,transform,visibility] max-md:duration-[180ms] max-md:data-[drawer-open=false]:pointer-events-none',
    'max-md:data-[drawer-open=false]:invisible max-md:data-[drawer-open=false]:-translate-y-2 max-md:data-[drawer-open=false]:scale-[0.98] max-md:data-[drawer-open=false]:opacity-0'
].join(' ');

const CanvasRightPanelRegion = ({
    panel,
    isNarrowViewport,
    isDrawerOpen,
    onDrawerOpenChange,
    ...panelProps
}: CanvasRightPanelRegionProps) => {
    const isCompactAnalysis = useMedia(COMPACT_ANALYSIS_MEDIA_QUERY);
    const drawerLabel = isDrawerOpen ? 'Close canvas panel' : 'Open canvas panel';

    return (
        <>
            {isNarrowViewport && (
                <button
                    type='button'
                    className='glass-surface absolute right-0 top-1/2 z-[6] flex h-[54px] w-[26px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-l-full border-0 bg-overlay p-0 text-muted shadow-overlay transition-colors duration-[140ms] ease-out hover:text-foreground aria-expanded:text-foreground pointer-coarse:md:max-[1199px]:mr-[env(safe-area-inset-right,0px)] pointer-coarse:md:max-[1199px]:h-16 pointer-coarse:md:max-[1199px]:w-8 max-md:right-[var(--canvas-mobile-control-right)] max-md:top-[var(--canvas-mobile-control-top)] max-md:z-[125] max-md:size-[var(--canvas-mobile-control-size)] max-md:translate-y-0 max-md:rounded-full'
                    onClick={() => onDrawerOpenChange((open) => !open)}
                    aria-label={drawerLabel}
                    title={drawerLabel}
                    aria-expanded={isDrawerOpen}
                    aria-controls='canvas-right-panel'
                    data-tour-id='canvas-analysis-panel-toggle'
                >
                    <PanelRight size={14} aria-hidden='true' />
                </button>
            )}
            {!isNarrowViewport && (
                <div className='pointer-events-none absolute z-[3] w-[15px] translate-x-1/2'
                    style={{
                        top: 0,
                        bottom: 0,
                        right: panel.size
                    }}
                >
                    <ResizeHandle
                        direction={ResizeDirection.Horizontal}
                        isDragging={panel.isDragging}
                        label='Resize right sidebar'
                        controls='canvas-right-panel'
                        className='pointer-events-auto mx-0 h-full w-[15px]'
                        {...panel.handleProps}
                    />
                </div>
            )}
            <div className={cn(PANEL_CLASS, isNarrowViewport && DRAWER_CLASS)}
                id='canvas-right-panel'
                style={{ width: panel.size }}
                data-drawer-open={isNarrowViewport ? (isDrawerOpen ? 'true' : 'false') : undefined}
            >
                <ObjectsPanel {...panelProps} mode={isCompactAnalysis ? 'analysis-compact' : 'default'} />
            </div>
        </>
    );
};

export default CanvasRightPanelRegion;
