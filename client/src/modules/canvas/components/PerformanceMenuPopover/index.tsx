import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { useEditorStore } from '@/modules/canvas/store/editor';
import {
    getPerformancePresetLabel,
    PERFORMANCE_PRESET_OPTIONS
} from '@/shared/rendering/performance';
import { VIEWPORT_FLOATING_BUTTON_CLASS } from '../ViewportFloatingControls/floating-button';
import { Button, Tooltip } from '@heroui/react';
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
        <ContextMenuPopover
            id='viewport-performance'
            triggerAction='click'
            ariaLabel='Performance preset'
            size='sm'
            trigger={compact ? (
                <span className='inline-flex items-center justify-center'>
                    <Tooltip>
                        <Button
                            variant='ghost'
                            size='sm'
                            isIconOnly
                            className={VIEWPORT_FLOATING_BUTTON_CLASS}
                            aria-label={`Performance: ${presetLabel}`}
                        >
                            <Gauge size={14} />
                        </Button>
                        <Tooltip.Content placement='bottom'>{`Performance: ${presetLabel}`}</Tooltip.Content>
                    </Tooltip>
                </span>
            ) : (
                <Button variant='ghost' size='sm' className='text-xs'>
                    <Gauge size={12} className='shrink-0' />
                    {presetLabel}
                </Button>
            )}
            content={(close) => (
                <div className='flex flex-col gap-0.5' role='group' aria-label='Performance preset'>
                    {PERFORMANCE_PRESET_OPTIONS.map((preset) => (
                        <Button
                            key={preset.value}
                            variant={preset.value === performancePreset ? 'secondary' : 'ghost'}
                            size='sm'
                            fullWidth
                            className='justify-start text-xs'
                            onPress={() => {
                                setPerformancePreset(preset.value);
                                close();
                            }}
                        >
                            {preset.title}
                        </Button>
                    ))}
                </div>
            )}
        />
    );
};

export default PerformanceMenuPopover;
