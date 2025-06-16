import React from 'react';
import type { DislocationResultsData, DislocationSegment } from '../hooks/useTimestepDataManager';
import EditorWidget from './organisms/EditorWidget';

interface DislocationResultsProps {
    results: DislocationResultsData;
    segments: DislocationSegment[];
    timestep: number;
    onDislocationSelect?: (segment: DislocationSegment) => void;
}

const DislocationResults: React.FC<DislocationResultsProps> = ({ 
    results, 
    segments,
    timestep,
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

    const formatVector = (vector: number[] | undefined): string => {
        if (!vector || !Array.isArray(vector)) return '[N/A]';
        return `[${vector.map(v => v.toFixed(3)).join(', ')}]`;
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
    
    return (
        <EditorWidget className='dislocation-results-container'>
            <div className='dislocation-results-header-container'>
                <h3 className='dislocation-results-header-title'>
                    Analysis for Timestep {timestep}
                </h3>
            </div>

            <div className='dislocation-results-body-container'>
                {segments.map((segment, index) => (
                    <div
                        key={segment.id || index}
                        className='dislocation-result-item'
                        onClick={() => onDislocationSelect?.(segment)}
                    >   
                        <div className='dislocation-result-item-header-container'>
                            <div style={{ backgroundColor: getDislocationTypeColor(segment.type) }} className='dislocation-result-type'></div>
                            <h4 className='dislocation-result-item-title'>
                                Dislocation #{index + 1} ({getDislocationTypeName(segment.type)})
                            </h4>
                        </div>
                        <div className='dislocation-result-data-container'>
                            <div className='dislocation-result-data'>
                                <span className='data-label'>Length:</span>
                                <span className='data-value'>{formatNumber(segment.length, { maximumFractionDigits: 2 })} Å</span>
                            </div>
                            <div className='dislocation-result-data'>
                                <span className='data-label'>Magitude:</span>
                                <span className='data-value'>{formatNumber(segment.burgers?.magnitude, { maximumFractionDigits: 3 })}</span>
                            </div>
                            <div className='dislocation-result-data'>
                                <span className='data-label'>Burgers Vector:</span>
                                <span className='data-value vector-value'>{formatBurgersVectorAsFraction(segment.burgers?.vector)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className='dislocation-results-summary-container'>
                <div className='dislocation-summary-item'>
                    <span className='dislocation-summary-value'>{results.total_dislocations}</span>
                    <span className='dislocation-summary-label'>Dislocs.</span>
                </div>
                <div className='dislocation-summary-item'>
                    <span className='dislocation-summary-value'>{formatNumber(results.total_length, { maximumFractionDigits: 1 })}</span>
                    <span className='dislocation-summary-label'>Total Length (Å)</span>
                </div>
                <div className='dislocation-summary-item'>
                    <span className='dislocation-summary-value'>{results.density.toExponential(2)}</span>
                    <span className='dislocation-summary-label'>Density (1/Å²)</span>
                </div>
            </div>
        </EditorWidget>
    );
};

export default DislocationResults;