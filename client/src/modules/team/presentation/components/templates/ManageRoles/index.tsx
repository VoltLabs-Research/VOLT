import React, { useCallback, useEffect, useState } from 'react';
import { RiDeleteBin6Line, RiEditLine, RiEyeLine } from 'react-icons/ri';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import { formatDistanceToNow } from 'date-fns';
import Container from '@/shared/presentation/components/Container';
import DocumentListing, { createListSyncConfig } from '@/shared/presentation/components/DocumentListing';
import type { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListing';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import RoleEditorModal, { openRoleEditorModal } from '../../organisms/RoleEditorModal';
import type { RoleEditorPayload } from '../../organisms/RoleEditorModal';
import { useSelectedTeam } from '@/modules/team/presentation/hooks/use-selected-team';
import { useTeamRoleStore } from '@/modules/team/presentation/stores/use-team-role-store';
import useTeamRoleUseCases from '@/modules/team/presentation/hooks/team-role/use-team-role-use-cases';
import useSystemUseCases from '@/modules/system/presentation/hooks/use-system-use-cases';
import usePermission from '@/shared/presentation/hooks/use-permission';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import ApiError from '@/shared/errors/ApiError';
import type { GetTeamRolesParams } from '@/modules/team/domain/ports/ITeamRoleRepository';
import type { TeamRole } from '@/modules/team/domain/entities/TeamRole';
import type { RBACResource, RBACAction } from '@/modules/system/domain/entities';

const LIST_SYNC = createListSyncConfig('team-role', ['created', 'deleted', 'updated']);

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
    const [isSaving, setIsSaving] = useState(false);
    const [resources, setResources] = useState<RBACResource[]>([]);
    const [actions, setActions] = useState<RBACAction[]>([]);

    const selectedTeam = useSelectedTeam()!;
    const canCreate = usePermission(['team-role:create']);
    const canUpdate = usePermission(['team-role:update']);
    const canDelete = usePermission(['team-role:delete']);
    const canRead = usePermission(['team-role:read']);
    const addRole = useTeamRoleStore((state) => state.addRole);
    const updateRole = useTeamRoleStore((state) => state.updateRole);
    const removeRole = useTeamRoleStore((state) => state.removeRole);

    const { teamRoleRepository } = useTeamRoleUseCases();
    const { systemRepository } = useSystemUseCases();

    useEffect(() => {
        let cancelled = false;
        systemRepository.getRBACConfig().then((config) => {
            if(cancelled) return;
            setResources(config.resources);
            setActions(config.actions);
        }).catch((error) => {
            if(ApiError.isRBACError(error)) return;
            sileo.error({ title: 'Failed to load permissions config' });
        });
        return () => { cancelled = true; };
    }, [systemRepository]);

    const fetchData = useCallback(async (params: GetTeamRolesParams) => {
        return await teamRoleRepository.getAll(selectedTeam._id, params);
    }, [selectedTeam._id, teamRoleRepository]);

    const handleOpenCreate = useCallback(() => {
        setEditingRole(null);
        openRoleEditorModal();
    }, []);

    const handleOpenEdit = useCallback((role: TeamRole) => {
        setEditingRole(role);
        setTimeout(() => openRoleEditorModal(), 0);
    }, []);

    const handleSaveRole = useCallback(async (data: RoleEditorPayload) => {
        setIsSaving(true);
        try{
            if(editingRole){
                const updated = await showPromise(
                    teamRoleRepository.update(selectedTeam._id, editingRole._id, data),
                    {
                        loading: { title: 'Updating role...' },
                        success: { title: 'Role updated successfully' },
                        error: { title: 'Failed to update role' }
                    }
                );
                updateRole(editingRole._id, updated);
            }else{
                const created = await showPromise(
                    teamRoleRepository.create(selectedTeam._id, data),
                    {
                        loading: { title: 'Creating role...' },
                        success: { title: 'Role created successfully' },
                        error: { title: 'Failed to create role' }
                    }
                );
                addRole(created);
            }
            setEditingRole(null);
        }catch(err){
            if(ApiError.isRBACError(err)){
                const msg = err instanceof ApiError ? err.getFriendlyMessage() : 'You do not have permission to manage roles';
                sileo.error({ title: msg });
            }
            throw err;
        }finally{
            setIsSaving(false);
        }
    }, [selectedTeam._id, editingRole, teamRoleRepository, addRole, updateRole]);

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
                    teamRoleRepository.delete(selectedTeam._id, role._id),
                    {
                        loading: { title: `Deleting "${role.name}"...` },
                        success: { title: `Role "${role.name}" deleted` },
                        error: { title: `Failed to delete "${role.name}"` }
                    }
                );
                removeRole(role._id);
            }catch{
            }
        }
    }, [selectedTeam._id, teamRoleRepository, removeRole]);

    const getMenuOptions = useCallback((role: TeamRole, selectedRoles: TeamRole[]): MenuOption[] => {
        const targetRoles = selectedRoles.includes(role) ? selectedRoles : [role];
        const isMultipleSelection = targetRoles.length > 1;
        const hasDeletableRoleInSelection = targetRoles.some((entry) => !entry.isSystem);

        if (isMultipleSelection) {
            if (!hasDeletableRoleInSelection || !canDelete) {
                return [];
            }

            return [{
                label: 'Delete',
                icon: RiDeleteBin6Line,
                onClick: () => handleDeleteRoles(targetRoles),
                destructive: true
            }];
        }

        if(role.isSystem){
            if(!canRead) return [];
            return [{
                label: 'View',
                icon: RiEyeLine,
                onClick: () => handleOpenEdit(role)
            }];
        }

        const options: MenuOption[] = [];

        if(canUpdate){
            options.push({
                label: 'Edit',
                icon: RiEditLine,
                onClick: () => handleOpenEdit(role)
            });
        }

        if(canDelete){
            options.push({
                label: 'Delete',
                icon: RiDeleteBin6Line,
                onClick: () => handleDeleteRoles(targetRoles),
                destructive: true
            });
        }

        return options;
    }, [canRead, canUpdate, canDelete, handleOpenEdit, handleDeleteRoles]);

    return (
        <Container className='manage-roles-page h-max'>
            <DocumentListing<TeamRole>
                title='Manage Roles'
                columns={COLUMNS}
                fetchData={fetchData}
                getMenuOptions={getMenuOptions}
                emptyMessage='No roles found. Create your first custom role.'
                createNew={canCreate ? {
                    buttonTitle: 'New Role',
                    onCreate: handleOpenCreate
                } : undefined}
                listSyncConfig={LIST_SYNC}
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
