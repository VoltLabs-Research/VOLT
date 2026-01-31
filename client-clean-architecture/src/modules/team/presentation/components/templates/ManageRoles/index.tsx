import React, { useEffect, useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import RoleRow from '../../molecules/RoleRow';
import EmptyState from '@/shared/presentation/components/EmptyState';
import RoleEditorModal, { openRoleEditorModal, RoleEditorPayload } from '../../organisms/RoleEditorModal';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import { useTeamRoleStore } from '@/modules/team/presentation/stores/use-team-role-store';
import useTeamRoleData from '@/modules/team/presentation/hooks/team-role/use-team-role-data';
import useTeamRoleUseCases from '@/modules/team/presentation/hooks/team-role/use-team-role-use-cases';
import type { TeamRole } from '@/modules/team/domain/entities/TeamRole';
import type { RBACResource, RBACAction } from '../../molecules/RolePermissionGrid';
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

const ManageRolesTemplate: React.FC = () => {
    const [editingRole, setEditingRole] = useState<TeamRole | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const roles = useTeamRoleStore((state) => state.roles);
    const isLoadingRoles = useTeamRoleStore((state) => state.isLoading);
    const addRole = useTeamRoleStore((state) => state.addRole);
    const updateRoleInList = useTeamRoleStore((state) => state.updateRoleInList);
    const removeRole = useTeamRoleStore((state) => state.removeRole);

    const { fetchRoles } = useTeamRoleData();

    const {
        createTeamRoleUseCase,
        updateTeamRoleUseCase,
        deleteTeamRoleUseCase
    } = useTeamRoleUseCases();

    useEffect(() => {
        if(selectedTeam) {
            fetchRoles(selectedTeam._id);
        }
    }, [selectedTeam, fetchRoles]);

    const handleOpenCreate = useCallback(() => {
        setEditingRole(null);
        setTimeout(() => openRoleEditorModal(), 0);
    }, []);

    const handleOpenEdit = useCallback((role: TeamRole) => {
        setEditingRole(role);
        setTimeout(() => openRoleEditorModal(), 0);
    }, []);

    const handleSaveRole = useCallback(async (data: RoleEditorPayload) => {
        if(!selectedTeam) return;

        setIsSaving(true);
        try{
            if(editingRole) {
                const updated = await updateTeamRoleUseCase.execute({
                    teamId: selectedTeam._id,
                    roleId: editingRole._id,
                    ...data
                });
                updateRoleInList(editingRole._id, updated);
            }else{
                const created = await createTeamRoleUseCase.execute({
                    teamId: selectedTeam._id,
                    ...data
                });
                addRole(created);
            }
            setEditingRole(null);
        }catch(err){
            console.error('Failed to save role:', err);
            throw err;
        }finally{
            setIsSaving(false);
        }
    }, [selectedTeam, editingRole, createTeamRoleUseCase, updateTeamRoleUseCase, addRole, updateRoleInList]);

    const handleDeleteRole = useCallback(async (role: TeamRole) => {
        if(!selectedTeam || role.isSystem) return;

        try{
            await deleteTeamRoleUseCase.execute({ 
                teamId: selectedTeam._id, 
                roleId: role._id 
            });
            removeRole(role._id);
        }catch(err){
            console.error('Failed to delete role:', err);
        }
    }, [selectedTeam, deleteTeamRoleUseCase, removeRole]);

    if(!selectedTeam){
        return (
            <Container className='manage-roles-page p-2'>
                <Paragraph className='color-secondary'>Please select a team.</Paragraph>
            </Container>
        );
    }

    return (
        <Container className='manage-roles-page d-flex column gap-1-5 p-2'>
            <Container className='d-flex items-center content-between'>
                <Title className='font-size-5 font-weight-6'>
                    Manage Roles ({roles.length})
                </Title>
                <Button
                    variant='solid'
                    intent='brand'
                    leftIcon={<Plus size={16} />}
                    onClick={handleOpenCreate}
                >
                    New Role
                </Button>
            </Container>

            {isLoadingRoles ? (
                <Container className='manage-roles-loading radius-md p-3'>
                    <Paragraph className='color-secondary'>Loading roles...</Paragraph>
                </Container>
            ) : roles.length === 0 ? (
                <EmptyState
                    title='No Roles'
                    description='No roles found. Create your first custom role.'
                />
            ) : (
                <Container className='manage-roles-list radius-md d-flex column gap-05'>
                    {roles.map((role) => (
                        <RoleRow
                            key={role._id}
                            role={role}
                            onEdit={handleOpenEdit}
                            onDelete={handleDeleteRole}
                        />
                    ))}
                </Container>
            )}

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
