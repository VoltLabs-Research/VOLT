import { cn } from '@/shared/utils/cn';
import { Button, CloseButton, Heading, Row, Text } from '@voltstack/bravais';
import './PanelHeader.css';
import type { ReactNode } from 'react';

export interface PanelHeaderProps {
    title?: string;
    icon?: ReactNode;
    actions?: ReactNode;
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

const PanelHeader = ({
    title,
    icon,
    actions,
    onClose,
    tabs,
    variant = 'default',
    className
}: PanelHeaderProps) => {
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
                    <Row gap='05'>
                        {icon && (
                            <Row as='span' className='shared-panel-header-icon'>{icon}</Row>
                        )}
                        {title && (
                            <Text as='p' size='xs' tone='muted' className={cn('shared-panel-header-title', variant === 'compact' && 'text-eyebrow')}>
                                {title}
                            </Text>
                        )}
                    </Row>
                )}
                {showFullTitle && (
                    <Heading level={3} size='xl' weight='bold' className='flex-1'>
                        {title}
                    </Heading>
                )}
                {showTabs && (
                    <Row flex='1' gap='025'>
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
                    </Row>
                )}
            </>
        );
    };

    return (
        <div className={rootClasses}>
            {renderLeft()}
            <Row gap='05'>
                {actions}
                {onClose && <CloseButton onClick={onClose} />}
            </Row>
        </div>
    );
};

export default PanelHeader;
