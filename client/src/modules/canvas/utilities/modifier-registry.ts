import ColorCoding from '../components/ColorCoding';
import ParticleFilter from '../components/ParticleFilter';
import SlicePlane from '../components/SlicePlane';

import type { ResolvedModifier } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { ComponentType } from 'react';

export interface BuiltInModifierDefinition {
    id: string;
    title: string;
    component?: ComponentType<any>;
    type?: 'built-in' | 'plugin';
};

export const BUILT_IN_MODIFIERS: BuiltInModifierDefinition[] = [
    {
        id: 'slice-plane',
        title: 'Slice Plane',
        component: SlicePlane,
        type: 'built-in'
    },
    {
        id: 'particle-filter',
        title: 'Particle Filter',
        component: ParticleFilter,
        type: 'built-in'
    },
    {
        id: 'color-coding',
        title: 'Color Coding',
        component: ColorCoding,
        type: 'built-in'
    }
];

export interface ModifierOption {
    modifierId: string;
    title: string;
    isPlugin: boolean;
    plugin?: ResolvedModifier['plugin'];
    pluginId?: string;
    pluginModifierId?: string;
};

export const buildCanvasModifierOptions = (pluginModifiers: ResolvedModifier[]): ModifierOption[] => {
    const builtInOptions: ModifierOption[] = BUILT_IN_MODIFIERS.map((modifier) => ({
        modifierId: modifier.id,
        title: modifier.title,
        isPlugin: false
    }));

    const pluginOptions: ModifierOption[] = pluginModifiers.map((modifier) => ({
        modifierId: `plugin:${modifier.pluginId}`,
        title: modifier.name,
        isPlugin: true,
        plugin: modifier.plugin,
        pluginId: modifier.plugin?._id,
        pluginModifierId: modifier.pluginId
    }));

    return [...builtInOptions, ...pluginOptions].sort((a, b) => (
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    ));
};
