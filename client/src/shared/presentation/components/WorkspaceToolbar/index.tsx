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
        <div className={`volt-container ${cn('latex-workspace__toolbar d-flex items-center content-between gap-1', className)}`}>
            <div className='volt-container d-flex items-center min-w-0'>
                {title}
            </div>
            {actions ? (
                <div className='volt-container d-flex items-center gap-075'>
                    {actions}
                </div>
            ) : null}
        </div>
    );
};

export default WorkspaceToolbar;
