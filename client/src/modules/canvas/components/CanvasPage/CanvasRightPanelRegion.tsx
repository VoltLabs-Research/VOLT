import ResizeHandle from '../ResizeHandle';
import RightPanel from '../RightPanel';
import { ResizeDirection } from '../../hooks/use-resizable';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { PanelRight } from 'lucide-react';

import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import type useResizable from '../../hooks/use-resizable';

interface CanvasRightPanelRegionProps extends Omit<ComponentProps<typeof RightPanel>, 'compactAnalysisOnly'> {
    panel: ReturnType<typeof useResizable>;
    isNarrowViewport: boolean;
    isDrawerOpen: boolean;
    onDrawerOpenChange: Dispatch<SetStateAction<boolean>>;
}

const COMPACT_ANALYSIS_MEDIA_QUERY = '(max-width: 768px)';



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
                    className='absolute right-0 top-1/2 z-[6] flex h-[54px] w-[26px] -translate-y-1/2 cursor-pointer items-center justify-center p-0 rounded-l-md border border-r-0 border-border bg-surface-secondary text-muted backdrop-blur-[6px] transition-[background-color,color] duration-[140ms] ease-out hover:bg-surface-hover hover:text-foreground pointer-coarse:md:max-[1199px]:h-16 pointer-coarse:md:max-[1199px]:w-8 pointer-coarse:md:max-[1199px]:bg-surface pointer-coarse:md:max-[1199px]:shadow-[0_0_0_1px_var(--border)] pointer-coarse:md:max-[1199px]:mr-[env(safe-area-inset-right,0px)] max-md:left-auto max-md:right-[var(--canvas-mobile-control-column-right)] max-md:top-[var(--canvas-mobile-drawer-trigger-top)] max-md:z-[125] max-md:h-[var(--canvas-mobile-control-column-size)] max-md:w-[var(--canvas-mobile-control-column-size)] max-md:translate-y-0 max-md:rounded-full max-md:border-0 max-md:bg-surface-secondary max-md:shadow-[0_0_0_1px_var(--border)]'
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
            <div className='absolute inset-y-0 right-0 z-[3] flex flex-col overflow-hidden bg-background [.canvas-editor-root--narrow_&]:z-[5] [.canvas-editor-root--narrow_&]:w-[min(400px,86vw)]! [.canvas-editor-root--narrow_&]:max-w-[86vw] [.canvas-editor-root--narrow_&]:rounded-none [.canvas-editor-root--narrow_&]:bg-background [.canvas-editor-root--narrow_&]:pr-[env(safe-area-inset-right,0px)] [.canvas-editor-root--narrow_&]:shadow-[-8px_0_32px_rgba(0,0,0,0.35)] [.canvas-editor-root--narrow_&]:transition-transform [.canvas-editor-root--narrow_&]:duration-[220ms] [.canvas-editor-root--narrow_&]:ease-out-fluid [.canvas-editor-root--narrow_&]:data-[drawer-open=false]:translate-x-full [.canvas-editor-root--narrow_&]:data-[drawer-open=false]:shadow-none max-md:[.canvas-editor-root--narrow_&]:inset-auto max-md:[.canvas-editor-root--narrow_&]:z-[140] max-md:[.canvas-editor-root--narrow_&]:top-[var(--canvas-mobile-panel-top)] max-md:[.canvas-editor-root--narrow_&]:left-[calc(var(--canvas-mobile-panel-edge)_+_env(safe-area-inset-left,0px))] max-md:[.canvas-editor-root--narrow_&]:w-[min(22rem,calc(100vw_-_var(--canvas-mobile-controls-gutter)_-_var(--canvas-mobile-panel-edge)_-_env(safe-area-inset-left,0px)_-_env(safe-area-inset-right,0px)))]! max-md:[.canvas-editor-root--narrow_&]:max-w-[calc(100vw_-_var(--canvas-mobile-controls-gutter)_-_var(--canvas-mobile-panel-edge)_-_env(safe-area-inset-left,0px)_-_env(safe-area-inset-right,0px))] max-md:[.canvas-editor-root--narrow_&]:h-[min(24rem,calc(100dvh_-_var(--canvas-mobile-panel-top)_-_1rem_-_env(safe-area-inset-bottom,0px)))] max-md:[.canvas-editor-root--narrow_&]:max-h-[calc(100dvh_-_var(--canvas-mobile-panel-top)_-_1rem_-_env(safe-area-inset-bottom,0px))] max-md:[.canvas-editor-root--narrow_&]:rounded-xl max-md:[.canvas-editor-root--narrow_&]:border-0 max-md:[.canvas-editor-root--narrow_&]:bg-surface-secondary max-md:[.canvas-editor-root--narrow_&]:pr-0 max-md:[.canvas-editor-root--narrow_&]:shadow-[0_0_0_1px_var(--border)] max-md:[.canvas-editor-root--narrow_&]:origin-top-left max-md:[.canvas-editor-root--narrow_&]:translate-y-0 max-md:[.canvas-editor-root--narrow_&]:scale-100 max-md:[.canvas-editor-root--narrow_&]:transition-[opacity,transform,visibility] max-md:[.canvas-editor-root--narrow_&]:duration-[180ms] max-md:[.canvas-editor-root--narrow_&]:data-[drawer-open=false]:invisible max-md:[.canvas-editor-root--narrow_&]:data-[drawer-open=false]:pointer-events-none max-md:[.canvas-editor-root--narrow_&]:data-[drawer-open=false]:opacity-0 max-md:[.canvas-editor-root--narrow_&]:data-[drawer-open=false]:-translate-y-2 max-md:[.canvas-editor-root--narrow_&]:data-[drawer-open=false]:scale-[0.98] max-md:[.canvas-editor-root--narrow_&]:data-[analysis-compact=true]:w-[min(18rem,calc(100vw_-_var(--canvas-mobile-controls-gutter)_-_var(--canvas-mobile-panel-edge)_-_env(safe-area-inset-left,0px)_-_env(safe-area-inset-right,0px)))]! max-md:[.canvas-editor-root--narrow_&]:data-[analysis-compact=true]:max-w-[calc(100vw_-_var(--canvas-mobile-controls-gutter)_-_var(--canvas-mobile-panel-edge)_-_env(safe-area-inset-left,0px)_-_env(safe-area-inset-right,0px))] max-md:[.canvas-editor-root--narrow_&]:data-[analysis-compact=true]:h-[min(18rem,calc(100dvh_-_var(--canvas-mobile-panel-top)_-_1rem_-_env(safe-area-inset-bottom,0px)))] max-md:[.canvas-editor-root--narrow_&]:data-[analysis-compact=true]:max-h-[calc(100dvh_-_var(--canvas-mobile-panel-top)_-_1rem_-_env(safe-area-inset-bottom,0px))]'
                id='canvas-right-panel'
                style={{ width: panel.size }}
                data-drawer-open={isNarrowViewport ? (isDrawerOpen ? 'true' : 'false') : undefined}
            >
                <RightPanel {...panelProps} compactAnalysisOnly={isCompactAnalysis} />
            </div>
        </>
    );
};

export default CanvasRightPanelRegion;
