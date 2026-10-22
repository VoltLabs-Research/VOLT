import { cn } from '@heroui/react';
import type { ReactNode } from 'react';

interface SettingsRowProps {
    title: string;
    description?: string;
    // Content that belongs to the row's subject, such as the profile picture itself.
    leading?: ReactNode;
    rightContent?: ReactNode;
    isDanger?: boolean;
}

const SettingsRow = ({
    title,
    description,
    leading,
    rightContent,
    isDanger = false
}: SettingsRowProps) => {
    return (
        <div
            className={cn(
                'flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5',
                isDanger ? 'border border-danger/30' : 'bg-foreground/4'
            )}
        >
            <div className='flex min-w-48 flex-1 items-center gap-4'>
                {leading}
                <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                    <p className='text-base font-medium text-foreground'>
                        {title}
                    </p>
                    {description && (
                        <p className='text-sm text-muted'>
                            {description}
                        </p>
                    )}
                </div>
            </div>
            {rightContent && (
                <div className='flex shrink-0 items-center gap-2'>
                    {rightContent}
                </div>
            )}
        </div>
    );
};

export default SettingsRow;
