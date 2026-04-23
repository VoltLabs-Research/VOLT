import { cn } from '@/shared/utils';
import { ChevronRight } from 'lucide-react';
import { Fragment, forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

export interface BreadcrumbItemData {
    key: string;
    label: ReactNode;
    onClick?: () => void;
    current?: boolean;
}

export interface BreadcrumbProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
    items: BreadcrumbItemData[];
    separator?: ReactNode;
    label?: string;
}

const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(({
    items,
    separator,
    label = 'Breadcrumb',
    className,
    ...rest
}, ref) => {
    const sep = separator ?? <ChevronRight size={12} aria-hidden='true' />;
    const classes = cn(
        'd-flex',
        'items-center',
        'gap-025',
        'font-size-1',
        'color-secondary',
        className
    );

    return (
        <nav ref={ref} aria-label={label} className={classes} {...rest}>
            {items.map((item, index) => {
                const isLast = index === items.length - 1;
                const isCurrent = item.current ?? isLast;

                return (
                    <Fragment key={item.key}>
                        {item.onClick && !isCurrent ? (
                            <button
                                type='button'
                                onClick={item.onClick}
                                className='b-none color-secondary cursor-pointer transition-fast'
                                style={{ background: 'transparent', padding: 0 }}
                            >
                                {item.label}
                            </button>
                        ) : (
                            <span
                                aria-current={isCurrent ? 'page' : undefined}
                                className={isCurrent ? 'color-primary' : undefined}
                            >
                                {item.label}
                            </span>
                        )}
                        {!isLast && (
                            <span className='d-flex items-center color-muted' aria-hidden='true'>
                                {sep}
                            </span>
                        )}
                    </Fragment>
                );
            })}
        </nav>
    );
});

Breadcrumb.displayName = 'Breadcrumb';

export default Breadcrumb;
