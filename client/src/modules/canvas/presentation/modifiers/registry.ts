import type { ComponentType } from 'react';
import { createElement } from 'react';
import { Wrench, LineChart, Scissors, Droplets } from 'lucide-react';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import SlicePlane from '../components/organisms/SlicePlane';
import ParticleFilter from '../components/organisms/ParticleFilter';
import ColorCoding from '../components/organisms/ColorCoding';
import type { ResolvedModifier } from '@/modules/plugin/presentation/stores/use-plugin-store';

export interface LegacyModifierDefinition {
    id: string;
    title: string;
    icon: ComponentType<any>;
    component?: ComponentType<any>;
    type?: 'legacy' | 'plugin';
}

export const LEGACY_MODIFIERS: LegacyModifierDefinition[] = [
    {
        id: 'slice-plane',
        title: 'Slice Plane',
        icon: Scissors,
        component: SlicePlane,
        type: 'legacy'
    },
    {
        id: 'particle-filter',
        title: 'Particle Filter',
        icon: Droplets,
        component: ParticleFilter,
        type: 'legacy'
    },
    {
        id: 'color-coding',
        title: 'Color Coding',
        icon: LineChart,
        component: ColorCoding,
        type: 'legacy'
    }
];

export interface ModifierOption {
    modifierId: string;
    title: string;
    Icon: ComponentType<any>;
    isPlugin: boolean;
    pluginId?: string;
    pluginModifierId?: string;
}

const fallbackIcon = Wrench;

const resolveIcon = (icon?: string): ComponentType<any> => {
    if (!icon) return fallbackIcon;
    const IconWrapper: ComponentType<any> = (props) =>
        createElement(DynamicIcon, { iconName: icon, fallback: fallbackIcon, ...props });
    IconWrapper.displayName = `DynamicIcon(${icon})`;
    return IconWrapper;
};

export const buildCanvasModifierOptions = (pluginModifiers: ResolvedModifier[]): ModifierOption[] => {
    const legacyOptions: ModifierOption[] = LEGACY_MODIFIERS.map((m) => ({
        modifierId: m.id,
        title: m.title,
        Icon: m.icon,
        isPlugin: false
    }));

    const pluginOptions: ModifierOption[] = pluginModifiers.map((modifier) => ({
        modifierId: `plugin:${modifier.pluginSlug}`,
        title: modifier.name,
        Icon: resolveIcon(modifier.icon),
        isPlugin: true,
        pluginId: modifier.plugin?._id,
        pluginModifierId: modifier.pluginSlug
    }));

    return [...legacyOptions, ...pluginOptions];
};
