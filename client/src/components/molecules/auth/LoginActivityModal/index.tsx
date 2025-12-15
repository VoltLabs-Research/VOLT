/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
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
 */

import React from 'react';
import { TbX, TbCheck, TbActivity, TbRefresh } from 'react-icons/tb';
import { formatDistanceToNow, isValid } from 'date-fns';
import useLoginActivity from '@/hooks/auth/use-login-activity';
import './LoginActivityModal.css';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';

interface LoginActivityModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const LoginActivityModal: React.FC<LoginActivityModalProps> = ({ isOpen, onClose }) => {
    const { activities, loading, error, refetch } = useLoginActivity(50);

    if (!isOpen) return null;

    return (
        <div className="login-activity-modal-overlay" onClick={onClose}>
            <div className="login-activity-modal" onClick={(e) => e.stopPropagation()}>
                <div className="login-activity-modal-header">
                    <div className="login-activity-modal-title">
                        <TbActivity size={24} />
                        <Title className='font-size-2 login-activity-modal-title'>Login Activity</Title>
                    </div>
                    <div className="login-activity-modal-actions">
                        <button
                            className="action-button refresh"
                            onClick={refetch}
                            disabled={loading}
                        >
                            <TbRefresh size={16} className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                        <button className="action-button close" onClick={onClose}>
                            <TbX size={20} />
                        </button>
                    </div>
                </div>

                <div className="login-activity-modal-content">
                    {loading ? (
                        <div className="activity-loading">
                            {Array.from({ length: 5 }).map((_, index) => (
                                <div key={index} className="activity-skeleton">
                                    <div className="activity-skeleton-icon"></div>
                                    <div className="activity-skeleton-content">
                                        <div className="activity-skeleton-line"></div>
                                        <div className="activity-skeleton-line short"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="activity-error">
                            <TbActivity size={48} />
                            <Title className='font-size-2-5'>Unable to load activity</Title>
                            <Paragraph>{error}</Paragraph>
                            <button className="action-button" onClick={refetch}>
                                Try Again
                            </button>
                        </div>
                    ) : activities.length === 0 ? (
                        <div className="activity-empty">
                            <TbActivity size={48} />
                            <Title className='font-size-2-5'>No login activity</Title>
                            <Paragraph>Your login attempts will appear here</Paragraph>
                        </div>
                    ) : (
                        <div className="activity-list">
                            {activities.map((activity) => (
                                <div key={activity._id} className={`activity-item ${activity.success ? 'success' : 'failed'}`}>
                                    <div className="activity-icon">
                                        {activity.success ? <TbCheck size={20} /> : <TbX size={20} />}
                                    </div>
                                    <div className="activity-content">
                                        <div className="activity-header">
                                            <span className="activity-title">
                                                {activity.action === 'login' ? 'Successful Login' :
                                                    activity.action === 'failed_login' ? 'Failed Login Attempt' :
                                                        'Logout'}
                                            </span>
                                            <span className="activity-time">
                                                {(() => {
                                                    try {
                                                        const date = new Date(activity.createdAt);
                                                        return isValid(date) ?
                                                            formatDistanceToNow(date, { addSuffix: true }) :
                                                            'Unknown time';
                                                    } catch {
                                                        return 'Unknown time';
                                                    }
                                                })()}
                                            </span>
                                        </div>
                                        <div className="activity-details">
                                            <Paragraph className="activity-description">
                                                <strong>Device:</strong> {activity.userAgent}
                                            </Paragraph>
                                            <Paragraph className="activity-description">
                                                <strong>IP Address:</strong> {activity.ip}
                                            </Paragraph>
                                            {activity.failureReason && (
                                                <Paragraph className="activity-description">
                                                    <strong>Reason:</strong> {activity.failureReason}
                                                </Paragraph>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginActivityModal;
