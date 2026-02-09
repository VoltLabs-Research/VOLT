import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import type { MenuConfig, MenuItem } from '../TopToolbarMenus';

const renderMenuItems = (items: MenuItem[], close: () => void) => (
    <PopoverMenu>
        {items.map((item, i) => {
            if (item.type === 'separator') {
                return <Container key={i} className="canvas-menu-separator" />;
            }
            return (
                <Button
                    key={i}
                    variant={item.checked ? 'solid' : 'ghost'}
                    intent="canvas"
                    shape="rounded"
                    size="sm"
                    className="font-size-05"
                    block
                    align="start"
                    leftIcon={item.icon ? <span className="d-flex items-center content-center f-shrink-0 font-size-3">{item.icon}</span> : undefined}
                    rightIcon={item.shortcut ? <span className="font-size-05 color-muted">{item.shortcut}</span> : undefined}
                    onClick={() => {
                        item.action?.();
                        close();
                    }}
                >
                    {item.label}
                </Button>
            );
        })}
    </PopoverMenu>
);

interface MenuPopoverProps {
    menu: MenuConfig;
    openMenu: string | null;
    onOpenChange: (menu: string | null) => void;
}

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
