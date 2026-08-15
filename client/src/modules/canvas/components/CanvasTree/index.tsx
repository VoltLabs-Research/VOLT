import { Button, Skeleton, cn } from '@heroui/react';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { RefreshCw } from 'lucide-react';

import type { ReactNode } from 'react';
import type { MenuOption } from '@/shared/contracts/menu';

export type CanvasTreeIndent = 'base' | 'lg' | 'xl';

export const TREE_ROW_CLASS = 'relative w-full border-none bg-transparent px-2.5 py-2 text-left [.canvas-objects-panel--analysis-compact_&]:min-h-[26px] [.canvas-objects-panel--analysis-compact_&]:gap-1 [.canvas-objects-panel--analysis-compact_&]:px-1.5 [.canvas-objects-panel--analysis-compact_&]:py-1 [.canvas-objects-panel--analysis-compact_&]:text-2xs';

const INDENT_CLASS: Record<CanvasTreeIndent, string> = {
    base: 'pl-4 [.canvas-objects-panel--analysis-compact_&]:pl-2.5',
    lg: 'pl-8 [.canvas-objects-panel--analysis-compact_&]:pl-4',
    xl: 'pl-12 [.canvas-objects-panel--analysis-compact_&]:pl-6'
};

export const treeIndentClass = (indent: CanvasTreeIndent): string => INDENT_CLASS[indent];

export const nextTreeIndent = (indent: CanvasTreeIndent): CanvasTreeIndent => {
    if (indent === 'base') return 'lg';
    return 'xl';
};

interface CanvasTreeRowProps {
    icon?: ReactNode;
    label: ReactNode;
    isActive?: boolean;
    onClick?: () => void;
    indent?: CanvasTreeIndent;
    trailing?: ReactNode;
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
    tourTargetId?: string;
}

export const CanvasTreeRow = ({
    icon,
    label,
    isActive,
    onClick,
    indent = 'base',
    trailing,
    disabled,
    className = '',
    ariaLabel,
    tourTargetId
}: CanvasTreeRowProps) => (
    <button
        type='button'
        role='treeitem'
        aria-selected={isActive}
        aria-disabled={disabled}
        aria-label={ariaLabel}
        tabIndex={disabled ? -1 : 0}
        onClick={disabled ? undefined : onClick}
        data-tour-id={tourTargetId}
        className={cn(
            'flex select-none items-center gap-2 text-xs text-muted',
            TREE_ROW_CLASS,
            treeIndentClass(indent),
            isActive && 'text-accent',
            disabled ? 'cursor-default opacity-65' : 'hover:rounded-md hover:bg-surface-hover',
            !disabled && onClick && 'cursor-pointer',
            className
        )}
    >
        {icon ?? <span className='size-[13px] [.canvas-objects-panel--analysis-compact_&]:size-[11px]' />}
        <span className={isActive ? 'text-foreground' : 'text-muted'}>{label}</span>
        {trailing !== undefined && <span className='flex-1' />}
        {trailing}
    </button>
);

interface MaybeContextMenuProps {
    enabled: boolean;
    id: string;
    options: MenuOption[];
    children: ReactNode;
}

export const MaybeContextMenu = ({ enabled, id, options, children }: MaybeContextMenuProps) => {
    if (!enabled) return <>{children}</>;
    return <ContextMenuPopover id={id} trigger={<div>{children}</div>} options={options} size='sm' />;
};

interface CanvasTreeSkeletonRowsProps {
    count: number;
    compact?: boolean;
    indent?: CanvasTreeIndent;
}

export const CanvasTreeSkeletonRows = ({ count, compact, indent = 'base' }: CanvasTreeSkeletonRowsProps) => {
    if (count <= 0) return null;
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={`canvas-tree-skel-${i}`} className={cn(
                    'flex items-center gap-8 text-muted',
                    TREE_ROW_CLASS,
                    treeIndentClass(indent)
                )}>
                    <span className='size-[13px] [.canvas-objects-panel--analysis-compact_&]:size-[11px]' />
                    <Skeleton className={compact ? 'h-2.5 w-20 rounded-md' : 'h-2.5 w-30 rounded-md'} />
                </div>
            ))}
        </>
    );
};

interface CanvasTreeEmptyRowProps {
    label: string;
    indent?: CanvasTreeIndent;
}

export const CanvasTreeEmptyRow = ({ label, indent = 'base' }: CanvasTreeEmptyRowProps) => (
    <div className={cn(
        'flex items-center gap-8 text-muted',
        TREE_ROW_CLASS,
        treeIndentClass(indent)
    )}>
        <span className='text-xs text-muted'>{label}</span>
    </div>
);

interface AnalysisTreeRetryRowProps {
    onRetry: () => void;
    indent?: CanvasTreeIndent;
}

export const AnalysisTreeRetryRow = ({ onRetry, indent = 'lg' }: AnalysisTreeRetryRowProps) => (
    <div className={cn(
        'flex items-center gap-8 text-muted',
        TREE_ROW_CLASS,
        treeIndentClass(indent)
    )}>
        <span className='text-xs text-muted'>Failed to load models</span>
        <span className='flex-1' />
        <Button variant='ghost' size='sm' isIconOnly onPress={onRetry} aria-label='Retry loading models'>
            <RefreshCw style={{
                width: 12,
                height: 12
            }} />
        </Button>
    </div>
);
