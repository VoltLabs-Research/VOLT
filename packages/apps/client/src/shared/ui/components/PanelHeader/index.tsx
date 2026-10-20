import { Button, CloseButton, cn } from '@heroui/react';
import type { ReactNode } from 'react';

interface PanelHeaderProps {
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
        'flex',
        'items-center',
        'justify-between',
        'shrink-0',
        'px-4',
        'py-3',
        'border-b',
        'border-border',
        variant === 'compact' && 'h-10',
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
                    <div className='flex flex-row items-center gap-2'>
                        {icon && (
                            <span className='flex flex-row items-center'>{icon}</span>
                        )}
                        {title && (
                            <p className={cn('text-xs text-muted', variant === 'compact' && 'text-xs font-semibold uppercase tracking-[0.05em] text-muted')}>
                                {title}
                            </p>
                        )}
                    </div>
                )}
                {showFullTitle && (
                    <h3 className='text-xl font-semibold text-foreground flex-1'>
                        {title}
                    </h3>
                )}
                {showTabs && (
                    <div className='flex flex-row items-center gap-1 flex-1'>
                        {tabs!.map((tab, index) => (
                            <Button
                                key={index}
                                variant='ghost'
                                size='sm'
                                onPress={tab.onClick}
                                isDisabled={tab.disabled}
                                className={tab.active ? 'text-foreground' : 'text-muted'}
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
        <div className={rootClasses}>
            {renderLeft()}
            <div className='flex flex-row items-center gap-2'>
                {actions}
                {onClose && <CloseButton onPress={onClose} />}
            </div>
        </div>
    );
};

export default PanelHeader;
