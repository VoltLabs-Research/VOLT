import type { ReactNode } from 'react';

interface SidebarBottomProps {
    children: ReactNode;

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
