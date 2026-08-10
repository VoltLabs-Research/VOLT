import CameraMenuPopover from '../CameraMenuPopover';
import PerformanceMenuPopover from '../PerformanceMenuPopover';
import RenderMenuPopover from '../RenderMenuPopover';
import ScreenshotMenuPopover from '../ScreenshotMenuPopover';
import ThemeToggleButton from '@/shared/ui/components/ThemeToggleButton';
import { VIEWPORT_FLOATING_BUTTON_CLASS } from './floating-button';
import { useChatSurfaceStore } from '@/modules/ai/store/use-chat-surface-store';
import { Button, Tooltip } from '@heroui/react';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { Sparkles } from 'lucide-react';
import useTip from '@/shared/tips/use-tip';

/**
 * bravais's `FloatingToolbar` had no HeroUI equivalent, so its chrome is inlined:
 * `absolute` + `inline-flex`, with `align='end'`'s `right: 1rem` replaced by the
 * `right` this module always overrode it with.
 *
 * The surface is the canvas floating surface `CanvasPage.css` handed every
 * `--canvas-floating-surface-*` consumer. With glass already flattened
 * (`--glass-blur: none`, `--glass-bg-secondary: --surface-secondary`) and the border
 * and shadow set to `0`, that whole contract resolves to two utilities:
 * `rounded-xl bg-surface-secondary`.
 *
 * `top` keeps three values because the stylesheet did: 4rem normally, 1rem when the
 * canvas is read-only (there is no toolbar row to clear), and the mobile control
 * column's offset under 768px. The read-only case is the one ancestor-flag contract
 * left, so it is a variant (spec §5b.3) rather than a descendant selector.
 */
const CONTROLS_CLASS = [
    'pointer-events-auto absolute z-[100] mr-2 inline-flex flex-col items-center gap-1 p-1',
    'left-auto right-[max(12px,var(--canvas-right-overlay-size,0px))] top-16',
    'rounded-xl bg-surface-secondary',
    '[.canvas-editor-root--read-only_&]:top-4',
    'max-md:box-border max-md:mr-0 max-md:w-[var(--canvas-mobile-control-column-size)]',
    'max-md:right-[var(--canvas-mobile-control-column-right)]',
    'max-md:top-[var(--canvas-mobile-viewport-controls-top)]',
    'max-md:[.canvas-editor-root--read-only_&]:top-[var(--canvas-mobile-viewport-controls-top)]'
].join(' ');

const ViewportFloatingControls = () => {
    const isMobileViewport = useMedia('(max-width: 768px)');
    const toggleVoltAi = useChatSurfaceStore((s) => s.toggleWidget);

    useTip('canvas-render-settings', {
        enabled: !isMobileViewport
    });

    return (
        <div
            className={`canvas-viewport-floating-controls ${CONTROLS_CLASS}`}
            role='toolbar'
            aria-label='Viewport controls'
        >
            <Tooltip>
                <Button
                    variant='ghost'
                    size='sm'
                    isIconOnly
                    className={VIEWPORT_FLOATING_BUTTON_CLASS}
                    aria-label='Open Volt AI'
                    onPress={toggleVoltAi}
                >
                    <Sparkles size={14} />
                </Button>
                <Tooltip.Content placement='bottom'>Volt AI</Tooltip.Content>
            </Tooltip>
            <RenderMenuPopover compact />
            <CameraMenuPopover compact />
            <ScreenshotMenuPopover compact />
            <PerformanceMenuPopover compact />
            <ThemeToggleButton className={VIEWPORT_FLOATING_BUTTON_CLASS} />
        </div>
    );
};

export default ViewportFloatingControls;
