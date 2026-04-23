import { useEditorStore } from '@/modules/canvas/stores/editor';
import {
    getPerformancePresetLabel,
    PERFORMANCE_PRESET_OPTIONS
} from '@/shared/domain/rendering/performance';
import { Button, Popover, Tooltip } from '@/shared/presentation/primitives';
import { PopoverMenu } from '@/shared/presentation/primitives';
import { Gauge } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

interface PerformanceMenuPopoverProps {
    compact?: boolean;
}

const PerformanceMenuPopover = ({ compact = false }: PerformanceMenuPopoverProps) => {
    const { performancePreset, setPerformancePreset } = useEditorStore(useShallow((s) => ({
        performancePreset: s.performanceSettings.preset,
        setPerformancePreset: s.performanceSettings.setPreset
    })));

    const presetLabel = getPerformancePresetLabel(performancePreset);

    return (
        <Popover
            id="viewport-performance"
            noPadding
            trigger={compact ? (
                <span className='d-inline-flex flex-center'>
                    <Tooltip content={`Performance: ${presetLabel}`} placement="bottom">
                        <Button
                            variant="ghost"
                            intent="canvas"
                            shape="rounded"
                            size="sm"
                            iconOnly
                            className="canvas-viewport-floating-btn"
                            aria-label={`Performance: ${presetLabel}`}
                        >
                            <Gauge size={14} />
                        </Button>
                    </Tooltip>
                </span>
            ) : (
                <Button
                    variant="ghost"
                    intent="canvas"
                    shape="rounded"
                    size="sm"
                    className="font-size-05 canvas-btn-compact"
                    leftIcon={<span className="d-flex items-center content-center f-shrink-0"><Gauge size={12} /></span>}
                >
                    {presetLabel}
                </Button>
            )}
        >
            {(close) => (
                <PopoverMenu>
                    {PERFORMANCE_PRESET_OPTIONS.map((preset) => (
                        <Button
                            key={preset.value}
                            variant={preset.value === performancePreset ? 'solid' : 'ghost'}
                            intent="canvas"
                            shape="rounded"
                            size="sm"
                            className="font-size-05"
                            block
                            align="start"
                            onClick={() => {
                                setPerformancePreset(preset.value);
                                close();
                            }}
                        >
                            {preset.title}
                        </Button>
                    ))}
                </PopoverMenu>
            )}
        </Popover>
    );
};

export default PerformanceMenuPopover;
