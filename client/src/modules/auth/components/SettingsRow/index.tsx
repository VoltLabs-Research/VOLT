import './SettingsRow.css';
import { cn } from '@/shared/utils/cn';
import { Row, Stack, Text } from '@voltstack/bravais';
import type { ReactNode } from 'react';

export interface SettingsRowProps {
    /**
     * Left icon or content
     */
    icon?: ReactNode;

    /**
     * Row title
     */
    title: string;

    /**
     * Row description
     */
    description?: string;

    /**
     * Right content (button, badge, toggle, etc.)
     */
    rightContent?: ReactNode;

    /**
     * Click handler (makes row interactive)
     */
    onClick?: () => void;

    /**
     * Additional CSS classes
     */
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
                <Row justify='center' shrink='0' className='font-size-4 color-muted'>
                    {icon}
                </Row>
            )}
            <Stack flex='1' gap='025' className='min-w-0'>
                <Text as='p' weight='medium' size='md'>
                    {title}
                </Text>
                {description && (
                    <Text as='p' tone='muted' size='sm'>
                        {description}
                    </Text>
                )}
            </Stack>
            {rightContent && (
                <Row shrink='0' className='settings-row-right'>
                    {rightContent}
                </Row>
            )}
        </Row>
    );
};

export default SettingsRow;
