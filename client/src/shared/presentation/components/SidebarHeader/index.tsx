import Button from '@/shared/presentation/primitives/Button';
import { LuPanelRight } from 'react-icons/lu';

interface SidebarHeaderProps {
    collapsed?: boolean;
    onToggle?: () => void;
    controlsId?: string;
    children: React.ReactNode;
};

const SidebarHeader = ({ collapsed, onToggle, controlsId, children }: SidebarHeaderProps) => {
    return (
        <header className='d-flex content-between p-1-5 sm:p-1 editor-sidebar-header-container'>
            <div className='d-flex column gap-05 editor-sidebar-header-content'>
                {children}
            </div>

            <Button
                variant='ghost'
                intent='neutral'
                iconOnly
                size='sm'
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-controls={controlsId}
                aria-expanded={collapsed === undefined ? undefined : !collapsed}
                onClick={onToggle}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className='editor-sidebar-toggle-btn'
            >
                <LuPanelRight
                    className={`editor-sidebar-toggle-icon ${collapsed ? 'rotated' : ''}`}
                    aria-hidden='true'
                />
            </Button>
        </header>
    );
};

export default SidebarHeader;
