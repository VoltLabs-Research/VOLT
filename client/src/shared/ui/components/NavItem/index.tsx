import { prefetchRoute } from '@/shared/utils/route-prefetch';
import { cn } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

export type NavItemDepth = 0 | 1 | 2;

interface NavItemProps {
    label: string;
    icon?: LucideIcon;
    to?: string;
    onClick?: () => void;
    isActive?: boolean;
    isDisabled?: boolean;
    collapsed?: boolean;
    depth?: NavItemDepth;
    isExpanded?: boolean;
    controls?: string;
}

const NavItem = ({
    label,
    icon: Icon,
    to,
    onClick,
    isActive = false,
    isDisabled = false,
    collapsed = false,
    depth = 0,
    isExpanded,
    controls
}: NavItemProps) => {
    const className = cn(
        'flex h-11 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-md bg-transparent px-2 text-left text-sm transition-colors duration-150 ease-out-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground lg:h-8',
        ({ 0: '', 1: 'pl-11', 2: 'pl-16' } as const)[depth],
        !isDisabled && !isActive && 'font-normal text-muted hover:text-foreground',
        !isDisabled && isActive && 'font-medium text-foreground',
        isDisabled && 'cursor-not-allowed font-normal text-muted opacity-50',
        collapsed && 'justify-center px-0'
    );

    const content = (
        <>
            {Icon ? (
                <span className='flex size-6 shrink-0 items-center justify-center'>
                    <Icon className='size-[18px]' aria-hidden='true' />
                </span>
            ) : null}

            <span className={collapsed ? 'sr-only' : 'min-w-0 truncate'}>{label}</span>

            {isExpanded === undefined ? null : (
                <ChevronDown
                    className={cn(
                        'ml-auto size-3.5 shrink-0 transition-transform duration-150 ease-out-fluid',
                        isExpanded && 'rotate-180',
                        collapsed && 'hidden'
                    )}
                    aria-hidden='true'
                />
            )}
        </>
    );

    if (to !== undefined && !isDisabled) {
        return (
            <Link
                to={to}
                className={className}
                aria-current={isActive ? 'page' : undefined}
                onPointerEnter={() => prefetchRoute(to)}
                onFocus={() => prefetchRoute(to)}
            >
                {content}
            </Link>
        );
    }

    return (
        <button
            type='button'
            className={className}
            onClick={onClick}
            disabled={isDisabled}
            aria-current={isActive ? 'page' : undefined}
            aria-expanded={isExpanded}
            aria-controls={controls}
        >
            {content}
        </button>
    );
};

export default NavItem;
