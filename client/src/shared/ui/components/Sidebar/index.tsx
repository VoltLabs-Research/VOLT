import SidebarBottom from '@/shared/ui/components/SidebarBottom';
import SidebarHeader from '@/shared/ui/components/SidebarHeader';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { cn } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState, useRef, useCallback, useMemo, useId } from 'react';
import React from 'react';
import type { ReactNode, ComponentType } from 'react';

const MOBILE_BREAKPOINT = 768;

interface SidebarTag {
    id: string;
    name: string;
    Component: ComponentType;
};

interface SidebarProps {
    activeTag: string;
    onTagChange?: (tagId: string) => void;
    tags: SidebarTag[];
    className?: string;
    overrideContent?: ReactNode;
    children?: ReactNode;
    position?: 'left' | 'right';
    collapsible?: boolean;

    keepMounted?: boolean;
};

/**
 * `max-[768px]:` rather than Tailwind's `max-md:` on purpose: the sheet this replaces
 * broke at `max-width: 768px` inclusive, and `max-md:` stops one pixel short of it —
 * which would leave the layout disagreeing with `useMedia` at exactly 768px wide.
 *
 * The mobile block restated `left: .5rem` unchanged, so only the vertical rules need a
 * breakpoint variant; `translate-y-0` stands in for its `transform: none`, since
 * Tailwind 4 translates through the `translate` property that `transform-none` cannot
 * reach.
 */
const WRAPPER = 'absolute z-[200] flex top-1/2 h-[98%] -translate-y-1/2 max-[768px]:top-2 max-[768px]:bottom-2 max-[768px]:h-auto max-[768px]:max-h-[calc(100%-1rem)] max-[768px]:translate-y-0';
const WRAPPER_SIDE = {
    left: 'left-2',
    right: 'left-auto right-2'
} as const;

const CONTAINER = 'flex h-full w-full max-w-full flex-col justify-between gap-0 overflow-hidden rounded-2xl border-0 bg-surface p-0 max-[768px]:z-[100] max-[768px]:rounded-md';
const TOP_CONTAINER = 'flex min-h-0 flex-1 flex-col overflow-hidden';
const BODY = 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden';

/**
 * The track paints no background of its own, which is what the fade overlays depend
 * on: they were `linear-gradient(to right, var(--surface), transparent)` — fading to
 * the *panel* colour, not to a colour of the track's. Giving the track a fill of its
 * own would leave the fade ending on a different colour than the strip it covers,
 * which reads as a seam at each end exactly when the tabs are scrollable.
 */
const TABS_CONTAINER = 'flex justify-between flex-nowrap overflow-x-auto overflow-y-hidden rounded-full p-2 scrollbar-none';
const FADE = 'pointer-events-none absolute top-0 bottom-0 z-10 w-10';

const TAB = 'flex items-center justify-center flex-[1_0_auto] cursor-pointer whitespace-nowrap rounded-full border border-transparent transition-colors duration-150 ease-smooth focus-visible:border-border';
const TAB_EXPANDED = 'min-h-11 min-w-[130px] px-4';
const TAB_COLLAPSED = 'grid place-items-center h-10 w-10 min-h-10 min-w-10 rounded-xl p-0';
const TAB_SELECTED = 'bg-surface-tertiary inset-ring-1 inset-ring-border';
const TAB_IDLE = 'hover:bg-surface-hover';

const Sidebar = ({
    activeTag: activeTagId,
    onTagChange,
    tags,
    children,
    overrideContent,
    className = '',
    position = 'left',
    collapsible = true,
    keepMounted = false
}: SidebarProps) => {
    const [collapsed, setCollapsed] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const tabsContainerRef = useRef<HTMLDivElement>(null);
    const prefersReducedMotion = useReducedMotion();
    const sidebarId = useId();
    const isMobile = useMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

    const checkOverflow = useCallback(() => {
        const container = tabsContainerRef.current;
        if (!container) return;

        const { scrollLeft, scrollWidth, clientWidth } = container;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
    }, []);

    useEffect(() => {
        if (!collapsible) {
            setCollapsed(false);
            return;
        }

        setCollapsed(isMobile);
    }, [collapsible, isMobile]);

    useEffect(() => {
        if (isMobile && collapsible) {
            setCollapsed(true);
        }
    }, [activeTagId, collapsible, isMobile]);

    useEffect(() => {
        const container = tabsContainerRef.current;
        if (!container) return;

        checkOverflow();
        container.addEventListener('scroll', checkOverflow);
        window.addEventListener('resize', checkOverflow);

        return () => {
            container.removeEventListener('scroll', checkOverflow);
            window.removeEventListener('resize', checkOverflow);
        };
    }, [checkOverflow, tags.length]);

    const toggleCollapsed = () => {
        if (collapsible) {
            setCollapsed((v) => !v);
        }
    };

    const header = React.Children.toArray(children).find(
        (child) => React.isValidElement(child) && child.type === SidebarHeader
    );

    const bottom = React.Children.toArray(children).find(
        (child) => React.isValidElement(child) && child.type === SidebarBottom
    );

    /**
     * Collapsed-and-mobile hid the tabs, the body, the footer and the header content.
     * `data-collapsed` and `data-mobile` are still written for anything selecting the
     * wrapper from outside, but the rules themselves now read the two booleans.
     */
    const isCollapsedOnMobile = collapsed && isMobile;

    const headerElement = header
        ? React.cloneElement(header as React.ReactElement<React.ComponentProps<typeof SidebarHeader>>, {
            collapsed,
            isMobile,
            onToggle: toggleCollapsed,
            controlsId: `${sidebarId}-content`
        })
        : null;

    const bottomElement = bottom
        ? React.cloneElement(bottom as React.ReactElement<React.ComponentProps<typeof SidebarBottom>>, {
            isHidden: isCollapsedOnMobile
        })
        : null;

    const activeTagConfig = useMemo(() => tags.find((tag) => tag.id === activeTagId), [tags, activeTagId]);
    const expandedWidth = isMobile ? 'min(460px, calc(100vw - 1rem))' : (overrideContent ? 460 : 380);
    const collapsedWidth = isMobile ? 56 : 64;

    return (
        <motion.aside
            className={cn(WRAPPER, WRAPPER_SIDE[position], className)}
            data-collapsed={collapsed}
            data-collapsible={collapsible}
            data-mobile={isMobile}
            data-position={position}
            initial={false}
            animate={{ width: collapsed ? collapsedWidth : expandedWidth }}
            transition={prefersReducedMotion ? { duration: 0 } : {
                type: 'spring',
                stiffness: 300,
                damping: 30
            }}
        >
            <div className={CONTAINER}>
                <div id={`${sidebarId}-content`} className={TOP_CONTAINER}>
                    {headerElement}

                    {overrideContent ? (
                        <div>{overrideContent}</div>
                    ) : (
                        <>
                            {tags.length > 1 && (
                                <div className={isCollapsedOnMobile ? 'hidden' : 'p-6'}>
                                    <div className='relative overflow-hidden rounded-full'>
                                        {canScrollLeft && (
                                            <div className={`${FADE} left-0 bg-linear-to-r from-surface to-transparent`} aria-hidden='true' />
                                        )}
                                            <div ref={tabsContainerRef} className={collapsed ? `${TABS_CONTAINER} gap-1` : TABS_CONTAINER} role='tablist' aria-label='Sidebar sections'>
                                                {tags.map((tag) => {
                                                    const isSelected = tag.id === activeTagId;

                                                    return (
                                                        <button
                                                            key={tag.id}
                                                            id={`${sidebarId}-tab-${tag.id}`}
                                                            type='button'
                                                            role='tab'
                                                            aria-selected={isSelected}
                                                            aria-controls={`${sidebarId}-panel-${tag.id}`}
                                                            tabIndex={isSelected ? 0 : -1}
                                                            className={cn(TAB, collapsed ? TAB_COLLAPSED : TAB_EXPANDED, isSelected ? TAB_SELECTED : TAB_IDLE)}
                                                            onClick={() => onTagChange?.(tag.id)}
                                                        >
                                                            <span className={collapsed ? 'sr-only' : 'text-sm font-medium'}>
                                                                {tag.name}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        {canScrollRight && (
                                            <div className={`${FADE} right-0 bg-linear-to-l from-surface to-transparent`} aria-hidden='true' />
                                        )}
                                    </div>
                                </div>
                            )}

                            {keepMounted ? (
                                tags.map((tag) => (
                                    <div
                                        key={tag.id}
                                        className={isCollapsedOnMobile ? 'hidden' : BODY}
                                        id={`${sidebarId}-panel-${tag.id}`}
                                        role='tabpanel'
                                        aria-labelledby={`${sidebarId}-tab-${tag.id}`}
                                        hidden={tag.id !== activeTagId}
                                    >
                                        <tag.Component />
                                    </div>
                                ))
                            ) : (
                                activeTagConfig && (
                                    <div
                                        className={isCollapsedOnMobile ? 'hidden' : BODY}
                                        id={tags.length > 1 ? `${sidebarId}-panel-${activeTagConfig.id}` : undefined}
                                        role={tags.length > 1 ? 'tabpanel' : undefined}
                                        aria-labelledby={tags.length > 1 ? `${sidebarId}-tab-${activeTagConfig.id}` : undefined}
                                    >
                                        <activeTagConfig.Component />
                                    </div>
                                )
                            )}
                        </>
                    )}
                </div>

                {bottomElement}
            </div>
        </motion.aside>
    );
};

const SidebarWithSlots = Sidebar as typeof Sidebar & Record<'Header' | 'Bottom', typeof SidebarHeader | typeof SidebarBottom>;
SidebarWithSlots.Header = SidebarHeader;
SidebarWithSlots.Bottom = SidebarBottom;

export default SidebarWithSlots;
