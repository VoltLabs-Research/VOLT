import './SettingsSectionHeader.css';
import { cn } from '@/shared/utils';
import type { ReactNode } from 'react';

export interface SettingsSectionHeaderProps {
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
    const classes = cn('settings-section-header', 'd-flex', 'items-start', 'content-between', 'gap-1', className);
    const HeadingTag = headingAs;

    return (
        <header className={classes}>
            <div className='volt-container flex-1 d-flex column gap-025'>
                <HeadingTag className='volt-title font-size-3 font-weight-6'>
                    {title}
                </HeadingTag>
                {description && (
                    <p className='volt-text color-muted font-size-2'>
                        {description}
                    </p>
                )}
            </div>
            {action && (
                <div className='volt-container f-shrink-0'>
                    {action}
                </div>
            )}
        </header>
    );
};

export default SettingsSectionHeader;
