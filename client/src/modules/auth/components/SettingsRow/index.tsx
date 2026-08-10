import './SettingsRow.css';
import { cn } from '@/shared/utils/cn';
import { Row } from '@voltstack/bravais';
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
    const classes = cn(
        'settings-row',
        onClick && 'clickable',
        className
    );

    return (
        <Row
            gap='075'
            p='05'
            radius='md'
            cursor={onClick ? 'pointer' : undefined}
            className={classes}
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
                <div className='flex flex-row items-center shrink-0 settings-row-right'>
                    {rightContent}
                </div>
            )}
        </Row>
    );
};

export default SettingsRow;
