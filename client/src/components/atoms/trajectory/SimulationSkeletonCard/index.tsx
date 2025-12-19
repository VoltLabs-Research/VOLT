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

import { Skeleton } from '@mui/material';
import Container from '@/components/primitives/Container';
import ProcessingLoader from '@/components/atoms/common/ProcessingLoader/ProcessingLoader';

type Props = {
    n?: number;
    progress?: number;
    status?: 'uploading' | 'processing';
};

const SimulationSkeletonCard: React.FC<Props> = ({ n = 8, progress, status }) => {
    if(progress !== undefined){
        return (
            <Container className='simulation-container loading p-relative w-max overflow-hidden cursor-pointer'>
                <Skeleton variant='rounded' width='100%' height={200} />

                <div className="p-absolute" style={{ bottom: '1.5rem', left: '1.5rem', zIndex: 10 }}>
                    <div className="d-flex items-center gap-05">
                        <ProcessingLoader
                            isVisible={true}
                            message={status === 'processing' ? `Processing ${Math.round(progress * 100)}%` : `Uploading ${Math.round(progress * 100)}%`}
                            className="text-white"
                        />
                    </div>
                </div>
            </Container>
        );
    }

    return (new Array(n).fill(0)).map((_, index) => (
        <Container className='simulation-container loading p-relative w-max overflow-hidden cursor-pointer' key={index}>
            <Skeleton variant='rounded' width='100%' height={200} />
        </Container>
    ));
};

export default SimulationSkeletonCard;
