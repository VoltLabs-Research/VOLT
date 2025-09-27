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
import useApiTracker from '@/hooks/api/use-api-tracker';
import './RecentActivity.css';

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
            <div className={`recent-activity-container ${className}`}>
                <div className="recent-activity-header">
                    <h3 className="recent-activity-title">
                        <HiChartBar className="recent-activity-icon" />
                        Recent Activity
                    </h3>
                </div>
                <div className="recent-activity-loading">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="recent-activity-skeleton">
                            <div className="recent-activity-skeleton-method" />
                            <div className="recent-activity-skeleton-content">
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
            <div className={`recent-activity-container ${className}`}>
                <div className="recent-activity-header">
                    <h3 className="recent-activity-title">
                        <HiChartBar className="recent-activity-icon" />
                        Recent Activity
                    </h3>
                </div>
                <div className="recent-activity-empty">
                    <HiGlobeAlt className="recent-activity-empty-icon" />
                    <h4 className="recent-activity-empty-title">Unable to load activity</h4>
                    <p className="recent-activity-empty-description">
                        {error}
                    </p>
                </div>
            </div>
        );
    }

    // Handle HandlerFactory response format (data is an array)
    const requests = Array.isArray(data?.data) ? data.data : [];
    const summary = data?.data?.summary;

    console.log('🔍 RecentActivity Debug:', {
        loading,
        error,
        data,
        requests: requests.length,
        summary,
        isArray: Array.isArray(data?.data),
        dataKeys: data?.data ? Object.keys(data.data) : []
    });

    if (requests.length === 0) {
        return (
            <div className={`recent-activity-container ${className}`}>
                <div className="recent-activity-header">
                    <h3 className="recent-activity-title">
                        <HiChartBar className="recent-activity-icon" />
                        Recent Activity
                    </h3>
                </div>
                <div className="recent-activity-empty">
                    <HiChartBar className="recent-activity-empty-icon" />
                    <h4 className="recent-activity-empty-title">No activity yet</h4>
                    <p className="recent-activity-empty-description">
                        Your API requests will appear here once you start using the platform.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`recent-activity-container ${className}`}>
            <div className="recent-activity-header">
                <h3 className="recent-activity-title">
                    <HiChartBar className="recent-activity-icon" />
                    Recent Activity
                </h3>
                
                {showStats && summary && (
                    <div className="recent-activity-stats">
                        <div className="recent-activity-stat">
                            <span className="recent-activity-stat-value">
                                {summary.totalRequests}
                            </span>
                            <span className="recent-activity-stat-label">Requests</span>
                        </div>
                        <div className="recent-activity-stat">
                            <span className="recent-activity-stat-value">
                                {formatResponseTime(summary.averageResponseTime)}
                            </span>
                            <span className="recent-activity-stat-label">Avg Time</span>
                        </div>
                        <div className="recent-activity-stat">
                            <span className="recent-activity-stat-value">
                                {summary.uniqueIPsCount}
                            </span>
                            <span className="recent-activity-stat-label">IPs</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="recent-activity-list">
                {requests.map((request) => (
                    <div key={request._id} className="recent-activity-item">
                        <div className="recent-activity-item-content">
                            <div className="recent-activity-item-header">
                                <span 
                                    className="recent-activity-method-badge"
                                    style={{ 
                                        backgroundColor: getMethodColor(request.method),
                                        color: 'white'
                                    }}
                                >
                                    {request.method}
                                </span>
                                <span className="recent-activity-url">
                                    {request.url}
                                </span>
                            </div>
                            
                            <div className="recent-activity-item-meta">
                                <div className={`recent-activity-status-code ${getStatusCodeClass(request.statusCode)}`}>
                                    <HiLightningBolt />
                                    {request.statusCode}
                                </div>
                                
                                <div className="recent-activity-response-time">
                                    <HiClock />
                                    {formatResponseTime(request.responseTime)}
                                </div>
                                
                                <div className="recent-activity-time">
                                    <HiGlobeAlt />
                                    {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                                </div>
                            </div>
                        </div>
                        
                        <div className="recent-activity-item-actions">
                            <button 
                                className="recent-activity-action-button"
                                title="View details"
                            >
                                <HiEye />
                            </button>
                            <button 
                                className="recent-activity-action-button"
                                title="Refresh"
                                onClick={handleRefresh}
                                disabled={refreshing}
                            >
                                <HiRefresh className={refreshing ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RecentActivity;
