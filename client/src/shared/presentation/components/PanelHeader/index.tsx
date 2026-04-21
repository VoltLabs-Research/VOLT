import { cn } from '@/shared/utils';
import Button from '@/shared/presentation/components/Button';
import CloseButton from '@/shared/presentation/components/CloseButton';
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
                    <div className="volt-container d-flex items-center gap-05">
                        {icon && (
                            <span className="shared-panel-header-icon d-flex items-center">{icon}</span>
                        )}
                        {title && (
                            <p className="volt-text shared-panel-header-title font-size-05 color-muted">
                                {title}
                            </p>
                        )}
                    </div>
                )}
                {showFullTitle && (
                    <h3 className="volt-title font-size-4 font-weight-6 flex-1">
                        {title}
                    </h3>
                )}
                {showTabs && (
                    <div className="volt-container d-flex flex-1 gap-025">
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
                    </div>
                )}
            </>
        );
    };

    return (
        <div className={`volt-container ${rootClasses}`}>
            {renderLeft()}
            <div className="volt-container d-flex items-center gap-05">
                {actions}
                {onClose && <CloseButton onClick={onClose} />}
            </div>
        </div>
    );
};

export default PanelHeader;
