import { Box, Button, Text, Skeleton } from '@voltstack/bravais';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import { RefreshCw } from 'lucide-react';

import type { ReactNode } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';

const INDENT_CLASSES = {
    base: 'canvas-tree-item--indent',
    lg: 'canvas-tree-item--indent-lg'
} as const;

export type CanvasTreeIndent = keyof typeof INDENT_CLASSES;

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
}: CanvasTreeRowProps) => {
    const cursor = disabled ? 'is-disabled' : (onClick ? 'cursor-pointer' : '');
    return (
        <button
            type="button"
            role="treeitem"
            aria-selected={isActive}
            aria-disabled={disabled}
            aria-label={ariaLabel}
            tabIndex={disabled ? -1 : 0}
            onClick={disabled ? undefined : onClick}
            data-tour-id={tourTargetId}
            className={`canvas-tree-item font-size-1 d-flex items-center gap-05 color-secondary u-select-none ${INDENT_CLASSES[indent]} ${isActive ? 'selected' : ''} ${cursor} ${className}`}
        >
            {icon ?? <span className="canvas-tree-spacer" />}
            <span className={isActive ? 'color-primary' : 'color-secondary'}>{label}</span>
            {trailing !== undefined && <Box as='span' flex='1' />}
            {trailing}
        </button>
    );
};

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
                <div key={`canvas-tree-skel-${i}`} className={`canvas-tree-item d-flex items-center gap-05 color-secondary ${INDENT_CLASSES[indent]}`}>
                    <span className="canvas-tree-spacer" />
                    <Skeleton variant='text' width={compact ? 80 : 120} height={10} />
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
    <div className={`canvas-tree-item d-flex items-center gap-05 color-secondary ${INDENT_CLASSES[indent]}`}>
        <Text size='sm' tone='muted'>{label}</Text>
    </div>
);

interface AnalysisTreeRetryRowProps {
    onRetry: () => void;
    indent?: CanvasTreeIndent;
}

export const AnalysisTreeRetryRow = ({ onRetry, indent = 'lg' }: AnalysisTreeRetryRowProps) => (
    <div className={`canvas-tree-item d-flex items-center gap-05 color-secondary ${INDENT_CLASSES[indent]}`}>
        <Text size='sm' tone='muted'>Failed to load models</Text>
        <Box as='span' flex='1' />
        <Button variant='ghost' intent='neutral' size='sm' onClick={onRetry} aria-label='Retry loading models'>
            <RefreshCw style={{ width: 12, height: 12 }} />
        </Button>
    </div>
);
