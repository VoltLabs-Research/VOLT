import { cn } from '@heroui/react';
import type { ReactNode } from 'react';

interface SettingsRowProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    rightContent?: ReactNode;
    onClick?: () => void;
    className?: string;
}

const SettingsRow = ({
    icon,
    title,
    description,
    rightContent,
    onClick,
    className = ''
}: SettingsRowProps) => {
    return (
        <div
            className={cn(
                'flex flex-row items-center gap-3 rounded-xl p-2 transition-colors duration-200 max-sm:flex-wrap',
                onClick && 'cursor-pointer hover:bg-surface-hover',
                className
            )}
            onClick={onClick}
        >
            {icon && (
                <div className='flex flex-row items-center justify-center shrink-0 text-xl text-muted'>
                    {icon}
                </div>
            )}
            <div className='flex flex-col gap-1 flex-1 min-w-0'>
                <p className='text-sm font-medium'>
                    {title}
                </p>
                {description && (
                    <p className='text-xs text-muted'>
                        {description}
                    </p>
                )}
            </div>
            {rightContent && (
                <div className='flex flex-row items-center shrink-0 max-sm:basis-full max-sm:ml-8'>
                    {rightContent}
                </div>
            )}
        </div>
    );
};

export default SettingsRow;
