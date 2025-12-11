import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import EditorWidget from '@/components/organisms/scene/EditorWidget';
import CanvasSidebarTab from '@/components/atoms/scene/CanvasSidebarTab';
import SidebarHeader from '@/components/molecules/common/SidebarHeader';
import SidebarBottom from '@/components/molecules/common/SidebarBottom';
import './Sidebar.css';

const MOBILE_BREAKPOINT = 768;

export interface SidebarTag{
    id: string;
    name: string;
    Component: React.ComponentType<any>;
    props?: () => Record<string, unknown>;
}

export interface SidebarProps{
    activeTag: string;
    tags: SidebarTag[];
    className?: string;
    overrideContent?: React.ReactNode;
    showCollapseButton?: boolean;
    children?: React.ReactNode;
}

const Sidebar = ({ activeTag, tags, children, showCollapseButton, overrideContent, className }: SidebarProps) => {
    const [collapsed, setCollapsed] = useState(false);
    const active = tags.find(tag => tag.id === activeTag);

    const bottom = React.Children.toArray(children).find((child) => child.type === SidebarBottom);

    useEffect(() => {
        if(window.innerWidth <= MOBILE_BREAKPOINT){
            setCollapsed(true);
        }
    }, []);

    const toggleCollapsed = () => {
        setCollapsed((v) => !v);
    };

    const header = React.Children.toArray(children).find(child => child.type === SidebarHeader);
    const headerElement = header
        ? React.cloneElement(header as any, {
            collapsed,
            onToggle: toggleCollapsed
        })
        : null;

    return (
        <motion.aside
            className={`editor-sidebar-wrapper ${className}`}
            data-collapsed={collapsed}
            initial={false}
            animate={{ width: collapsed ? 64 : 380 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
            <EditorWidget className='editor-sidebar-container' draggable={false}>
                <div className='editor-sidebar-top-container'>
                    {headerElement}

                    {overrideContent ? (
                        <div className='editor-sidebar-override-container'>
                            {overrideContent}
                        </div>
                    ) : (
                        <>
                            <div className='editor-sidebar-options-wrapper-container'>
                                <div className='editor-sidebar-options-container'>
                                    {tags.map(tag => (
                                        <CanvasSidebarTab option={tag.name} key={tag.id} />
                                    ))}
                                </div>
                            </div>

                            {active && (
                                <active.Component {...active.props} />
                            )}  
                        </>
                    )}
                </div>

                {bottom}
            </EditorWidget>
        </motion.aside>
    );
};

Sidebar.Header = SidebarHeader;
Sidebar.Bottom = SidebarBottom;

export default Sidebar;