import './Brand.css';
import IconButton from '@/shared/presentation/components/IconButton';
import { GoSidebarCollapse, GoSidebarExpand } from 'react-icons/go';

interface BrandProps {
    collapsed?: boolean;
    onToggleCollapse?: () => void;
};

const Brand = ({ collapsed = false, onToggleCollapse }: BrandProps) => {
    let brandContent = <h3 className='volt-title sidebar-brand-title color-primary'>Volt</h3>;
    if (collapsed) {
        brandContent = <div className='volt-container sidebar-brand-icon d-flex flex-center radius-full'>V</div>;
    }

    let collapseIcon = <GoSidebarCollapse size={16} />;
    if (collapsed) {
        collapseIcon = <GoSidebarExpand size={16} />;
    }

    return (
        <div className={`volt-container sidebar-brand ${collapsed ? 'is-collapsed' : ''}`}>
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
        </div>
    );
};

export default Brand;
