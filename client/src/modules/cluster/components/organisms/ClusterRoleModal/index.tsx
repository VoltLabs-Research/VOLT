import { ErrorSurface, reportError } from '@/shared/errors/core';
import Container from '@/shared/presentation/components/Container';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Select from '@/shared/presentation/components/Select';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import Title from '@/shared/presentation/components/Title';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import {
    describeTeamClusterDraining,
    getTeamClusterRoleBadgeVariant,
    getTeamClusterRoleDescription,
    getTeamClusterRoleLabel,
    getTeamClusterRoleSummary,
    isTeamClusterRoleTransitionPending,
    TEAM_CLUSTER_ROLE_OPTIONS
} from '@/modules/cluster/utilities/team-cluster-role';
import { useEffect, useMemo, useState } from 'react';
import type { TeamCluster, TeamClusterRole } from '@/modules/cluster/api/entities/team-cluster';
import type { UpdateTeamClusterRoleOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/update-team-cluster-role';

interface ClusterRoleModalProps {
    teamCluster: TeamCluster | null;
    onSave: (role: TeamClusterRole) => Promise<UpdateTeamClusterRoleOutputDTO>;
    onClose: () => void;
};

export const CLUSTER_ROLE_MODAL_ID = 'cluster-role-modal';

const ClusterRoleModal = ({ teamCluster, onSave, onClose }: ClusterRoleModalProps) => {
    const [selectedRole, setSelectedRole] = useState<TeamClusterRole>('cluster');
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setSelectedRole(teamCluster?.roleConfig.desiredRole ?? 'cluster');
        setError(undefined);
    }, [teamCluster]);

    const clusterName = teamCluster?.name ?? 'cluster';
    const isLiveCluster = teamCluster?.status === TeamClusterStatus.Connected;
    const isTransitionPending = teamCluster ? isTeamClusterRoleTransitionPending(teamCluster) : false;
    const drainingSummary = teamCluster ? describeTeamClusterDraining(teamCluster) : null;

    const saveMessage = useMemo(() => {
        if (!teamCluster) {
            return 'The desired role is saved in Volt and applied when the daemon next connects.';
        }

        if (isLiveCluster) {
            return 'Volt saves the desired role and asks the daemon to converge live with controlled drain when needed.';
        }

        return 'Volt saves the desired role now and applies it the next time the daemon connects.';
    }, [isLiveCluster, teamCluster]);

    const handleClose = () => {
        setSelectedRole(teamCluster?.roleConfig.desiredRole ?? 'cluster');
        setError(undefined);
        closeModal(CLUSTER_ROLE_MODAL_ID);
        onClose();
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        setError(undefined);

        try {
            await onSave(selectedRole);
            handleClose();
        } catch (err: unknown) {
            setError(reportError(err, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to save cluster role'
            }).title);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            id={CLUSTER_ROLE_MODAL_ID}
            title={`Runtime role for ${clusterName}`}
            description='Control whether this cluster behaves as a combined node, storage authority, or compute-only worker.'
            footer={(
                <ModalFooterActions
                    secondary={{
                        label: 'Cancel',
                        onClick: handleClose,
                        disabled: isSubmitting
                    }}
                    primary={{
                        label: 'Save role',
                        onClick: handleSave,
                        isLoading: isSubmitting
                    }}
                />
            )}
            onClose={handleClose}
        >
            <Container className='d-flex column gap-1 p-1-5'>
                <Container className='d-flex column gap-05'>
                    <Title className='font-size-2 font-weight-5 color-secondary'>Cluster scheduling role</Title>
                    <Paragraph className='font-size-2 color-secondary'>{saveMessage}</Paragraph>
                </Container>
                {teamCluster && (
                    <Container className='d-flex column gap-075 p-1 radius-md bg-page'>
                        <Container className='d-flex items-center gap-05 flex-wrap'>
                            <Paragraph className='font-size-1 color-muted'>Desired</Paragraph>
                            <StatusBadge variant={getTeamClusterRoleBadgeVariant(teamCluster.roleConfig.desiredRole)} size='compact'>
                                {getTeamClusterRoleLabel(teamCluster.roleConfig.desiredRole)}
                            </StatusBadge>
                            <Paragraph className='font-size-1 color-muted'>Effective</Paragraph>
                            <StatusBadge variant={getTeamClusterRoleBadgeVariant(teamCluster.roleConfig.effectiveRole)} size='compact'>
                                {getTeamClusterRoleLabel(teamCluster.roleConfig.effectiveRole)}
                            </StatusBadge>
                        </Container>
                        {isTransitionPending && (
                            <Paragraph className='font-size-1 color-warning'>
                                {drainingSummary
                                    ? `${drainingSummary}. Effective role is still converging.`
                                    : 'The daemon is still converging to the desired role.'}
                            </Paragraph>
                        )}
                    </Container>
                )}
                <Select
                    options={TEAM_CLUSTER_ROLE_OPTIONS}
                    value={selectedRole}
                    onChange={(value) => {
                        setSelectedRole(value as TeamClusterRole);
                        if (error) {
                            setError(undefined);
                        }
                    }}
                    placeholder='Select a role...'
                    disabled={isSubmitting}
                />
                <Container className='d-flex column gap-05 p-1 radius-md bg-page'>
                    <Container className='d-flex items-center gap-05 flex-wrap'>
                        <Paragraph className='font-size-1 color-muted'>Selected role</Paragraph>
                        <StatusBadge variant={getTeamClusterRoleBadgeVariant(selectedRole)} size='compact'>
                            {getTeamClusterRoleLabel(selectedRole)}
                        </StatusBadge>
                    </Container>
                    <Paragraph className='font-size-2 color-secondary'>
                        {getTeamClusterRoleDescription(selectedRole)}
                    </Paragraph>
                    <Paragraph className='font-size-1 color-muted'>
                        {getTeamClusterRoleSummary(selectedRole)}
                    </Paragraph>
                </Container>
                {error && (
                    <Paragraph className='font-size-2 color-danger'>{error}</Paragraph>
                )}
            </Container>
        </Modal>
    );
};

export default ClusterRoleModal;
