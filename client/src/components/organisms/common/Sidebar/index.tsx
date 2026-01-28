import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import EditorWidget from '@/features/canvas/components/organisms/EditorWidget';
import CanvasSidebarTab from '@/features/canvas/components/atoms/CanvasSidebarTab';
import SidebarHeader from '@/components/molecules/common/SidebarHeader';
import SidebarBottom from '@/components/molecules/common/SidebarBottom';
import Container from '@/components/primitives/Container';
import '@/components/organisms/common/Sidebar/Sidebar.css';

const MOBILE_BREAKPOINT = 768;

export interface SidebarTag {
    id: string;
    name: string;
    Component: React.ComponentType<any>;
    props?: () => Record<string, unknown>;
}

export interface SidebarProps {
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
            className={`editor-sidebar-wrapper d-flex ${className} p-absolute`}
            data-collapsed={collapsed}
            initial={false}
            animate={{ width: collapsed ? 64 : (overrideContent ? 460 : 380) }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
            <EditorWidget className='editor-sidebar-container d-flex column content-between overflow-hidden w-max h-max' draggable={false}>
                <Container className='editor-sidebar-top-container'>
                    {headerElement}

                    {overrideContent ? (
                        <Container>
                            {overrideContent}
                        </Container>
                    ) : (
                        <>
                            <Container className='p-1-5'>
                                <Container className='d-flex p-05 content-between editor-sidebar-options-container'>
                                    {tags.map(tag => (
                                        <CanvasSidebarTab option={tag.name} key={tag.id} />
                                    ))}
                                </Container>
                            </Container>

                            {tags.map(tag => (
                                <div key={tag.id} style={{ display: tag.id === activeTag ? 'block' : 'none' }}>
                                    <tag.Component {...tag.props} />
                                </div>
                            ))}
                        </>
                    )}
                </Container>

                {bottom}
            </EditorWidget>
        </motion.aside>
    );
};

Sidebar.Header = SidebarHeader;
Sidebar.Bottom = SidebarBottom;

export default Sidebar;
