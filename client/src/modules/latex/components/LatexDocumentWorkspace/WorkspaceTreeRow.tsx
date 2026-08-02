import { cn } from '@/shared/utils/cn';
import { Row } from '@voltstack/bravais';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

interface WorkspaceTreeRowProps extends HTMLAttributes<HTMLDivElement> {
    depth: number;
    icon: ReactNode;
    label: ReactNode;
    ariaLabel: string;
    selected?: boolean;
    expanded?: boolean;
    trailing?: ReactNode;
    treeItemLevel?: number;
    className?: string;
}

const WorkspaceTreeRow = forwardRef<HTMLDivElement, WorkspaceTreeRowProps>(({
    depth,
    icon,
    label,
    ariaLabel,
    selected = false,
    expanded,
    trailing,
    treeItemLevel,
    className = '',
    style,
    ...props
}, ref) => (
    <div ref={ref} className={cn(
            'latex-workspace__file-row latex-workspace__tree-row d-flex items-center content-between gap-05',
            selected && 'is-selected',
            className
        )} role='treeitem' tabIndex={0} aria-label={ariaLabel} aria-level={treeItemLevel} aria-expanded={expanded} aria-selected={selected} style={{
            ...style,
            paddingLeft: `${0.75 + depth * 12 / 16}rem`
        }} {...props}>
        <Row gap='05' flex='1' minW='0'>
            {depth > 0 && <span className='latex-workspace__tree-indent-line' aria-hidden='true' />}
            <Row as='span' shrink='0' className='color-muted'>{icon}</Row>
            {label}
        </Row>
        {trailing && <Row gap='025' shrink='0'>{trailing}</Row>}
    </div>
));

WorkspaceTreeRow.displayName = 'WorkspaceTreeRow';

export default WorkspaceTreeRow;
