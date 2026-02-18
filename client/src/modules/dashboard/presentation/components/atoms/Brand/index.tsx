import { GoSidebarCollapse, GoSidebarExpand } from 'react-icons/go';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import IconButton from '@/shared/presentation/components/IconButton';
import './Brand.css';

interface BrandProps {
    collapsed?: boolean;
    onToggleCollapse?: () => void;
};

const Brand = ({ collapsed = false, onToggleCollapse }: BrandProps) => {
    return (
        <Container className={`sidebar-brand ${collapsed ? 'is-collapsed' : ''}`}>
            {collapsed ? (
                <Container className='sidebar-brand-icon d-flex flex-center radius-full'>V</Container>
            ) : (
                <Title className='sidebar-brand-title color-primary'>Volt</Title>
            )}

            {onToggleCollapse && (
                <IconButton
                    className='sidebar-collapse-toggle d-flex flex-center radius-xs transition-fast'
                    onClick={onToggleCollapse}
                    size={20}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? <GoSidebarExpand size={16} /> : <GoSidebarCollapse size={16} />}
                </IconButton>
            )}
        </Container>
    );
};

export default Brand;
