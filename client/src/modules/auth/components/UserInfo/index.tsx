import './UserInfo.css';
import { Avatar, Box, Row, Text } from '@voltstack/bravais';
import type { User } from '@/modules/auth/api/entities/user';
import type { ReactNode } from 'react';

interface UserInfoProps {
    user: User | null;
    showStatus?: boolean;
    isOnline?: boolean;
    suffix?: ReactNode;
    className?: string;
}

const UserInfo = ({ 
    user, 
    showStatus = false, 
    isOnline = false, 
    suffix,
    className 
}: UserInfoProps) => {
    return (
        <Row gap='075' width='max' justify='between' className={className}>
            <Avatar
                user={user}
                size='sm'
                showStatus={showStatus}
                isOnline={isOnline}
            />
            <Box flex='1' minW='0' className='user-info-details'>
                <Text as='p' size='md' weight='bold' tone='primary' className='user-info-name overflow-hidden'>
                    {user?.firstName} {user?.lastName}
                    {suffix}
                </Text>
                <Text as='p' size='sm' tone='muted' className='user-info-email overflow-hidden'>
                    {user?.email}
                </Text>
            </Box>
        </Row>
    );
};

export default UserInfo;
