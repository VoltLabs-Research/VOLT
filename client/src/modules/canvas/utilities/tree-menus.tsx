import { Eye, Minus, Plus, SlidersHorizontal } from 'lucide-react';
import Slider from '@/shared/presentation/primitives/Slider';

import type { MenuOption } from '@/shared/presentation/types/menu';

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

export const buildTransparencySubmenu = (_label: string, value: number, onChange: (value: number) => void) => (
    <SliderSubmenu
        label='Transparency'
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={onChange}
    />
);

export const buildLineWidthSubmenu = (_label: string, value: number, defaultValue: number, onChange: (value: number) => void) => (
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
        ? { label: 'Remove from scene', icon: Minus, destructive: true, onClick: onRemove }
        : { label: 'Add to scene', icon: Plus, onClick: onAdd };
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
