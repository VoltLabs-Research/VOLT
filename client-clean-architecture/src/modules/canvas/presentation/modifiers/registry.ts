import { createElement, type ComponentType } from 'react';
import { PiEngine, PiSelectionThin } from 'react-icons/pi';
import { CiImageOn } from 'react-icons/ci';
import { IoColorPalette } from 'react-icons/io5';
import { VscPulse } from 'react-icons/vsc';
import { RiSliceFill } from 'react-icons/ri';

import SlicePlane from '@/modules/canvas/presentation/components/organisms/SlicePlane';
import PerformanceMonitor from '@/modules/canvas/presentation/components/organisms/PerformanceMonitor';
import ColorCoding from '@/modules/canvas/presentation/components/organisms/ColorCoding';
import ParticleFilter from '@/modules/canvas/presentation/components/organisms/ParticleFilter';
import ModifierConfiguration from '@/modules/plugin/presentation/components/organisms/ModifierConfiguration';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';

export interface LegacyModifierDefinition {
    id: string;
    title: string;
    Icon: ComponentType<any>;
    component?: ComponentType<any> | null;
    opensRenderConfig?: boolean;
}

export interface ModifierOption {
    Icon: ComponentType<any>;
    title: string;
    modifierId: string;
    isPlugin: boolean;
    pluginId?: string;
    pluginModifierId?: string;
    opensRenderConfig?: boolean;
}

interface ModifierToggleContext {
    activeModifiers: string[];
    pluginParam?: string;
    toggleModifier: (id: string) => void;
    setPluginParam: (value?: string | null) => void;
    setModifiers: (ids: string[]) => void;
    setRenderConfigOpen: (open: boolean) => void;
}

export interface PluginSelection {
    pluginId: string;
    modifierSlug: string;
}

export interface ModifierWidgetEntry {
    key: string;
    Component: ComponentType<any>;
    props?: Record<string, unknown>;
}

export const LEGACY_MODIFIERS: LegacyModifierDefinition[] = [
    { id: 'color-coding', title: 'Color Coding', Icon: IoColorPalette, component: ColorCoding },
    { id: 'slice-plane', title: 'Slice Plane', Icon: RiSliceFill, component: SlicePlane },
    { id: 'particle-filter', title: 'Particle Selection', Icon: PiSelectionThin, component: ParticleFilter },
    { id: 'performance-monitor', title: 'Performance Monitor', Icon: VscPulse, component: PerformanceMonitor },
    { id: 'raster', title: 'Raster Frames', Icon: CiImageOn, component: null }
];

export const getLegacyModifierOptions = () => (
    LEGACY_MODIFIERS.map((modifier) => ({
        id: modifier.id,
        title: modifier.title,
        Icon: modifier.Icon,
        opensRenderConfig: modifier.opensRenderConfig
    }))
);

export const getActiveLegacyComponents = (activeIds: string[]) => (
    LEGACY_MODIFIERS
        .filter((modifier) => !!modifier.component && activeIds.includes(modifier.id))
        .map((modifier) => [modifier.id, modifier.component!] as const)
);

export const buildPluginModifierOptions = (modifiers: any[]): ModifierOption[] => (
    modifiers.map((modifier: any) => ({
        title: modifier.name,
        modifierId: modifier.plugin._id,
        pluginId: modifier.plugin._id,
        pluginModifierId: modifier.plugin.slug,
        Icon: modifier.icon
            ? () => createElement(DynamicIcon, { iconName: modifier.icon ?? '' })
            : PiEngine,
        isPlugin: true
    }))
);

export const buildCanvasModifierOptions = (modifiers: any[]): ModifierOption[] => (
    [
        ...buildPluginModifierOptions(modifiers),
        ...getLegacyModifierOptions().map((modifier) => ({
            Icon: modifier.Icon,
            title: modifier.title,
            modifierId: modifier.id,
            isPlugin: false,
            opensRenderConfig: modifier.opensRenderConfig
        }))
    ]
);

export const toggleModifierOption = (option: ModifierOption, context: ModifierToggleContext) => {
    if (option.isPlugin) {
        const newPlugin = `${option.pluginId}:${option.pluginModifierId}`;
        context.setPluginParam(context.pluginParam === newPlugin ? null : newPlugin);
        return;
    }

    if (option.opensRenderConfig) {
        const next = context.activeModifiers.includes(option.modifierId)
            ? context.activeModifiers
            : Array.from(new Set([...context.activeModifiers, option.modifierId]));
        context.setModifiers(next);
        context.setRenderConfigOpen(true);
        return;
    }

    context.toggleModifier(option.modifierId);
};

export const buildModifierWidgetEntries = (config: {
    activeModifierIds: string[];
    pluginSelection: PluginSelection | null;
    activePlugin: any | null;
    trajectoryId?: string;
    currentTimestep?: number;
}): ModifierWidgetEntry[] => {
    const entries: ModifierWidgetEntry[] = [];

    getActiveLegacyComponents(config.activeModifierIds).forEach(([key, Component]) => {
        entries.push({ key: `modifier-${key}`, Component });
    });

    if (config.pluginSelection && config.activePlugin && config.trajectoryId) {
        entries.push({
            key: 'plugin-modifier',
            Component: ModifierConfiguration,
            props: {
                pluginId: config.pluginSelection.pluginId,
                modifierId: config.pluginSelection.modifierSlug,
                trajectoryId: config.trajectoryId,
                currentTimestep: config.currentTimestep
            }
        });
    }

    return entries;
};
