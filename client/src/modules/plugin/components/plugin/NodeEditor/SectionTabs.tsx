import { cn } from '@heroui/react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';
import type { ReactNode } from 'react';

/**
 * bravais's `SegmentedTabs`, rebuilt — deliberately by hand rather than on HeroUI's
 * `Tabs`.
 *
 * The spec offers `ToggleButtonGroup` or `TabsRoot`+`TabList`, and neither fits this
 * one call site:
 *
 *   • `ToggleButtonGroup` is a `role='group'` of toggle buttons. bravais rendered a
 *     real `role='tablist'` with `role='tab'`, `aria-selected` and a roving `tabIndex`,
 *     and this control does select between two panels — dropping to a button group is
 *     an accessibility downgrade, not a re-skin.
 *   • `Tabs` would fit the semantics exactly, but its Root has to wrap both the tab
 *     strip *and* the panels. Here they are separated by the floating panel's own
 *     `flex-1 min-h-0` scroll body, so a Root between them becomes the flex child and
 *     the body stops being one — a layout change, and the JSX reorder rule 4 forbids.
 *
 * So the markup is bravais's, unchanged down to the roving tabIndex, and only the
 * chrome moves to utilities. The sliding pill stays framer-motion (already a
 * dependency, and `FloatingNodePanel` above it uses the same library) with the same
 * `prefers-reduced-motion` opt-out, now read from the relocated hook (§3d).
 */

/** `.segmented-tabs` + `--sm` + `--full` */
const TABLIST_CLASS = 'flex w-full flex-row items-center gap-[2px] rounded-full border border-border bg-surface-secondary p-[3px]';

/** `.segmented-tabs__tab` at `--sm`, plus `--full`'s `flex: 1`. */
const TAB_CLASS = 'relative inline-flex flex-1 cursor-pointer flex-row items-center justify-center whitespace-nowrap rounded-full border-none bg-transparent px-2.5 py-1 text-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--focus)]';

/** `.segmented-tabs__tab.is-active` */
const TAB_ACTIVE_CLASS = 'text-foreground';

/** `.segmented-tabs__pill` — `--color-content-bg` is `--surface`, `--shadow-card` a hairline. */
const PILL_CLASS = 'pointer-events-none absolute inset-0 z-0 rounded-full bg-surface shadow-[0_0_0_1px_var(--border)]';

/** `.segmented-tabs__label` — its own 0.8125rem wins over the tab's `--sm` size. */
const LABEL_CLASS = 'relative z-[1] inline-flex flex-row items-center gap-1.5 text-[0.8125rem] font-medium leading-none';

const PILL_SPRING = {
    type: 'spring',
    stiffness: 420,
    damping: 36
} as const;

interface SectionTabOption<TId extends string> {
    id: TId;
    label: string;
    icon?: ReactNode;
};

interface SectionTabsProps<TId extends string> {
    tabs: ReadonlyArray<SectionTabOption<TId>>;
    activeTab: TId;
    onChange: (id: TId) => void;
    ariaLabel: string;
    /** Shared by the sliding pill across mounts, exactly as bravais's `layoutId` was. */
    layoutId: string;
};

const SectionTabs = <TId extends string>({
    tabs,
    activeTab,
    onChange,
    ariaLabel,
    layoutId
}: SectionTabsProps<TId>) => {
    const prefersReducedMotion = usePrefersReducedMotion();

    return (
        <div className={TABLIST_CLASS} role='tablist' aria-label={ariaLabel}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;

                return (
                    <button
                        key={tab.id}
                        type='button'
                        role='tab'
                        aria-selected={isActive}
                        tabIndex={isActive ? 0 : -1}
                        className={cn(TAB_CLASS, isActive ? TAB_ACTIVE_CLASS : null)}
                        onClick={() => onChange(tab.id)}
                    >
                        {isActive && (
                            <motion.span
                                layoutId={`${layoutId}-pill`}
                                className={PILL_CLASS}
                                transition={prefersReducedMotion ? { duration: 0 } : PILL_SPRING}
                            />
                        )}

                        <span className={LABEL_CLASS}>
                            {tab.icon ? (
                                <span className='flex flex-row items-center justify-center text-current'>{tab.icon}</span>
                            ) : null}
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default SectionTabs;
