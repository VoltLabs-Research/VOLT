import { Droplet, Eye, Minus, Plus, SlidersHorizontal } from 'lucide-react';
import { Button, Row, Slider } from '@voltstack/bravais';

import type { MenuOption } from '@/shared/contracts/menu';

interface SliderSubmenuProps {
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (value: number) => void;
}

const SliderSubmenu = ({ label, min, max, step, value, onChange }: SliderSubmenuProps) => (
    <div className="context-menu-transparency">
        <span className="context-menu-transparency__label">{label}</span>
        <Slider
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={onChange}
        />
    </div>
);

export const buildTransparencySubmenu = (value: number, onChange: (value: number) => void) => (
    <SliderSubmenu
        label='Transparency'
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={onChange}
    />
);

export const buildLineWidthSubmenu = (value: number, defaultValue: number, onChange: (value: number) => void) => (
    <SliderSubmenu
        label='Line Width'
        min={Math.max(0.01, defaultValue * 0.25)}
        max={Math.max(defaultValue * 3, defaultValue + 0.25)}
        step={Math.max(0.01, defaultValue * 0.05)}
        value={value}
        onChange={onChange}
    />
);

interface AddRemoveOption {
    isActive: boolean;
    onAdd: () => void;
    onRemove: () => void;
}

export const buildAddRemoveOption = ({ isActive, onAdd, onRemove }: AddRemoveOption): MenuOption => {
    return isActive
        ? {
            label: 'Remove from scene',
            icon: Minus,
            destructive: true,
            onClick: onRemove
        }
        : {
            label: 'Add to scene',
            icon: Plus,
            onClick: onAdd
        };
};

export const transparencyOption = (submenuContent: React.ReactNode): MenuOption => ({
    label: 'Transparency',
    icon: Eye,
    submenuContent
});

export const lineSettingsOption = (submenuContent: React.ReactNode): MenuOption => ({
    label: 'Line Settings',
    icon: SlidersHorizontal,
    submenuContent
});

interface ColorSubmenuProps {
    value: string;
    onChange: (color: string | undefined) => void;
}

const ColorSubmenu = ({ value, onChange }: ColorSubmenuProps) => (
    <div className="context-menu-transparency">
        <span className="context-menu-transparency__label">Color</span>
        <Row gap='05' align='center'>
            <input
                type='color'
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-label='Scene color override'
            />
            <Button
                variant='ghost'
                size='sm'
                className='text-xs'
                onClick={() => onChange(undefined)}
            >
                Reset
            </Button>
        </Row>
    </div>
);

export const buildColorSubmenu = (
    value: string | undefined,
    onChange: (color: string | undefined) => void
) => (
    <ColorSubmenu value={value ?? '#4d80e6'} onChange={onChange} />
);

export const colorOption = (submenuContent: React.ReactNode): MenuOption => ({
    label: 'Color',
    icon: Droplet,
    submenuContent
});
