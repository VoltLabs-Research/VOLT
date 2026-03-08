import { ICON_LIB_LOADERS } from '@/shared/presentation/components/DynamicIcon/loaders';
import { memo, useEffect, useState } from 'react';
import { GrStatusUnknown } from 'react-icons/gr';
import type { IconType, IconBaseProps } from 'react-icons';

type IconLib = keyof typeof ICON_LIB_LOADERS;

interface IconModule {
    [key: string]: unknown;
};

const ICON_LIB_PREFIXES = Object.keys(ICON_LIB_LOADERS) as IconLib[];

const isIconLib = (value: string): value is IconLib => {
    return ICON_LIB_PREFIXES.some((prefix) => prefix === value);
};

const isIconModule = (value: unknown): value is IconModule => {
    return typeof value === 'object' && value !== null;
};

const getLibFromIconName = (iconName: string): IconLib | null => {
    const match = iconName.match(/^[A-Z][a-z0-9]*/);
    const prefix = (match?.[0] ?? '').toLowerCase();
    return isIconLib(prefix) ? prefix : null;
};

const isRenderableComponent = (value: unknown): value is IconType => {
    return typeof value === 'function';
};

const moduleCache = new Map<IconLib, Promise<Record<string, unknown>>>();
const iconCache = new Map<string, IconType>();

const resolveIcon = async (iconName: string, fallback: IconType): Promise<IconType> => {
    if (!iconName) return fallback;

    const cached = iconCache.get(iconName);
    if (cached) return cached;

    const lib = getLibFromIconName(iconName);
    if (!lib) return fallback;

    let modPromise = moduleCache.get(lib);
    if (!modPromise) {
        modPromise = ICON_LIB_LOADERS[lib]();
        moduleCache.set(lib, modPromise);
    }

    try {
        const mod = await modPromise;
        if (!isIconModule(mod)) return fallback;

        const candidate = mod[iconName];
        if (!isRenderableComponent(candidate)) return fallback;

        iconCache.set(iconName, candidate);
        return candidate;
    } catch {
        return fallback;
    }
};

export type DynamicIconProps = IconBaseProps & {
    iconName: string;
    fallback?: IconType;
};

const DynamicIcon = memo(function DynamicIcon({
    iconName,
    fallback = GrStatusUnknown,
    ...iconProps
}: DynamicIconProps) {
    const [Icon, setIcon] = useState<IconType>(() => fallback);

    useEffect(() => {
        let alive = true;

        setIcon(() => fallback);

        resolveIcon(iconName, fallback).then((Resolved) => {
            if (alive) setIcon(() => Resolved);
        });

        return () => {
            alive = false;
        };
    }, [iconName, fallback]);

    return <Icon aria-hidden {...iconProps} />;
});

export default DynamicIcon;
