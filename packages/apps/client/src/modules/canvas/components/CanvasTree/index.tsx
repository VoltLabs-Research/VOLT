import { cn } from '@heroui/react';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';

import type { ReactNode } from 'react';
import type { MenuOption } from '@/shared/contracts/menu';

export type CanvasTreeIndent = 'base' | 'lg' | 'xl';

export const TREE_ROW_CLASS = 'relative w-full rounded-xl border-none bg-transparent px-2.5 py-2 text-left outline-none transition-colors duration-[140ms] [.canvas-objects-panel--analysis-compact_&]:min-h-7 [.canvas-objects-panel--analysis-compact_&]:gap-1 [.canvas-objects-panel--analysis-compact_&]:px-1.5 [.canvas-objects-panel--analysis-compact_&]:py-1';

const INDENT_CLASS: Record<CanvasTreeIndent, string> = {
    base: 'pl-4 [.canvas-objects-panel--analysis-compact_&]:pl-2.5',
    lg: 'pl-8 [.canvas-objects-panel--analysis-compact_&]:pl-4',
    xl: 'pl-12 [.canvas-objects-panel--analysis-compact_&]:pl-6'
};

export const treeIndentClass = (indent: CanvasTreeIndent): string => INDENT_CLASS[indent];

interface CanvasTreeRowProps {
    label: ReactNode;
    isActive?: boolean;
    onClick?: () => void;
    indent?: CanvasTreeIndent;
    disabled?: boolean;
    ariaLabel?: string;
    tourTargetId?: string;
}

export const CanvasTreeRow = ({
    label,
    isActive,
    onClick,
    indent = 'base',
    disabled,
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
            disabled ? 'cursor-default opacity-65' : 'hover:bg-foreground/5 focus-visible:bg-foreground/[0.06]',
            !disabled && onClick && 'cursor-pointer'
        )}
    >
        <span className={cn('min-w-0 truncate transition-colors duration-[180ms]', isActive ? 'text-foreground' : 'text-muted')}>{label}</span>
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
