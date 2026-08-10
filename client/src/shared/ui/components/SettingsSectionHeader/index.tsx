import { cn } from '@heroui/react';
import type { ReactNode } from 'react';

interface SettingsSectionHeaderProps {
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
    headingAs?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
};

const SettingsSectionHeader = ({
    title,
    description,
    action,
    className = '',
    headingAs = 'h2'
}: SettingsSectionHeaderProps) => {
    const HeadingTag = headingAs;

    return (
        <header className={cn('flex items-start justify-between gap-4 max-sm:flex-col', className)}>
            <div className='flex flex-col gap-1 flex-1'>
                <HeadingTag className='text-base font-semibold text-foreground'>
                    {title}
                </HeadingTag>
                {description && (
                    <p className='text-sm text-muted'>
                        {description}
                    </p>
                )}
            </div>
            {action && (
                <div className='shrink-0'>
                    {action}
                </div>
            )}
        </header>
    );
};

export default SettingsSectionHeader;
