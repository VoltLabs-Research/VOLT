import React from 'react';
import Container from '@/shared/presentation/components/Container';
import { cn } from '@/shared/utils';

export interface SettingsSectionProps {
    children: React.ReactNode;
    className?: string;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ children, className = '' }) => {
    const classes = cn(
        'glass-bg',
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
