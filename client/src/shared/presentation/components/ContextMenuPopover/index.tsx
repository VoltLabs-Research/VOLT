import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import AsyncContextMenuItem from './AsyncContextMenuItem';
import SubmenuItemWrapper from './SubmenuItemWrapper';
import './ContextMenuPopover.css';
import { useState } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { MouseEvent, ReactNode } from 'react';
import type { Placement } from '@floating-ui/react';

type ContextMenuOpenPredicate = (event: MouseEvent<Element>) => boolean;
type ContextMenuContent = ReactNode | ((close: () => void) => ReactNode);

interface ContextMenuPopoverProps {
    id: string;
    trigger: ReactNode;
    options?: MenuOption[];
    content?: ContextMenuContent;
    size?: 'sm' | 'md';
    triggerAction?: 'click' | 'contextmenu';
    shouldOpenOnContextMenu?: ContextMenuOpenPredicate;
    ariaLabel?: string;
    menuLabel?: string;
    placement?: Placement;
    className?: string;
};

const ContextMenuPopover = ({
    id,
    trigger,
    options = [],
    content,
    size = 'md',
    triggerAction = 'contextmenu',
    shouldOpenOnContextMenu,
    ariaLabel = 'Context menu',
    menuLabel = 'Context menu actions',
    placement = 'bottom-start',
    className = ''
}: ContextMenuPopoverProps) => {
    const [menuError, setMenuError] = useState<string | null>(null);
    const hasCustomContent = content !== undefined;

    if (options.length === 0 && !hasCustomContent) {
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
            placement={placement}
            noPadding={!hasCustomContent}
            className={`context-menu-popover context-menu-popover--${size} ${className}`.trim()}
            role={hasCustomContent ? 'dialog' : 'menu'}
            triggerAriaHaspopup={hasCustomContent ? 'dialog' : 'menu'}
            ariaLabel={ariaLabel}
            shouldOpenOnContextMenu={shouldOpenOnContextMenu}
            onOpenChange={(isOpen) => {
                if (!isOpen) {
                    setMenuError(null);
                }
            }}
        >
            {(close) => (
                hasCustomContent ? (
                    <div className={`volt-container context-menu-popover-panel context-menu-popover-panel--${size} d-flex column`}>
                        {typeof content === 'function' ? content(close) : content}
                    </div>
                ) : (
                    <PopoverMenu label={menuLabel} onClose={close}>
                        {menuError && (
                            <p className='volt-text context-menu-popover-error font-size-1 color-danger' role='status' aria-live='polite' aria-atomic='true'>
                                {menuError}
                            </p>
                        )}
                        {options.map((option, index) => renderOption(option, index, close))}
                    </PopoverMenu>
                )
            )}
        </Popover>
    );
};

export default ContextMenuPopover;
