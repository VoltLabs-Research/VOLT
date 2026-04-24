import CameraMenuPopover from '../CameraMenuPopover';
import PerformanceMenuPopover from '../PerformanceMenuPopover';
import RenderMenuPopover from '../RenderMenuPopover';
import ScreenshotMenuPopover from '../ScreenshotMenuPopover';
import ThemeToggleButton from '@/shared/presentation/components/ThemeToggleButton';
import FloatingToolbar from '@/shared/presentation/primitives/FloatingToolbar';
import useTip from '@/shared/tips/use-tip';

import './ViewportFloatingControls.css';

const ViewportFloatingControls = () => {
    useTip('canvas-render-settings');

    return (
        <FloatingToolbar
            align='end'
            className="canvas-viewport-floating-controls"
            aria-label="Viewport controls"
        >
            <RenderMenuPopover compact />
            <CameraMenuPopover compact />
            <ScreenshotMenuPopover compact />
            <PerformanceMenuPopover compact />
            <ThemeToggleButton className="canvas-viewport-floating-btn" />
        </FloatingToolbar>
    );
};

export default ViewportFloatingControls;
