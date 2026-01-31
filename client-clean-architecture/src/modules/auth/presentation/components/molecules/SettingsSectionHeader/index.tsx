import React from 'react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { cn } from '@/shared/utils';
import './SettingsSectionHeader.css';

export interface SettingsSectionHeaderProps {
    /**
     * Section title
     */
    title: string;

    /**
     * Section description
     */
    description?: string;

    /**
     * Optional action button or element (e.g., Button, Link)
     */
    action?: React.ReactNode;

    /**
     * Additional CSS classes
     */
    className?: string;
}

const SettingsSectionHeader: React.FC<SettingsSectionHeaderProps> = ({
    title,
    description,
    action,
    className = ''
}) => {
    const classes = cn('settings-section-header', 'd-flex', 'items-start', 'content-between', 'gap-1', className);

    return (
        <Container className={classes}>
            <Container className="flex-1 d-flex column gap-025">
                <Title className="font-size-3 font-weight-6">
                    {title}
                </Title>
                {description && (
                    <Paragraph className="color-muted font-size-2">
                        {description}
                    </Paragraph>
                )}
            </Container>
            {action && (
                <Container className="f-shrink-0">
                    {action}
                </Container>
            )}
        </Container>
    );
};

export default SettingsSectionHeader;
