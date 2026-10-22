import ResizeHandle from '../ResizeHandle';
import Timeline from '../Timeline';
import { ResizeDirection } from '../../hooks/use-resizable';

import type { CSSProperties, ComponentProps, ReactNode } from 'react';
import type useResizable from '../../hooks/use-resizable';

interface CanvasTimelineDockProps extends ComponentProps<typeof Timeline> {
    panel: ReturnType<typeof useResizable>;
    isNarrowViewport: boolean;
    statusBar?: ReactNode;
}

const CanvasTimelineDock = ({ panel, isNarrowViewport, statusBar, ...timelineProps }: CanvasTimelineDockProps) => (
    // Glass docked over the bottom of the viewport; on phones a floating card inside it.
    <div className='absolute inset-x-0 bottom-0 z-20 flex h-auto max-h-[calc(100%-2rem)] min-h-0 flex-col overflow-visible bg-dashboard-surface shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_6%,transparent)] max-md:pointer-events-none max-md:inset-x-2 max-md:bottom-2 max-md:max-h-[calc(100%-4rem)] max-md:gap-1.5 max-md:rounded-2xl max-md:p-1.5 max-md:shadow-overlay'
        id='canvas-center-timeline'
        data-tour-id='canvas-timeline'
        style={!isNarrowViewport ? { '--canvas-timeline-size': `${panel.size}px` } as CSSProperties : undefined}
    >
        {!isNarrowViewport && (
            <div className='pointer-events-none absolute z-[3] h-[15px] -translate-y-1/2'
                style={{
                    top: 0,
                    left: 0,
                    right: 0
                }}
            >
                <ResizeHandle
                    direction={ResizeDirection.Vertical}
                    isDragging={panel.isDragging}
                    label='Resize timeline'
                    controls='canvas-center-timeline'
                    className='pointer-events-auto my-0 h-[15px] w-full'
                    {...panel.handleProps}
                />
            </div>
        )}
        <Timeline {...timelineProps} />
        {statusBar}
    </div>
);

export default CanvasTimelineDock;
