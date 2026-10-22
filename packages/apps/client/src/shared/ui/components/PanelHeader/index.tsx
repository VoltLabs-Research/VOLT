import { Button, CloseButton, cn } from '@heroui/react';
import type { ReactNode } from 'react';

interface PanelHeaderProps {
    title?: string;
    actions?: ReactNode;
    onClose?: () => void;
    tabs?: PanelHeaderTab[];
    className?: string;
};

interface PanelHeaderTab {
    label: string;
    active: boolean;
    disabled?: boolean;
    onClick?: () => void;
};

// The mockup's panel head: no rule under it, the title in body weight, the close button tucked
// into the corner.
const PanelHeader = ({
    title,
    actions,
    onClose,
    tabs,
    className
}: PanelHeaderProps) => (
    <div className={cn('flex shrink-0 items-center justify-between gap-2 py-3 pr-3 pl-5', className)}>
        {title && (
            <h3 className='min-w-0 flex-1 truncate text-base font-medium text-foreground'>
                {title}
            </h3>
        )}
        {tabs && tabs.length > 0 && (
            <div className='flex flex-1 flex-row items-center gap-1'>
                {tabs.map((tab, index) => (
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
        <div className='ms-auto flex flex-row items-center gap-1'>
            {actions}
            {onClose && <CloseButton onPress={onClose} />}
        </div>
    </div>
);

export default PanelHeader;
