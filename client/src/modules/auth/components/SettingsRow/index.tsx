import './SettingsRow.css';
import { cn } from '@/shared/utils';
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
};

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
        'd-flex',
        'items-center',
        'gap-075',
        'p-05',
        'radius-md',
        onClick && 'clickable cursor-pointer',
        className
    );

    return (
        <div className={`volt-container ${classes}`} onClick={onClick}>
            {icon && (
                <div className="volt-container d-flex items-center content-center f-shrink-0 font-size-4 color-muted">
                    {icon}
                </div>
            )}
            <div className="volt-container flex-1 d-flex column gap-025 settings-row-content">
                <p className="volt-text font-weight-5 font-size-2">
                    {title}
                </p>
                {description && (
                    <p className="volt-text color-muted font-size-1">
                        {description}
                    </p>
                )}
            </div>
            {rightContent && (
                <div className="volt-container settings-row-right d-flex items-center f-shrink-0">
                    {rightContent}
                </div>
            )}
        </div>
    );
};

export default SettingsRow;
