import { ErrorSurface, reportError } from '@/shared/errors/core';
import ClusterModalActionFooter from '@/modules/cluster/components/shared/ClusterModalActionFooter';
import { Heading, Modal, closeModal, Row, Stack, StatusBadge, Text, Select } from '@voltstack/bravais';
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
import type { UpdateTeamClusterRoleOutputDTO } from '@/modules/cluster/api/service';

interface ClusterRoleModalProps {
    teamCluster: TeamCluster | null;
    onSave: (role: TeamClusterRole) => Promise<UpdateTeamClusterRoleOutputDTO>;
    onClose: () => void;
}

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

    const footer = (
        <ClusterModalActionFooter
            confirmLabel='Save role'
            onCancel={handleClose}
            onConfirm={handleSave}
            isSubmitting={isSubmitting}
        />
    );

    return (
        <Modal id={CLUSTER_ROLE_MODAL_ID} title={`Runtime role for ${clusterName}`} description='Control whether this cluster behaves as a combined node, storage authority, or compute-only worker.' footer={footer} onClose={handleClose}>
            <Stack gap='1' p='1-5'>
                <Stack gap='05'>
                    <Heading level={3} size='md' weight='medium' tone='secondary'>Cluster scheduling role</Heading>
                    <Text as='p' size='md' tone='secondary'>{saveMessage}</Text>
                </Stack>
                {teamCluster && (
                    <Stack gap='075' p='1' radius='md' className='bg-page'>
                        <Row gap='05' wrap>
                            <Text as='p' size='sm' tone='muted'>Desired</Text>
                            <StatusBadge variant={getTeamClusterRoleBadgeVariant(teamCluster.roleConfig.desiredRole)} size='compact'>
                                {getTeamClusterRoleLabel(teamCluster.roleConfig.desiredRole)}
                            </StatusBadge>
                            <Text as='p' size='sm' tone='muted'>Effective</Text>
                            <StatusBadge variant={getTeamClusterRoleBadgeVariant(teamCluster.roleConfig.effectiveRole)} size='compact'>
                                {getTeamClusterRoleLabel(teamCluster.roleConfig.effectiveRole)}
                            </StatusBadge>
                        </Row>
                        {isTransitionPending && (
                            <Text as='p' size='sm' className='color-warning'>
                                {drainingSummary
                                    ? `${drainingSummary}. Effective role is still converging.`
                                    : 'The daemon is still converging to the desired role.'}
                            </Text>
                        )}
                    </Stack>
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
                <Stack gap='05' p='1' radius='md' className='bg-page'>
                    <Row gap='05' wrap>
                        <Text as='p' size='sm' tone='muted'>Selected role</Text>
                        <StatusBadge variant={getTeamClusterRoleBadgeVariant(selectedRole)} size='compact'>
                            {getTeamClusterRoleLabel(selectedRole)}
                        </StatusBadge>
                    </Row>
                    <Text as='p' size='md' tone='secondary'>
                        {getTeamClusterRoleDescription(selectedRole)}
                    </Text>
                    <Text as='p' size='sm' tone='muted'>
                        {getTeamClusterRoleSummary(selectedRole)}
                    </Text>
                </Stack>
                {error && (
                    <Text as='p' size='md' className='color-danger'>{error}</Text>
                )}
            </Stack>
        </Modal>
    );
};

export default ClusterRoleModal;
