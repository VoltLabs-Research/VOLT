import './SettingsSectionHeader.css';
import { cn } from '@/shared/utils/cn';
import { Box, Heading, Stack, Text } from '@voltstack/bravais';
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
    const level = Number(headingAs.slice(1)) as 2 | 3 | 4 | 5 | 6;

    return (
        <Box as='header' display='flex' align='start' justify='between' gap='1' className={cn('settings-section-header', className)}>
            <Stack flex='1' gap='025'>
                <Heading level={level} size='lg' weight='bold'>
                    {title}
                </Heading>
                {description && (
                    <Text as='p' tone='muted' size='md'>
                        {description}
                    </Text>
                )}
            </Stack>
            {action && (
                <Box shrink='0'>
                    {action}
                </Box>
            )}
        </Box>
    );
};

export default SettingsSectionHeader;
