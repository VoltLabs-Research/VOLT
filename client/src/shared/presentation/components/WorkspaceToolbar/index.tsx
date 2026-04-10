import Container from '@/shared/presentation/components/Container';
import { cn } from '@/shared/utils';
import type { ReactNode } from 'react';

interface WorkspaceToolbarProps {
    title: ReactNode;
    actions?: ReactNode;
    className?: string;
}

const WorkspaceToolbar = ({
    title,
    actions,
    className
}: WorkspaceToolbarProps) => {
    return (
        <Container className={cn('latex-workspace__toolbar d-flex items-center content-between gap-1', className)}>
            <Container className='d-flex items-center min-w-0'>
                {title}
            </Container>
            {actions ? (
                <Container className='d-flex items-center gap-075'>
                    {actions}
                </Container>
            ) : null}
        </Container>
    );
};

export default WorkspaceToolbar;
