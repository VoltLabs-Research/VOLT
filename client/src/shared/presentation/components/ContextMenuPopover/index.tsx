import AsyncMenuItemWrapper from '@/shared/presentation/components/AsyncMenuItemWrapper';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import './ContextMenuPopover.css';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { ReactNode } from 'react';

interface ContextMenuPopoverProps {
    id: string;
    trigger: ReactNode;
    options?: MenuOption[];
    size?: 'sm' | 'md';
    triggerAction?: 'click' | 'contextmenu';
};

const ContextMenuPopover = ({
    id,
    trigger,
    options = [],
    size = 'md',
    triggerAction = 'contextmenu'
}: ContextMenuPopoverProps) => {
    if (options.length === 0) {
        return <>{trigger}</>;
    }

    return (
        <Popover
            id={id}
            trigger={trigger}
            triggerAction={triggerAction}
            noPadding
            className={`context-menu-popover context-menu-popover--${size}`}
        >
            {(close) => (
                <PopoverMenu>
                    {options.map((option, index) => (
                        <AsyncMenuItemWrapper
                            key={`${id}-${option.label}-${index}`}
                            option={option}
                            size={size}
                            onSuccess={close}
                        />
                    ))}
                </PopoverMenu>
            )}
        </Popover>
    );
};

export default ContextMenuPopover;
