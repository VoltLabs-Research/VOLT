import './SettingsSectionHeader.css';
import { cn } from '@/shared/utils';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import type { ReactNode } from 'react';

export interface SettingsSectionHeaderProps {
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
};

const SettingsSectionHeader = ({
    title,
    description,
    action,
    className = ''
}: SettingsSectionHeaderProps) => {
    const classes = cn('settings-section-header', 'd-flex', 'items-start', 'content-between', 'gap-1', className);

    return (
        <Container className={classes}>
            <Container className='flex-1 d-flex column gap-025'>
                <Title className='font-size-3 font-weight-6'>
                    {title}
                </Title>
                {description && (
                    <Paragraph className='color-muted font-size-2'>
                        {description}
                    </Paragraph>
                )}
            </Container>
            {action && (
                <Container className='f-shrink-0'>
                    {action}
                </Container>
            )}
        </Container>
    );
};

export default SettingsSectionHeader;
