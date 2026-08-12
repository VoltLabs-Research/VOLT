import { cn } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import type { ReactNode } from 'react';

export const PANEL_ICON_STYLE = {
    width: 13,
    height: 13,
    color: 'var(--muted)'
} as const;

interface RightCollapsibleProps {
    title: string;

    icon?: ReactNode;
    expanded: boolean;
    onExpandedChange?: (next: boolean) => void;
    headerAction?: ReactNode;
    children: ReactNode;
    extraClassName?: string;
    collapsible?: boolean;
    tourId?: string;
}

const RightCollapsible = ({
    title,
    expanded,
    onExpandedChange,
    headerAction,
    children,
    extraClassName,
    collapsible = true,
    tourId
}: RightCollapsibleProps) => {
    const reactId = useId();
    const bodyId = `collapsible-section-body-${reactId}`;
    const headingId = `collapsible-section-heading-${reactId}`;
    const triggerId = `collapsible-section-trigger-${reactId}`;
    const [hasBeenExpanded, setHasBeenExpanded] = useState(expanded);

    useEffect(() => {
        if (expanded && !hasBeenExpanded) {
            setHasBeenExpanded(true);
        }
    }, [expanded, hasBeenExpanded]);

    const toggle = () => {
        if (!collapsible) return;
        onExpandedChange?.(!expanded);
    };

    const titleNode = <span className='min-w-0 flex-1 truncate text-xs text-muted [.canvas-objects-panel--analysis-compact_&]:text-2xs'>{title}</span>;
    const actionsNode = <span className='flex shrink-0 flex-row items-center gap-0.5'>{headerAction}</span>;

    return (
        <div data-tour-id={tourId}>
            <div className={cn('flex flex-col', extraClassName)}>
                <div className='flex h-[39px] flex-row items-center justify-between gap-2 px-3 max-md:h-auto max-md:min-h-[34px] [.canvas-objects-panel--analysis-compact_&]:h-[30px] [.canvas-objects-panel--analysis-compact_&]:min-h-[30px] [.canvas-objects-panel--analysis-compact_&]:px-2'>
                    <h3 id={headingId} className='m-0 min-w-0 flex-1'>
                        <span className='flex min-h-8 w-full min-w-0 flex-row items-center gap-2 max-md:min-h-[34px] [.canvas-objects-panel--analysis-compact_&]:min-h-7'>
                            {collapsible ? (
                                <>
                                    <button
                                        id={triggerId}
                                        type='button'
                                        className='mr-1 flex min-h-8 min-w-0 flex-1 cursor-pointer flex-row items-center gap-2 border-none bg-transparent p-0 text-left select-none max-md:min-h-[34px] [.canvas-objects-panel--analysis-compact_&]:min-h-7'
                                        onClick={toggle}
                                        aria-expanded={expanded}
                                        aria-controls={bodyId}
                                    >
                                        {titleNode}
                                    </button>
                                    {actionsNode}
                                    <button
                                        type='button'
                                        className='flex size-[1.625rem] shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent p-0 text-muted hover:bg-surface-hover focus-visible:bg-surface-hover [.canvas-objects-panel--analysis-compact_&]:size-[1.375rem]'
                                        onClick={toggle}
                                        aria-expanded={expanded}
                                        aria-controls={bodyId}
                                        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
                                    >
                                        <ChevronDown
                                            size={13}
                                            aria-hidden='true'
                                            className={expanded ? undefined : '-rotate-90'}
                                        />
                                    </button>
                                </>
                            ) : (
                                <>
                                    {titleNode}
                                    {actionsNode}
                                </>
                            )}
                        </span>
                    </h3>
                </div>
                <div
                    id={bodyId}
                    className={cn(
                        'overflow-hidden pl-2 [&_.canvas-tree-container]:px-0 [&_.canvas-tree-container]:pb-2.5 [&_.canvas-tree-container]:pt-1.5',
                        !collapsible && 'overflow-visible',
                        collapsible && !expanded && 'h-0'
                    )}
                    role='region'
                    aria-labelledby={collapsible ? triggerId : headingId}
                >
                    <div className='flex flex-col'>
                        {collapsible ? (hasBeenExpanded ? children : null) : children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RightCollapsible;
