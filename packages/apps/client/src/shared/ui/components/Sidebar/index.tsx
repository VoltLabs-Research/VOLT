import Scrollable from '@/shared/ui/components/Scrollable';
import SidebarBottom from '@/shared/ui/components/SidebarBottom';
import SidebarHeader from '@/shared/ui/components/SidebarHeader';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { cn } from '@heroui/react';
import { useEffect, useState, useMemo, useId } from 'react';
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
    const sidebarId = useId();
    const isMobile = useMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

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
            collapsed,
            isHidden: isCollapsedOnMobile
        })
        : null;

    const activeTagConfig = useMemo(() => tags.find((tag) => tag.id === activeTagId), [tags, activeTagId]);
    const expandedWidth = isMobile ? 'min(460px, calc(100vw - 1rem))' : (overrideContent ? 460 : 380);
    const collapsedWidth = isMobile ? 56 : 64;

    return (
        <aside
            className={cn('absolute inset-y-2 z-[200] flex transition-[width] duration-[420ms] ease-[var(--ease-emphasized)]', { left: 'left-2', right: 'left-auto right-2' }[position], className)}
            style={{ width: collapsed ? collapsedWidth : expandedWidth }}
            data-collapsed={collapsed}
            data-collapsible={collapsible}
            data-mobile={isMobile}
            data-position={position}
        >
            <div className='glass-surface flex h-full w-full max-w-full flex-col justify-between gap-0 overflow-hidden rounded-2xl border-0 bg-dashboard-surface p-0 shadow-[var(--overlay-shadow)] max-[768px]:z-[100]'>
                <div id={`${sidebarId}-content`} className='flex min-h-0 flex-1 flex-col overflow-hidden'>
                    {headerElement}

                    {/* The content keeps its expanded width while the rail animates, so it is clipped instead of
                        reflowing word by word, and it fades out because the collapsed rail has no room for it. */}
                    <div
                        className={cn('flex min-h-0 flex-1 flex-col transition-[opacity,visibility] duration-200 ease-smooth', collapsed && 'invisible opacity-0')}
                        style={{ minWidth: expandedWidth }}
                        inert={collapsed}
                    >
                        {overrideContent ? (
                            <div>{overrideContent}</div>
                        ) : (
                            <>
                                {tags.length > 1 && (
                                    <div className='p-6'>
                                        <div className='relative overflow-hidden rounded-full'>
                                                <Scrollable orientation='horizontal' size={40} className='flex justify-between flex-nowrap overflow-y-hidden rounded-full p-2' role='tablist' aria-label='Sidebar sections'>
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
                                                                className={cn('flex min-h-11 min-w-[130px] flex-[1_0_auto] cursor-pointer items-center justify-center whitespace-nowrap rounded-full border border-transparent px-4 transition-colors duration-150 ease-smooth focus-visible:border-border', isSelected ? 'bg-surface-tertiary inset-ring-1 inset-ring-border' : 'hover:bg-surface-hover')}
                                                                onClick={() => onTagChange?.(tag.id)}
                                                            >
                                                                <span className='text-sm font-medium'>
                                                                    {tag.name}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </Scrollable>
                                        </div>
                                    </div>
                                )}

                                {keepMounted ? (
                                    tags.map((tag) => (
                                        <Scrollable
                                            key={tag.id}
                                            className='min-h-0 flex-1 overflow-x-hidden'
                                            id={`${sidebarId}-panel-${tag.id}`}
                                            role='tabpanel'
                                            aria-labelledby={`${sidebarId}-tab-${tag.id}`}
                                            hidden={tag.id !== activeTagId}
                                        >
                                            <tag.Component />
                                        </Scrollable>
                                    ))
                                ) : (
                                    activeTagConfig && (
                                        <Scrollable
                                            className='min-h-0 flex-1 overflow-x-hidden'
                                            id={tags.length > 1 ? `${sidebarId}-panel-${activeTagConfig.id}` : undefined}
                                            role={tags.length > 1 ? 'tabpanel' : undefined}
                                            aria-labelledby={tags.length > 1 ? `${sidebarId}-tab-${activeTagConfig.id}` : undefined}
                                        >
                                            <activeTagConfig.Component />
                                        </Scrollable>
                                    )
                                )}
                            </>
                        )}
                    </div>
                </div>

                {bottomElement}
            </div>
        </aside>
    );
};

const SidebarWithSlots = Sidebar as typeof Sidebar & { Header: typeof SidebarHeader; Bottom: typeof SidebarBottom };
SidebarWithSlots.Header = SidebarHeader;
SidebarWithSlots.Bottom = SidebarBottom;

export default SidebarWithSlots;
