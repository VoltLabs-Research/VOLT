import CameraMenuPopover from '../CameraMenuPopover';
import PerformanceMenuPopover from '../PerformanceMenuPopover';
import RenderMenuPopover from '../RenderMenuPopover';
import ScreenshotMenuPopover from '../ScreenshotMenuPopover';
import ThemeToggleButton from '@/shared/presentation/components/ThemeToggleButton';

import './ViewportFloatingControls.css';

const ViewportFloatingControls = () => {
    return (
        <div
            className="volt-container canvas-viewport-floating-controls d-flex column items-center gap-025"
            role="toolbar"
            aria-label="Viewport controls"
        >
            <RenderMenuPopover compact />
            <CameraMenuPopover compact />
            <ScreenshotMenuPopover compact />
            <PerformanceMenuPopover compact />
            <ThemeToggleButton className="canvas-viewport-floating-btn" />
        </div>
    );
};

export default ViewportFloatingControls;
