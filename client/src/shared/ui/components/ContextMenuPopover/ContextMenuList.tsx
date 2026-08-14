import Scrollable from '@/shared/ui/components/Scrollable';
import { cn } from '@heroui/react';
import { useEffect, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { ContextMenuItemSize } from './ContextMenuItem';

interface ContextMenuListProps {
    children: ReactNode;
    label?: string;
    size?: ContextMenuItemSize;
    onClose?: () => void;
};

const MENU_ITEM_SELECTOR = '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';

const getMenuItems = (menuElement: HTMLDivElement | null): HTMLElement[] => {
    if (!menuElement) {
        return [];
    }

    return Array.from(menuElement.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)).filter((item) => {
        return item.closest('[role="menu"]') === menuElement
            && !item.hasAttribute('disabled')
            && item.getAttribute('aria-disabled') !== 'true';
    });
};

const ContextMenuList = ({ children, label = 'Menu', size = 'md', onClose }: ContextMenuListProps) => {
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const focusFrame = window.requestAnimationFrame(() => {
            const menuItems = getMenuItems(menuRef.current);
            menuItems[0]?.focus();
        });

        return () => window.cancelAnimationFrame(focusFrame);
    }, []);

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            onClose?.();
            return;
        }

        const menuItems = getMenuItems(menuRef.current);

        if (menuItems.length === 0) {
            return;
        }

        const activeElement = document.activeElement;
        const currentIndex = menuItems.findIndex((item) => item === activeElement || (activeElement instanceof Node && item.contains(activeElement)));

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % menuItems.length;
            menuItems[nextIndex]?.focus();
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            const nextIndex = currentIndex < 0
                ? menuItems.length - 1
                : (currentIndex - 1 + menuItems.length) % menuItems.length;
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
        <Scrollable
            ref={menuRef}
            className={cn('flex flex-col gap-1 p-1', { sm: 'min-w-[124px]', md: 'min-w-[160px]' }[size])}
            role='menu'
            aria-label={label}
            aria-orientation='vertical'
            onKeyDown={handleKeyDown}
        >
            {children}
        </Scrollable>
    );
};

export default ContextMenuList;
