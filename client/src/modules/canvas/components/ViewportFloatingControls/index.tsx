import CameraMenuPopover from '../CameraMenuPopover';
import PerformanceMenuPopover from '../PerformanceMenuPopover';
import RenderMenuPopover from '../RenderMenuPopover';
import ScreenshotMenuPopover from '../ScreenshotMenuPopover';
import ThemeToggleButton from '@/shared/ui/components/ThemeToggleButton';
import { useChatSurfaceStore } from '@/modules/ai/store/use-chat-surface-store';
import { Button, Separator, Tooltip } from '@heroui/react';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { Sparkles } from 'lucide-react';
import useTip from '@/shared/tips/use-tip';

const ViewportFloatingControls = () => {
    const isMobileViewport = useMedia('(max-width: 768px)');
    const toggleVoltAi = useChatSurfaceStore((s) => s.toggleWidget);

    useTip('canvas-render-settings', {
        enabled: !isMobileViewport
    });

    return (
        <div
            className='canvas-viewport-floating-controls pointer-events-auto absolute z-[100] mr-2 inline-flex flex-col items-center gap-1 p-1 left-auto right-[max(12px,var(--canvas-right-overlay-size,0px))] top-16 rounded-xl [.canvas-editor-root--read-only_&]:top-4 max-md:box-border max-md:mr-0 max-md:w-[var(--canvas-mobile-control-column-size)] max-md:right-[var(--canvas-mobile-control-column-right)] max-md:top-[var(--canvas-mobile-viewport-controls-top)] max-md:[.canvas-editor-root--read-only_&]:top-[var(--canvas-mobile-viewport-controls-top)]'
            role='toolbar'
            aria-label='Viewport controls'
        >
            <Tooltip>
                <Button
                    variant='ghost'
                    size='sm'
                    isIconOnly
                    className='size-[30px] min-h-[30px] min-w-[30px] rounded-full p-0 text-muted hover:text-foreground focus-visible:text-foreground max-md:size-[34px] max-md:min-h-[34px] max-md:min-w-[34px]'
                    aria-label='Open Volt AI'
                    onPress={toggleVoltAi}
                >
                    <Sparkles size={14} />
                </Button>
                <Tooltip.Content placement='bottom'>Volt AI</Tooltip.Content>
            </Tooltip>
            <Separator orientation='horizontal' className='h-px w-4 bg-border' />
            <RenderMenuPopover compact />
            <CameraMenuPopover compact />
            <ScreenshotMenuPopover compact />
            <PerformanceMenuPopover compact />
            <ThemeToggleButton className='size-[30px] min-h-[30px] min-w-[30px] rounded-full p-0 text-muted hover:text-foreground focus-visible:text-foreground max-md:size-[34px] max-md:min-h-[34px] max-md:min-w-[34px]' />
        </div>
    );
};

export default ViewportFloatingControls;
