import Container from '@/shared/presentation/components/Container';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { motion } from 'framer-motion';
import { useId } from 'react';
import type { ReactNode } from 'react';
import './SegmentedTabs.css';

export interface SegmentedTabOption<TId extends string = string> {
    id: TId;
    label: string;
    icon?: ReactNode;
};

interface SegmentedTabsProps<TId extends string = string> {
    tabs: ReadonlyArray<SegmentedTabOption<TId>>;
    activeTab: TId;
    onChange: (id: TId) => void;
    ariaLabel: string;
    /** Unique per instance. Defaults to a React-generated id — override only to share animation across mount boundaries. */
    layoutId?: string;
    size?: 'sm' | 'md';
    fullWidth?: boolean;
    className?: string;
};

const SegmentedTabs = <TId extends string>({
    tabs,
    activeTab,
    onChange,
    ariaLabel,
    layoutId,
    size = 'md',
    fullWidth = false,
    className = ''
}: SegmentedTabsProps<TId>) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const autoLayoutId = useId();
    const resolvedLayoutId = layoutId ?? autoLayoutId;

    const containerClassName = [
        'segmented-tabs',
        `segmented-tabs--${size}`,
        fullWidth ? 'segmented-tabs--full' : '',
        className
    ].filter(Boolean).join(' ');

    return (
        <Container className={containerClassName} role='tablist' aria-label={ariaLabel}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        type='button'
                        role='tab'
                        aria-selected={isActive}
                        tabIndex={isActive ? 0 : -1}
                        className={`segmented-tabs__tab ${isActive ? 'is-active' : ''}`}
                        onClick={() => onChange(tab.id)}
                    >
                        {isActive && (
                            <motion.span
                                layoutId={`${resolvedLayoutId}-pill`}
                                className='segmented-tabs__pill'
                                transition={prefersReducedMotion
                                    ? { duration: 0 }
                                    : { type: 'spring', stiffness: 420, damping: 36 }}
                            />
                        )}
                        <span className='segmented-tabs__label'>
                            {tab.icon ? <span className='segmented-tabs__icon d-flex flex-center'>{tab.icon}</span> : null}
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </Container>
    );
};

export default SegmentedTabs;
