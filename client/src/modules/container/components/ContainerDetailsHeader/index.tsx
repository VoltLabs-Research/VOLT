import { Box, Button, Heading, Row, SegmentedTabs, Stack, StatusDot } from '@/shared/presentation/primitives';
import type { StatusDotTone } from '@/shared/presentation/primitives';
import { ArrowLeft, ExternalLink, Play, RefreshCw, Square } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useOpenContainerPort } from '@/modules/container/hooks/use-open-container-port';
import { getPrimaryAccessiblePort } from '@/modules/container/utilities/get-primary-accessible-port';
import { ContainerAction } from '@/modules/container/api/dtos/update-container';
import type { ReactNode } from 'react';
import type { Container as ContainerEntity } from '@/modules/container/api/entities/container';
import type { SegmentedTabOption } from '@/shared/presentation/primitives';
import './ContainerDetailsHeader.css';

type ContainerDetailsTabId = 'overview' | 'processes' | 'terminal' | 'storage';

interface ContainerDetailsTabOption extends SegmentedTabOption<ContainerDetailsTabId> {
    path: string;
};

const TABS: ReadonlyArray<ContainerDetailsTabOption> = [
    { id: 'overview', label: 'Overview', path: '' },
    { id: 'processes', label: 'Processes', path: 'processes' },
    { id: 'terminal', label: 'Terminal', path: 'terminal' },
    { id: 'storage', label: 'Files', path: 'storage' }
] as const;

const resolveActiveTab = (pathname: string, basePath: string): ContainerDetailsTabId => {
    const normalized = pathname.replace(/\/$/, '');
    const base = basePath.replace(/\/$/, '');

    if (normalized === base) return 'overview';
    if (normalized.endsWith('/processes')) return 'processes';
    if (normalized.endsWith('/terminal')) return 'terminal';
    if (normalized.endsWith('/storage')) return 'storage';
    return 'overview';
};

export interface ContainerDetailsHeaderProps {
    container: ContainerEntity;
    onBack: () => void;
    onAction: (action: ContainerAction | 'delete') => void;
    actionLoading: boolean;
    contextualActions?: ReactNode;
};

const ContainerDetailsHeader = ({
    container,
    onBack,
    onAction,
    actionLoading,
    contextualActions
}: ContainerDetailsHeaderProps) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { canAccess } = useTeamPermissions();
    const canUpdate = canAccess(['container:update']);
    const { openPort, openingPort } = useOpenContainerPort();

    const basePath = `/dashboard/containers/${container._id}`;
    const activeTab = resolveActiveTab(pathname, basePath);
    const primaryAccessiblePort = getPrimaryAccessiblePort(container.accessiblePorts);
    const isRunning = container.status === 'running';

    const statusTone: StatusDotTone = container.status === 'running'
        ? 'success'
        : container.status === 'exited'
            ? 'danger'
            : container.status === 'created'
                ? 'info'
                : 'neutral';

    const createdRelative = useMemo(
        () => formatDistanceToNow(new Date(container.createdAt), { addSuffix: true }),
        [container.createdAt]
    );

    const handleTabChange = (id: ContainerDetailsTabId) => {
        const tab = TABS.find((t) => t.id === id);
        if (!tab) return;
        navigate(tab.path ? `${basePath}/${tab.path}` : basePath);
    };

    return (
        <Stack className='container-details-header'>
            <Row gap='05'>
                <Button
                    className='container-details-header-back'
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    leftIcon={<ArrowLeft size={14} />}
                    onClick={onBack}
                >
                    Back
                </Button>
            </Row>

            <Row className='container-details-header-top' align='start' justify='between' mt='05'>
                <Stack className='container-details-header-identity' gap='025'>
                    <Row gap='075' wrap>
                        <Heading level={1} className='container-details-header-name' size='xl' weight='bold'>
                            {container.name}
                        </Heading>
                        <span
                            className={`container-details-status-badge ${container.status} d-flex items-center gap-035 font-size-1 font-weight-5`}
                        >
                            <StatusDot tone={statusTone} pulse={isRunning} glow={isRunning} />
                            {container.status}
                        </span>
                    </Row>
                    <Row className='container-details-header-meta' wrap>
                        <span className='container-details-header-meta-image'>{container.image}</span>
                        <span className='container-details-header-meta-dot' aria-hidden='true'>·</span>
                        <span>Created {createdRelative}</span>
                    </Row>
                </Stack>

                <Row className='container-details-header-actions' gap='05'>
                    {contextualActions}
                    {canUpdate && isRunning && (
                        <>
                            <Button
                                variant='ghost'
                                intent='neutral'
                                size='sm'
                                leftIcon={<RefreshCw size={14} />}
                                onClick={() => onAction(ContainerAction.Restart)}
                                disabled={actionLoading}
                            >
                                Restart
                            </Button>
                            <Button
                                variant='ghost'
                                intent='danger'
                                size='sm'
                                leftIcon={<Square size={14} />}
                                onClick={() => onAction(ContainerAction.Stop)}
                                disabled={actionLoading}
                            >
                                Stop
                            </Button>
                        </>
                    )}
                    {canUpdate && !isRunning && (
                        <Button
                            variant='soft'
                            intent='success'
                            size='sm'
                            leftIcon={<Play size={14} />}
                            onClick={() => onAction(ContainerAction.Start)}
                            disabled={actionLoading}
                        >
                            Start
                        </Button>
                    )}
                    {primaryAccessiblePort && (
                        <Button
                            variant='soft'
                            intent='brand'
                            size='sm'
                            leftIcon={<ExternalLink size={14} />}
                            onClick={() => openPort(container._id, primaryAccessiblePort.private)}
                            isLoading={openingPort === primaryAccessiblePort.private}
                        >
                            Open :{primaryAccessiblePort.private}
                        </Button>
                    )}
                </Row>
            </Row>

            <Box className='container-details-header-tabs-row' display='flex'>
                <SegmentedTabs<ContainerDetailsTabId>
                    tabs={TABS}
                    activeTab={activeTab}
                    onChange={handleTabChange}
                    ariaLabel='Container sections'
                    size='sm'
                />
            </Box>
        </Stack>
    );
};

export default ContainerDetailsHeader;
