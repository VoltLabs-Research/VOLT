import { ContainerAction } from '../../../api/dtos/update-container';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Activity,
    ArrowLeft,
    Box,
    FileText,
    Folder,
    Layers,
    Monitor,
    Play,
    RefreshCw,
    Square,
    Terminal
} from 'lucide-react';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import SidebarNavItem from '@/shared/presentation/components/SidebarNavItem';
import Title from '@/shared/presentation/components/Title';
import usePermission from '@/shared/presentation/hooks/use-permission';
import { supportsRemoteDesktop } from '@/modules/container/utilities/supports-remote-desktop';
import type { Container as ContainerEntity } from '@/modules/container/api/entities/container';
import type { LucideIcon } from 'lucide-react';
import { getPrimaryAccessiblePort } from '@/modules/container/utilities/get-primary-accessible-port';
import { useOpenContainerPort } from '@/modules/container/hooks/use-open-container-port';

interface ContainerSidebarProps {
    container: ContainerEntity;
    onBack: () => void;
    onAction: (action: ContainerAction | 'delete') => void;
    actionLoading: boolean;
};

interface NavItem {
    path: string;
    label: string;
    icon: LucideIcon;
};

const BASE_NAV_ITEMS: NavItem[] = [
    {
        path: '',
        label: 'Overview',
        icon: Layers
    },
    {
        path: 'processes',
        label: 'Processes',
        icon: Activity
    },
    {
        path: 'terminal',
        label: 'Terminal',
        icon: Terminal
    },
    {
        path: 'logs',
        label: 'Logs',
        icon: FileText
    },
    {
        path: 'storage',
        label: 'Files & Storage',
        icon: Folder
    }
];

const REMOTE_DESKTOP_NAV_ITEM: NavItem = {
    path: 'remote-desktop',
    label: 'Remote Desktop',
    icon: Monitor
};

const ContainerSidebar = ({
    container,
    onBack,
    onAction,
    actionLoading
}: ContainerSidebarProps) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const isRunning = container.status === 'running';
    const canUpdate = usePermission(['container:update']);
    const hasRemoteDesktop = supportsRemoteDesktop(container.capabilities);
    const { openPort, openingPort } = useOpenContainerPort();
    const primaryAccessiblePort = getPrimaryAccessiblePort(container.accessiblePorts);

    const basePath = `/dashboard/containers/${container._id}`;
    const navItems = hasRemoteDesktop && isRunning
        ? [...BASE_NAV_ITEMS, REMOTE_DESKTOP_NAV_ITEM]
        : BASE_NAV_ITEMS;
    let actionButtons = null;

    if (canUpdate) {
        if (!isRunning) {
            actionButtons = (
                <Button
                    variant='solid'
                    intent='success'
                    block
                    leftIcon={<Play size={16} />}
                    onClick={() => onAction(ContainerAction.Start)}
                    disabled={actionLoading}
                >
                    Start Container
                </Button>
            );
        } else {
            actionButtons = (
                <>
                    <Button
                        variant='outline'
                        intent='neutral'
                        block
                        leftIcon={<RefreshCw size={16} />}
                        onClick={() => onAction(ContainerAction.Restart)}
                        disabled={actionLoading}
                    >
                        Restart
                    </Button>
                    <Button
                        variant='soft'
                        intent='danger'
                        block
                        leftIcon={<Square size={16} />}
                        onClick={() => onAction(ContainerAction.Stop)}
                        disabled={actionLoading}
                    >
                        Stop
                    </Button>
                </>
            );
        }
    }

    const handleNavigate = (path: string) => {
        navigate(`${basePath}/${path}`);
    };

    const isSelected = (path: string) => {
        if (!path) {
            return pathname === basePath;
        }

        return pathname.endsWith(`/${path}`);
    };

    return (
        <Container className='container-details-sidebar d-flex column f-shrink-0'>
            <Container className='container-details-sidebar-header d-flex column gap-1 items-start p-1-5'>
                <Button
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    leftIcon={<ArrowLeft size={16} />}
                    onClick={onBack}
                >
                    Back
                </Button>

                <Container className='d-flex items-center gap-1 container-details-identity'>
                    <Container className='d-flex items-center content-center container-details-icon-large radius-md'>
                        <Box size={24} />
                    </Container>
                    <Container className='container-details-identity-text d-flex column gap-05'>
                        <Title className='font-size-2-5 font-weight-6'>{container.name}</Title>
                        <span className={`d-flex items-center gap-035 container-details-status-badge ${container.status} font-size-1 font-weight-5`}>
                            {container.status}
                        </span>
                    </Container>
                </Container>
            </Container>

            <nav className='container-details-nav d-flex gap-1 column flex-1 y-auto' aria-label='Container detail sections'>
                {navItems.map(({ path, label, icon }) => (
                    <SidebarNavItem
                        key={path}
                        label={label}
                        icon={icon}
                        isSelected={isSelected(path)}
                        onClick={() => handleNavigate(path)}
                    />
                ))}
            </nav>

            <Container className='container-details-actions d-flex column gap-075 p-1-5'>
                {primaryAccessiblePort && (
                    <Button
                        variant='solid'
                        intent='brand'
                        block
                        onClick={() => openPort(container._id, primaryAccessiblePort.private)}
                        isLoading={openingPort === primaryAccessiblePort.private}
                    >
                        Open App
                    </Button>
                )}
                {actionButtons}
            </Container>
        </Container>
    );
};

export default ContainerSidebar;
