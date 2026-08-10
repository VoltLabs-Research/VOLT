import { ErrorSurface, reportError } from '@/shared/errors/core';
import ClusterModalActionFooter from '@/modules/cluster/components/shared/ClusterModalActionFooter';
import { Modal, closeModal, StatusBadge, Select } from '@voltstack/bravais';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import {
    describeTeamClusterDraining,
    getTeamClusterRoleBadgeVariant,
    getTeamClusterRoleDescription,
    getTeamClusterRoleLabel,
    getTeamClusterRoleSummary,
    isTeamClusterRoleTransitionPending,
    TEAM_CLUSTER_ROLE_OPTIONS
} from '@/modules/cluster/utils/team-cluster-role';
import { useEffect, useState } from 'react';
import type { TeamCluster, TeamClusterRole } from '@volt/contracts/modules/cluster/domain';
import type { UpdateTeamClusterRoleResponse } from '@volt/contracts/modules/cluster/domain';

interface ClusterRoleModalProps {
    teamCluster: TeamCluster | null;
    onSave: (role: TeamClusterRole) => Promise<UpdateTeamClusterRoleResponse>;
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

    const saveMessage = !teamCluster
        ? 'The desired role is saved in Volt and applied when the daemon next connects.'
        : isLiveCluster
            ? 'Volt saves the desired role and asks the daemon to converge live with controlled drain when needed.'
            : 'Volt saves the desired role now and applies it the next time the daemon connects.';

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
            <div className='flex flex-col gap-4 p-6'>
                <div className='flex flex-col gap-2'>
                    <h3 className='text-sm font-medium text-muted'>Cluster scheduling role</h3>
                    <p className='text-sm text-muted'>{saveMessage}</p>
                </div>
                {teamCluster && (
                    <div className='flex flex-col gap-3 p-4 rounded-xl bg-background'>
                        <div className='flex flex-row items-center flex-wrap gap-2'>
                            <p className='text-xs text-muted'>Desired</p>
                            <StatusBadge variant={getTeamClusterRoleBadgeVariant(teamCluster.roleConfig.desiredRole)} size='compact'>
                                {getTeamClusterRoleLabel(teamCluster.roleConfig.desiredRole)}
                            </StatusBadge>
                            <p className='text-xs text-muted'>Effective</p>
                            <StatusBadge variant={getTeamClusterRoleBadgeVariant(teamCluster.roleConfig.effectiveRole)} size='compact'>
                                {getTeamClusterRoleLabel(teamCluster.roleConfig.effectiveRole)}
                            </StatusBadge>
                        </div>
                        {isTransitionPending && (
                            <p className='text-xs text-warning'>
                                {drainingSummary
                                    ? `${drainingSummary}. Effective role is still converging.`
                                    : 'The daemon is still converging to the desired role.'}
                            </p>
                        )}
                    </div>
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
                <div className='flex flex-col gap-2 p-4 rounded-xl bg-background'>
                    <div className='flex flex-row items-center flex-wrap gap-2'>
                        <p className='text-xs text-muted'>Selected role</p>
                        <StatusBadge variant={getTeamClusterRoleBadgeVariant(selectedRole)} size='compact'>
                            {getTeamClusterRoleLabel(selectedRole)}
                        </StatusBadge>
                    </div>
                    <p className='text-sm text-muted'>
                        {getTeamClusterRoleDescription(selectedRole)}
                    </p>
                    <p className='text-xs text-muted'>
                        {getTeamClusterRoleSummary(selectedRole)}
                    </p>
                </div>
                {error && (
                    <p className='text-sm text-danger'>{error}</p>
                )}
            </div>
        </Modal>
    );
};

export default ClusterRoleModal;
