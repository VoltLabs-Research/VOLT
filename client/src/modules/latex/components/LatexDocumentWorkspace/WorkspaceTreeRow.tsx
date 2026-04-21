import { cn } from '@/shared/utils';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

interface WorkspaceTreeRowProps extends HTMLAttributes<HTMLDivElement> {
    depth: number;
    icon: ReactNode;
    label: ReactNode;
    selected?: boolean;
    expanded?: boolean;
    trailing?: ReactNode;
    treeItemLevel?: number;
    ariaLabel?: string;
    className?: string;
}

const WorkspaceTreeRow = forwardRef<HTMLDivElement, WorkspaceTreeRowProps>(({
    depth,
    icon,
    label,
    selected = false,
    expanded,
    trailing,
    treeItemLevel,
    ariaLabel,
    className = '',
    style,
    ...props
}, ref) => {
    const indent = depth * 12;
    const resolvedAriaLabel = ariaLabel
        ?? (typeof label === 'string' || typeof label === 'number' ? String(label) : undefined);

    return (
        <div ref={ref} className={`volt-container ${cn(
                'latex-workspace__file-row latex-workspace__tree-row d-flex items-center content-between gap-05',
                selected && 'is-selected',
                className
            )}`} role='treeitem' tabIndex={0} aria-label={resolvedAriaLabel} aria-level={treeItemLevel} aria-expanded={expanded} aria-selected={selected} style={{ ...style, paddingLeft: `${0.75 + indent / 16}rem` }} {...props}>
            <div className='volt-container d-flex items-center gap-05 flex-1 min-w-0'>
                {depth > 0 && <span className='latex-workspace__tree-indent-line' aria-hidden='true' />}
                <span className='color-muted d-flex items-center f-shrink-0'>{icon}</span>
                {typeof label === 'string' || typeof label === 'number'
                    ? <span className='latex-workspace__file-name text-truncate'>{label}</span>
                    : label}
            </div>
            {trailing && <div className='volt-container d-flex items-center gap-025 f-shrink-0'>{trailing}</div>}
        </div>
    );
});

WorkspaceTreeRow.displayName = 'WorkspaceTreeRow';

export default WorkspaceTreeRow;
