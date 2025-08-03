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

import React from 'react';
import EditorWidget from '../organisms/EditorWidget';

interface DislocationData {
    segmentId: number;
    type: string;
    pointIndexOffset: number;
    numPoints: number;
    length: number;
    points: number[][];
    burgers: {
        vector: number[];
        magnitude: number;
        fractional: string;
    };
    nodes?: {
        forward?: any;
        backward?: any;
    };
    lineDirection?: {
        vector: number[];
        string: string;
    };
}

interface DislocationAPIResponse {
    _id: string;
    trajectory: string;
    timestep: number;
    totalSegments: number;
    dislocations: DislocationData[];
    totalPoints: number;
    averageSegmentLength: number;
    maxSegmentLength: number;
    minSegmentLength: number;
    totalLength: number;
    createdAt: string;
    updatedAt: string;
    __v: number;
}

interface DislocationResultsProps {
    dislocationData: DislocationAPIResponse;
    onDislocationSelect?: (segment: DislocationData) => void;
}

const DislocationResults: React.FC<DislocationResultsProps> = ({ 
    dislocationData, 
    onDislocationSelect 
}) => {

    const formatNumber = (num: number, options?: Intl.NumberFormatOptions) => {
        if (typeof num !== 'number' || isNaN(num)) return 'N/A';
        return num.toLocaleString(undefined, options);
    };

    const gcd = (a: number, b: number): number => {
        return b === 0 ? a : gcd(b, a % b);
    };

    const toFraction = (decimal: number, tolerance = 1e-6): string => {
        if (Math.abs(decimal - Math.round(decimal)) < tolerance) {
            return `${Math.round(decimal)}`;
        }

        const sign = decimal < 0 ? '-' : '';
        const num = Math.abs(decimal);
        const commonDenominators = [2, 3, 4, 5, 6, 8, 10, 12, 16];
        
        for (const denominator of commonDenominators) {
            const numerator = Math.round(num * denominator);
            if (Math.abs(num - numerator / denominator) < tolerance) {
                const commonDivisor = gcd(numerator, denominator);
                return `${sign}${numerator / commonDivisor}/${denominator / commonDivisor}`;
            }
        }
        
        return decimal.toFixed(3);
    };

    const formatBurgersVectorAsFraction = (vector: number[] | undefined): string => {
        if (!vector || !Array.isArray(vector)) return '[N/A]';
        const fractions = vector.map(v => toFraction(v));
        return `<${fractions.join(' ')}>`;
    };

    const getDislocationTypeName = (type: string = 'unknown'): string => {
        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    const getDislocationTypeColor = (type: string = 'unknown'): string => {
        switch(type.toLowerCase()){
            case 'edge': return '#3b82f6';
            case 'screw': return '#ef4444';
            case 'mixed': return '#8b5cf6';
            case 'loop': return '#10b981';
            default: return '#6b7280';
        }
    };

    const getTypeStatistics = () => {
        const typeCount = dislocationData.dislocations.reduce((acc, dislocation) => {
            acc[dislocation.type] = (acc[dislocation.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return typeCount;
    };

    const typeStats = getTypeStatistics();
    
    return (
        <EditorWidget className='dislocation-results-container'>
            <div className='dislocation-results-header-container'>
                <h3 className='dislocation-results-header-title'>
                    Analysis for Timestep {dislocationData.timestep}
                </h3>
                <div className='dislocation-type-legend'>
                    {Object.entries(typeStats).map(([type, count]) => (
                        <div key={type} className='type-legend-item'>
                            <div 
                                style={{ backgroundColor: getDislocationTypeColor(type) }} 
                                className='type-legend-color'
                            />
                            <span className='type-legend-text'>
                                {getDislocationTypeName(type)} ({count})
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className='dislocation-results-body-container'>
                {dislocationData.dislocations.map((segment, index) => (
                    <div
                        key={`ts-${dislocationData.timestep}-seg-${segment.segmentId}-${index}`}
                        className='dislocation-result-item'
                        onClick={() => onDislocationSelect?.(segment)}
                    >   
                        <div className='dislocation-result-item-header-container'>
                            <div 
                                style={{ backgroundColor: getDislocationTypeColor(segment.type) }} 
                                className='dislocation-result-type'
                            />
                            <h4 className='dislocation-result-item-title'>
                                Segment #{segment.segmentId} ({getDislocationTypeName(segment.type)})
                            </h4>
                        </div>
                        
                        <div className='dislocation-result-data-container'>
                            <div className='dislocation-result-data'>
                                <span className='data-label'>Length:</span>
                                <span className='data-value'>
                                    {formatNumber(segment.length, { maximumFractionDigits: 2 })} Å
                                </span>
                            </div>
                            
                            <div className='dislocation-result-data'>
                                <span className='data-label'>Magnitude:</span>
                                <span className='data-value'>
                                    {formatNumber(segment.burgers?.magnitude, { maximumFractionDigits: 3 })}
                                </span>
                            </div>
                            
                            <div className='dislocation-result-data'>
                                <span className='data-label'>Burgers Vector:</span>
                                <span className='data-value vector-value'>
                                    {segment.burgers?.fractional || formatBurgersVectorAsFraction(segment.burgers?.vector)}
                                </span>
                            </div>

                            <div className='dislocation-result-data'>
                                <span className='data-label'>Points:</span>
                                <span className='data-value'>{segment.numPoints}</span>
                            </div>

                            {segment.lineDirection?.string && (
                                <div className='dislocation-result-data'>
                                    <span className='data-label'>Line Direction:</span>
                                    <span className='data-value vector-value'>
                                        {segment.lineDirection.string}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className='dislocation-results-summary-container'>
                <div className='dislocation-summary-item'>
                    <span className='dislocation-summary-value'>
                        {dislocationData.totalSegments}
                    </span>
                    <span className='dislocation-summary-label'>Segments</span>
                </div>
                
                <div className='dislocation-summary-item'>
                    <span className='dislocation-summary-value'>
                        {formatNumber(dislocationData.totalLength, { maximumFractionDigits: 1 })}
                    </span>
                    <span className='dislocation-summary-label'>Length (Å)</span>
                </div>
                
                <div className='dislocation-summary-item'>
                    <span className='dislocation-summary-value'>
                        {formatNumber(dislocationData.averageSegmentLength, { maximumFractionDigits: 2 })}
                    </span>
                    <span className='dislocation-summary-label'>Avg. Length (Å)</span>
                </div>
            </div>
        </EditorWidget>
    );
};

export default DislocationResults;