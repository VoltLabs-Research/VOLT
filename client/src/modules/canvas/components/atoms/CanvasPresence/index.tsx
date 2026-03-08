import { useMemo } from 'react';
import AvatarStack from '@/shared/presentation/components/AvatarStack';
import Container from '@/shared/presentation/components/Container';

import type { CanvasPresenceUser } from '../../../hooks/use-canvas-presence';

import './CanvasPresence.css';

interface CanvasPresenceProps {
    users: CanvasPresenceUser[];
};

const CanvasPresence = ({ users }: CanvasPresenceProps) => {
    const mapped = useMemo(() => (
        users.map((user) => ({
            _id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
        }))
    ), [users]);

    if (!mapped.length) return null;

    const title = users.map((user) => {
        const name = `${user.firstName} ${user.lastName}`;
        return `${name}${user.isAnonymous ? ' (Anonymous)' : ''}`;
    }).join(', ');

    return (
        <Container className="canvas-presence d-flex items-center p-fixed right-1" title={title}>
            <AvatarStack users={mapped} maxDisplay={5} size="sm" />
        </Container>
    );
};

export default CanvasPresence;
