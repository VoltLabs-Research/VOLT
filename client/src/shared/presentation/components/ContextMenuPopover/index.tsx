import AsyncMenuItemWrapper from '@/shared/presentation/components/AsyncMenuItemWrapper';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import SubmenuItemWrapper from './SubmenuItemWrapper';
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

    const renderOption = (option: MenuOption, index: number, close: () => void) => {
        const key = `${id}-${option.label}-${index}`;

        if (option.submenuContent) {
            return (
                <SubmenuItemWrapper
                    key={key}
                    option={option}
                    size={size}
                />
            );
        }

        return (
            <AsyncMenuItemWrapper
                key={key}
                option={option}
                size={size}
                onSuccess={close}
            />
        );
    };

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
                    {options.map((option, index) => renderOption(option, index, close))}
                </PopoverMenu>
            )}
        </Popover>
    );
};

export default ContextMenuPopover;
