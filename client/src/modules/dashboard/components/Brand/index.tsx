import './Brand.css';
import { Box, Heading, IconButton, IconFrame } from '@/shared/presentation/primitives';
import { GoSidebarCollapse, GoSidebarExpand } from 'react-icons/go';

interface BrandProps {
    collapsed?: boolean;
    onToggleCollapse?: () => void;
};

const Brand = ({ collapsed = false, onToggleCollapse }: BrandProps) => {
    let brandContent = <Heading level={3} size='lg' weight='medium' tone='primary' className='sidebar-brand-title'>Volt</Heading>;
    if (collapsed) {
        brandContent = <IconFrame size='sm' shape='circle' className='sidebar-brand-icon'>V</IconFrame>;
    }

    let collapseIcon = <GoSidebarCollapse size={16} />;
    if (collapsed) {
        collapseIcon = <GoSidebarExpand size={16} />;
    }

    return (
        <Box className={`sidebar-brand ${collapsed ? 'is-collapsed' : ''}`}>
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
        </Box>
    );
};

export default Brand;
