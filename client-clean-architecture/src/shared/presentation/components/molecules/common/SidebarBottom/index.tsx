import Container from '@/shared/presentation/components/primitives/Container';
import type { ReactNode } from 'react';

interface SidebarBottomProps {
    children?: ReactNode;
}

const SidebarBottom = ({ children }: SidebarBottomProps) => {

    return(
        <Container className='editor-sidebar-bottom-container'>
            {children}
        </Container>
    );
};

export default SidebarBottom;
