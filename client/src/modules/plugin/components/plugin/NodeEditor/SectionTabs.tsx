import { cn } from '@heroui/react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';
import type { ReactNode } from 'react';

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
        <div className='flex w-full flex-row items-center gap-0.5 rounded-full border border-border bg-surface-secondary p-0.5' role='tablist' aria-label={ariaLabel}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;

                return (
                    <button
                        key={tab.id}
                        type='button'
                        role='tab'
                        aria-selected={isActive}
                        tabIndex={isActive ? 0 : -1}
                        className={cn('relative inline-flex flex-1 cursor-pointer flex-row items-center justify-center whitespace-nowrap rounded-full border-none bg-transparent px-2.5 py-1 text-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--focus)]', isActive ? 'text-foreground' : null)}
                        onClick={() => onChange(tab.id)}
                    >
                        {isActive && (
                            <motion.span
                                layoutId={`${layoutId}-pill`}
                                className='pointer-events-none absolute inset-0 z-0 rounded-full bg-surface shadow-[0_0_0_1px_var(--border)]'
                                transition={prefersReducedMotion ? { duration: 0 } : PILL_SPRING}
                            />
                        )}

                        <span className='relative z-[1] inline-flex flex-row items-center gap-1.5 text-sm font-medium leading-none'>
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
