import { ICON_LIB_LOADERS } from '@/shared/presentation/components/DynamicIcon/loaders';
import { memo, useEffect, useState } from 'react';
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

const DefaultFallbackIcon: IconType = ({
    size = '1em',
    color = 'currentColor',
    className,
    style,
    title
}) => (
    <svg
        aria-hidden='true'
        viewBox='0 0 24 24'
        width={size}
        height={size}
        fill='none'
        stroke={color}
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
        className={className}
        style={style}
    >
        {title ? <title>{title}</title> : null}
        <circle cx='12' cy='12' r='9' />
        <path d='M9.75 9a2.25 2.25 0 0 1 4.16-1.18c.38.5.59 1.1.59 1.72 0 1.57-1.5 2.3-2.17 2.95-.42.41-.58.77-.58 1.51' />
        <circle cx='12' cy='17' r='0.8' fill={color} stroke='none' />
    </svg>
);

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
    fallback = DefaultFallbackIcon,
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
