import CameraMenuPopover from '../CameraMenuPopover';
import PerformanceMenuPopover from '../PerformanceMenuPopover';
import RenderMenuPopover from '../RenderMenuPopover';
import ScreenshotMenuPopover from '../ScreenshotMenuPopover';
import ThemeToggleButton from '@/shared/ui/components/ThemeToggleButton';
import { useChatSurfaceStore } from '@/modules/ai/store/use-chat-surface-store';
import { FloatingToolbar, IconButton, Tooltip } from '@voltstack/bravais';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { Sparkles } from 'lucide-react';
import useTip from '@/shared/tips/use-tip';

import './ViewportFloatingControls.css';

const ViewportFloatingControls = () => {
    const isMobileViewport = useMedia('(max-width: 768px)');
    const toggleVoltAi = useChatSurfaceStore((s) => s.toggleWidget);

    useTip('canvas-render-settings', {
        enabled: !isMobileViewport
    });

    return (
        <FloatingToolbar
            align='end'
            className="canvas-viewport-floating-controls"
            aria-label="Viewport controls"
        >
            <Tooltip content='Volt AI' placement='bottom'>
                <IconButton
                    variant='ghost'
                    size='sm'
                    className="canvas-viewport-floating-btn"
                    aria-label='Open Volt AI'
                    title='Volt AI'
                    onClick={toggleVoltAi}
                >
                    <Sparkles size={14} />
                </IconButton>
            </Tooltip>
            <RenderMenuPopover compact />
            <CameraMenuPopover compact />
            <ScreenshotMenuPopover compact />
            <PerformanceMenuPopover compact />
            <ThemeToggleButton className="canvas-viewport-floating-btn" />
        </FloatingToolbar>
    );
};

export default ViewportFloatingControls;
