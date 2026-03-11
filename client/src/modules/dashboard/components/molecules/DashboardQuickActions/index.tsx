import './DashboardQuickActions.css';
import DashboardCard from '@/modules/dashboard/components/atoms/DashboardCard';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import useTrajectoryFilePicker from '@/modules/trajectory/hooks/trajectory/use-trajectory-file-picker';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Puzzle, Upload, Users } from 'lucide-react';
import { GoArrowRight } from 'react-icons/go';
import type { ReactNode } from 'react';

export enum DashboardQuickActionVariant {
    Upload = 'upload',
    Team = 'team',
    Plugin = 'plugin',
    Container = 'container'
}

interface DashboardQuickAction {
    label: string;
    description: string;
    icon: ReactNode;
    variant: DashboardQuickActionVariant;
    path: string;
    requiredPermissions?: string[];
    disabledReason?: string;
};

const actions: DashboardQuickAction[] = [
    {
        label: 'Upload Trajectory',
        description: 'Import simulation data',
        icon: <Upload size={16} strokeWidth={1.8} />,
        variant: DashboardQuickActionVariant.Upload,
        path: '/dashboard/trajectories/list',
        requiredPermissions: ['trajectory:create'],
        disabledReason: 'You do not have permission to upload trajectories.'
    },
    {
        label: 'Team Management',
        description: 'View the team activity',
        icon: <Users size={16} strokeWidth={1.8} />,
        variant: DashboardQuickActionVariant.Team,
        path: '/dashboard/my-team',
        requiredPermissions: ['team:read'],
        disabledReason: 'You do not have permission to manage team members.'
    },
    {
        label: 'Browse Plugins',
        description: 'Extend your workflow',
        icon: <Puzzle size={16} strokeWidth={1.8} />,
        variant: DashboardQuickActionVariant.Plugin,
        path: '/dashboard/plugins/catalog',
        requiredPermissions: ['plugin:read'],
        disabledReason: 'You do not have permission to view plugins.'
    },
    {
        label: 'Containers',
        description: 'Manage compute resources',
        icon: <Box size={16} strokeWidth={1.8} />,
        variant: DashboardQuickActionVariant.Container,
        path: '/dashboard/containers',
        requiredPermissions: ['container:read'],
        disabledReason: 'You do not have permission to view containers.'
    }
];

export const DashboardQuickActions = () => {
    const navigate = useNavigate();
    const { fileInputRef, handlePickerChange, openFilePicker } = useTrajectoryFilePicker();
    const { canAccess: canAccessPermissions } = useTeamPermissions();

    const canAccess = useCallback((requiredPermissions: string[] = []) => {
        return canAccessPermissions(requiredPermissions);
    }, [canAccessPermissions]);

    const handleActionClick = useCallback((action: DashboardQuickAction) => {
        const requiredPermissions = action.requiredPermissions ?? [];
        if (!canAccess(requiredPermissions)) {
            return;
        }

        if (action.variant !== DashboardQuickActionVariant.Upload) {
            navigate(action.path);
            return;
        }

        openFilePicker();
    }, [navigate, canAccess, openFilePicker]);

    const renderAction = (action: DashboardQuickAction) => {
        const isAllowed = canAccess(action.requiredPermissions ?? []);
        let actionClassName = 'dashboard-action-item list-item-hoverable d-flex items-center gap-075';
        if (!isAllowed) {
            actionClassName = `${actionClassName} is-disabled`;
        }

        const content = (
            <Container
                key={action.label}
                className={actionClassName}
                onClick={() => handleActionClick(action)}
            >
                <Container className={`dashboard-action-icon ${action.variant}`}>
                    {action.icon}
                </Container>
                <Container className='d-flex column gap-01'>
                    <span className='font-size-2 color-primary font-weight-5'>{action.label}</span>
                    <span className='font-size-1 color-muted'>{action.description}</span>
                </Container>
                <Container className='dashboard-action-arrow'>
                    <GoArrowRight size={14} />
                </Container>
            </Container>
        );

        return (
            <Tooltip
                key={action.label}
                content={action.disabledReason ?? 'You do not have permission to use this action.'}
                placement='bottom'
                disabled={isAllowed}
            >
                {content}
            </Tooltip>
        );
    };

    return (
        <DashboardCard className='dashboard-actions-card d-flex column'>
            <Title className='font-size-3 color-primary font-weight-5' style={{ marginBottom: '0.75rem' }}>
                Quick Actions
            </Title>

            <Container className='d-flex column gap-025'>
                {actions.map(renderAction)}
            </Container>
            <input
                ref={fileInputRef}
                type='file'
                multiple
                hidden
                onChange={handlePickerChange}
            />
        </DashboardCard>
    );
};

export default DashboardQuickActions;
