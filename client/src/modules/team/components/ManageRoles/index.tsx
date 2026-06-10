import { Box, StatusBadge, Text } from '@voltstack/bravais';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useCreateTeamRoleMutation, useDeleteTeamRoleMutation, useUpdateTeamRoleMutation } from '@/modules/team/hooks/role/queries';
import { rbacConfigQuery } from '@/modules/system/hooks/queries';
import { RoleEditorModal, openRoleEditorModal } from '../RoleEditorModal';
import { runAction } from '@/shared/presentation/actions/run-action';
import { confirm, ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';
import { createPromiseToastOptions } from '@/shared/presentation/utilities/toast-options';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import useTip from '@/shared/tips/use-tip';
import { teamRolesResource } from '@/modules/team/hooks/role/queries';
import type { GetTeamRolesParams } from '@/modules/team/api/services/role-service';
import { RiDeleteBin6Line, RiEditLine, RiEyeLine } from 'react-icons/ri';
import { useCallback, useMemo, useState } from 'react';
import type { TeamRole } from '@/modules/team/api/entities/role/team-role';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';
import { SOCKET_TEAM_ROLE_EVENTS } from '@/modules/socket/events/team';
import type { RoleEditorPayload } from '../RoleEditorModal';

const TEAM_ROLES_QUERY_KEY = ['team-roles'] as const;

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: SOCKET_TEAM_ROLE_EVENTS.CREATED, queryKeys: [TEAM_ROLES_QUERY_KEY] },
    { event: SOCKET_TEAM_ROLE_EVENTS.DELETED, queryKeys: [TEAM_ROLES_QUERY_KEY] },
    { event: SOCKET_TEAM_ROLE_EVENTS.UPDATED, queryKeys: [TEAM_ROLES_QUERY_KEY] }
];

const createRoleToastOptions = createPromiseToastOptions({
    loading: 'Creating role...',
    success: 'Role created successfully',
    error: 'Failed to create role'
});

const updateRoleToastOptions = createPromiseToastOptions({
    loading: 'Updating role...',
    success: 'Role updated successfully',
    error: 'Failed to update role'
});

const getDeleteRoleToastOptions = (roleName: string) => createPromiseToastOptions({
    loading: `Deleting "${roleName}"...`,
    success: `Role "${roleName}" deleted`,
    error: `Failed to delete "${roleName}"`
});

const COLUMNS: ColumnConfig<TeamRole>[] = [
    {
        key: 'name',
        title: 'Role Name',
        render: (_value, role) => (
            <Text weight='medium' tone='secondary'>{role.name}</Text>
        )
    },
    {
        key: 'isSystem',
        title: 'Type',
        render: (_value, role) => (
            <StatusBadge variant={role.isSystem ? 'warning' : 'brand'}>
                {role.isSystem ? 'System' : 'Custom'}
            </StatusBadge>
        )
    },
    {
        key: 'permissions',
        title: 'Permissions',
        render: (_value, role) => {
            if(role.permissions.includes('*')){
                return <StatusBadge variant='primary'>All Permissions</StatusBadge>;
            }
            const count = role.permissions.length;
            return (
                <Text tone='secondary' size='md'>
                    {count} permission{count !== 1 ? 's' : ''}
                </Text>
            );
        }
    },
    dateColumn<TeamRole>('createdAt', 'Created', { sortable: false })
];

export default function ManageRolesTemplate() {
    useTip('team-roles-permissions');

    const [editingRole, setEditingRole] = useState<TeamRole | null>(null);
    const { canAccess } = useTeamPermissions();

    const selectedTeam = useSelectedTeam()!;
    const canCreate = canAccess(['team-role:create']);
    const canUpdate = canAccess(['team-role:update']);
    const canDelete = canAccess(['team-role:delete']);
    const canRead = canAccess(['team-role:read']);

    const createRoleMutation = useCreateTeamRoleMutation();
    const updateRoleMutation = useUpdateTeamRoleMutation();
    const deleteRoleMutation = useDeleteTeamRoleMutation();
    const { queryKey, fetchData } = useMemo(
        () => teamRolesResource.createListingAccessors<GetTeamRolesParams>(selectedTeam._id),
        [selectedTeam._id]
    );
    const isSaving = createRoleMutation.isPending || updateRoleMutation.isPending;

    const rbacConfigResult = rbacConfigQuery(undefined);
    const resources = rbacConfigResult.data?.resources ?? [];
    const actions = rbacConfigResult.data?.actions ?? [];

    const handleOpenCreate = useCallback(() => {
        setEditingRole(null);
        openRoleEditorModal();
    }, []);

    const handleOpenEdit = useCallback((role: TeamRole) => {
        setEditingRole(role);
        setTimeout(openRoleEditorModal, 0);
    }, []);

    const handleSaveRole = useCallback(async (data: RoleEditorPayload) => {
        try {
            await runAction({
                action: () => editingRole
                    ? updateRoleMutation.mutateAsync({ teamId: selectedTeam._id, roleId: editingRole._id, ...data })
                    : createRoleMutation.mutateAsync({ teamId: selectedTeam._id, ...data }),
                toast: editingRole ? updateRoleToastOptions : createRoleToastOptions,
                afterSuccess: () => {
                    setEditingRole(null);
                }
            });
        } catch {
        }
    }, [selectedTeam._id, editingRole, createRoleMutation, updateRoleMutation]);

    const handleDeleteRoles = useCallback(async (rolesToDelete: TeamRole[]) => {
        const eligibleRoles = rolesToDelete.filter((role) => !role.isSystem);
        if (!eligibleRoles.length) return;

        let confirmationTitle = `Delete ${eligibleRoles.length} roles?`;
        if (eligibleRoles.length === 1) {
            confirmationTitle = `Delete "${eligibleRoles[0].name}"?`;
        }

        const isConfirmed = await confirm({
            title: confirmationTitle,
            description: 'Deleting a role permanently removes its configuration and cannot be undone.',
            confirmText: 'Delete role',
            cancelText: 'Cancel',
            tone: ConfirmActionTone.Danger
        });
        if (!isConfirmed) return;

        for (const role of eligibleRoles) {
            try {
                await runAction({
                    action: () => deleteRoleMutation.mutateAsync({ teamId: selectedTeam._id, roleId: role._id }),
                    toast: getDeleteRoleToastOptions(role.name)
                });
            } catch {
            }
        }
    }, [selectedTeam._id, deleteRoleMutation]);

    const { getMenuOptions, getSelectionActionOptions } = useListingActions<TeamRole>({
        actions: {
            view: {
                label: 'View',
                icon: RiEyeLine,
                handler: ({ item: role }) => handleOpenEdit(role),
                requiredPermission: 'team-role:read'
            },
            edit: {
                label: 'Edit',
                icon: RiEditLine,
                handler: ({ item: role }) => handleOpenEdit(role),
                requiredPermission: 'team-role:update'
            },
            delete: {
                label: 'Delete',
                icon: RiDeleteBin6Line,
                variant: 'danger',
                handler: ({ item, selectedItems }) => {
                    const targets = selectedItems.length > 1 ? selectedItems : [item];
                    return handleDeleteRoles(targets);
                },
                requiredPermission: 'team-role:delete'
            }
        }
    });

    const getRoleMenuOptions = useCallback((role: TeamRole, selectedRoles: TeamRole[]) => {
        const targetRoles = selectedRoles.includes(role) ? selectedRoles : [role];

        if (targetRoles.length > 1) {
            const hasDeletableRoleInSelection = targetRoles.some((entry) => !entry.isSystem);
            if (!hasDeletableRoleInSelection || !canDelete) {
                return [];
            }

            return getSelectionActionOptions(role, targetRoles)
                .filter((option) => option.label === 'Delete');
        }

        if (role.isSystem) {
            if (!canRead) return [];
            return getMenuOptions(role, [role]).filter((option) => option.label === 'View');
        }

        return getMenuOptions(role, [role]).filter((option) => {
            if (option.label === 'Edit') return canUpdate;
            if (option.label === 'Delete') return canDelete;
            return false;
        });
    }, [canDelete, canRead, canUpdate, getMenuOptions, getSelectionActionOptions]);

    return (
        <Box height='max' className='manage-roles-page'>
            <DocumentListing<TeamRole>
                title='Manage Roles'
                queryKey={queryKey}
                columns={COLUMNS}
                fetchData={fetchData}
                getMenuOptions={getRoleMenuOptions}
                emptyMessage='No roles found. Create your first custom role.'
                createNew={canCreate ? {
                    buttonTitle: 'New Role',
                    onCreate: handleOpenCreate
                } : undefined}
                socketInvalidation={SOCKET_INVALIDATION}
            />

            <RoleEditorModal
                role={editingRole}
                resources={resources}
                actions={actions}
                onSave={handleSaveRole}
                isSaving={isSaving}
            />
        </Box>
    );
};
