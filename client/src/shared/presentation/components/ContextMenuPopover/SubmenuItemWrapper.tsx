import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import { ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';

interface SubmenuItemWrapperProps {
    option: MenuOption;
    size?: 'sm' | 'md';
    onOpen?: () => void;
};

const MENU_ICON_SIZES: Record<'sm' | 'md', number> = {
    sm: 14,
    md: 16
};

const HOVER_CLOSE_DELAY_MS = 150;
const MENU_ITEM_SELECTOR = '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';

const SubmenuItemWrapper: React.FC<SubmenuItemWrapperProps> = ({ option, size = 'md', onOpen }) => {
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const submenuId = useId();

    const clearHideTimeout = useCallback(() => {
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const focusFirstSubmenuItem = useCallback(() => {
        const submenuPanel = wrapperRef.current?.querySelector<HTMLDivElement>(`#${submenuId}`);
        if (!submenuPanel) {
            return;
        }

        const menuItems = Array.from(submenuPanel.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR));
        const firstMenuItem = menuItems.find((item) => !item.hasAttribute('disabled') && item.getAttribute('aria-disabled') !== 'true');
        firstMenuItem?.focus();
    }, [submenuId]);

    const openSubmenu = useCallback(() => {
        clearHideTimeout();
        setIsOpen(true);
        onOpen?.();
    }, [clearHideTimeout, onOpen]);

    const closeSubmenu = useCallback(() => {
        clearHideTimeout();
        setIsOpen(false);
    }, [clearHideTimeout]);

    const handleMouseEnter = useCallback(() => {
        openSubmenu();
    }, [openSubmenu]);

    const handleMouseLeave = useCallback(() => {
        timeoutRef.current = setTimeout(() => {
            closeSubmenu();
        }, HOVER_CLOSE_DELAY_MS);
    }, [closeSubmenu]);

    useEffect(() => {
        return clearHideTimeout;
    }, [clearHideTimeout]);

    const handleSubmenuClick = (event: React.MouseEvent) => {
        event.stopPropagation();
    };

    const handleTriggerClick = () => {
        if (option.disabled) {
            return;
        }

        if (isOpen) {
            closeSubmenu();
            return;
        }

        openSubmenu();
    };

    const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (option.disabled) {
            return;
        }

        if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openSubmenu();
            window.requestAnimationFrame(focusFirstSubmenuItem);
            return;
        }

        if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            closeSubmenu();
        }
    };

    const handleSubmenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowLeft' || event.key === 'Escape') {
            event.preventDefault();
            closeSubmenu();
            triggerRef.current?.focus();
        }
    };

    const handleBlurCapture = (event: React.FocusEvent<HTMLDivElement>) => {
        const nextFocusedElement = event.relatedTarget;
        if (nextFocusedElement instanceof Node && event.currentTarget.contains(nextFocusedElement)) {
            return;
        }

        closeSubmenu();
    };

    const menuIcon = option.icon
        ? <option.icon size={MENU_ICON_SIZES[size]} />
        : undefined;

    const suffix = <ChevronRight size={14} aria-hidden='true' />;

    return (
        <div
            ref={wrapperRef}
            className='context-menu-submenu-wrapper'
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onBlurCapture={handleBlurCapture}
        >
            <PopoverMenuItem
                ref={triggerRef}
                icon={menuIcon}
                size={size}
                disabled={option.disabled}
                onClick={handleTriggerClick}
                onKeyDown={handleTriggerKeyDown}
                ariaHaspopup='menu'
                ariaExpanded={isOpen}
                ariaControls={submenuId}
                rightAdornment={suffix}
            >
                {option.label}
            </PopoverMenuItem>

            {isOpen && (
                <div
                    id={submenuId}
                    className='context-menu-submenu-panel'
                    role='menu'
                    aria-label={`${option.label} submenu`}
                    onClick={handleSubmenuClick}
                    onKeyDown={handleSubmenuKeyDown}
                >
                    {option.submenuContent}
                </div>
            )}
        </div>
    );
};

export default SubmenuItemWrapper;
