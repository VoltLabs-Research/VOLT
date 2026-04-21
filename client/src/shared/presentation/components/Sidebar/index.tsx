import SidebarBottom from '@/shared/presentation/components/SidebarBottom';
import SidebarHeader from '@/shared/presentation/components/SidebarHeader';
import './Sidebar.css';
import '@/shared/presentation/components/SidebarTab/SidebarTab.css';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState, useRef, useCallback, useMemo, useId } from 'react';
import React from 'react';
import type { ReactNode, ComponentType } from 'react';

const MOBILE_BREAKPOINT = 768;

export interface SidebarTag {
    id: string;
    name: string;
    Component: ComponentType;
};

export interface SidebarProps {
    activeTag: string;
    onTagChange?: (tagId: string) => void;
    tags: SidebarTag[];
    className?: string;
    overrideContent?: ReactNode;
    children?: ReactNode;
    position?: 'left' | 'right';
    collapsible?: boolean;
    /** Keep inactive tabs mounted but hidden (prevents refetch on tab switch) */
    keepMounted?: boolean;
};

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
    const [isMobile, setIsMobile] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const tabsContainerRef = useRef<HTMLDivElement>(null);
    const prefersReducedMotion = useReducedMotion();
    const sidebarId = useId();

    const checkOverflow = useCallback(() => {
        const container = tabsContainerRef.current;
        if (!container) return;
        
        const { scrollLeft, scrollWidth, clientWidth } = container;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
    }, []);

    useEffect(() => {
        const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

        const handleMediaChange = (event: MediaQueryListEvent | MediaQueryList) => {
            const nextIsMobile = event.matches;
            setIsMobile(nextIsMobile);

            if (!collapsible) {
                setCollapsed(false);
                return;
            }

            setCollapsed(nextIsMobile);
        };

        handleMediaChange(mediaQuery);
        mediaQuery.addEventListener('change', handleMediaChange);

        return () => {
            mediaQuery.removeEventListener('change', handleMediaChange);
        };
    }, [collapsible]);

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

    const headerElement = header
        ? React.cloneElement(header as React.ReactElement<React.ComponentProps<typeof SidebarHeader>>, {
            collapsed,
            onToggle: toggleCollapsed,
            controlsId: `${sidebarId}-content`
        })
        : null;

    const positionClass = position === 'right' ? 'editor-sidebar-wrapper--right' : '';
    const activeTagConfig = useMemo(() => tags.find((tag) => tag.id === activeTagId), [tags, activeTagId]);
    const expandedWidth = isMobile ? 'min(460px, calc(100vw - 1rem))' : (overrideContent ? 460 : 380);
    const collapsedWidth = isMobile ? 56 : 64;

    return (
        <motion.aside
            className={`editor-sidebar-wrapper d-flex ${positionClass} ${className} p-absolute`}
            data-collapsed={collapsed}
            data-collapsible={collapsible}
            data-mobile={isMobile}
            data-position={position}
            initial={false}
            animate={{ width: collapsed ? collapsedWidth : expandedWidth }}
            transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
        >
            <div className='volt-container editor-sidebar-container glass-bg b-none d-flex column glass-bg content-between overflow-hidden w-max h-max'>
                <div id={`${sidebarId}-content`} className='volt-container editor-sidebar-top-container'>
                    {headerElement}

                    {overrideContent ? (
                        <div className="volt-container">{overrideContent}</div>
                    ) : (
                        <>
                            {tags.length > 1 && (
                                <div className='volt-container p-1-5 editor-sidebar-tabs-region'>
                                    <div className='volt-container editor-sidebar-tabs-wrapper p-relative'>
                                        {canScrollLeft && (
                                            <div className='editor-sidebar-tabs-fade editor-sidebar-tabs-fade--left' aria-hidden='true' />
                                        )}
                                            <div ref={tabsContainerRef} className='volt-container d-flex p-05 content-between editor-sidebar-options-container scrollbar-none' role='tablist' aria-label='Sidebar sections'>
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
                                                            className={`d-flex content-center items-center editor-sidebar-option-container ${isSelected ? 'selected' : ''}`}
                                                            onClick={() => onTagChange?.(tag.id)}
                                                        >
                                                            <span className='font-size-3 editor-sidebar-option-title font-weight-5'>
                                                                {tag.name}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        {canScrollRight && (
                                            <div className='editor-sidebar-tabs-fade editor-sidebar-tabs-fade--right' aria-hidden='true' />
                                        )}
                                    </div>
                                </div>
                            )}

                            {keepMounted ? (
                                // Keep all tabs mounted, hide inactive ones with CSS
                                tags.map((tag) => (
                                    <div
                                        key={tag.id}
                                        className='editor-sidebar-body'
                                        id={`${sidebarId}-panel-${tag.id}`}
                                        role='tabpanel'
                                        aria-labelledby={`${sidebarId}-tab-${tag.id}`}
                                        hidden={tag.id !== activeTagId}
                                    >
                                        <tag.Component />
                                    </div>
                                ))
                            ) : (
                                // Default: only render active tab
                                activeTagConfig && (
                                    <div
                                        className='editor-sidebar-body'
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

                {bottom}
            </div>
        </motion.aside>
    );
};

const SidebarWithSlots = Sidebar as typeof Sidebar & Record<'Header' | 'Bottom', typeof SidebarHeader | typeof SidebarBottom>;
SidebarWithSlots.Header = SidebarHeader;
SidebarWithSlots.Bottom = SidebarBottom;

export default SidebarWithSlots;
