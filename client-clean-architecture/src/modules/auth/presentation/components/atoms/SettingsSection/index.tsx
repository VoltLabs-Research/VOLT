import React from 'react';
import Container from '@/shared/presentation/components/Container';
import { cn } from '@/shared/utils';
import './SettingsSection.css';

export interface SettingsSectionProps {
    /**
     * Section content
     */
    children: React.ReactNode;

    /**
     * Additional CSS classes
     */
    className?: string;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ children, className = '' }) => {
    const classes = cn(
        'settings-section',
        'd-flex', 
        'column', 
        'gap-1', 
        'p-1-5', 
        'radius-md', 
        className
    );

    return (
        <Container className={classes}>
            {children}
        </Container>
    );
};

export default SettingsSection;
