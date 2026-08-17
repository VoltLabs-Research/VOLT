import RenderMenuPopover from '../RenderMenuPopover';
import ScreenshotMenuPopover from '../ScreenshotMenuPopover';

const ViewportFloatingControls = () => (
    <div
        className='canvas-viewport-floating-controls pointer-events-auto absolute z-[100] inline-flex flex-col items-center gap-1 p-1 left-auto right-3 top-16 rounded-xl [.canvas-editor-root--read-only_&]:top-4 max-md:box-border max-md:w-[var(--canvas-mobile-control-column-size)] max-md:right-[var(--canvas-mobile-control-column-right)] max-md:top-[var(--canvas-mobile-viewport-controls-top)] max-md:[.canvas-editor-root--read-only_&]:top-[var(--canvas-mobile-viewport-controls-top)]'
        role='toolbar'
        aria-label='Viewport controls'
    >
        <RenderMenuPopover compact />
        <ScreenshotMenuPopover compact />
    </div>
);

export default ViewportFloatingControls;
