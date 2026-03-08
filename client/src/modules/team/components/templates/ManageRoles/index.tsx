import React, { useCallback, useState } from 'react';
import { RiDeleteBin6Line, RiEditLine, RiEyeLine } from 'react-icons/ri';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import { formatDistanceToNow } from 'date-fns';
import Container from '@/shared/presentation/components/Container';
import DocumentListing, { type ColumnConfig, type SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import RoleEditorModal, { openRoleEditorModal } from '../../organisms/RoleEditorModal';
import type { RoleEditorPayload } from '../../organisms/RoleEditorModal';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { useCreateTeamRoleMutation, useDeleteTeamRoleMutation, useUpdateTeamRoleMutation } from '@/modules/team/hooks/team-role/queries';
import useTeamRolesListing from '@/modules/team/hooks/team-role/use-team-roles-listing';
import { rbacConfigQuery } from '@/modules/system/hooks/queries';
import usePermission from '@/shared/presentation/hooks/use-permission';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import ApiError from '@/shared/errors/ApiError';
import type { TeamRole } from '@/modules/team/api/entities/team-role';

const TEAM_ROLES_QUERY_KEY = ['team-roles'] as const;

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'team-role.created', queryKeys: [TEAM_ROLES_QUERY_KEY] },
    { event: 'team-role.deleted', queryKeys: [TEAM_ROLES_QUERY_KEY] },
    { event: 'team-role.updated', queryKeys: [TEAM_ROLES_QUERY_KEY] }
];

const COLUMNS: ColumnConfig[] = [
    {
        key: 'name',
        title: 'Role Name',
        render: (value: unknown) => (
            <Container className='d-flex items-center gap-1'>
                <IoShieldCheckmarkOutline size={18} className='color-secondary' />
                <span className='font-weight-5 color-primary'>{value as string}</span>
            </Container>
        )
    },
    {
        key: 'isSystem',
        title: 'Type',
        render: (isSystem: unknown) => (
            <StatusBadge variant={isSystem ? 'warning' : 'brand'}>
                {isSystem ? 'System' : 'Custom'}
            </StatusBadge>
        )
    },
    {
        key: 'permissions',
        title: 'Permissions',
        render: (permissions: unknown) => {
            const perms = permissions as string[];
            if(perms.includes('*')){
                return <StatusBadge variant='primary'>All Permissions</StatusBadge>;
            }
            const count = perms.length;
            return (
                <span className='color-secondary font-size-2'>
                    {count} permission{count !== 1 ? 's' : ''}
                </span>
            );
        }
    },
    {
        key: 'createdAt',
        title: 'Created',
        render: (value: unknown) => (
            <span className='color-secondary font-size-2'>
                {formatDistanceToNow(new Date(value as string), { addSuffix: true })}
            </span>
        )
    }
];

const ManageRolesTemplate: React.FC = () => {
    const [editingRole, setEditingRole] = useState<TeamRole | null>(null);

    const selectedTeam = useSelectedTeam()!;
    const canCreate = usePermission(['team-role:create']);
    const canUpdate = usePermission(['team-role:update']);
    const canDelete = usePermission(['team-role:delete']);
    const canRead = usePermission(['team-role:read']);

    const createRoleMutation = useCreateTeamRoleMutation();
    const updateRoleMutation = useUpdateTeamRoleMutation();
    const deleteRoleMutation = useDeleteTeamRoleMutation();
    const { queryKey, fetchData } = useTeamRolesListing(selectedTeam._id);
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
        setTimeout(() => openRoleEditorModal(), 0);
    }, []);

    const handleSaveRole = useCallback(async (data: RoleEditorPayload) => {
        try{
            if(editingRole){
                await showPromise(
                    updateRoleMutation.mutateAsync({ teamId: selectedTeam._id, roleId: editingRole._id, ...data }),
                    {
                        loading: { title: 'Updating role...' },
                        success: { title: 'Role updated successfully' },
                        error: { title: 'Failed to update role' }
                    }
                );
            }else{
                await showPromise(
                    createRoleMutation.mutateAsync({ teamId: selectedTeam._id, ...data }),
                    {
                        loading: { title: 'Creating role...' },
                        success: { title: 'Role created successfully' },
                        error: { title: 'Failed to create role' }
                    }
                );
            }
            setEditingRole(null);
        }catch(err){
            if(ApiError.isRBACError(err)){
                const msg = err instanceof ApiError ? err.getFriendlyMessage() : 'You do not have permission to manage roles';
                sileo.error({ title: msg });
            }
            throw err;
        }
    }, [selectedTeam._id, editingRole, createRoleMutation, updateRoleMutation]);

    const handleDeleteRoles = useCallback(async (rolesToDelete: TeamRole[]) => {
        const eligibleRoles = rolesToDelete.filter((role) => !role.isSystem);
        if (!eligibleRoles.length) return;

        const isConfirmed = await confirm(
            eligibleRoles.length === 1
                ? `Are you sure you want to delete "${eligibleRoles[0].name}"?`
                : `Are you sure you want to delete ${eligibleRoles.length} roles?`
        );
        if(!isConfirmed) return;

        for (const role of eligibleRoles) {
            try{
                await showPromise(
                    deleteRoleMutation.mutateAsync({ teamId: selectedTeam._id, roleId: role._id }),
                    {
                        loading: { title: `Deleting "${role.name}"...` },
                        success: { title: `Role "${role.name}" deleted` },
                        error: { title: `Failed to delete "${role.name}"` }
                    }
                );
            }catch{
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
        <Container className='manage-roles-page h-max'>
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
        </Container>
    );
};

export default ManageRolesTemplate;
