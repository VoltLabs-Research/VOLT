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
import Container from '@/components/primitives/Container';
import '@/components/atoms/common/ProcessingLoader/ProcessingLoader.css';
import Paragraph from '@/components/primitives/Paragraph';

interface ProcessingLoaderProps {
    message?: string;
    completionRate?: number;
    className?: string,
    isVisible: boolean;
    showProgress?: boolean;
}

const ProcessingLoader: React.FC<ProcessingLoaderProps> = ({
    message = 'Processing...',
    completionRate = 0,
    isVisible = true,
    className = '',
    showProgress = false
}) => {
    if(!isVisible) return null;

    return (
        <Container className={`d-flex items-center gap-075 processing-loader-container ${className}`}>
            <Container className="processing-loader-spinner f-shrink-0" />
            <Container className="d-flex column gap-035 flex-1 column">
                <Paragraph className="processing-loader-text overflow-hidden color-secondary">{message}</Paragraph>
                {showProgress && completionRate > 0 && (
                    <Container className="w-max overflow-hidden processing-loader-progress-bar">
                        <Container
                            className="processing-loader-progress-fill h-max"
                            style={{ width: `${Math.min(completionRate * 100, 100)}%` }}
                        />
                    </Container>
                )}
            </Container>
        </Container>
    );
};

export default ProcessingLoader;
