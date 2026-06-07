import './Breadcrumbs.css';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { forwardRef } from 'react';
import type { ReactNode } from 'react';

export interface BreadcrumbItem {
    id: string;
    title: string;
    leftIcon?: ReactNode;
    onClick?: () => void;
};

export type BreadcrumbsVariant = 'default' | 'compact' | 'pill';

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
    variant?: BreadcrumbsVariant;
    separator?: ReactNode;
    ariaLabel?: string;
    title?: string;
    className?: string;
    onItemClick?: (item: BreadcrumbItem, index: number) => void;
};

const MAX_BREADCRUMB_LABEL_LENGTH = 24;

const truncateBreadcrumbLabel = (label: string) => {
    if (label.length <= MAX_BREADCRUMB_LABEL_LENGTH) {
        return label;
    }

    return `${label.slice(0, MAX_BREADCRUMB_LABEL_LENGTH - 1)}…`;
};

const Breadcrumbs = forwardRef<HTMLElement, BreadcrumbsProps>(({
    items,
    variant = 'default',
    separator,
    ariaLabel = 'Breadcrumbs',
    title,
    className,
    onItemClick
}, ref) => {
    if (!items.length) {
        return null;
    }

    const resolvedSeparator = separator ?? (
        variant === 'compact'
            ? <span className='volt-breadcrumbs__separator'>/</span>
            : <ChevronRight size={12} className='volt-breadcrumbs__separator' aria-hidden='true' />
    );

    return (
        <nav
            ref={ref}
            className={cn('volt-breadcrumbs', `volt-breadcrumbs--${variant}`, className)}
            aria-label={ariaLabel}
            title={title}
        >
            <ol className='volt-breadcrumbs__list'>
                {items.map((item, index) => {
                    const isCurrent = index === items.length - 1;
                    const displayTitle = variant === 'compact'
                        ? truncateBreadcrumbLabel(item.title)
                        : item.title;

                    const handleClick = () => {
                        item.onClick?.();
                        onItemClick?.(item, index);
                    };

                    return (
                        <li key={item.id} className='volt-breadcrumbs__item'>
                            {index > 0 && resolvedSeparator}
                            {isCurrent ? (
                                <span
                                    className='volt-breadcrumbs__current'
                                    aria-current='page'
                                    title={item.title}
                                >
                                    {item.leftIcon && (
                                        <span aria-hidden='true'>{item.leftIcon}</span>
                                    )}
                                    {displayTitle}
                                </span>
                            ) : (
                                <button
                                    type='button'
                                    className='volt-breadcrumbs__trigger'
                                    onClick={handleClick}
                                    title={item.title}
                                    aria-label={`Open ${item.title}`}
                                >
                                    {item.leftIcon && (
                                        <span aria-hidden='true'>{item.leftIcon}</span>
                                    )}
                                    {displayTitle}
                                </button>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
});

Breadcrumbs.displayName = 'Breadcrumbs';

export default Breadcrumbs;
