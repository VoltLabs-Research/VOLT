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
    <div className='absolute bottom-0 left-0 right-auto z-20 flex h-auto max-h-[calc(100%-2rem)] min-h-0 flex-col overflow-visible w-full bg-chrome max-md:pointer-events-none max-md:bottom-4 max-md:left-4 max-md:z-[120] max-md:w-auto max-md:right-4 max-md:rounded-xl max-md:bg-surface-secondary'
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
