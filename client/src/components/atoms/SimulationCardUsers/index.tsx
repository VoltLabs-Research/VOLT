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

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { socketService } from '@/services/socketio';
import './SimulationCardUsers.css';

export interface CardPresenceUser {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    isAnonymous: boolean;
}

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

const getDisplayName = (user: CardPresenceUser): string => {
    if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
    }
    if (user.email) {
        return user.email.split('@')[0];
    }
    return 'Anonymous';
};

const SimulationCardUsers: React.FC<SimulationCardUsersProps> = ({ trajectoryId }) => {
    const [users, setUsers] = useState<CardPresenceUser[]>([]);
    const [isConnected, setIsConnected] = useState(() => socketService.isConnected());

    console.log(`[SimulationCardUsers] Component mounted for trajectory: ${trajectoryId}, isConnected: ${isConnected}`);

    // Monitor connection status
    useEffect(() => {
        const unsubscribe = socketService.onConnectionChange((connected) => {
            console.log(`[SimulationCardUsers] Connection changed: ${connected}`);
            setIsConnected(connected);
        });

        return unsubscribe;
    }, []);

    // Subscribe to canvas AND raster presence for this trajectory
    useEffect(() => {
        if (!isConnected || !trajectoryId) {
            console.log(`[SimulationCardUsers] Skipping subscription - isConnected: ${isConnected}, trajectoryId: ${trajectoryId}`);
            return;
        }

        console.log(`[SimulationCardUsers] Setting up observers for trajectory: ${trajectoryId}`);

        // Track canvas and raster users separately, then combine
        let canvasUsers: CardPresenceUser[] = [];
        let rasterUsers: CardPresenceUser[] = [];

        const updateCombinedUsers = () => {
            const combined = [...canvasUsers, ...rasterUsers];
            // Deduplicate by user ID
            const uniqueUsers = combined.filter((user, index, self) => 
                index === self.findIndex(u => u.id === user.id)
            );
            console.log(`[SimulationCardUsers] Combined users for trajectory ${trajectoryId}:`, uniqueUsers);
            setUsers(uniqueUsers);
        };

        // IMPORTANT: Register trajectory-specific listeners BEFORE observing to avoid race condition
        // Listen for canvas users updates for THIS SPECIFIC trajectory
        const canvasEventName = `canvas_users_update:${trajectoryId}`;
        const unsubscribeCanvas = socketService.on(canvasEventName, (updatedUsers: CardPresenceUser[]) => {
            console.log(`[SimulationCardUsers] Received ${canvasEventName}:`, updatedUsers);
            canvasUsers = updatedUsers;
            updateCombinedUsers();
        });

        // Listen for raster users updates for THIS SPECIFIC trajectory
        const rasterEventName = `raster_users_update:${trajectoryId}`;
        const unsubscribeRaster = socketService.on(rasterEventName, (updatedUsers: CardPresenceUser[]) => {
            console.log(`[SimulationCardUsers] Received ${rasterEventName}:`, updatedUsers);
            rasterUsers = updatedUsers;
            updateCombinedUsers();
        });

        console.log(`[SimulationCardUsers] Observing canvas & raster presence for trajectory: ${trajectoryId}`);

        // Use OBSERVE events instead of SUBSCRIBE (doesn't join main room, won't appear in user list)
        socketService.emit('observe_canvas_presence', {
            trajectoryId
        }).then(() => {
            console.log(`[SimulationCardUsers] Successfully observing canvas:${trajectoryId}`);
        }).catch((error) => {
            console.error('[SimulationCardUsers] Failed to observe canvas for card:', error);
        });

        socketService.emit('observe_raster_presence', {
            trajectoryId
        }).then(() => {
            console.log(`[SimulationCardUsers] Successfully observing raster:${trajectoryId}`);
        }).catch((error) => {
            console.error('[SimulationCardUsers] Failed to observe raster for card:', error);
        });

        return () => {
            console.log(`[SimulationCardUsers] Unsubscribing from trajectory: ${trajectoryId}`);
            unsubscribeCanvas();
            unsubscribeRaster();
        };
    }, [trajectoryId, isConnected]);

    // Show max 3 avatars in card
    const displayUsers = users.slice(0, 3);
    const extraCount = Math.max(0, users.length - 3);

    // Always render to keep useEffect subscriptions active, hide with CSS
    if (!users || users.length === 0) {
        return <div className='simulation-card-users' style={{ display: 'none' }} />;
    }

    return (
        <div className='simulation-card-users'>
            <div className='card-users-avatars'>
                <AnimatePresence mode='popLayout'>
                    {displayUsers.map((user) => (
                        <motion.div
                            key={user.id}
                            className='card-user-avatar-wrapper'
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            title={getDisplayName(user)}
                        >
                            <div className='card-user-avatar'>
                                <span className='avatar-initials'>
                                    {getInitialsFromUser(user)}
                                </span>
                                {user.isAnonymous && (
                                    <div className='avatar-anonymous-badge'>?</div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {extraCount > 0 && (
                    <motion.div
                        className='card-user-avatar-wrapper'
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        title={`${extraCount} more users`}
                    >
                        <div className='card-user-avatar card-user-avatar-extra'>
                            <span className='avatar-initials'>+{extraCount}</span>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default SimulationCardUsers;
