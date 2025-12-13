/**
 * Copyright(C) Rodolfo Herrera Hernandez. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 **/

import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrajectoryPresence, type CardPresenceUser } from '@/hooks/socket/use-trajectory-presence';
import './SimulationCardUsers.css';

interface SimulationCardUsersProps {
    trajectoryId: string;
}

const getInitialsFromUser = (user: CardPresenceUser): string => {
    if(user.firstName && user.lastName){
        return(user.firstName[0] + user.lastName[0]).toUpperCase();
    }
    if(user.email){
        const parts = user.email.split('@')[0].split('.');
        if(parts.length >= 2){
            return(parts[0][0] + parts[1][0]).toUpperCase();
        }
        return user.email[0].toUpperCase();
    }
    return '?';
};

const SimulationCardUsers: React.FC<SimulationCardUsersProps> = memo(({ trajectoryId }) => {
    // Use centralized hook that prevents duplicate subscriptions
    const { users } = useTrajectoryPresence(trajectoryId);

    // Show max 3 avatars in card
    const displayUsers = users.slice(0, 3);
    const extraCount = Math.max(0, users.length - 3);

    // Always render to keep useEffect subscriptions active, hide with CSS
    if(users.length === 0){
        return null;
    }

    return(
        <div className="simulation-card-users">
            <div className="card-users-avatars">
                <AnimatePresence mode="popLayout">
                    {displayUsers.map((user, index) => (
                        <motion.div
                            key={user.id}
                            className="card-user-avatar-wrapper"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <div className="card-user-avatar">
                                <div className="avatar-initials">{getInitialsFromUser(user)}</div>
                                {user.isAnonymous && <div className="avatar-anonymous-badge">?</div>}
                            </div>
                        </motion.div>
                    ))}
                    {extraCount > 0 && (
                        <motion.div
                            key="extra"
                            className="card-user-avatar-wrapper"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                        >
                            <div className="card-user-avatar card-user-avatar-extra">
                                <div className="avatar-initials">+{extraCount}</div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
});

SimulationCardUsers.displayName = 'SimulationCardUsers';

export default SimulationCardUsers;
