import ResizeHandle from '../ResizeHandle';
import Timeline from '../Timeline';
import { ResizeDirection } from '../../hooks/use-resizable';

import type { CSSProperties, ComponentProps } from 'react';
import type useResizable from '../../hooks/use-resizable';

interface CanvasTimelineDockProps extends Omit<ComponentProps<typeof Timeline>, 'disableContextualTips'> {
    panel: ReturnType<typeof useResizable>;
    isNarrowViewport: boolean;
}

const CanvasTimelineDock = ({ panel, isNarrowViewport, ...timelineProps }: CanvasTimelineDockProps) => (
    <div className='absolute bottom-0 left-0 right-auto z-20 flex h-auto max-h-[calc(100%-2rem)] min-h-0 flex-col overflow-visible w-[calc(100%-max(12px,var(--canvas-right-overlay-size,0px)))] bg-background max-md:pointer-events-none max-md:bottom-4 max-md:left-4 max-md:z-[120] max-md:w-auto max-md:right-[calc(var(--canvas-right-overlay-size,0px)_+_1rem)] max-md:rounded-xl max-md:bg-surface-secondary'
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
        <Timeline {...timelineProps} disableContextualTips={isNarrowViewport} />
    </div>
);

export default CanvasTimelineDock;
