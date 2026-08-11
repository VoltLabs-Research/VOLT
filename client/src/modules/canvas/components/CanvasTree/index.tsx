import { Button, Skeleton, cn } from '@heroui/react';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { RefreshCw } from 'lucide-react';
import {
    TREE_ITEM_CLASS,
    TREE_ITEM_DISABLED_CLASS,
    TREE_ITEM_HOVER_CLASS,
    TREE_ITEM_INDENT_CLASS,
    TREE_ITEM_SELECTED_CLASS,
    TREE_SPACER_CLASS
} from '../ObjectsPanel/tree-classes';

import type { ReactNode } from 'react';
import type { MenuOption } from '@/shared/contracts/menu';

type CanvasTreeIndent = keyof typeof TREE_ITEM_INDENT_CLASS;

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
            TREE_ITEM_CLASS,
            TREE_ITEM_INDENT_CLASS[indent],
            isActive && TREE_ITEM_SELECTED_CLASS,
            disabled ? TREE_ITEM_DISABLED_CLASS : TREE_ITEM_HOVER_CLASS,
            !disabled && onClick && 'cursor-pointer',
            className
        )}
    >
        {icon ?? <span className={TREE_SPACER_CLASS} />}
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

const STATIC_ROW_CLASS = 'flex items-center gap-8 text-muted';

export const CanvasTreeSkeletonRows = ({ count, compact, indent = 'base' }: CanvasTreeSkeletonRowsProps) => {
    if (count <= 0) return null;
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={`canvas-tree-skel-${i}`} className={cn(STATIC_ROW_CLASS, TREE_ITEM_CLASS, TREE_ITEM_INDENT_CLASS[indent])}>
                    <span className={TREE_SPACER_CLASS} />
                    {/*
                      * bravais's `Skeleton variant='text'` sized itself from `width`/`height`
                      * props; HeroUI's is a bare polymorphic box you size with a class, so the
                      * two widths become two complete literals.
                      */}
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
    <div className={cn(STATIC_ROW_CLASS, TREE_ITEM_CLASS, TREE_ITEM_INDENT_CLASS[indent])}>
        <span className='text-xs text-muted'>{label}</span>
    </div>
);

interface AnalysisTreeRetryRowProps {
    onRetry: () => void;
    indent?: CanvasTreeIndent;
}

export const AnalysisTreeRetryRow = ({ onRetry, indent = 'lg' }: AnalysisTreeRetryRowProps) => (
    <div className={cn(STATIC_ROW_CLASS, TREE_ITEM_CLASS, TREE_ITEM_INDENT_CLASS[indent])}>
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
