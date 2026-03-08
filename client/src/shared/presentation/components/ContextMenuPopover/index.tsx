import type { ReactNode } from 'react';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import AsyncMenuItemWrapper from '@/shared/presentation/components/AsyncMenuItemWrapper';
import type { MenuOption } from '@/shared/presentation/types/menu';
import './ContextMenuPopover.css';

interface ContextMenuPopoverProps {
    id: string;
    trigger: ReactNode;
    options?: MenuOption[];
    size?: 'sm' | 'md';
}

const ContextMenuPopover = ({ id, trigger, options = [], size = 'md' }: ContextMenuPopoverProps) => {
    if (options.length === 0) {
        return <>{trigger}</>;
    }

    return (
        <Popover
            id={id}
            trigger={trigger}
            triggerAction='contextmenu'
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
