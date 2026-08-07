import { Button, Popover, PopoverMenu } from '@voltstack/bravais';

import type { ReactNode } from 'react';

interface PresetPopoverProps {
    id: string;
    icon: ReactNode;
    presets: number[];
    value: number;
    suffix: string;
    onSelect: (preset: number) => void;
}

/** Compact numeric picker used by the playback speed and viewport zoom controls. */
const PresetPopover = ({ id, icon, presets, value, suffix, onSelect }: PresetPopoverProps) => (
    <Popover
        id={id}
        noPadding
        trigger={(
            <Button
                variant="ghost"
                intent="canvas"
                shape="rounded"
                size="sm"
                className="text-xs canvas-btn-compact"
                leftIcon={icon}
            >
                {`${value}${suffix}`}
            </Button>
        )}
    >
        {(close) => (
            <PopoverMenu>
                {presets.map((preset) => (
                    <Button
                        key={preset}
                        variant={preset === value ? 'solid' : 'ghost'}
                        intent="canvas"
                        shape="rounded"
                        size="sm"
                        className="text-xs"
                        block
                        align="start"
                        onClick={() => {
                            onSelect(preset);
                            close();
                        }}
                    >
                        {`${preset}${suffix}`}
                    </Button>
                ))}
            </PopoverMenu>
        )}
    </Popover>
);

export default PresetPopover;
