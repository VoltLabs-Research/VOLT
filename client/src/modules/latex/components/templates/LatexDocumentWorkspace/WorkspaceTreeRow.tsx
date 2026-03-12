import Container from '@/shared/presentation/components/Container';
import { cn } from '@/shared/utils';
import type { HTMLAttributes, ReactNode } from 'react';

interface WorkspaceTreeRowProps extends HTMLAttributes<HTMLDivElement> {
    depth: number;
    icon: ReactNode;
    label: string;
    selected?: boolean;
    dragging?: boolean;
    trailing?: ReactNode;
    className?: string;
}

const WorkspaceTreeRow = ({
    depth,
    icon,
    label,
    selected = false,
    dragging = false,
    trailing,
    className = '',
    style,
    ...props
}: WorkspaceTreeRowProps) => {
    const indent = depth * 12;

    return (
        <Container
            className={cn(
                'latex-workspace__file-row d-flex items-center content-between gap-05',
                selected && 'is-selected',
                dragging && 'is-dragging',
                className
            )}
            style={{ ...style, paddingLeft: `${0.75 + indent / 16}rem` }}
            {...props}
        >
            <Container className='d-flex items-center gap-05 flex-1 min-w-0'>
                <span className='color-muted d-flex items-center f-shrink-0'>{icon}</span>
                <span className='latex-workspace__file-name text-truncate'>{label}</span>
            </Container>
            {trailing && <Container className='d-flex items-center gap-025 f-shrink-0'>{trailing}</Container>}
        </Container>
    );
};

export default WorkspaceTreeRow;
