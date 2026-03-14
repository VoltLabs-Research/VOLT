import Avatar from '@/shared/presentation/components/Avatar';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { formatDistanceToNow } from 'date-fns';
import type { User } from '@/modules/auth/api/entities/user';
import './SimulationCardHeader.css';

interface SimulationCardHeaderProps {
    user?: User | null;
    createdAt: string;
};

export default function SimulationCardHeader({ user, createdAt }: SimulationCardHeaderProps) {
    const uploadedAtLabel = `Uploaded ${formatDistanceToNow(new Date(createdAt), { addSuffix: true })}`;
    const userFullName = user?.firstName ? `${user.firstName} ${user.lastName}`.trim() : '';

    if (!user?.firstName) {
        return (
            <div className='simulation-card-header d-flex column gap-075 p-absolute top-0 left-0 right-0 z-5'>
                <Paragraph className='font-size-1 simulation-card-upload-meta' title={uploadedAtLabel}>
                    {uploadedAtLabel}
                </Paragraph>
            </div>
        );
    }

    return (
        <div className='simulation-card-header d-flex column gap-075 p-absolute top-0 left-0 right-0 z-5'>
            <div className='simulation-card-header-user d-flex items-center gap-075 p-relative'>
                <div className='header-avatar-wrapper'>
                    <Avatar user={user} size='sm' />
                </div>
                <div className='d-flex column content-center overflow-hidden'>
                    <Paragraph className='font-size-1 font-weight-5 color-secondary simulation-card-header-label'>Uploaded by</Paragraph>
                    <Paragraph className='font-size-1 font-weight-5 color-primary header-user-name text-truncate' title={userFullName}>
                        {userFullName}
                    </Paragraph>
                </div>
            </div>
            <Paragraph className='font-size-1 simulation-card-upload-meta' title={uploadedAtLabel}>
                {uploadedAtLabel}
            </Paragraph>
        </div>
    );
}
