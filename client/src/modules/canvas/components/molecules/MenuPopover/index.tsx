import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';

import type { MenuConfig, MenuItem } from '../TopToolbarMenus';

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
    if (item.type === 'separator') {
        return <Container key={index} className="canvas-menu-separator" />;
    }

    const handleClick = () => {
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
