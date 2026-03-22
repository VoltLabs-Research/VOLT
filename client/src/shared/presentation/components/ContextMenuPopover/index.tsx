import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import Paragraph from '@/shared/presentation/components/Paragraph';
import AsyncContextMenuItem from './AsyncContextMenuItem';
import SubmenuItemWrapper from './SubmenuItemWrapper';
import './ContextMenuPopover.css';
import { useState } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { MouseEvent, ReactNode } from 'react';

type ContextMenuOpenPredicate = (event: MouseEvent<Element>) => boolean;

interface ContextMenuPopoverProps {
    id: string;
    trigger: ReactNode;
    options?: MenuOption[];
    size?: 'sm' | 'md';
    triggerAction?: 'click' | 'contextmenu';
    shouldOpenOnContextMenu?: ContextMenuOpenPredicate;
    ariaLabel?: string;
    menuLabel?: string;
};

const ContextMenuPopover = ({
    id,
    trigger,
    options = [],
    size = 'md',
    triggerAction = 'contextmenu',
    shouldOpenOnContextMenu,
    ariaLabel = 'Context menu',
    menuLabel = 'Context menu actions'
}: ContextMenuPopoverProps) => {
    const [menuError, setMenuError] = useState<string | null>(null);

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
                    onOpen={() => setMenuError(null)}
                />
            );
        }

        return (
            <AsyncContextMenuItem
                key={key}
                option={option}
                size={size}
                onClose={close}
                onError={setMenuError}
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
            role='menu'
            triggerAriaHaspopup='menu'
            ariaLabel={ariaLabel}
            shouldOpenOnContextMenu={shouldOpenOnContextMenu}
            onOpenChange={(isOpen) => {
                if (!isOpen) {
                    setMenuError(null);
                }
            }}
        >
            {(close) => (
                <PopoverMenu label={menuLabel} onClose={close}>
                    {menuError && (
                        <Paragraph className='context-menu-popover-error font-size-1 color-danger' role='status' aria-live='polite' aria-atomic='true'>
                            {menuError}
                        </Paragraph>
                    )}
                    {options.map((option, index) => renderOption(option, index, close))}
                </PopoverMenu>
            )}
        </Popover>
    );
};

export default ContextMenuPopover;
