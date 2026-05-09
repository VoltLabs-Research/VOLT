import { ICON_COMPONENTS } from '@/shared/presentation/components/DynamicIcon/loaders';
import { memo, useEffect, useState } from 'react';
import type { DynamicIconComponent, DynamicIconRenderProps } from '@/shared/presentation/components/DynamicIcon/loaders';

const iconCache = new Map<string, DynamicIconComponent>();

const DefaultFallbackIcon: DynamicIconComponent = ({
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

const resolveIcon = (iconName: string, fallback: DynamicIconComponent): DynamicIconComponent => {
    if (!iconName) return fallback;

    const cached = iconCache.get(iconName);
    if (cached) return cached;

    const candidate = ICON_COMPONENTS[iconName];
    if (!candidate) {
        return fallback;
    }

    iconCache.set(iconName, candidate);
    return candidate;
};

export type DynamicIconProps = DynamicIconRenderProps & {
    iconName: string;
    fallback?: DynamicIconComponent;
};

const DynamicIcon = memo(function DynamicIcon({
    iconName,
    fallback = DefaultFallbackIcon,
    ...iconProps
}: DynamicIconProps) {
    const [Icon, setIcon] = useState<DynamicIconComponent>(() => fallback);

    useEffect(() => {
        setIcon(() => resolveIcon(iconName, fallback));
    }, [iconName, fallback]);

    return <Icon aria-hidden {...iconProps} />;
});

export default DynamicIcon;
