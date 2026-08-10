import type { ReactNode } from 'react';

interface SidebarBottomProps {
    children: ReactNode;
    /**
     * Set by Sidebar. `.editor-sidebar-bottom-container` had exactly one rule — it
     * disappeared when the sidebar was collapsed under the mobile breakpoint — and
     * that condition lives in Sidebar, so it is passed down rather than re-measured.
     */
    isHidden?: boolean;
};

const SidebarBottom = ({ children, isHidden = false }: SidebarBottomProps) => {
    return (
        <footer className={isHidden ? 'hidden' : undefined}>
            {children}
        </footer>
    );
};

export default SidebarBottom;
