import type { ReactNode } from 'react';

interface SidebarBottomState {
    collapsed: boolean;
}

export type SidebarBottomContent = ReactNode | ((state: SidebarBottomState) => ReactNode);

interface SidebarBottomProps {
    children: SidebarBottomContent;

    collapsed?: boolean;
    isHidden?: boolean;
};

const SidebarBottom = ({ children, collapsed = false, isHidden = false }: SidebarBottomProps) => {
    return (
        <footer className={isHidden ? 'hidden' : undefined}>
            {typeof children === 'function' ? children({ collapsed }) : children}
        </footer>
    );
};

export default SidebarBottom;
