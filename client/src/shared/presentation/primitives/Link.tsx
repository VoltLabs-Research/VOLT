import { cn } from '@/shared/utils';
import { Link as RouterLink } from 'react-router-dom';
import { forwardRef } from 'react';
import type { LinkProps as RouterLinkProps } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { TextTone } from './types';

const toneMap: Record<TextTone, string> = {
    primary: 'color-primary',
    secondary: 'color-secondary',
    muted: 'color-muted',
    'muted-foreground': 'color-muted-foreground'
};

export interface LinkProps extends RouterLinkProps {
    tone?: TextTone;
    underline?: boolean;
    children?: ReactNode;
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(({
    tone,
    underline = true,
    className,
    children,
    style,
    ...rest
}, ref) => {
    const classes = cn(
        tone ? toneMap[tone] : undefined,
        'transition-fast',
        className
    );

    return (
        <RouterLink
            ref={ref}
            className={classes}
            style={{ textDecoration: underline ? 'underline' : 'none', ...style }}
            {...rest}
        >
            {children}
        </RouterLink>
    );
});

Link.displayName = 'Link';

export default Link;
