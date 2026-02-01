import React from 'react';
import { Shield, Eye, Edit, Trash2 } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import PermissionBadge from '../../atoms/PermissionBadge';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import { formatRelativeDate } from '@/shared/utils/format';
import type { TeamRole } from '@/modules/team/domain/entities/TeamRole';
import './RoleRow.css';

interface RoleRowProps {
    role: TeamRole;
    onEdit: (role: TeamRole) => void;
    onDelete: (role: TeamRole) => void;
    confirmDelete?: boolean;
};

const RoleRow: React.FC<RoleRowProps> = ({
    role,
    onEdit,
    onDelete,
    confirmDelete = true
}) => {
    const handleDelete = () => {
        if(confirmDelete){
            const confirmed = confirm(
                `Are you sure you want to delete the role "${role.name}"? This action cannot be undone.`
            );
            if(!confirmed) return;
        }
        onDelete(role);
    };

    return (
        <Popover
            id={`role-menu-${role._id}`}
            triggerAction='contextmenu'
            trigger={
                <Container className='role-row radius-sm d-flex items-center content-between gap-1 p-1'>
                    <Container className='d-flex items-center gap-1'>
                        <Shield size={18} className='color-secondary' />
                        <Container className='d-flex column'>
                            <Paragraph className='font-weight-5 color-primary'>
                                {role.name}
                            </Paragraph>
                            <PermissionBadge permissions={role.permissions} />
                        </Container>
                    </Container>

                    <Container className='d-flex items-center gap-1'>
                        <span className={`role-badge radius-sm ${role.isSystem ? 'badge-warning' : 'badge-brand'}`}>
                            {role.isSystem ? 'System' : 'Custom'}
                        </span>

                        {role.createdAt && (
                            <Paragraph className='font-size-1 color-tertiary'>
                                Created {formatRelativeDate(role.createdAt)}
                            </Paragraph>
                        )}
                    </Container>
                </Container>
            }
        >
            {(close) => (
                <PopoverMenu>
                    <PopoverMenuItem
                        icon={role.isSystem ? <Eye size={16} /> : <Edit size={16} />}
                        label={role.isSystem ? 'View Role' : 'Edit Role'}
                        onClick={() => {
                            onEdit(role);
                            close();
                        }}
                    />
                    {!role.isSystem && (
                        <PopoverMenuItem
                            icon={<Trash2 size={16} />}
                            label='Delete Role'
                            variant='danger'
                            onClick={() => {
                                handleDelete();
                                close();
                            }}
                        />
                    )}
                </PopoverMenu>
            )}
        </Popover>
    );
};

export default RoleRow;
