import './Brand.css';
import { IconButton, IconFrame } from '@voltstack/bravais';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface BrandProps {
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}

const Brand = ({ collapsed = false, onToggleCollapse }: BrandProps) => {
    let brandContent = <h3 className='text-base font-medium text-foreground sidebar-brand-title'>Volt</h3>;
    if (collapsed) {
        brandContent = <IconFrame size='sm' shape='circle' className='sidebar-brand-icon'>V</IconFrame>;
    }

    let collapseIcon = <PanelLeftClose size={16} />;
    if (collapsed) {
        collapseIcon = <PanelLeftOpen size={16} />;
    }

    return (
        <div className={`sidebar-brand ${collapsed ? 'is-collapsed' : ''}`}>
            {brandContent}

            {onToggleCollapse && (
                <IconButton
                    className='sidebar-collapse-toggle flex items-center justify-center rounded-md transition-[all] duration-150 ease-out-fluid'
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
