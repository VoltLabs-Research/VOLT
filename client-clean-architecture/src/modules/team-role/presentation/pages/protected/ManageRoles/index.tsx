import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { usePageTitle } from '@/shared/presentation/hooks/core/use-page-title';
import { RiDeleteBin6Line, RiEditLine, RiEyeLine } from 'react-icons/ri';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/organisms/common/DocumentListing';
import useConfirm from '@/shared/presentation/hooks/ui/use-confirm';
import { useTeamStore } from '@/modules/team/presentation/stores';
import { useTeamRoleStore } from '@/modules/team-role/presentation/stores';
import useToast from '@/shared/presentation/hooks/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import RoleEditor, { openRoleEditorModal } from '@/modules/team/presentation/components/organisms/RoleEditor';
import type { TeamRole, TeamRolePayload } from '@/modules/team-role/domain/entities';
import Container from '@/shared/presentation/components/primitives/Container';
import '@/modules/team-role/presentation/pages/protected/ManageRoles/ManageRoles.css';

const ManageRoles: React.FC = () => {
    usePageTitle('Manage Roles');
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const { roles, isLoading, isSaving, fetchRoles, createRole, updateRole, deleteRole } = useTeamRoleStore();
    const { showSuccess, showError } = useToast();
    const { confirmDelete } = useConfirm();

    const [editingRole, setEditingRole] = useState<TeamRole | null>(null);
    const [page, setPage] = useState(1);
    const limit = 20;

    useEffect(() => {
        if (selectedTeam?._id) {
            fetchRoles(selectedTeam._id);
        }
    }, [selectedTeam?._id, fetchRoles]);

    const visibleRoles = useMemo(() => roles.slice(0, page * limit), [roles, page, limit]);
    const hasMore = visibleRoles.length < roles.length;

    const handleLoadMore = useCallback(() => {
        setPage((prev) => prev + 1);
    }, []);

    const handleOpenCreate = useCallback(() => {
        setEditingRole(null);
        openRoleEditorModal();
    }, []);

    const handleOpenEdit = useCallback((role: TeamRole) => {
        setEditingRole(role);
        setTimeout(() => openRoleEditorModal(), 0);
    }, []);

    const handleSaveRole = useCallback(async (data: TeamRolePayload) => {
        if (!selectedTeam?._id) return;

        try {
            if (editingRole) {
                await updateRole(selectedTeam._id, editingRole._id, data);
                showSuccess('Role updated successfully');
            } else {
                await createRole(selectedTeam._id, data);
                showSuccess('Role created successfully');
            }
            setEditingRole(null);
        } catch (err: any) {
            showError(err?.message || 'Failed to save role');
            throw err;
        }
    }, [selectedTeam?._id, editingRole, updateRole, createRole, showSuccess, showError]);

    const handleDeleteRole = useCallback(async (role: TeamRole) => {
        if (!selectedTeam?._id) return;

        if (role.isSystem) {
            showError('System roles cannot be deleted');
            return;
        }

        const isConfirmed = await confirmDelete(role.name);
        if (!isConfirmed) {
            return;
        }

        try {
            await deleteRole(selectedTeam._id, role._id);
            showSuccess('Role deleted successfully');
        } catch (err: any) {
            showError(err?.message || 'Failed to delete role. It may be in use by team members.');
        }
    }, [selectedTeam?._id, deleteRole, showSuccess, showError, confirmDelete]);

    const columns: ColumnConfig[] = useMemo(() => [
        {
            key: 'name',
            title: 'Role Name',
            sortable: true,
            render: (value: string) => (
                <Container className="d-flex items-center gap-1">
                    <IoShieldCheckmarkOutline size={18} className="color-secondary" />
                    <span className="font-weight-5 color-primary">{value}</span>
                </Container>
            ),
            skeleton: { variant: 'text', width: 140 }
        },
        {
            key: 'isSystem',
            title: 'Type',
            sortable: true,
            render: (isSystem: boolean) => (
                <span className={`badge ${isSystem ? 'badge-warning' : 'badge-brand'}`}>
                    {isSystem ? 'System' : 'Custom'}
                </span>
            ),
            skeleton: { variant: 'rounded', width: 70, height: 24 }
        },
        {
            key: 'permissions',
            title: 'Permissions',
            render: (permissions: string[]) => {
                if (permissions.includes('*')) {
                    return <span className="badge badge-primary">All Permissions</span>;
                }

                const count = permissions.length;
                return (
                    <span className="color-secondary font-size-2">
                        {count} permission{count !== 1 ? 's' : ''}
                    </span>
                );
            },
            skeleton: { variant: 'text', width: 100 }
        },
        {
            key: 'createdAt',
            title: 'Created',
            sortable: true,
            render: (value: string) => (
                <span className="color-secondary font-size-2">{formatDistanceToNow(value)}</span>
            ),
            skeleton: { variant: 'text', width: 100 }
        }
    ], []);

    const getMenuOptions = useCallback((role: TeamRole) => {
        const options = [];

        if (role.isSystem) {
            options.push({
                label: 'View',
                icon: RiEyeLine,
                onClick: () => handleOpenEdit(role)
            });
        } else {
            options.push({
                label: 'Edit',
                icon: RiEditLine,
                onClick: () => handleOpenEdit(role)
            });
            options.push({
                label: 'Delete',
                icon: RiDeleteBin6Line,
                onClick: () => handleDeleteRole(role),
                destructive: true
            });
        }

        return options;
    }, [handleOpenEdit, handleDeleteRole]);

    if (!selectedTeam) {
        return <Container className="dashboard-content-padding">Please select a team.</Container>;
    }

    return (
        <Container className="manage-roles-page dashboard-content-padding h-100 h-max">
            <DocumentListing
                title={`Manage Roles (${roles.length})`}
                columns={columns}
                data={visibleRoles}
                isLoading={isLoading}
                getMenuOptions={getMenuOptions}
                emptyMessage="No roles found. Create your first custom role."
                keyExtractor={(item: any) => item._id}
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
                createNew={{
                    buttonTitle: 'New Role',
                    onCreate: handleOpenCreate
                }}
            />

            <RoleEditor
                role={editingRole}
                onSave={handleSaveRole}
                isSaving={isSaving}
            />
        </Container>
    );
};

export default ManageRoles;
