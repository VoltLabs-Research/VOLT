import { prefetchRoute } from '@/shared/utils/route-prefetch';
import { cn } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface NavItemProps {
    label: string;
    icon?: LucideIcon;
    to?: string;
    onClick?: () => void;
    isActive?: boolean;
    isDisabled?: boolean;
    collapsed?: boolean;
    // Rows inside an expanded group: one step smaller, indented by the group itself.
    isNested?: boolean;
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
    isNested = false,
    isExpanded,
    controls
}: NavItemProps) => {
    const isGroup = isExpanded !== undefined;
    // The pill marks the page you are on. A group's own row only names its open section, unless
    // the rail is collapsed and its icon is all that is left of it.
    const showIndicator = isActive && !isDisabled && (!isGroup || collapsed);

    const className = cn(
        'relative isolate flex h-11 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-md bg-transparent px-2 text-left transition-colors duration-150 ease-out-fluid lg:h-8',
        isNested ? 'text-sm' : 'text-base',
        !isDisabled && !isActive && 'font-normal text-muted hover:text-foreground',
        !isDisabled && isActive && 'font-medium text-foreground',
        isDisabled && 'cursor-not-allowed font-normal text-muted opacity-50',
        collapsed && 'justify-center px-0'
    );

    const content = (
        <>
            {showIndicator ? <span className='nav-indicator absolute inset-0 -z-10 rounded-md bg-foreground/6' aria-hidden='true' /> : null}

            {Icon ? (
                <span className='flex size-6 shrink-0 items-center justify-center'>
                    <Icon className='size-4.5' aria-hidden='true' />
                </span>
            ) : null}

            <span className={collapsed ? 'sr-only' : 'min-w-0 flex-1 truncate'}>{label}</span>

            {isGroup ? (
                <ChevronDown
                    className={cn(
                        'size-4 shrink-0 transition-transform duration-200 ease-out-fluid',
                        isExpanded && 'rotate-180',
                        collapsed && 'hidden'
                    )}
                    aria-hidden='true'
                />
            ) : null}
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
            aria-current={isActive && !isGroup ? 'page' : undefined}
            aria-expanded={isExpanded}
            aria-controls={controls}
        >
            {content}
        </button>
    );
};

export default NavItem;
