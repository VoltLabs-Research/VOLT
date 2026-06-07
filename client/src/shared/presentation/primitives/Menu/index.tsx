import { cn } from '@/shared/utils/cn';
import Popover from '@/shared/presentation/primitives/Popover';
import PopoverMenu from '@/shared/presentation/primitives/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/primitives/PopoverMenuItem';
import Text from '@/shared/presentation/primitives/Text';
import './Menu.css';
import { forwardRef, isValidElement, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Placement } from '@floating-ui/react';
import type { StatusTone } from '@/shared/presentation/primitives/types';

const MISSING_MENU_NAME_ERROR = 'Menu requires an accessible name via ariaLabel (or menuLabel) so assistive tech can announce the menu.';
const FALLBACK_MENU_LABEL = 'Menu';

type MenuSize = 'sm' | 'md';

/**
 * A single actionable entry in a {@link Menu}.
 *
 * Set `divider: true` to render a visual separator instead of an action;
 * separator entries ignore every other field except `id`.
 */
export interface MenuItem {
    /** Stable, unique key for this entry. */
    id: string;
    /** Visible label. Required for actionable items, unused for dividers. */
    label?: ReactNode;
    /** Optional leading icon node (e.g. a lucide-react icon element). */
    icon?: ReactNode;
    /** Invoked when the item is chosen; the menu closes afterwards. */
    onSelect?: () => void;
    /** Semantic tone. Only `danger` is visually distinct (maps to the danger item style). */
    tone?: StatusTone;
    /** Disabled items are not focusable and cannot be selected. */
    disabled?: boolean;
    /** Render this entry as a separator rule instead of an action. */
    divider?: boolean;
}

/** Render-prop form of the trigger; receives the menu's open state. */
export type MenuTriggerRenderProp = (state: { isOpen: boolean }) => ReactNode;

export interface MenuProps {
    /**
     * The element (or render-prop) that opens the menu. A render-prop receives
     * `{ isOpen }`. The trigger is wrapped in a focusable element so any node works.
     */
    trigger: ReactNode | MenuTriggerRenderProp;
    /** The menu entries. Use `divider: true` entries to group sections. */
    items: MenuItem[];
    /** Floating-ui placement of the menu relative to the trigger. */
    placement?: Placement;
    /** Control density passed through to each item. */
    size?: MenuSize;
    /** Stable id for the popover; auto-generated when omitted. */
    id?: string;
    /** Accessible name announced for the menu region. Falls back to `menuLabel`. */
    ariaLabel?: string;
    /** Human label for the menu list (also used as the accessible name fallback). */
    menuLabel?: string;
    /** Accessible name for the auto-generated trigger wrapper. */
    triggerAriaLabel?: string;
    /** Rendered when `items` is empty (after filtering dividers). */
    emptyContent?: ReactNode;
    /** Notified whenever the menu opens or closes. */
    onOpenChange?: (isOpen: boolean) => void;
    /** Extra classes for the popover panel. */
    className?: string;
    /** Extra classes for the trigger wrapper. */
    triggerClassName?: string;
}

const isRenderProp = (value: MenuProps['trigger']): value is MenuTriggerRenderProp => typeof value === 'function';

const Menu = forwardRef<HTMLSpanElement, MenuProps>(({
    trigger,
    items,
    placement = 'bottom-start',
    size = 'md',
    id,
    ariaLabel,
    menuLabel = 'Menu',
    triggerAriaLabel,
    emptyContent,
    onOpenChange,
    className,
    triggerClassName
}, ref) => {
    const generatedId = useId();
    const popoverId = id ?? `menu-${generatedId}`;
    const [isOpen, setIsOpen] = useState(false);
    const hasWarnedForMissingNameRef = useRef(false);

    const resolvedAriaLabel = ariaLabel?.trim() || menuLabel?.trim() || undefined;
    let accessibleName = resolvedAriaLabel;
    if (!accessibleName) {
        if (!hasWarnedForMissingNameRef.current) {
            console.warn(MISSING_MENU_NAME_ERROR);
            hasWarnedForMissingNameRef.current = true;
        }

        accessibleName = FALLBACK_MENU_LABEL;
    }

    const handleOpenChange = (nextOpen: boolean) => {
        setIsOpen(nextOpen);
        onOpenChange?.(nextOpen);
    };

    const triggerNode = isRenderProp(trigger) ? trigger({ isOpen }) : trigger;

    // Popover clones its trigger to attach ref + aria-* state, so it needs a
    // single valid element. We always wrap in a focusable span so render-props,
    // text, fragments, and bare elements behave identically.
    const triggerElement = (
        <span
            ref={ref}
            className={cn('menu-trigger u-select-none cursor-pointer', triggerClassName)}
            role='button'
            tabIndex={isValidElement(triggerNode) ? -1 : 0}
            aria-label={triggerAriaLabel}
        >
            {triggerNode}
        </span>
    );

    const actionableItems = items.filter((item) => !item.divider);

    return (
        <Popover
            id={popoverId}
            trigger={triggerElement}
            placement={placement}
            role='menu'
            triggerAriaHaspopup='menu'
            ariaLabel={accessibleName}
            noPadding
            className={cn('menu-popover', className)}
            onOpenChange={handleOpenChange}
        >
            {(close) => (
                <PopoverMenu label={accessibleName} onClose={close}>
                    {actionableItems.length === 0
                        ? (emptyContent ?? (
                            <Text as='p' size='sm' className='menu-empty color-muted' role='status' aria-live='polite'>
                                No actions available
                            </Text>
                        ))
                        : items.map((item) => {
                            if (item.divider) {
                                return <div key={item.id} className='menu-separator' role='separator' aria-hidden='true' />;
                            }

                            return (
                                <PopoverMenuItem
                                    key={item.id}
                                    icon={item.icon}
                                    size={size}
                                    variant={item.tone === 'danger' ? 'danger' : 'default'}
                                    disabled={item.disabled}
                                    onClick={() => {
                                        item.onSelect?.();
                                        close();
                                    }}
                                >
                                    {item.label}
                                </PopoverMenuItem>
                            );
                        })}
                </PopoverMenu>
            )}
        </Popover>
    );
});

Menu.displayName = 'Menu';

export default Menu;
