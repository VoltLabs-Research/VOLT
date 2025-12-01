/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import { Skeleton } from '@mui/material'; 
import './SimulationSkeletonCard.css';

type Props = { n?: number };

const SimulationSkeletonCard: React.FC<Props> = ({ n = 8 }) => {

    return (new Array(n).fill(0)).map((_, index) => (
        <div className='simulation-container' key={index}>
            <Skeleton variant='rounded' width='100%' height={200} />
            <div className='simulation-caption-container'>
                <div className='simulation-caption-left-container'>
                    <Skeleton variant='text' sx={{ fontSize: '1rem' }} width='60%' />
                    <Skeleton variant='text' sx={{ fontSize: '1rem' }} width='40%' />
                </div>
            </div>
        </div>
    ));
};

export default SimulationSkeletonCard;