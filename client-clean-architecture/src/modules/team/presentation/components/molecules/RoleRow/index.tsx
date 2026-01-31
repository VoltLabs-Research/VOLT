import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Shield, Eye, Edit, Trash2 } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import PermissionBadge from '../../atoms/PermissionBadge';
import type { TeamRole } from '@/modules/team/domain/entities/TeamRole';
import './RoleRow.css';

interface RoleRowProps {
    role: TeamRole;
    onEdit: (role: TeamRole) => void;
    onDelete: (role: TeamRole) => void;
};

const RoleRow: React.FC<RoleRowProps> = ({
    role,
    onEdit,
    onDelete
}) => {
    return (
        <Popover
            id={`role-menu-${role._id}`}
            triggerAction='contextmenu'
            trigger={
                <Container className='role-row d-flex items-center content-between gap-1 p-1'>
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
                        <span className={`role-badge ${role.isSystem ? 'badge-warning' : 'badge-brand'}`}>
                            {role.isSystem ? 'System' : 'Custom'}
                        </span>

                        {role.createdAt && (
                            <Paragraph className='font-size-1 color-tertiary'>
                                Created {formatDistanceToNow(new Date(role.createdAt), { addSuffix: true })}
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
                                onDelete(role);
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
