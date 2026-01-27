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

import React, { useState } from 'react';
import {
    HiChartBar,
    HiClock,
    HiLightningBolt,
    HiGlobeAlt,
    HiEye,
    HiRefresh
} from 'react-icons/hi';
import { formatDistanceToNow } from 'date-fns';
import useApiTracker from '@/modules/api-tracker/presentation/hooks/use-api-tracker';
import '@/modules/auth/presentation/components/molecules/RecentActivity/RecentActivity.css';
import Title from '@/shared/presentation/components/primitives/Title';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import Button from '@/shared/presentation/components/primitives/Button';
import Tooltip from '@/shared/presentation/components/atoms/common/Tooltip';

interface RecentActivityProps {
    limit?: number;
    showStats?: boolean;
    className?: string;
}

const RecentActivity: React.FC<RecentActivityProps> = ({
    limit = 10,
    showStats = true,
    className = ''
}) => {
    const [refreshing, setRefreshing] = useState(false);
    const { data, loading, error, refetch } = useApiTracker({
        limit,
        sort: '-createdAt'
    });

    const handleRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    const getStatusCodeClass = (statusCode: number) => {
        if (statusCode >= 200 && statusCode < 300) return 'success';
        if (statusCode >= 400 && statusCode < 500) return 'client-error';
        if (statusCode >= 500) return 'server-error';
        return 'success';
    };

    const formatResponseTime = (time: number) => {
        if (time < 1000) return `${time}ms`;
        return `${(time / 1000).toFixed(1)}s`;
    };

    const getMethodColor = (method: string) => {
        const colors = {
            GET: 'var(--accent-green)',
            POST: 'var(--accent-blue)',
            PUT: 'var(--accent-yellow)',
            PATCH: 'var(--accent-orange)',
            DELETE: 'var(--accent-red)'
        };
        return colors[method as keyof typeof colors] || 'var(--accent-gray)';
    };

    if (loading && !data) {
        return (
            <div className={`recent-activity-container ${className} p-1-5`}>
                <div className="recent-activity-header mb-1-5">
                    <Title className="font-size-3 recent-activity-title font-size-4 font-weight-6 color-primary">
                        <HiChartBar className="recent-activity-icon" />
                        Recent Activity
                    </Title>
                </div>
                <div className="d-flex column gap-075 recent-activity-loading">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="d-flex items-center gap-1 recent-activity-skeleton p-1">
                            <div className="recent-activity-skeleton-method" />
                            <div className="d-flex column gap-05 flex-1 recent-activity-skeleton-content">
                                <div className="recent-activity-skeleton-line short" />
                                <div className="recent-activity-skeleton-line medium" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`recent-activity-container ${className} p-1-5`}>
                <div className="recent-activity-header mb-1-5">
                    <Title className="font-size-3 recent-activity-title font-size-4 font-weight-6 color-primary">
                        <HiChartBar className="recent-activity-icon" />
                        Recent Activity
                    </Title>
                </div>
                <div className="d-flex column flex-center recent-activity-empty text-center color-muted">
                    <HiGlobeAlt className="recent-activity-empty-icon" />
                    <Title className="font-size-2-5 recent-activity-empty-title font-weight-6 color-secondary">Unable to load activity</Title>
                    <Paragraph className="recent-activity-empty-description font-size-2 line-height-5">
                        {error}
                    </Paragraph>
                </div>
            </div>
        );
    }

    // Handle HandlerFactory response format(data is an array)
    const requests = Array.isArray(data.data.requests) ? data.data.requests : [];

    if (requests.length === 0) {
        return (
            <div className={`recent-activity-container ${className} p-1-5`}>
                <div className="recent-activity-header mb-1-5">
                    <Title className="font-size-3 recent-activity-title font-size-4 font-weight-6 color-primary">
                        <HiChartBar className="recent-activity-icon" />
                        Recent Activity
                    </Title>
                </div>
                <div className="d-flex column flex-center recent-activity-empty text-center color-muted">
                    <HiChartBar className="recent-activity-empty-icon" />
                    <Title className="font-size-2-5 recent-activity-empty-title font-weight-6 color-secondary">No activity yet</Title>
                    <Paragraph className="recent-activity-empty-description font-size-2 line-height-5">
                        Your API requests will appear here once you start using the platform.
                    </Paragraph>
                </div>
            </div>
        );
    }

    return (
        <div className={`recent-activity-container ${className} p-1-5`}>
            <div className="d-flex items-center content-between sm:column sm:item-start sm:gap-1 recent-activity-header mb-1-5">
                <Title className="d-flex items-center gap-1 font-size-3 recent-activity-title font-size-4 font-weight-6 color-primary">
                    <HiChartBar className="recent-activity-icon" />
                    Recent Activity
                </Title>
            </div>

            <div className="d-flex column gap-075 recent-activity-list y-auto">
                {requests.map((request) => (
                    <div key={request._id} className="d-flex items-center gap-1 sm:column sm:item-start sm:gap-075 recent-activity-item cursor-pointer p-1">
                        <div className="flex-1 d-flex column gap-05 recent-activity-item-content">
                            <div className="d-flex items-center gap-075 recent-activity-item-header">
                                <span
                                    className="recent-activity-method-badge text-center font-size-1 font-weight-6"
                                    style={{
                                        backgroundColor: getMethodColor(request.method),
                                        color: 'white'
                                    }}
                                >
                                    {request.method}
                                </span>
                                <span className="recent-activity-url font-size-2 font-weight-5 color-primary">
                                    {request.url || request.path}
                                </span>
                            </div>

                            <div className="d-flex items-center gap-1 recent-activity-item-meta font-size-1 color-secondary">
                                <div className={`d-flex items-center gap-025 recent-activity-status-code ${getStatusCodeClass(request.statusCode)} font-weight-6`}>
                                    <HiLightningBolt />
                                    {request.statusCode}
                                </div>

                                <div className="d-flex items-center gap-025 recent-activity-response-time">
                                    <HiClock />
                                    {formatResponseTime(request.responseTime)}
                                </div>

                                <div className="d-flex items-center gap-025 recent-activity-time">
                                    <HiGlobeAlt />
                                    {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                                </div>
                            </div>
                        </div>

                        <div className="d-flex items-center gap-05 recent-activity-item-actions">
                            <Tooltip content="View Details" placement="top">
                                <Button
                                    variant='ghost'
                                    intent='neutral'
                                    iconOnly
                                    size='sm'
                                >
                                    <HiEye />
                                </Button>
                            </Tooltip>
                            <Tooltip content="Refresh" placement="top">
                                <Button
                                    variant='ghost'
                                    intent='neutral'
                                    iconOnly
                                    size='sm'
                                    onClick={handleRefresh}
                                    disabled={refreshing}
                                >
                                    <HiRefresh className={refreshing ? 'animate-spin' : ''} />
                                </Button>
                            </Tooltip>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RecentActivity;
