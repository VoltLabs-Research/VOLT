import PopoverMenuItem from '../PopoverMenuItem';
import FloatingRootContext, {
    FloatingOwnerIdsContext,
    appendFloatingOwnerIds,
    hasFloatingOwnerId,
    useFloatingOwnerIds,
    useFloatingRoot
} from '@/shared/presentation/contexts/FloatingRootContext';
import composeRefs from '@/shared/presentation/utilities/compose-refs';
import { FloatingPortal, autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import { ChevronRight } from 'lucide-react';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
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

const FOCUSABLE_SELECTOR = [
    '[role="menuitem"]:not([disabled])',
    '[role="menuitemcheckbox"]:not([disabled])',
    '[role="menuitemradio"]:not([disabled])',
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(', ');
const NESTED_FLOATING_SELECTOR = '.select-dropdown, .form-field-autocomplete-menu';

const SubmenuItemWrapper = ({ option, size = 'md', onOpen }: SubmenuItemWrapperProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const submenuPanelRef = useRef<HTMLDivElement | null>(null);
    const submenuId = useId();
    const floatingRoot = useFloatingRoot();
    const floatingOwnerIds = useFloatingOwnerIds();
    const submenuFloatingOwnerIds = useMemo(() => appendFloatingOwnerIds(floatingOwnerIds, submenuId), [floatingOwnerIds, submenuId]);
    const {
        refs,
        floatingStyles,
        placement
    } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: 'right-start',
        strategy: 'fixed',
        middleware: [
            offset(6),
            flip({
                fallbackPlacements: ['left-start'],
                padding: 12
            }),
            shift({ padding: 12 })
        ],
        whileElementsMounted: autoUpdate
    });

    const containsNode = useCallback((node: Node | null) => {
        if (!node) {
            return false;
        }

        return Boolean(
            triggerRef.current?.contains(node)
            || submenuPanelRef.current?.contains(node)
        );
    }, []);

    const focusFirstSubmenuItem = useCallback(() => {
        const submenuPanel = submenuPanelRef.current;
        if (!submenuPanel) {
            return;
        }

        const focusableElements = Array.from(submenuPanel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        const firstFocusableElement = focusableElements.find((element) => {
            return !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true';
        });
        firstFocusableElement?.focus();
    }, []);

    const openSubmenu = useCallback(() => {
        setIsOpen(true);
        onOpen?.();
    }, [onOpen]);

    const closeSubmenu = useCallback(() => {
        setIsOpen(false);
    }, []);

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
        if (event.key === 'Escape') {
            event.preventDefault();
            closeSubmenu();
            triggerRef.current?.focus();
        }
    };

    const handleBlur = (event: React.FocusEvent<HTMLElement>) => {
        const nextFocusedElement = event.relatedTarget;
        if (nextFocusedElement instanceof Node && containsNode(nextFocusedElement)) {
            return;
        }

        if (nextFocusedElement instanceof Element) {
            const nestedFloatingElement = nextFocusedElement.closest<HTMLElement>(NESTED_FLOATING_SELECTOR);
            if (nestedFloatingElement && hasFloatingOwnerId(nestedFloatingElement, submenuId)) {
                return;
            }
        }

        closeSubmenu();
    };

    const menuIcon = option.icon
        ? <option.icon size={MENU_ICON_SIZES[size]} />
        : undefined;

    const suffix = <ChevronRight size={14} aria-hidden='true' />;
    const portalRoot = wrapperRef.current?.closest<HTMLElement>('.popover') ?? floatingRoot;

    return (
        <div
            ref={wrapperRef}
            className='context-menu-submenu-wrapper'
        >
            <PopoverMenuItem
                ref={composeRefs(triggerRef, refs.setReference)}
                icon={menuIcon}
                size={size}
                disabled={option.disabled}
                onClick={handleTriggerClick}
                onKeyDown={handleTriggerKeyDown}
                onBlur={handleBlur}
                ariaHaspopup='dialog'
                ariaExpanded={isOpen}
                ariaControls={submenuId}
                rightAdornment={suffix}
            >
                {option.label}
            </PopoverMenuItem>

            {isOpen && portalRoot && (
                <FloatingPortal root={portalRoot}>
                    <div
                        ref={composeRefs(submenuPanelRef, refs.setFloating)}
                        id={submenuId}
                        className='context-menu-submenu-panel'
                        data-floating-submenu-panel='true'
                        data-side={placement.startsWith('left') ? 'left' : 'right'}
                        role='dialog'
                        aria-label={`${option.label} submenu`}
                        style={floatingStyles}
                        onClick={handleSubmenuClick}
                        onKeyDown={handleSubmenuKeyDown}
                        onBlur={handleBlur}
                    >
                        <FloatingOwnerIdsContext.Provider value={submenuFloatingOwnerIds}>
                            <FloatingRootContext.Provider value={portalRoot}>
                                {option.submenuContent}
                            </FloatingRootContext.Provider>
                        </FloatingOwnerIdsContext.Provider>
                    </div>
                </FloatingPortal>
            )}
        </div>
    );
};

export default SubmenuItemWrapper;
