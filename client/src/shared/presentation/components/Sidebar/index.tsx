import React, { useEffect, useState, useRef, useCallback, useMemo, type ReactNode, type ComponentType } from 'react';
import { motion } from 'framer-motion';
import SidebarHeader from '@/shared/presentation/components/SidebarHeader';
import SidebarBottom from '@/shared/presentation/components/SidebarBottom';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import '@/shared/presentation/components/SidebarTab/SidebarTab.css';
import './Sidebar.css';

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
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const tabsContainerRef = useRef<HTMLDivElement>(null);

    const checkOverflow = useCallback(() => {
        const container = tabsContainerRef.current;
        if (!container) return;
        
        const { scrollLeft, scrollWidth, clientWidth } = container;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
    }, []);

    useEffect(() => {
        if (window.innerWidth <= MOBILE_BREAKPOINT && collapsible) {
            setCollapsed(true);
        }
    }, [collapsible]);

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
        ? React.cloneElement(header as React.ReactElement, {
            collapsed,
            onToggle: toggleCollapsed
        })
        : null;

    const positionClass = position === 'right' ? 'editor-sidebar-wrapper--right' : '';
    const activeTagConfig = useMemo(() => tags.find((tag) => tag.id === activeTagId), [tags, activeTagId]);

    return (
        <motion.aside
            className={`editor-sidebar-wrapper d-flex ${positionClass} ${className} p-absolute`}
            data-collapsed={collapsed}
            data-collapsible={collapsible}
            data-position={position}
            initial={false}
            animate={{ width: collapsed ? 64 : (overrideContent ? 460 : 380) }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
            <Container className='editor-sidebar-container glass-bg b-none d-flex column content-between overflow-hidden w-max h-max'>
                <Container className='editor-sidebar-top-container'>
                    {headerElement}

                    {overrideContent ? (
                        <Container>{overrideContent}</Container>
                    ) : (
                        <>
                            {tags.length > 1 && (
                                <Container className='p-1-5'>
                                    <Container className='editor-sidebar-tabs-wrapper p-relative'>
                                        {canScrollLeft && (
                                            <div className='editor-sidebar-tabs-fade editor-sidebar-tabs-fade--left' />
                                        )}
                                            <Container 
                                                ref={tabsContainerRef}
                                                className='d-flex p-05 content-between editor-sidebar-options-container'
                                            >
                                                {tags.map((tag) => (
                                                    <Container
                                                        key={tag.id}
                                                        className={`d-flex content-center items-center editor-sidebar-option-container ${tag.id === activeTagId ? 'selected' : ''}`}
                                                        onClick={() => onTagChange?.(tag.id)}
                                                    >
                                                        <Title className='font-size-3 editor-sidebar-option-title font-weight-5'>
                                                            {tag.name}
                                                        </Title>
                                                    </Container>
                                                ))}
                                            </Container>
                                        {canScrollRight && (
                                            <div className='editor-sidebar-tabs-fade editor-sidebar-tabs-fade--right' />
                                        )}
                                    </Container>
                                </Container>
                            )}

                            {keepMounted ? (
                                // Keep all tabs mounted, hide inactive ones with CSS
                                tags.map((tag) => (
                                    <div
                                        key={tag.id}
                                        className='editor-sidebar-body'
                                        style={{ display: tag.id === activeTagId ? 'block' : 'none' }}
                                    >
                                        <tag.Component />
                                    </div>
                                ))
                            ) : (
                                // Default: only render active tab
                                activeTagConfig && (
                                    <div className='editor-sidebar-body'>
                                        <activeTagConfig.Component />
                                    </div>
                                )
                            )}
                        </>
                    )}
                </Container>

                {bottom}
            </Container>
        </motion.aside>
    );
};

const SidebarWithSlots = Sidebar as typeof Sidebar & Record<'Header' | 'Bottom', typeof SidebarHeader | typeof SidebarBottom>;
SidebarWithSlots.Header = SidebarHeader;
SidebarWithSlots.Bottom = SidebarBottom;

export default SidebarWithSlots;
