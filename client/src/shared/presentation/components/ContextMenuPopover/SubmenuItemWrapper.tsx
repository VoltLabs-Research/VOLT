import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import { ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';

interface SubmenuItemWrapperProps {
    option: MenuOption;
    size?: 'sm' | 'md';
};

const MENU_ICON_SIZES: Record<'sm' | 'md', number> = {
    sm: 14,
    md: 16
};

const HOVER_CLOSE_DELAY_MS = 150;

const SubmenuItemWrapper: React.FC<SubmenuItemWrapperProps> = ({ option, size = 'md' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearHideTimeout = useCallback(() => {
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const handleMouseEnter = useCallback(() => {
        clearHideTimeout();
        setIsOpen(true);
    }, [clearHideTimeout]);

    const handleMouseLeave = useCallback(() => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, HOVER_CLOSE_DELAY_MS);
    }, []);

    useEffect(() => {
        return clearHideTimeout;
    }, [clearHideTimeout]);

    const handleSubmenuClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const menuIcon = option.icon
        ? <option.icon size={MENU_ICON_SIZES[size]} />
        : undefined;

    const suffix = <ChevronRight size={14} />;

    return (
        <div
            className='context-menu-submenu-wrapper'
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <PopoverMenuItem
                icon={menuIcon}
                size={size}
                disabled={option.disabled}
            >
                <span className='d-flex items-center content-between w-max'>
                    {option.label}
                    {suffix}
                </span>
            </PopoverMenuItem>

            {isOpen && (
                <div className='context-menu-submenu-panel' onClick={handleSubmenuClick}>
                    {option.submenuContent}
                </div>
            )}
        </div>
    );
};

export default SubmenuItemWrapper;
