import ColorCoding from '../components/ColorCoding';
import ParticleFilter from '../components/ParticleFilter';
import SlicePlane from '../components/SlicePlane';

import { Wrench, LineChart, Scissors, Droplets } from 'lucide-react';
import { createElement } from 'react';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';

import type { ResolvedModifier } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { ComponentType } from 'react';

export interface BuiltInModifierDefinition {
    id: string;
    title: string;
    icon: ComponentType<any>;
    component?: ComponentType<any>;
    type?: 'built-in' | 'plugin';
};

export const BUILT_IN_MODIFIERS: BuiltInModifierDefinition[] = [
    {
        id: 'slice-plane',
        title: 'Slice Plane',
        icon: Scissors,
        component: SlicePlane,
        type: 'built-in'
    },
    {
        id: 'particle-filter',
        title: 'Particle Filter',
        icon: Droplets,
        component: ParticleFilter,
        type: 'built-in'
    },
    {
        id: 'color-coding',
        title: 'Color Coding',
        icon: LineChart,
        component: ColorCoding,
        type: 'built-in'
    }
];

export interface ModifierOption {
    modifierId: string;
    title: string;
    Icon: ComponentType<any>;
    isPlugin: boolean;
    plugin?: ResolvedModifier['plugin'];
    pluginId?: string;
    pluginModifierId?: string;
};

const fallbackIcon = Wrench;

const resolveIcon = (icon?: string): ComponentType<any> => {
    if (!icon) return fallbackIcon;
    const IconWrapper: ComponentType<any> = (props) =>
        createElement(DynamicIcon, { iconName: icon, fallback: fallbackIcon, ...props });
    IconWrapper.displayName = `DynamicIcon(${icon})`;
    return IconWrapper;
};

export const buildCanvasModifierOptions = (pluginModifiers: ResolvedModifier[]): ModifierOption[] => {
    const builtInOptions: ModifierOption[] = BUILT_IN_MODIFIERS.map((modifier) => ({
        modifierId: modifier.id,
        title: modifier.title,
        Icon: modifier.icon,
        isPlugin: false
    }));

    const pluginOptions: ModifierOption[] = pluginModifiers.map((modifier) => ({
        modifierId: `plugin:${modifier.pluginId}`,
        title: modifier.name,
        Icon: resolveIcon(modifier.icon),
        isPlugin: true,
        plugin: modifier.plugin,
        pluginId: modifier.plugin?._id,
        pluginModifierId: modifier.pluginId
    }));

    return [...builtInOptions, ...pluginOptions];
};
