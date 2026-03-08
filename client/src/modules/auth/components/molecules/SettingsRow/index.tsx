import './SettingsRow.css';
import { cn } from '@/shared/utils';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
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
        <Container className={classes} onClick={onClick}>
            {icon && (
                <Container className="d-flex items-center content-center f-shrink-0 font-size-4 color-muted">
                    {icon}
                </Container>
            )}
            <Container className="flex-1 d-flex column gap-025 settings-row-content">
                <Paragraph className="font-weight-5 font-size-2">
                    {title}
                </Paragraph>
                {description && (
                    <Paragraph className="color-muted font-size-1">
                        {description}
                    </Paragraph>
                )}
            </Container>
            {rightContent && (
                <Container className="settings-row-right d-flex items-center f-shrink-0">
                    {rightContent}
                </Container>
            )}
        </Container>
    );
};

export default SettingsRow;
