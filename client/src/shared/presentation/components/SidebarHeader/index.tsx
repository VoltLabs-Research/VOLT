import { Box, Button, Stack } from '@voltstack/bravais';
import { LuPanelRight } from 'react-icons/lu';

interface SidebarHeaderProps {
    collapsed?: boolean;
    onToggle?: () => void;
    controlsId?: string;
    children: React.ReactNode;
};

const SidebarHeader = ({ collapsed, onToggle, controlsId, children }: SidebarHeaderProps) => {
    return (
        <Box as='header' display='flex' justify='between' p='1-5' className='sm:p-1 editor-sidebar-header-container'>
            <Stack gap='05' className='editor-sidebar-header-content'>
                {children}
            </Stack>

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
        </Box>
    );
};

export default SidebarHeader;
