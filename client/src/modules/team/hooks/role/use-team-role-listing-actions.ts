import { useCreateTeamRoleMutation, useDeleteTeamRoleMutation, useUpdateTeamRoleMutation } from '@/modules/team/hooks/role/queries';
import { runAction } from '@/shared/ui/actions/run-action';
import { confirm, ConfirmActionTone } from '@/shared/ui/hooks/use-confirm';
import useListingActions from '@/shared/ui/hooks/use-listing-actions';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import type { TeamRole } from '@volt/contracts/modules/team/domain';
import type { RoleEditorPayload } from '@/modules/team/components/RoleEditorModal';

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

interface UseTeamRoleListingActionsOptions {
    teamId: string;
    editingRole: TeamRole | null;
    onEditRole: (role: TeamRole) => void;
    onSaved: () => void;
}

export default function useTeamRoleListingActions({
    teamId,
    editingRole,
    onEditRole,
    onSaved
}: UseTeamRoleListingActionsOptions) {
    const createRoleMutation = useCreateTeamRoleMutation();
    const updateRoleMutation = useUpdateTeamRoleMutation();
    const deleteRoleMutation = useDeleteTeamRoleMutation();

    const handleSaveRole = useCallback(async (data: RoleEditorPayload) => {
        await runAction({
            action: () => editingRole
                ? updateRoleMutation.mutateAsync({
                    teamId,
                    roleId: editingRole._id,
                    ...data
                })
                : createRoleMutation.mutateAsync({
                    teamId,
                    ...data
                }),
            toast: editingRole ? updateRoleToastOptions : createRoleToastOptions,
            afterSuccess: onSaved
        });
    }, [teamId, editingRole, createRoleMutation, updateRoleMutation, onSaved]);

    const handleDeleteRoles = useCallback(async (rolesToDelete: TeamRole[]) => {
        const eligibleRoles = rolesToDelete.filter((role) => !role.isSystem);
        if (!eligibleRoles.length) return;

        const isConfirmed = await confirm({
            title: eligibleRoles.length === 1
                ? `Delete "${eligibleRoles[0].name}"?`
                : `Delete ${eligibleRoles.length} roles?`,
            description: 'Deleting a role permanently removes its configuration and cannot be undone.',
            confirmText: 'Delete role',
            cancelText: 'Cancel',
            tone: ConfirmActionTone.Danger
        });
        if (!isConfirmed) return;

        for (const role of eligibleRoles) {
            await runAction({
                action: () => deleteRoleMutation.mutateAsync({
                    teamId,
                    roleId: role._id
                }),
                toast: getDeleteRoleToastOptions(role.name)
            });
        }
    }, [teamId, deleteRoleMutation]);

    const { getMenuOptions, getSelectionActionOptions } = useListingActions<TeamRole>({
        actions: {
            view: {
                label: 'View',
                icon: Eye,
                handler: ({ item: role }) => onEditRole(role),
                requiredPermission: 'team-role:read'
            },
            edit: {
                label: 'Edit',
                icon: Pencil,
                handler: ({ item: role }) => onEditRole(role),
                requiredPermission: 'team-role:update'
            },
            delete: {
                label: 'Delete',
                icon: Trash2,
                variant: 'danger',
                handler: ({ item, selectedItems }) => {
                    const targets = selectedItems.length > 1 ? selectedItems : [item];
                    return handleDeleteRoles(targets);
                },
                requiredPermission: 'team-role:delete'
            }
        }
    });

    return {
        handleSaveRole,
        isSaving: createRoleMutation.isPending || updateRoleMutation.isPending,
        getMenuOptions,
        getSelectionActionOptions
    };
}
