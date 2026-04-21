import { cn } from '@/shared/utils';
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
        <div className={`volt-container ${classes}`}>
            {children}
        </div>
    );
};

export default SettingsSection;
