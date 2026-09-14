import { Button, Popover, cn } from '@heroui/react';
import { useState } from 'react';

import type { ReactNode } from 'react';

interface PresetPopoverProps {
    id: string;
    icon: ReactNode;
    presets: number[];
    value: number;
    suffix: string;
    onSelect: (preset: number) => void;

    hideOnMobile?: boolean;
}

const PresetPopover = ({ id, icon, presets, value, suffix, onSelect, hideOnMobile = false }: PresetPopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
            <Button
                variant='ghost'
                size='sm'
                className={cn('h-7 min-h-7 text-xs', 'max-md:h-7 max-md:min-h-7 max-md:rounded-md max-md:bg-surface-secondary max-md:px-2', hideOnMobile && 'max-md:hidden')}
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
