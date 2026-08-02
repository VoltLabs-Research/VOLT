import ResizeHandle from '../ResizeHandle';
import Timeline from '../Timeline';
import { ResizeDirection } from '../../hooks/use-resizable';
import { Box, Stack } from '@voltstack/bravais';

import type { CSSProperties, ComponentProps } from 'react';
import type useResizable from '../../hooks/use-resizable';

interface CanvasTimelineDockProps extends Omit<ComponentProps<typeof Timeline>, 'disableContextualTips'> {
    panel: ReturnType<typeof useResizable>;
    isNarrowViewport: boolean;
}

/** The resizable bottom dock holding the trajectory timeline. */
const CanvasTimelineDock = ({ panel, isNarrowViewport, ...timelineProps }: CanvasTimelineDockProps) => (
    <Stack
        id='canvas-center-timeline'
        className='canvas-center-timeline'
        data-tour-id='canvas-timeline'
        style={!isNarrowViewport ? { '--canvas-timeline-size': `${panel.size}px` } as CSSProperties : undefined}
    >
        {!isNarrowViewport && (
            <Box
                position='absolute'
                className='canvas-resize-rail canvas-resize-rail--bottom'
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
                    {...panel.handleProps}
                />
            </Box>
        )}
        <Timeline {...timelineProps} disableContextualTips={isNarrowViewport} />
    </Stack>
);

export default CanvasTimelineDock;
