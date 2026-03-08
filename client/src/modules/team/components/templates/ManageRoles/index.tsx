import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { useCreateTeamRoleMutation, useDeleteTeamRoleMutation, useUpdateTeamRoleMutation } from '@/modules/team/hooks/role/queries';
import { rbacConfigQuery } from '@/modules/system/hooks/queries';
import { RoleEditorModal, openRoleEditorModal } from '../../organisms/RoleEditorModal';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import { showPromise } from '@/shared/presentation/hooks/toast';
import ApiError from '@/shared/errors/ApiError';
import Container from '@/shared/presentation/components/Container';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import usePermission from '@/shared/presentation/hooks/use-permission';
import useTeamRolesListing from '@/modules/team/hooks/role/use-team-roles-listing';
import { formatDistanceToNow } from 'date-fns';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import { RiDeleteBin6Line, RiEditLine, RiEyeLine } from 'react-icons/ri';
import { sileo } from 'sileo';
import { useCallback, useState } from 'react';
import type { TeamRole } from '@/modules/team/api/entities/role/team-role';
import type { ColumnConfig, SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { RoleEditorPayload } from '../../organisms/RoleEditorModal';

const TEAM_ROLES_QUERY_KEY = ['team-roles'] as const;

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'team-role.created', queryKeys: [TEAM_ROLES_QUERY_KEY] },
    { event: 'team-role.deleted', queryKeys: [TEAM_ROLES_QUERY_KEY] },
    { event: 'team-role.updated', queryKeys: [TEAM_ROLES_QUERY_KEY] }
];

interface PromiseToastOptions {
    loading: { title: string };
    success: { title: string };
    error: { title: string };
};

const createRoleToastOptions: PromiseToastOptions = {
    loading: { title: 'Creating role...' },
    success: { title: 'Role created successfully' },
    error: { title: 'Failed to create role' }
};

const updateRoleToastOptions: PromiseToastOptions = {
    loading: { title: 'Updating role...' },
    success: { title: 'Role updated successfully' },
    error: { title: 'Failed to update role' }
};

const getDeleteRoleToastOptions = (roleName: string): PromiseToastOptions => ({
    loading: { title: `Deleting "${roleName}"...` },
    success: { title: `Role "${roleName}" deleted` },
    error: { title: `Failed to delete "${roleName}"` }
});

const COLUMNS: ColumnConfig<TeamRole>[] = [
    {
        key: 'name',
        title: 'Role Name',
        render: (_value, role) => (
            <Container className='d-flex items-center gap-1'>
                <IoShieldCheckmarkOutline size={18} className='color-secondary' />
                <span className='font-weight-5 color-primary'>{role.name}</span>
            </Container>
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
                <span className='color-secondary font-size-2'>
                    {count} permission{count !== 1 ? 's' : ''}
                </span>
            );
        }
    },
    {
        key: 'createdAt',
        title: 'Created',
        render: (_value, role) => (
            <span className='color-secondary font-size-2'>
                {formatDistanceToNow(new Date(role.createdAt), { addSuffix: true })}
            </span>
        )
    }
];

export default function ManageRolesTemplate() {
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
        setTimeout(openRoleEditorModal, 0);
    }, []);

    const handleSaveRole = useCallback(async (data: RoleEditorPayload) => {
        try{
            if(editingRole){
                await showPromise(
                    updateRoleMutation.mutateAsync({ teamId: selectedTeam._id, roleId: editingRole._id, ...data }),
                    updateRoleToastOptions
                );
            }else{
                await showPromise(
                    createRoleMutation.mutateAsync({ teamId: selectedTeam._id, ...data }),
                    createRoleToastOptions
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

        let confirmationMessage = `Are you sure you want to delete ${eligibleRoles.length} roles?`;
        if (eligibleRoles.length === 1) {
            confirmationMessage = `Are you sure you want to delete "${eligibleRoles[0].name}"?`;
        }

        const isConfirmed = await confirm(
            confirmationMessage
        );
        if(!isConfirmed) return;

        for (const role of eligibleRoles) {
            try{
                await showPromise(
                    deleteRoleMutation.mutateAsync({ teamId: selectedTeam._id, roleId: role._id }),
                    getDeleteRoleToastOptions(role.name)
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
