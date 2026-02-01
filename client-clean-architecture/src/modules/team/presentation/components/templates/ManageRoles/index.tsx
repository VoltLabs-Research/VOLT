import React, { useCallback, useState } from 'react';
import { RiDeleteBin6Line, RiEditLine, RiEyeLine } from 'react-icons/ri';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import { formatDistanceToNow } from 'date-fns';
import Container from '@/shared/presentation/components/Container';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import type { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListing';
import RoleEditorModal, { openRoleEditorModal } from '../../organisms/RoleEditorModal';
import type { RoleEditorPayload, RBACResource, RBACAction } from '../../organisms/RoleEditorModal';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import { useTeamRoleStore } from '@/modules/team/presentation/stores/use-team-role-store';
import useTeamRoleUseCases from '@/modules/team/presentation/hooks/team-role/use-team-role-use-cases';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import type { TeamRole } from '@/modules/team/domain/entities/TeamRole';
import './ManageRoles.css';

const DEFAULT_RESOURCES: RBACResource[] = [
    { key: 'trajectory', label: 'Trajectories' },
    { key: 'analysis', label: 'Analyses' },
    { key: 'team', label: 'Team' },
    { key: 'team-member', label: 'Members' },
    { key: 'team-role', label: 'Roles' }
];

const DEFAULT_ACTIONS: RBACAction[] = [
    { key: 'create', label: 'Create' },
    { key: 'read', label: 'Read' },
    { key: 'update', label: 'Update' },
    { key: 'delete', label: 'Delete' }
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
            <span className={`badge ${isSystem ? 'badge-warning' : 'badge-brand'}`}>
                {isSystem ? 'System' : 'Custom'}
            </span>
        )
    },
    {
        key: 'permissions',
        title: 'Permissions',
        render: (permissions: unknown) => {
            const perms = permissions as string[];
            if(perms.includes('*')){
                return <span className='badge badge-primary'>All Permissions</span>;
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

    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const addRole = useTeamRoleStore((state) => state.addRole);
    const updateRoleInList = useTeamRoleStore((state) => state.updateRoleInList);
    const removeRole = useTeamRoleStore((state) => state.removeRole);

    const { teamRoleRepository } = useTeamRoleUseCases();

    const fetchData = useCallback(async (params: { page: number; limit: number }) => {
        if(!selectedTeam?._id){
            return {
                status: 'success' as const,
                data: [],
                pagination: { page: 1, limit: params.limit, total: 0, totalPages: 0, hasMore: false }
            };
        }
        return await teamRoleRepository.getAll(selectedTeam._id, params);
    }, [selectedTeam?._id, teamRoleRepository]);

    const handleOpenCreate = useCallback(() => {
        setEditingRole(null);
        openRoleEditorModal();
    }, []);

    const handleOpenEdit = useCallback((role: TeamRole) => {
        setEditingRole(role);
        setTimeout(() => openRoleEditorModal(), 0);
    }, []);

    const handleSaveRole = useCallback(async (data: RoleEditorPayload) => {
        if(!selectedTeam) return;

        setIsSaving(true);
        try{
            if(editingRole){
                const updated = await teamRoleRepository.update(selectedTeam._id, editingRole._id, data);
                updateRoleInList(editingRole._id, updated);
            }else{
                const created = await teamRoleRepository.create(selectedTeam._id, data);
                addRole(created);
            }
            setEditingRole(null);
        }catch(err){
            console.error('Failed to save role:', err);
            throw err;
        }finally{
            setIsSaving(false);
        }
    }, [selectedTeam, editingRole, teamRoleRepository, addRole, updateRoleInList]);

    const handleDeleteRole = useCallback(async (role: TeamRole) => {
        if(!selectedTeam || role.isSystem) return;

        const isConfirmed = await confirm(`Are you sure you want to delete "${role.name}"?`);
        if(!isConfirmed) return;

        try{
            await teamRoleRepository.delete(selectedTeam._id, role._id);
            removeRole(role._id);
        }catch(err){
            console.error('Failed to delete role:', err);
        }
    }, [selectedTeam, teamRoleRepository, removeRole]);

    const getMenuOptions = useCallback((role: TeamRole): MenuOption[] => {
        if(role.isSystem){
            return [{
                label: 'View',
                icon: RiEyeLine,
                onClick: () => handleOpenEdit(role)
            }];
        }

        return [
            {
                label: 'Edit',
                icon: RiEditLine,
                onClick: () => handleOpenEdit(role)
            },
            {
                label: 'Delete',
                icon: RiDeleteBin6Line,
                onClick: () => handleDeleteRole(role),
                destructive: true
            }
        ];
    }, [handleOpenEdit, handleDeleteRole]);

    if(!selectedTeam){
        return <Container className='p-3'>Please select a team.</Container>;
    }

    return (
        <Container className='manage-roles-page h-max'>
            <DocumentListing<TeamRole>
                title='Manage Roles'
                columns={COLUMNS}
                fetchData={fetchData}
                enabled={!!selectedTeam?._id}
                getMenuOptions={getMenuOptions}
                emptyMessage='No roles found. Create your first custom role.'
                createNew={{
                    buttonTitle: 'New Role',
                    onCreate: handleOpenCreate
                }}
            />

            <RoleEditorModal
                role={editingRole}
                resources={DEFAULT_RESOURCES}
                actions={DEFAULT_ACTIONS}
                onSave={handleSaveRole}
                isSaving={isSaving}
            />
        </Container>
    );
};

export default ManageRolesTemplate;
