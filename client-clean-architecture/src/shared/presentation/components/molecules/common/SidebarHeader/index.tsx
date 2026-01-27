import Container from '@/shared/presentation/components/primitives/Container';
import Button from '@/shared/presentation/components/primitives/Button';
import { LuPanelRight } from 'react-icons/lu';

interface SidebarHeaderProps {
    collapsed?: boolean;
    onToggle?: () => void;
    children: React.ReactNode;
}

const SidebarHeader = ({ collapsed, onToggle, children }: SidebarHeaderProps) => {
    return (
        <Container className="d-flex content-between p-1-5 sm:p-1 editor-sidebar-header-container">
            <Container className="d-flex column gap-05">
                {children}
            </Container>

            <Button
                variant='ghost'
                intent='neutral'
                iconOnly
                size='sm'
                onClick={onToggle}
            >
                <LuPanelRight
                    className={`editor-sidebar-toggle-icon ${collapsed ? "rotated" : ""}`}
                />
            </Button>
        </Container>
    );
};

export default SidebarHeader;
