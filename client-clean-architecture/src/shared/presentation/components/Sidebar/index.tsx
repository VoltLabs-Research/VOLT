import React, { useEffect, useState, type ReactNode, type ComponentType } from 'react';
import { motion } from 'framer-motion';
import SidebarHeader from '@/shared/presentation/components/SidebarHeader';
import SidebarBottom from '@/shared/presentation/components/SidebarBottom';
import SidebarTab from '@/shared/presentation/components/SidebarTab';
import Container from '@/shared/presentation/components/Container';
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
};

const Sidebar = ({ 
    activeTag, 
    onTagChange,
    tags, 
    children, 
    overrideContent, 
    className = '' 
}: SidebarProps) => {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        if (window.innerWidth <= MOBILE_BREAKPOINT) {
            setCollapsed(true);
        }
    }, []);

    const toggleCollapsed = () => setCollapsed((v) => !v);

    const header = React.Children.toArray(children).find(
        (child) => React.isValidElement(child) && child.type === SidebarHeader
    );

    const bottom = React.Children.toArray(children).find(
        (child) => React.isValidElement(child) && child.type === SidebarBottom
    );

    const headerElement = header
        ? React.cloneElement(header as React.ReactElement<{ collapsed?: boolean; onToggle?: () => void }>, {
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
            <Container className='editor-sidebar-container d-flex column content-between overflow-hidden w-max h-max'>
                <Container className='editor-sidebar-top-container'>
                    {headerElement}

                    {overrideContent ? (
                        <Container>{overrideContent}</Container>
                    ) : (
                        <>
                            {tags.length > 1 && (
                                <Container className='p-1-5'>
                                    <Container className='d-flex p-05 content-between editor-sidebar-options-container'>
                                        {tags.map((tag) => (
                                            <SidebarTab
                                                key={tag.id}
                                                label={tag.name}
                                                isActive={tag.id === activeTag}
                                                onClick={() => onTagChange?.(tag.id)}
                                            />
                                        ))}
                                    </Container>
                                </Container>
                            )}

                            {tags.map((tag) => (
                                <div key={tag.id} style={{ display: tag.id === activeTag ? 'block' : 'none' }}>
                                    <tag.Component />
                                </div>
                            ))}
                        </>
                    )}
                </Container>

                {bottom}
            </Container>
        </motion.aside>
    );
};

Sidebar.Header = SidebarHeader;
Sidebar.Bottom = SidebarBottom;

export default Sidebar;
