import { closeModal, openModal } from '@/shared/ui/modal';
import { Button, cn } from '@heroui/react';
import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';

interface SidebarNavItemProps {
    label: string;
    icon: LucideIcon;
    isSelected?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    /**
     * The invoker pair, kept at its original shape. bravais wrote these straight onto
     * the DOM as `commandfor` / `command` and let the browser's Invoker Commands API
     * (or `invokers-polyfill`) open the native `<dialog>`; both the attributes and the
     * global `ButtonHTMLAttributes` augmentation that typed them are gone, so the pair
     * now drives the imperative modal façade in `@/shared/ui/modal` instead. The
     * façade keeps the old `openModal`/`closeModal` names, so this is the same
     * mechanism relocated, not a second one.
     */
    commandFor?: string;
    command?: string;
};

/**
 * `sidebar-nav-item`, `sidebar-nav-icon` and `sidebar-nav-label` carry no styling of
 * their own any more. They stay on the DOM because
 * `modules/dashboard/components/DashboardSidebar/DashboardSidebar.css` still selects
 * all three to collapse the dashboard rail; that sheet is another agent's to migrate.
 */
const NAV_ITEM = 'sidebar-nav-item relative flex w-full min-h-12 items-center justify-start gap-3 rounded-lg border border-transparent px-3.5 py-2.5 text-left text-sm cursor-pointer transition-[all] duration-150 ease-out-fluid';
const NAV_ITEM_SELECTED = 'is-selected bg-accent-soft font-medium text-foreground hover:bg-accent-soft-hover focus-visible:bg-accent-soft';
const NAV_ITEM_IDLE = 'font-normal text-muted hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:text-foreground';

/**
 * The icon keeps its `1em` sizing rather than a fixed `size-5`: the dashboard rail
 * shrinks it by re-declaring `font-size` on `.sidebar-nav-icon`, which only works
 * while the glyph is sized in `em`. `mx-0 my-0` neutralises the margins HeroUI's
 * `.button svg` rule applies to every icon inside a button.
 */
const NAV_ICON = 'sidebar-nav-icon flex size-5 shrink-0 items-center justify-center text-xl leading-none';
const NAV_ICON_GLYPH = 'block size-[1em] mx-0 my-0';

const SidebarNavItem = forwardRef<HTMLButtonElement, SidebarNavItemProps>(({
    label,
    icon: Icon,
    isSelected = false,
    disabled = false,
    onClick,
    onMouseEnter,
    onMouseLeave,
    commandFor,
    command
}, ref) => {
    /**
     * `onClick` runs before the command, matching the platform: a `CommandEvent` is
     * dispatched on the target only after the activating click has been handled.
     * A `commandFor` with no recognised `command` stays inert, which is also what the
     * browser did — `commandfor` alone names a target but requests no action.
     */
    const handlePress = () => {
        onClick?.();

        if (!commandFor) return;

        if (command === 'show-modal') {
            openModal(commandFor);
        } else if (command === 'close') {
            closeModal(commandFor);
        }
    };

    return (
        <Button
            ref={ref}
            variant='ghost'
            className={cn(NAV_ITEM, isSelected ? NAV_ITEM_SELECTED : NAV_ITEM_IDLE)}
            onPress={handlePress}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            isDisabled={disabled}
            aria-current={isSelected ? 'page' : undefined}
        >
            <div className={NAV_ICON}>
                <Icon size='1em' className={NAV_ICON_GLYPH} />
            </div>
            <span className='sidebar-nav-label flex-1'>{label}</span>
        </Button>
    );
});

SidebarNavItem.displayName = 'SidebarNavItem';

export default SidebarNavItem;
