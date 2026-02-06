import Container from '@/shared/presentation/components/Container';

interface SidebarBottomProps {
    children: React.ReactNode;
};

const SidebarBottom = ({ children }: SidebarBottomProps) => {
    return (
        <Container className='editor-sidebar-bottom-container'>
            {children}
        </Container>
    );
};

export default SidebarBottom;
