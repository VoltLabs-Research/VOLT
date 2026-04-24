import './SettingsSectionHeader.css';
import { cn } from '@/shared/utils';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
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
            <Stack flex='1' gap='025'>
                <HeadingTag className='font-size-3 font-weight-6'>
                    {title}
                </HeadingTag>
                {description && (
                    <Text as='p' tone='muted' size='md'>
                        {description}
                    </Text>
                )}
            </Stack>
            {action && (
                <div className='f-shrink-0'>
                    {action}
                </div>
            )}
        </header>
    );
};

export default SettingsSectionHeader;
