import { Button, Tooltip } from '@heroui/react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface BrandProps {
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}

/**
 * `.sidebar-brand`. Both states were plain rules on the same element with the
 * `is-collapsed` flag already applied from JSX — `DashboardSidebar.css` never
 * selected `.sidebar-brand` — so this is a straight ternary, not an ancestor-flag
 * variant.
 */
const BRAND = 'flex items-center justify-between px-6 pt-6 pb-2';
const BRAND_COLLAPSED = 'flex flex-col items-center justify-center gap-2 px-0 pt-5 pb-2';

/**
 * bravais's `IconFrame size='sm' shape='circle'`: a 28px circle with a 1px soft
 * border and, for the neutral tone, no fill. `aria-hidden` was hardcoded on
 * IconFrame, so the collapsed rail's "V" mark has always been invisible to
 * assistive tech — preserved rather than quietly fixed, since the rail's accessible
 * naming is the nav items' job.
 */
const BRAND_MARK = 'inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-bold tracking-[-0.02em] text-foreground';

/**
 * `.sidebar-collapse-toggle`. It overrode bravais's 44px icon-button box down to a
 * 28px-tall auto-width hit target, so the HeroUI button's own metrics are overridden
 * the same way.
 */
const COLLAPSE_TOGGLE = 'flex h-7 w-auto min-w-0 shrink-0 items-center justify-center rounded-md border-none bg-transparent p-0 text-muted transition-[all] duration-150 ease-out-fluid hover:bg-surface-tertiary hover:text-foreground max-[1024px]:hidden';

const Brand = ({ collapsed = false, onToggleCollapse }: BrandProps) => {
    let brandContent = (
        <h3 className='text-[0.95rem] font-[590] uppercase tracking-[-0.01em] text-foreground'>Volt</h3>
    );
    if (collapsed) {
        brandContent = <span className={BRAND_MARK} aria-hidden='true'>V</span>;
    }

    let collapseIcon = <PanelLeftClose size={16} />;
    if (collapsed) {
        collapseIcon = <PanelLeftOpen size={16} />;
    }

    const collapseLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

    return (
        <div className={collapsed ? BRAND_COLLAPSED : BRAND}>
            {brandContent}

            {onToggleCollapse && (
                <Tooltip>
                    {/* bravais's IconButton back-filled `title` from its accessible name, so
                        this control always had a native tooltip. HeroUI's Button has a closed
                        prop interface with no `title` (spec §5b.8), hence the Tooltip. */}
                    <Button
                        isIconOnly
                        variant='ghost'
                        className={COLLAPSE_TOGGLE}
                        aria-label={collapseLabel}
                        onPress={onToggleCollapse}
                    >
                        {collapseIcon}
                    </Button>
                    <Tooltip.Content placement='bottom'>{collapseLabel}</Tooltip.Content>
                </Tooltip>
            )}
        </div>
    );
};

export default Brand;
