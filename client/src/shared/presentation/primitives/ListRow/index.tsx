import { cn } from '@/shared/utils/cn';
import Text from '../Text';
import './ListRow.css';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface ListRowProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
    leading?: ReactNode;
    title?: ReactNode;
    subtitle?: ReactNode;
    meta?: ReactNode;
    trailing?: ReactNode;
    selected?: boolean;
    active?: boolean;
    onClick?: () => void;
    to?: string;
    /** When `onClick`/`to` are absent, renders as a passive `div`. */
    as?: 'button' | 'div' | 'li';
    disabled?: boolean;
}

/**
 * Hoverable list row with leading / primary / subtitle / trailing slots.
 * Consolidates team member rows, chat list items, user cells, and similar list entries.
 */
const ListRow = forwardRef<HTMLElement, ListRowProps>(({
    leading,
    title,
    subtitle,
    meta,
    trailing,
    selected = false,
    active = false,
    onClick,
    to,
    as,
    disabled,
    className,
    ...rest
}, ref) => {
    const classes = cn(
        'volt-list-row',
        'list-item-hoverable',
        selected && 'volt-list-row--selected',
        active && 'volt-list-row--active',
        disabled && 'volt-list-row--disabled',
        className
    );

    const inner = (
        <>
            {leading && (
                <div className='volt-list-row__leading' aria-hidden='true'>
                    {leading}
                </div>
            )}
            <div className='volt-list-row__content'>
                {title && (
                    <Text as='span' size='md' weight='medium' tone='primary' truncate>
                        {title}
                    </Text>
                )}
                {subtitle && (
                    <Text as='span' size='sm' tone='muted' truncate>
                        {subtitle}
                    </Text>
                )}
                {meta}
            </div>
            {trailing && (
                <div className='volt-list-row__trailing'>
                    {trailing}
                </div>
            )}
        </>
    );

    if (to) {
        return (
            <Link
                ref={ref as React.Ref<HTMLAnchorElement>}
                to={to}
                className={classes}
                aria-current={selected ? 'page' : undefined}
                {...(rest as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
            >
                {inner}
            </Link>
        );
    }

    if (onClick || as === 'button') {
        return (
            <button
                ref={ref as React.Ref<HTMLButtonElement>}
                type='button'
                className={classes}
                onClick={onClick}
                disabled={disabled}
                aria-pressed={selected || undefined}
                {...(rest as unknown as React.ButtonHTMLAttributes<HTMLButtonElement>)}
            >
                {inner}
            </button>
        );
    }

    const Component = (as ?? 'div') as 'div' | 'li';

    return (
        <Component
            ref={ref as unknown as React.Ref<HTMLDivElement & HTMLLIElement>}
            className={classes}
            {...(rest as HTMLAttributes<HTMLElement>)}
        >
            {inner}
        </Component>
    );
});

ListRow.displayName = 'ListRow';

export default ListRow;
