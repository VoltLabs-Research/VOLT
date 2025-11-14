/**
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
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

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CanvasPresenceUser } from '@/hooks/canvas/use-canvas-presence';
import './CanvasPresenceAvatars.css';

interface CanvasPresenceAvatarsProps {
    users: CanvasPresenceUser[];
}

const getInitialsFromUser = (user: CanvasPresenceUser): string => {
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

const getDisplayName = (user: CanvasPresenceUser): string => {
    if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
    }
    if (user.email) {
        return user.email.split('@')[0];
    }
    return 'Anonymous User';
};

const CanvasPresenceAvatars: React.FC<CanvasPresenceAvatarsProps> = ({ users }) => {
    if (!users || users.length === 0) {
        return null;
    }

    const displayUsers = users.slice(0, 5); // Show max 5 avatars
    const extraCount = Math.max(0, users.length - 5);

    return (
        <div className='canvas-presence-container'>
            <div className='canvas-presence-avatars'>
                <AnimatePresence mode='popLayout'>
                    {displayUsers.map((user) => (
                        <motion.div
                            key={user.id}
                            className='canvas-presence-avatar-wrapper'
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            title={getDisplayName(user)}
                        >
                            <div className='canvas-presence-avatar'>
                                <span className='avatar-initials'>
                                    {getInitialsFromUser(user)}
                                </span>
                                {user.isAnonymous && (
                                    <div className='avatar-anonymous-badge' title='Anonymous'>
                                        ?
                                    </div>
                                )}
                            </div>
                            <div className='avatar-tooltip'>
                                {getDisplayName(user)}
                                {user.isAnonymous && ' (Anonymous)'}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {extraCount > 0 && (
                    <motion.div
                        className='canvas-presence-avatar-wrapper'
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        title={`${extraCount} more users`}
                    >
                        <div className='canvas-presence-avatar canvas-presence-avatar-extra'>
                            <span className='avatar-initials'>+{extraCount}</span>
                        </div>
                        <div className='avatar-tooltip'>
                            {extraCount} more {extraCount === 1 ? 'user' : 'users'}
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default CanvasPresenceAvatars;
