import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoArrowRight } from 'react-icons/go';
import { Upload, Users, Puzzle, Box } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Tooltip from '@/shared/presentation/components/Tooltip';
import useTrajectoryUpload from '@/modules/trajectory/presentation/hooks/trajectory/use-trajectory-upload';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import { canAccessTeamPermissions } from '@/modules/team/presentation/utils/permission-evaluator';
import type { FileWithPath } from '@/shared/utils/file';
import './DashboardQuickActions.css';

const actions = [
    {
        label: 'Upload Trajectory',
        description: 'Import simulation data',
        icon: <Upload size={16} strokeWidth={1.8} />,
        variant: 'upload' as const,
        path: '/dashboard/trajectories/list',
        requiredPermissions: ['trajectory:create'],
        disabledReason: 'You do not have permission to upload trajectories.'
    },
    {
        label: 'Team Management',
        description: 'View the team activity',
        icon: <Users size={16} strokeWidth={1.8} />,
        variant: 'team' as const,
        path: '/dashboard/my-team',
        requiredPermissions: ['team:read'],
        disabledReason: 'You do not have permission to manage team members.'
    },
    {
        label: 'Browse Plugins',
        description: 'Extend your workflow',
        icon: <Puzzle size={16} strokeWidth={1.8} />,
        variant: 'plugin' as const,
        path: '/dashboard/plugins/catalog',
        requiredPermissions: ['plugin:read'],
        disabledReason: 'You do not have permission to view plugins.'
    },
    {
        label: 'Containers',
        description: 'Manage compute resources',
        icon: <Box size={16} strokeWidth={1.8} />,
        variant: 'container' as const,
        path: '/dashboard/containers',
        requiredPermissions: ['container:read'],
        disabledReason: 'You do not have permission to view containers.'
    }
];

const DashboardQuickActions = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadTrajectory } = useTrajectoryUpload();
    const selectedTeamId = useTeamStore((state) => state.selectedTeam?._id ?? null);
    const teamPermissions = useTeamStore((state) => state.permissions);
    const permissionsTeamId = useTeamStore((state) => state.permissionsTeamId);

    const canAccess = useCallback((requiredPermissions: string[] = []) => {
        return canAccessTeamPermissions({
            selectedTeamId,
            permissionsTeamId,
            permissions: teamPermissions,
            requiredPermissions
        });
    }, [selectedTeamId, permissionsTeamId, teamPermissions]);

    const resolveUploadName = useCallback((files: FileWithPath[]): string => {
        if (files.length === 0) return `upload_${Date.now()}`;
        const hasRelativePaths = files.some(({ path }) => path.includes('/'));

        if (hasRelativePaths) {
            const firstPathSegment = files[0].path.split('/').filter(Boolean)[0];
            return firstPathSegment || `upload_${Date.now()}`;
        }

        if (files.length === 1) {
            return files[0].file.name;
        }

        return `upload_${Date.now()}`;
    }, []);

    const handlePickerChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const input = event.target;
        const selectedFiles = input.files;

        if (!selectedFiles || selectedFiles.length === 0) {
            return;
        }

        const filesWithPath: FileWithPath[] = Array.from(selectedFiles).map((file) => ({
            file,
            path: file.webkitRelativePath || file.name
        }));

        const uploadName = resolveUploadName(filesWithPath);
        try {
            await uploadTrajectory(filesWithPath, uploadName);
        } finally {
            input.value = '';
        }
    }, [resolveUploadName, uploadTrajectory]);

    const handleActionClick = useCallback((action: (typeof actions)[number]) => {
        const requiredPermissions = action.requiredPermissions ?? [];
        if (!canAccess(requiredPermissions)) {
            return;
        }

        if (action.variant !== 'upload') {
            navigate(action.path);
            return;
        }

        fileInputRef.current?.click();
    }, [navigate, canAccess]);

    return (
        <Container className='dashboard-actions-card'>
            <Title className='font-size-3 color-primary font-weight-5' style={{ marginBottom: '0.75rem' }}>
                Quick Actions
            </Title>

            <Container className='d-flex column gap-025'>
                {actions.map((action) => {
                    const isAllowed = canAccess(action.requiredPermissions ?? []);
                    const content = (
                        <Container
                            key={action.label}
                            className={`dashboard-action-item list-item-hoverable d-flex items-center gap-075 ${!isAllowed ? 'is-disabled' : ''}`}
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
                })}
            </Container>
            <input
                ref={fileInputRef}
                type='file'
                multiple
                hidden
                onChange={handlePickerChange}
            />
        </Container>
    );
};

export { DashboardQuickActions };
export default DashboardQuickActions;
