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

import React, { useEffect, useState, useRef } from 'react';
import Loader from '@/components/atoms/common/Loader';
import WindowIcons from '@/components/molecules/common/WindowIcons';
import pluginApi from '@/features/plugins/api/plugin';

interface ChartImageViewerProps {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    title?: string;
    onClose?: () => void;
}

const ChartImageViewer: React.FC<ChartImageViewerProps> = ({
    trajectoryId,
    analysisId,
    exposureId,
    timestep,
    title,
    onClose
}) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const previousUrlRef = useRef<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const fetchChartImage = async () => {
            setLoading(true);
            setError(null);

            try {
                const url = await pluginApi.getChartImage(
                    trajectoryId,
                    analysisId,
                    exposureId,
                    timestep
                );

                if (mounted) {
                    // Revoke previous URL to prevent memory leaks
                    if (previousUrlRef.current) {
                        URL.revokeObjectURL(previousUrlRef.current);
                    }
                    previousUrlRef.current = url;
                    setImageUrl(url);
                }
            } catch (err: any) {
                console.error('Failed to fetch chart image:', err);
                if (mounted) {
                    setError(err.message || 'Failed to load chart');
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        fetchChartImage();

        return () => {
            mounted = false;
        };
    }, [trajectoryId, analysisId, exposureId, timestep]);

    // Cleanup URL on unmount
    useEffect(() => {
        return () => {
            if (previousUrlRef.current) {
                URL.revokeObjectURL(previousUrlRef.current);
            }
        };
    }, []);

    if (loading) {
        return (
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    width: '100%'
                }}
            >
                <Loader scale={0.7} />
            </div>
        );
    }

    if (error) {
        return (
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    width: '100%'
                }}
            >
                <span style={{ color: '#ff6b6b' }}>{error}</span>
            </div>
        );
    }

    if (!imageUrl) return null;

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: '10px 12px',
                gap: '8px'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '2px 4px'
                }}
            >
                <div
                    className="chart-viewer-drag-area"
                    style={{
                        flex: 1,
                        height: '20px',
                        cursor: 'grab',
                        userSelect: 'none'
                    }}
                >
                    {title && (
                        <span
                            style={{
                                color: '#ffffff',
                                fontSize: 14,
                                fontWeight: 600,
                                opacity: 0.95
                            }}
                        >
                            {title}
                        </span>
                    )}
                </div>
                <div>
                    <WindowIcons
                        onClose={() => {
                            onClose?.();
                        }}
                    />
                </div>
            </div>

            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden'
                }}
            >
                <img
                    src={imageUrl}
                    alt={title || 'Chart'}
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        borderRadius: '4px'
                    }}
                />
            </div>
        </div>
    );
};

export default ChartImageViewer;
