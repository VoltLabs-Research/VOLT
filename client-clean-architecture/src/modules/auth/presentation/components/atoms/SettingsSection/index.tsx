import React from 'react';
import Container from '@/shared/presentation/components/Container';
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
    const classes = [
        'settings-section',
        'd-flex', 
        'column', 
        'gap-1', 
        'p-1-5', 
        'b-radius-08', 
        className
    ].filter(Boolean).join(' ');

    return (
        <Container className={classes}>
            {children}
        </Container>
    );
};

export default SettingsSection;
