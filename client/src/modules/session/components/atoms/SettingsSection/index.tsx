import { cn } from '@/shared/utils';
import Container from '@/shared/presentation/components/Container';
import type { ReactNode } from 'react';

export interface SettingsSectionProps {
    children: ReactNode;
    className?: string;
};

const SettingsSection = ({ children, className = '' }: SettingsSectionProps) => {
    const classes = cn(
        'd-flex',
        'b-soft',
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
