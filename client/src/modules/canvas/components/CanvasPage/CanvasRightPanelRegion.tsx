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

/** The right sidebar region: drawer toggle on narrow viewports, resize rail on wide ones. */
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
                    className='canvas-panel-drawer-toggle canvas-panel-drawer-toggle--right'
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
                <div className='absolute canvas-resize-rail canvas-resize-rail--right'
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
                        {...panel.handleProps}
                    />
                </div>
            )}
            <div className='flex flex-col absolute canvas-right-panel-container canvas-overlay-glass'
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
