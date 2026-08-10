import { Button, Popover, Separator, cn } from '@heroui/react';
import type { MenuConfig, MenuItem } from '../TopToolbarMenus';

import { MenuItemType } from '../TopToolbarMenus';

interface MenuPopoverProps {
    menu: MenuConfig;
    openMenu: string | null;
    onOpenChange: (menu: string | null) => void;
    idPrefix?: string;
    /** `TopToolbar.css` shrank every small button in its mobile options row. */
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

    /*
     * `onPress` is not reached at all while `isDisabled`, so the old handler's
     * `if(item.disabled) return` guard is now the prop. `aria-disabled` stayed on the
     * element in the original and is what React Aria emits for a disabled Button, so
     * nothing is lost by dropping the explicit attribute.
     */
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

/**
 * `.popover-menu` was `min-width: 160px; padding: 0.25rem`, and bravais's `Popover`
 * clamped itself to 180–320px. HeroUI's `Popover.Dialog` is the padded box, so both
 * live on it.
 */
const MENU_CLASS = 'flex min-w-40 max-w-80 flex-col p-1';

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
              * The Button is the Root's direct child rather than being wrapped in
              * `Popover.Trigger`: that part renders its own `role='button'` div, which
              * around a real button would add a second tab stop per menu.
              */}
            <Button
                variant={isOpen ? 'secondary' : 'ghost'}
                size='sm'
                className={cn('text-xs', triggerClassName)}
            >
                {menu.label}
            </Button>

            <Popover.Content placement='bottom start'>
                <Popover.Dialog id={`${idPrefix}-${menu.label.toLowerCase()}`} aria-label={menu.label} className={MENU_CLASS}>
                    {menu.items.map(renderMenuItem)}
                </Popover.Dialog>
            </Popover.Content>
        </Popover>
    );
};

export default MenuPopover;
