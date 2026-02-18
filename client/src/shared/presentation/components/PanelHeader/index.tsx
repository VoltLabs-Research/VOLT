import React from 'react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import CloseButton from '@/shared/presentation/components/CloseButton';
import { cn } from '@/shared/utils';
import './PanelHeader.css';

export interface PanelHeaderProps {
    title?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    onClose?: () => void;
    tabs?: { label: string; active: boolean; disabled?: boolean; onClick?: () => void }[];
    variant?: 'default' | 'compact';
    className?: string;
}

const PanelHeader: React.FC<PanelHeaderProps> = ({
    title,
    icon,
    actions,
    onClose,
    tabs,
    variant = 'default',
    className
}) => {
    const rootClasses = cn(
        'shared-panel-header',
        'panel-header-bordered',
        'd-flex',
        'items-center',
        'content-between',
        'f-shrink-0',
        variant === 'compact' && 'shared-panel-header--compact',
        className
    );

    const renderLeft = () => {
        if (icon || (title && variant === 'compact')) {
            return (
                <Container className="d-flex items-center gap-05">
                    {icon && (
                        <span className="shared-panel-header-icon d-flex items-center">{icon}</span>
                    )}
                    {title && (
                        <Paragraph className="shared-panel-header-title font-size-05 color-muted">
                            {title}
                        </Paragraph>
                    )}
                </Container>
            );
        }

        if (title) {
            return (
                <Title className="font-size-4 font-weight-6 flex-1">
                    {title}
                </Title>
            );
        }

        if (tabs && tabs.length > 0) {
            return (
                <Container className="d-flex flex-1 gap-025">
                    {tabs.map((tab, index) => (
                        <Button
                            key={index}
                            variant="ghost"
                            intent={tab.active ? 'brand' : 'neutral'}
                            size="sm"
                            onClick={tab.onClick}
                            disabled={tab.disabled}
                            style={tab.disabled ? { opacity: 0.5 } : undefined}
                        >
                            {tab.label}
                        </Button>
                    ))}
                </Container>
            );
        }

        return null;
    };

    return (
        <Container className={rootClasses}>
            {renderLeft()}
            <Container className="d-flex items-center gap-05">
                {actions}
                {onClose && <CloseButton onClick={onClose} />}
            </Container>
        </Container>
    );
};

export default PanelHeader;
