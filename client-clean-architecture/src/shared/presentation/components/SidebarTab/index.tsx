import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import './SidebarTab.css';

interface SidebarTabProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
};

const SidebarTab = ({ label, isActive, onClick }: SidebarTabProps) => {
    return (
        <Container
            className={`d-flex content-center items-center editor-sidebar-option-container ${isActive ? 'selected' : ''}`}
            onClick={onClick}
        >
            <Title className='font-size-3 editor-sidebar-option-title font-weight-5'>
                {label}
            </Title>
        </Container>
    );
};

export default SidebarTab;
