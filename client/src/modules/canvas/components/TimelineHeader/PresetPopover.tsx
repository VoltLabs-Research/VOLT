import { Button, Popover, cn } from '@heroui/react';
import { useState } from 'react';
import { FRAME_INFO_BUTTON_CLASS } from '../Timeline/timeline-classes';

import type { ReactNode } from 'react';

interface PresetPopoverProps {
    id: string;
    icon: ReactNode;
    presets: number[];
    value: number;
    suffix: string;
    onSelect: (preset: number) => void;
    /**
     * `Timeline.css` hid `[data-popover-trigger="timeline-zoom"]` under 768px — a
     * viewport zoom control is redundant next to a pinch gesture. `data-popover-trigger`
     * was bravais's own attribute and HeroUI emits nothing like it, so the intent moves
     * to a prop.
     */
    hideOnMobile?: boolean;
}

/**
 * Compact numeric picker used by the playback speed and viewport zoom controls.
 *
 * Open state is local because bravais handed its children a `close()`; HeroUI's Popover
 * is declarative, so picking a preset sets `isOpen` to false instead.
 */
const PresetPopover = ({ id, icon, presets, value, suffix, onSelect, hideOnMobile = false }: PresetPopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
            {/*
              * The Button is the Root's direct child rather than being wrapped in
              * `Popover.Trigger`, which renders its own `role='button'` div — see MenuPopover.
              */}
            <Button
                variant='ghost'
                size='sm'
                className={cn('text-xs', FRAME_INFO_BUTTON_CLASS, hideOnMobile && 'max-md:hidden')}
            >
                {icon}
                {`${value}${suffix}`}
            </Button>

            <Popover.Content placement='bottom start'>
                <Popover.Dialog id={id} aria-label={`${id} presets`} className='flex min-w-40 max-w-80 flex-col p-1'>
                    {presets.map((preset) => (
                        <Button
                            key={preset}
                            variant={preset === value ? 'secondary' : 'ghost'}
                            size='sm'
                            fullWidth
                            className='justify-start text-xs'
                            onPress={() => {
                                onSelect(preset);
                                setIsOpen(false);
                            }}
                        >
                            {`${preset}${suffix}`}
                        </Button>
                    ))}
                </Popover.Dialog>
            </Popover.Content>
        </Popover>
    );
};

export default PresetPopover;
