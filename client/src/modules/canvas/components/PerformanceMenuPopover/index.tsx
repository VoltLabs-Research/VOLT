import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { useEditorStore } from '@/modules/canvas/store/editor';
import {
    getPerformancePresetLabel,
    PERFORMANCE_PRESET_OPTIONS
} from '@/shared/rendering/performance';
import { Button } from '@heroui/react';
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
                <button
                    type='button'
                    className='no-highlight inline-flex size-[30px] min-h-[30px] min-w-[30px] transform-gpu cursor-pointer select-none items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted [transition:transform_250ms_ease,background-color_100ms_cubic-bezier(0,0,0.2,1)] motion-reduce:transition-none hover:bg-default hover:text-foreground focus-visible:text-foreground active:scale-[0.98] active:bg-default disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 max-md:size-[34px] max-md:min-h-[34px] max-md:min-w-[34px] [&>svg]:pointer-events-none [&>svg]:size-4 [&>svg]:shrink-0'
                    title={`Performance: ${presetLabel}`}
                    aria-label={`Performance: ${presetLabel}`}
                >
                    <Gauge size={14} />
                </button>
            ) : (
                <button
                    type='button'
                    className='no-highlight inline-flex h-9 w-fit transform-gpu cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-3xl border-0 bg-transparent px-3 text-xs font-medium text-default-foreground [transition:transform_250ms_ease,background-color_100ms_cubic-bezier(0,0,0.2,1)] motion-reduce:transition-none hover:bg-default active:scale-[0.98] active:bg-default disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:h-8 [&>svg]:pointer-events-none [&>svg]:-mx-0.5 [&>svg]:size-4 [&>svg]:shrink-0'
                >
                    <Gauge size={12} className='shrink-0' />
                    {presetLabel}
                </button>
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
