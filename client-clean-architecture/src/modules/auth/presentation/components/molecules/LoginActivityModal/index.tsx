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
import useLoginActivity from '@/modules/auth/presentation/hooks/use-login-activity';
import '@/modules/auth/presentation/components/molecules/LoginActivityModal/LoginActivityModal.css';
import Title from '@/shared/presentation/components/primitives/Title';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import Button from '@/shared/presentation/components/primitives/Button';
import Tooltip from '@/shared/presentation/components/atoms/common/Tooltip';
import Modal from '@/shared/presentation/components/molecules/common/Modal';

interface LoginActivityModalProps { }

const LoginActivityModal: React.FC<LoginActivityModalProps> = () => {
    const { activities, loading, error, refetch } = useLoginActivity(50);

    const closeModal = () => {
        (document.getElementById('login-activity-modal') as HTMLDialogElement)?.close();
    };

    return (
        <Modal
            id='login-activity-modal'
            title='Login Activity'
            width='600px'
            className='login-activity-modal w-max overflow-hidden'
        >
            <div className="d-flex column flex-1 login-activity-modal-content y-auto p-1-5">
                <div className="d-flex items-center content-end gap-075 login-activity-modal-actions mb-1">
                    <Button
                        variant='ghost'
                        intent='neutral'
                        size='sm'
                        leftIcon={<TbRefresh size={16} className={loading ? 'animate-spin' : ''} />}
                        onClick={refetch}
                        disabled={loading}
                    >
                        Refresh
                    </Button>
                    <Tooltip content="Close" placement="left">
                        <Button
                            variant='ghost'
                            intent='neutral'
                            iconOnly
                            commandfor='login-activity-modal'
                            command='close'
                        >
                            <TbX size={20} />
                        </Button>
                    </Tooltip>
                </div>

                {loading ? (
                    <div className="d-flex column gap-1 activity-loading">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <div key={index} className="d-flex items-center gap-1 activity-skeleton p-1">
                                <div className="activity-skeleton-icon"></div>
                                <div className="d-flex column gap-05 flex-1 activity-skeleton-content">
                                    <div className="activity-skeleton-line"></div>
                                    <div className="activity-skeleton-line short"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="d-flex column flex-center activity-error">
                        <TbActivity size={48} />
                        <Title className='font-size-2-5'>Unable to load activity</Title>
                        <Paragraph>{error}</Paragraph>
                        <Button variant='ghost' intent='neutral' onClick={refetch}>
                            Try Again
                        </Button>
                    </div>
                ) : activities.length === 0 ? (
                    <div className="d-flex column flex-center activity-empty">
                        <TbActivity size={48} />
                        <Title className='font-size-2-5'>No login activity</Title>
                        <Paragraph>Your login attempts will appear here</Paragraph>
                    </div>
                ) : (
                    <div className="d-flex column gap-1 activity-list">
                        {activities.map((activity) => (
                            <div key={activity._id} className={`d-flex items-start gap-1 activity-item ${activity.success ? 'success' : 'failed'}`}>
                                <div className="d-flex flex-center activity-icon f-shrink-0">
                                    {activity.success ? <TbCheck size={20} /> : <TbX size={20} />}
                                </div>
                                <div className="d-flex column gap-075 flex-1 activity-content">
                                    <div className="d-flex items-center content-between gap-1 sm:column sm:item-start sm:gap-05 activity-header">
                                        <span className="activity-title font-size-3 font-weight-6 color-primary">
                                            {activity.action === 'login' ? 'Successful Login' :
                                                activity.action === 'failed_login' ? 'Failed Login Attempt' :
                                                    'Logout'}
                                        </span>
                                        <span className="activity-time font-size-2 color-secondary">
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
                                    <div className="d-flex column gap-05 activity-details">
                                        <Paragraph className="activity-description font-size-2 color-secondary">
                                            <strong>Device:</strong> {activity.userAgent}
                                        </Paragraph>
                                        <Paragraph className="activity-description font-size-2 color-secondary">
                                            <strong>IP Address:</strong> {activity.ip}
                                        </Paragraph>
                                        {activity.failureReason && (
                                            <Paragraph className="activity-description font-size-2 color-secondary">
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
        </Modal>
    );
};

export default LoginActivityModal;
