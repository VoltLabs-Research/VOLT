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

import { useEffect, useState, useCallback } from 'react';
import { useTrajectoryStore } from '@/stores/slices/trajectory';

export type FrameAtoms = {
    timestep: number;
    natoms?: number;
    total?: number;
    page?: number;
    pageSize?: number;
    positions: number[][];
    types?: number[];
};

export interface UseFrameAtomsResult{
    data: FrameAtoms | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<FrameAtoms | null>;
}

const useFrameAtoms = (
    trajectoryId?: string,
    timestep?: number,
    opts?: { page?: number, pageSize?: number }
): UseFrameAtomsResult => {
    const getFrameAtoms = useTrajectoryStore((state) => state.getFrameAtoms);
    const [data, setData] = useState<FrameAtoms | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAtoms = useCallback(async(force = false) => {
        if(!trajectoryId || timestep === undefined){
            setData(null);
            setError('Missing trajectoryId or timestep');
            return null;
        }

        setLoading(true);
        setError(null);

        try{
            const res = await getFrameAtoms(trajectoryId, timestep, { force, page: opts?.page, pageSize: opts?.pageSize });
            setData(res);
            if(!res){
                setError('No atoms data returned');
            }
            return res;
        }catch(e: any){
            console.error('API Error loading frame atoms');
            const errorMsg = `Failed to load atoms: ${e?.message}`;
            setError(errorMsg);
            setData(null);
            return null;
        }finally{
            setLoading(false);
        }
    }, [trajectoryId, timestep, opts?.page, opts?.pageSize, getFrameAtoms]);

    useEffect(() => {
        let mounted = true;

        const run = async() => {
            const result = await fetchAtoms(false);
            if(!mounted) return;
            setData(result);
        };

        run();

        return() => {
            mounted = false;
        };
    }, [fetchAtoms]);

    const refetch = useCallback(() => {
        return fetchAtoms(true);
    }, [fetchAtoms]);

    return { data, loading, error, refetch };
};

export default useFrameAtoms;
