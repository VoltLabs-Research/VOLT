import { StatusBadge } from '@voltstack/bravais';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import useTeamRoleListingActions from '@/modules/team/hooks/role/use-team-role-listing-actions';
import { rbacConfigQuery } from '@/modules/system/hooks/queries';
import { RoleEditorModal, openRoleEditorModal } from '../RoleEditorModal';
import { dateColumn } from '@/shared/ui/utils/column-presets';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import useTip from '@/shared/tips/use-tip';
import { teamRolesResource } from '@/modules/team/hooks/role/queries';
import type { GetTeamRolesParams } from '@/modules/team/api/services/role-service';
import { useCallback, useMemo, useState } from 'react';
import type { TeamRole } from '@volt/contracts/modules/team/domain';
import type { SocketInvalidationConfig } from '@/shared/ui/components/DocumentListing';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import { SOCKET_TEAM_ROLE_EVENTS } from '@/modules/socket/events/team';

const TEAM_ROLES_QUERY_KEY = ['team-roles'] as const;

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    {
        event: SOCKET_TEAM_ROLE_EVENTS.CREATED,
        queryKeys: [TEAM_ROLES_QUERY_KEY]
    },
    {
        event: SOCKET_TEAM_ROLE_EVENTS.DELETED,
        queryKeys: [TEAM_ROLES_QUERY_KEY]
    },
    {
        event: SOCKET_TEAM_ROLE_EVENTS.UPDATED,
        queryKeys: [TEAM_ROLES_QUERY_KEY]
    }
];

const COLUMNS: ColumnConfig<TeamRole>[] = [
    {
        key: 'name',
        title: 'Role Name',
        render: (_value, role) => (
            <span className='font-medium text-muted'>{role.name}</span>
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
                <span className='text-sm text-muted'>
                    {count} permission{count !== 1 ? 's' : ''}
                </span>
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

    const { queryKey, fetchData } = useMemo(
        () => teamRolesResource.createListingAccessors<GetTeamRolesParams>(selectedTeam._id),
        [selectedTeam._id]
    );

    const rbacConfigResult = rbacConfigQuery(undefined);

    const handleOpenCreate = useCallback(() => {
        setEditingRole(null);
        openRoleEditorModal();
    }, []);

    const handleOpenEdit = useCallback((role: TeamRole) => {
        setEditingRole(role);
        setTimeout(openRoleEditorModal, 0);
    }, []);

    const {
        handleSaveRole,
        isSaving,
        getMenuOptions,
        getSelectionActionOptions
    } = useTeamRoleListingActions({
        teamId: selectedTeam._id,
        editingRole,
        onEditRole: handleOpenEdit,
        onSaved: () => setEditingRole(null)
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
        <div className='h-full manage-roles-page'>
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
                resources={rbacConfigResult.data?.resources ?? []}
                actions={rbacConfigResult.data?.actions ?? []}
                onSave={handleSaveRole}
                isSaving={isSaving}
            />
        </div>
    );
};
