import CameraMenuPopover from '../CameraMenuPopover';
import PerformanceMenuPopover from '../PerformanceMenuPopover';
import RenderMenuPopover from '../RenderMenuPopover';
import ScreenshotMenuPopover from '../ScreenshotMenuPopover';
import { useMedia } from '@/shared/ui/hooks/use-media';
import useTip from '@/shared/tips/use-tip';

const ViewportFloatingControls = () => {
    const isMobileViewport = useMedia('(max-width: 768px)');

    useTip('canvas-render-settings', {
        enabled: !isMobileViewport
    });

    return (
        <div
            className='canvas-viewport-floating-controls pointer-events-auto absolute z-[100] inline-flex flex-col items-center gap-1 p-1 left-auto right-3 top-16 rounded-xl [.canvas-editor-root--read-only_&]:top-4 max-md:box-border max-md:w-[var(--canvas-mobile-control-column-size)] max-md:right-[var(--canvas-mobile-control-column-right)] max-md:top-[var(--canvas-mobile-viewport-controls-top)] max-md:[.canvas-editor-root--read-only_&]:top-[var(--canvas-mobile-viewport-controls-top)]'
            role='toolbar'
            aria-label='Viewport controls'
        >
            <RenderMenuPopover compact />
            <CameraMenuPopover compact />
            <ScreenshotMenuPopover compact />
            <PerformanceMenuPopover compact />
        </div>
    );
};

export default ViewportFloatingControls;
