import { Droplet, Eye, Minus, Plus, SlidersHorizontal } from 'lucide-react';
import { Button, Label, Slider } from '@heroui/react';

import type { MenuOption } from '@/shared/contracts/menu';

interface SliderSubmenuProps {
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (value: number) => void;
}

/*
 * `.context-menu-transparency` and `__label` were never defined in any surviving
 * stylesheet — not even before this migration — so the row had no layout of its own
 * (spec §5b.4). It gets the minimum that makes a labelled control legible in a submenu
 * panel, and nothing more.
 */
const SUBMENU_ROW_CLASS = 'flex min-w-[200px] flex-col gap-1.5 p-2';

const SUBMENU_LABEL_CLASS = 'text-xs text-muted';

const SliderSubmenu = ({ label, min, max, step, value, onChange }: SliderSubmenuProps) => (
    <div className={SUBMENU_ROW_CLASS}>
        <Slider
            minValue={min}
            maxValue={max}
            step={step}
            value={value}
            onChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
        >
            <Label className={SUBMENU_LABEL_CLASS}>{label}</Label>
            <Slider.Track>
                <Slider.Fill />
                <Slider.Thumb />
            </Slider.Track>
        </Slider>
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
    <div className={SUBMENU_ROW_CLASS}>
        <span className={SUBMENU_LABEL_CLASS}>Color</span>
        <div className='flex flex-row items-center gap-2'>
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
                onPress={() => onChange(undefined)}
            >
                Reset
            </Button>
        </div>
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
