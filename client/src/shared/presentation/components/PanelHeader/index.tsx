import { cn } from '@/shared/utils';
import Button from '@/shared/presentation/components/Button';
import CloseButton from '@/shared/presentation/components/CloseButton';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import './PanelHeader.css';
import React from 'react';

export interface PanelHeaderProps {
    title?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    onClose?: () => void;
    tabs?: PanelHeaderTab[];
    variant?: 'default' | 'compact';
    className?: string;
};

interface PanelHeaderTab {
    label: string;
    active: boolean;
    disabled?: boolean;
    onClick?: () => void;
};

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
        const showCompactIconTitle = icon || (title && variant === 'compact');
        const showFullTitle = title && !icon && variant !== 'compact';
        const showTabs = tabs && tabs.length > 0;

        if (!showCompactIconTitle && !showFullTitle && !showTabs) {
            return null;
        }

        return (
            <>
                {showCompactIconTitle && (
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
                )}
                {showFullTitle && (
                    <Title className="font-size-4 font-weight-6 flex-1">
                        {title}
                    </Title>
                )}
                {showTabs && (
                    <Container className="d-flex flex-1 gap-025">
                        {tabs!.map((tab, index) => (
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
                )}
            </>
        );
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
