import { cn } from '@/shared/utils';
import Row from '@/shared/presentation/primitives/Row';
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
        <Row justify='between' gap='1' className={cn('latex-workspace__toolbar', className)}>
            <Row minW='0'>
                {title}
            </Row>
            {actions ? (
                <Row gap='075'>
                    {actions}
                </Row>
            ) : null}
        </Row>
    );
};

export default WorkspaceToolbar;
