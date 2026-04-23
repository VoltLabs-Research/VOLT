import './PopoverMenu.css';
import { useEffect, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

interface PopoverMenuItemElement extends HTMLElement {
    disabled?: boolean;
};

interface PopoverMenuProps {
    children: ReactNode;
    label?: string;
    onClose?: () => void;
};

const MENU_ITEM_SELECTOR = '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';

const getMenuItems = (menuElement: HTMLDivElement | null) => {
    if (!menuElement) {
        return [];
    }

    const items = Array.from(menuElement.querySelectorAll<PopoverMenuItemElement>(MENU_ITEM_SELECTOR));

    return items.filter((item) => {
        return item.closest('[role="menu"]') === menuElement && !item.hasAttribute('disabled') && item.getAttribute('aria-disabled') !== 'true';
    });
};

const PopoverMenu = ({ children, label = 'Menu', onClose }: PopoverMenuProps) => {
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const focusTimer = window.requestAnimationFrame(() => {
            const menuItems = getMenuItems(menuRef.current);
            menuItems[0]?.focus();
        });

        return () => {
            window.cancelAnimationFrame(focusTimer);
        };
    }, []);

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const menuItems = getMenuItems(menuRef.current);
        const activeElement = document.activeElement;
        const currentIndex = menuItems.findIndex((item) => item === activeElement || item.contains(activeElement));

        if (event.key === 'Escape') {
            event.preventDefault();
            onClose?.();
            return;
        }

        if (menuItems.length === 0) {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % menuItems.length;
            menuItems[nextIndex]?.focus();
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            const nextIndex = currentIndex < 0 ? menuItems.length - 1 : (currentIndex - 1 + menuItems.length) % menuItems.length;
            menuItems[nextIndex]?.focus();
            return;
        }

        if (event.key === 'Home') {
            event.preventDefault();
            menuItems[0]?.focus();
            return;
        }

        if (event.key === 'End') {
            event.preventDefault();
            menuItems[menuItems.length - 1]?.focus();
        }
    };

    return (
        <div ref={menuRef} className='popover-menu d-flex column gap-025' role='menu' aria-label={label} aria-orientation='vertical' onKeyDown={handleKeyDown}>
            {children}
        </div>
    );
};

export default PopoverMenu;
