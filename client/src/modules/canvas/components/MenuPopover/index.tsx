import { Button, Popover, Separator, cn } from '@heroui/react';
import type { MenuConfig, MenuItem } from '../TopToolbarMenus';

import { MenuItemType } from '../TopToolbarMenus';

interface MenuPopoverProps {
    menu: MenuConfig;
    openMenu: string | null;
    onOpenChange: (menu: string | null) => void;
    idPrefix?: string;

    triggerClassName?: string;
}

const renderMenuItemIcon = (item: MenuItem) => {
    if (!item.icon) {
        return undefined;
    }

    return <span className='flex shrink-0 flex-row items-center justify-center text-base'>{item.icon}</span>;
};

const renderMenuItemShortcut = (item: MenuItem) => {
    if (!item.shortcut) {
        return undefined;
    }

    return <span className='text-xs text-muted'>{item.shortcut}</span>;
};

const createMenuItemRenderer = (close: () => void) => (item: MenuItem, index: number) => {
    if (item.type === MenuItemType.Separator) {
        return <Separator key={index} />;
    }

    const handlePress = () => {
        item.action?.();
        close();
    };

    return (
        <Button
            key={index}
            variant={item.checked ? 'secondary' : 'ghost'}
            size='sm'
            className='justify-start gap-1.5 text-xs'
            fullWidth
            onPress={handlePress}
            isDisabled={item.disabled}
        >
            {renderMenuItemIcon(item)}
            <span className='min-w-0 flex-1 text-left'>{item.label}</span>
            {renderMenuItemShortcut(item)}
        </Button>
    );
};

const MenuPopover = ({ menu, openMenu, onOpenChange, idPrefix = 'menu', triggerClassName }: MenuPopoverProps) => {
    const isOpen = openMenu === menu.label;
    const close = () => onOpenChange(null);
    const renderMenuItem = createMenuItemRenderer(close);

    return (
        <Popover
            isOpen={isOpen}
            onOpenChange={(nextOpen) => onOpenChange(nextOpen ? menu.label : null)}
        >
            {/*
              * Ghost until hovered or opened: the menu bar reads as plain labels at
              * rest, and only the open menu carries a background.
              */}
            <Button
                variant={isOpen ? 'secondary' : 'ghost'}
                size='sm'
                className={cn('text-xs', triggerClassName)}
            >
                {menu.label}
            </Button>
            <Popover.Content placement='bottom start'>
                <Popover.Dialog id={`${idPrefix}-${menu.label.toLowerCase()}`} aria-label={menu.label} className='flex min-w-40 max-w-80 flex-col p-1'>
                    {menu.items.map(renderMenuItem)}
                </Popover.Dialog>
            </Popover.Content>
        </Popover>
    );
};

export default MenuPopover;
