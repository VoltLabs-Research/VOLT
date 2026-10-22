import { cn } from '@heroui/react';
import type { ReactNode } from 'react';

interface CollapsibleJobContentProps {
    id: string;
    isExpanded: boolean;
    className?: string;
    children: ReactNode;
}

const CollapsibleJobContent = ({ id, isExpanded, className, children }: CollapsibleJobContentProps) => {
    if (!isExpanded) {
        return null;
    }

    return (
        <div id={id} className={cn('animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-out-fluid', className)}>
            {children}
        </div>
    );
};

export default CollapsibleJobContent;
