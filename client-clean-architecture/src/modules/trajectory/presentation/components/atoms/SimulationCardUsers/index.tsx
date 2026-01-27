import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrajectoryPresence, type CardPresenceUser } from '@/modules/trajectory/presentation/hooks/use-trajectory-presence';
import '@/modules/trajectory/presentation/components/atoms/SimulationCardUsers/SimulationCardUsers.css';
import Container from '@/shared/presentation/components/primitives/Container';

interface SimulationCardUsersProps {
    trajectoryId: string;
}

const getInitialsFromUser = (user: CardPresenceUser): string => {
    if (user.firstName && user.lastName) {
        return (user.firstName[0] + user.lastName[0]).toUpperCase();
    }
    if (user.email) {
        const parts = user.email.split('@')[0].split('.');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return user.email[0].toUpperCase();
    }
    return '?';
};

const SimulationCardUsers: React.FC<SimulationCardUsersProps> = memo(({ trajectoryId }) => {
    const { users } = useTrajectoryPresence(trajectoryId);
    const displayUsers = users.slice(0, 3);
    const extraCount = Math.max(0, users.length - 3);

    if (users.length === 0) {
        return null;
    }

    return (
        <Container className="simulation-card-users p-absolute">
            <Container className="d-flex items-center row-reverse">
                <AnimatePresence mode="popLayout">
                    {displayUsers.map((user, index) => (
                        <motion.div
                            key={user.id}
                            className="p-relative f-shrink-0 card-user-avatar-wrapper"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Container className="d-flex flex-center overflow-hidden p-relative card-user-avatar">
                                <Container className="avatar-initials font-size-1 font-weight-6 color-secondary">{getInitialsFromUser(user)}</Container>
                                {user.isAnonymous && <div className="d-flex items-center content-center avatar-anonymous-badge p-absolute">?</div>}
                            </Container>
                        </motion.div>
                    ))}
                    {extraCount > 0 && (
                        <motion.div
                            key="extra"
                            className="p-relative f-shrink-0 card-user-avatar-wrapper"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                        >
                            <Container className="d-flex flex-center overflow-hidden p-relative card-user-avatar card-user-avatar-extra">
                                <Container className="avatar-initials font-size-1 font-weight-6 color-secondary">+{extraCount}</Container>
                            </Container>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Container>
        </Container>
    );
});

SimulationCardUsers.displayName = 'SimulationCardUsers';

export default SimulationCardUsers;
