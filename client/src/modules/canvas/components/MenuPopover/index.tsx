import Button from '@/shared/presentation/primitives/Button';
import Divider from '@/shared/presentation/primitives/Divider';
import Popover from '@/shared/presentation/primitives/Popover';
import PopoverMenu from '@/shared/presentation/primitives/PopoverMenu';
import type { MenuConfig, MenuItem } from '../TopToolbarMenus';

import { MenuItemType } from '../TopToolbarMenus';

interface MenuPopoverProps {
    menu: MenuConfig;
    openMenu: string | null;
    onOpenChange: (menu: string | null) => void;
};

const renderMenuItemIcon = (item: MenuItem) => {
    if (!item.icon) {
        return undefined;
    }

    return <span className="d-flex items-center content-center f-shrink-0 font-size-3">{item.icon}</span>;
};

const renderMenuItemShortcut = (item: MenuItem) => {
    if (!item.shortcut) {
        return undefined;
    }

    return <span className="font-size-05 color-muted">{item.shortcut}</span>;
};

const createMenuItemRenderer = (close: () => void) => (item: MenuItem, index: number) => {
    if (item.type === MenuItemType.Separator) {
        return <Divider key={index} />;
    }

    const handleClick = () => {
        if (item.disabled) {
            return;
        }

        item.action?.();
        close();
    };

    return (
        <Button
            key={index}
            variant={item.checked ? 'solid' : 'ghost'}
            intent="canvas"
            shape="rounded"
            size="sm"
            className="font-size-05"
            block
            align="start"
            leftIcon={renderMenuItemIcon(item)}
            rightIcon={renderMenuItemShortcut(item)}
            onClick={handleClick}
            disabled={item.disabled}
            aria-disabled={item.disabled}
            title={item.disabled ? `${item.label} is not available yet` : item.label}
        >
            {item.label}
        </Button>
    );
};

const renderMenuItems = (items: MenuItem[], close: () => void) => {
    const renderMenuItem = createMenuItemRenderer(close);

    return (
        <PopoverMenu>
            {items.map(renderMenuItem)}
        </PopoverMenu>
    );
};

const MenuPopover = ({ menu, openMenu, onOpenChange }: MenuPopoverProps) => (
    <Popover
        id={`menu-${menu.label.toLowerCase()}`}
        noPadding
        onOpenChange={(isOpen) => onOpenChange(isOpen ? menu.label : null)}
        trigger={(
            <Button
                variant={openMenu === menu.label ? 'solid' : 'ghost'}
                intent="canvas"
                shape="rounded"
                size="sm"
                className="font-size-05 canvas-btn-compact"
            >
                {menu.label}
            </Button>
        )}
    >
        {(close) => renderMenuItems(menu.items, close)}
    </Popover>
);

export default MenuPopover;
