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

import { useEffect, useState } from 'react';
import { useRasterStore } from '@/features/raster/stores';

export interface UseRasterFrameResult {
    scene: {
        frame: number;
        model: string;
        analysisId: string;
        data?: string;
        isUnavailable?: boolean;
    } | null;
    isLoading: boolean;
    error: string | null;
};

const useRasterFrame = (
    trajectoryId?: string,
    timestep?: number,
    analysisId?: string,
    model?: string
): UseRasterFrameResult => {
    const [scene, setScene] = useState<UseRasterFrameResult['scene']>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const getRasterFrame = useRasterStore((state) => state.getRasterFrame);

    useEffect(() => {
        let mounted = true;

        if (!trajectoryId || timestep === undefined || !analysisId || !model) {
            setScene(null);
            setError('Missing required parameters');
            setIsLoading(false);

            return () => {
                mounted = false;
            };
        }

        const run = async () => {
            setIsLoading(true);

            try {
                const data = await getRasterFrame(trajectoryId, timestep, analysisId, model);
                if (!mounted) return;

                if (data) {
                    setScene({
                        frame: timestep,
                        model,
                        analysisId,
                        data,
                        isUnavailable: false
                    });
                    setError(null);
                } else {
                    setScene({
                        frame: timestep,
                        model,
                        analysisId,
                        isUnavailable: true
                    });
                    setError(`Frame ${timestep} not available`);
                }
            } catch (e: any) {
                if (!mounted) return;
                // Silently handle 404s for missing frames - this is expected
                setScene({
                    frame: timestep,
                    model,
                    analysisId,
                    isUnavailable: true
                });
                setError(e?.message ?? 'Frame not available');
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        run();
        return () => {
            mounted = false;
        };
    }, [trajectoryId, timestep, analysisId, model]);

    return { scene, isLoading, error };
};

export default useRasterFrame;
