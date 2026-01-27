import { memo, useEffect, useState } from 'react';
import type { IconType, IconBaseProps } from 'react-icons';
import { GrStatusUnknown } from 'react-icons/gr';
import { ICON_LIB_LOADERS } from '@/shared/presentation/components/atoms/common/DynamicIcon/loaders';

type IconLib = keyof typeof ICON_LIB_LOADERS;

const getLibFromIconName = (iconName: string): IconLib | null => {
    const m = iconName.match(/^[A-Z][a-z0-9]*/);
    const prefix = (m?.[0] ?? '').toLowerCase();
    return prefix in ICON_LIB_LOADERS ? (prefix as IconLib) : null;
};

const isRenderableComponent = (x: unknown): x is IconType => {
    return typeof x === 'function';
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
        const candidate = (mod as Record<string, unknown>)[iconName];
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

const DynamicIcon = memo(function DynamicProps({
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
