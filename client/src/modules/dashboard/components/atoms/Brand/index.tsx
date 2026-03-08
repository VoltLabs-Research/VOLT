import './Brand.css';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Title from '@/shared/presentation/components/Title';
import { GoSidebarCollapse, GoSidebarExpand } from 'react-icons/go';

interface BrandProps {
    collapsed?: boolean;
    onToggleCollapse?: () => void;
};

const Brand = ({ collapsed = false, onToggleCollapse }: BrandProps) => {
    let brandContent = <Title className='sidebar-brand-title color-primary'>Volt</Title>;
    if (collapsed) {
        brandContent = <Container className='sidebar-brand-icon d-flex flex-center radius-full'>V</Container>;
    }

    let collapseIcon = <GoSidebarCollapse size={16} />;
    if (collapsed) {
        collapseIcon = <GoSidebarExpand size={16} />;
    }

    return (
        <Container className={`sidebar-brand ${collapsed ? 'is-collapsed' : ''}`}>
            {brandContent}

            {onToggleCollapse && (
                <IconButton
                    className='sidebar-collapse-toggle d-flex flex-center radius-xs transition-fast'
                    onClick={onToggleCollapse}
                    size='md'
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapseIcon}
                </IconButton>
            )}
        </Container>
    );
};

export default Brand;
