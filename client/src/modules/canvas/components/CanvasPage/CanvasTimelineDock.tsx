import ResizeHandle from '../ResizeHandle';
import Timeline from '../Timeline';
import { ResizeDirection } from '../../hooks/use-resizable';

import type { CSSProperties, ComponentProps } from 'react';
import type useResizable from '../../hooks/use-resizable';

interface CanvasTimelineDockProps extends Omit<ComponentProps<typeof Timeline>, 'disableContextualTips'> {
    panel: ReturnType<typeof useResizable>;
    isNarrowViewport: boolean;
}

/**
 * `.canvas-center-timeline`. On a wide viewport a dock pinned to the bottom, inset on
 * the right by however much of the panel is showing; under 768px an inset, transparent,
 * pointer-events-free frame that only its own controls re-enable — which is what keeps
 * the 3D scene grabbable behind the mobile timeline.
 *
 * The `--canvas-floating-surface-*` contract it read resolves to one utility,
 * `bg-surface-secondary`: the border and shadow were literally `0`, the radius was
 * `unset` on this element, and the backdrop filter was `none` once glass was flattened.
 */
const DOCK_CLASS = [
    'absolute bottom-0 left-0 right-auto z-20 flex h-auto max-h-[calc(100%-2rem)] min-h-0 flex-col overflow-visible',
    'w-[calc(100%-max(12px,var(--canvas-right-overlay-size,0px)))] bg-surface-secondary',
    'max-md:pointer-events-none max-md:bottom-4 max-md:left-4 max-md:z-[120] max-md:w-auto',
    'max-md:right-[calc(var(--canvas-right-overlay-size,0px)_+_1rem)] max-md:rounded-xl max-md:bg-transparent'
].join(' ');

/** `.canvas-resize-rail--bottom` and the handle geometry it imposed on its child. */
const RESIZE_RAIL_CLASS = 'pointer-events-none absolute z-[3] h-[15px] -translate-y-1/2';
const RESIZE_HANDLE_CLASS = 'pointer-events-auto my-0 h-[15px] w-full';

/** The resizable bottom dock holding the trajectory timeline. */
const CanvasTimelineDock = ({ panel, isNarrowViewport, ...timelineProps }: CanvasTimelineDockProps) => (
    <div className={DOCK_CLASS}
        id='canvas-center-timeline'
        data-tour-id='canvas-timeline'
        style={!isNarrowViewport ? { '--canvas-timeline-size': `${panel.size}px` } as CSSProperties : undefined}
    >
        {!isNarrowViewport && (
            <div className={RESIZE_RAIL_CLASS}
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
                    className={RESIZE_HANDLE_CLASS}
                    {...panel.handleProps}
                />
            </div>
        )}
        <Timeline {...timelineProps} disableContextualTips={isNarrowViewport} />
    </div>
);

export default CanvasTimelineDock;
