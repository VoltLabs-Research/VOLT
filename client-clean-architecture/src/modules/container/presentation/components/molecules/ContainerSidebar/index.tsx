import { useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Play,
    Square,
    ExternalLink,
    Box,
    Layers,
    RefreshCw,
    Terminal,
    Folder,
    Activity
} from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Title from '@/shared/presentation/components/Title';
import SidebarNavItem from '@/shared/presentation/components/SidebarNavItem';
import type { Container as ContainerEntity } from '@/modules/container/domain/entities';
import type { LucideIcon } from 'lucide-react';

interface ContainerSidebarProps {
    container: ContainerEntity;
    onBack: () => void;
    onAction: (action: 'start' | 'stop' | 'restart' | 'delete') => void;
    actionLoading: boolean;
};

const NAV_ITEMS: { path: string; label: string; icon: LucideIcon }[] = [
    { path: '', label: 'Overview', icon: Layers },
    { path: 'processes', label: 'Processes', icon: Activity },
    { path: 'logs', label: 'Terminal & Logs', icon: Terminal },
    { path: 'storage', label: 'Files & Storage', icon: Folder }
];

const ContainerSidebar = ({
    container,
    onBack,
    onAction,
    actionLoading
}: ContainerSidebarProps) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const isRunning = container.status === 'running';

    const basePath = `/dashboard/containers/${container._id}`;

    const handleNavigate = (path: string) => {
        navigate(`${basePath}/${path}`);
    };

    const isSelected = (path: string) => pathname.endsWith(`/${path}`);

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
                    <Container className='d-flex items-center content-center container-details-icon-large'>
                        <Box size={24} />
                    </Container>
                    <Container className='container-details-identity-text d-flex column gap-05'>
                        <Title className='font-size-4 font-weight-6'>{container.name}</Title>
                        <span className={`d-flex items-center gap-035 container-details-status-badge ${container.status} font-size-1 font-weight-5`}>
                            {container.status}
                        </span>
                    </Container>
                </Container>
            </Container>

            <nav className='container-details-nav d-flex column flex-1 y-auto'>
                {NAV_ITEMS.map(({ path, label, icon }) => (
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
                {!isRunning ? (
                    <Button
                        variant='solid'
                        intent='success'
                        block
                        leftIcon={<Play size={16} />}
                        onClick={() => onAction('start')}
                        disabled={actionLoading}
                    >
                        Start Container
                    </Button>
                ) : (
                    <>
                        <Button
                            variant='outline'
                            intent='neutral'
                            block
                            leftIcon={<RefreshCw size={16} />}
                            onClick={() => onAction('restart')}
                            disabled={actionLoading}
                        >
                            Restart
                        </Button>
                        <Button
                            variant='soft'
                            intent='danger'
                            block
                            leftIcon={<Square size={16} />}
                            onClick={() => onAction('stop')}
                            disabled={actionLoading}
                        >
                            Stop
                        </Button>
                    </>
                )}

                {container.ports?.[0] && (
                    <a
                        href={`http://localhost:${container.ports[0].public}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='d-flex items-center content-center gap-05 container-details-visit-btn font-size-2 font-weight-6'
                    >
                        Visit App <ExternalLink size={14} />
                    </a>
                )}
            </Container>
        </Container>
    );
};

export default ContainerSidebar;
