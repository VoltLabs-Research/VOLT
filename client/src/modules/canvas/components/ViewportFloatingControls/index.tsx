import CameraMenuPopover from '../CameraMenuPopover';
import PerformanceMenuPopover from '../PerformanceMenuPopover';
import RenderMenuPopover from '../RenderMenuPopover';
import ScreenshotMenuPopover from '../ScreenshotMenuPopover';

import './ViewportFloatingControls.css';

const ViewportFloatingControls = () => {
    return (
        <div
            className="volt-container canvas-viewport-floating-controls d-flex items-center gap-025"
            role="toolbar"
            aria-label="Viewport controls"
        >
            <RenderMenuPopover compact />
            <CameraMenuPopover compact />
            <ScreenshotMenuPopover compact />
            <PerformanceMenuPopover compact />
        </div>
    );
};

export default ViewportFloatingControls;
