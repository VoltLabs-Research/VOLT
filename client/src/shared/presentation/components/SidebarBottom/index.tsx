import type { ReactNode } from 'react';

interface SidebarBottomProps {
    children: ReactNode;
};

const SidebarBottom = ({ children }: SidebarBottomProps) => {
    return (
        <footer className='editor-sidebar-bottom-container'>
            {children}
        </footer>
    );
};

export default SidebarBottom;
