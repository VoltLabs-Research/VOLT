// File: src/components/atoms/DislocationResults.tsx

import React from 'react';
import EditorWidget from '../organisms/EditorWidget';

interface DislocationData {
  segmentId: number;
  type: string;
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
  title?: string; // <- FIX: make title explicit
  dislocationData: DislocationAPIResponse;
  onDislocationSelect?: (segment: DislocationData) => void;
}

const DislocationResults: React.FC<DislocationResultsProps> = ({ 
  dislocationData, 
  onDislocationSelect,
  title = "Dislocations"
}) => {

  const formatNumber = (num: number, options?: Intl.NumberFormatOptions) => {
    if (typeof num !== 'number' || isNaN(num)) return 'N/A';
    return num.toLocaleString(undefined, options);
  };

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

  const toFraction = (decimal: number, tolerance = 1e-6): string => {
    if (Math.abs(decimal - Math.round(decimal)) < tolerance) return `${Math.round(decimal)}`;
    const sign = decimal < 0 ? '-' : '';
    const num = Math.abs(decimal);
    const commonDenominators = [2, 3, 4, 5, 6, 8, 10, 12, 16];
    for (const denominator of commonDenominators) {
      const numerator = Math.round(num * denominator);
      if (Math.abs(num - numerator / denominator) < tolerance) {
        const commonDivisor = gcd(numerator, denominator);
        return `${sign}${numerator / commonDivisor}/{${denominator / commonDivisor}}`.replace('/{', '/').replace('}', '');
      }
    }
    return decimal.toFixed(3);
  };

  const formatBurgersVectorAsFraction = (vector: number[] | undefined): string => {
    if (!vector || !Array.isArray(vector)) return '[N/A]';
    const fractions = vector.map(v => toFraction(v));
    return `<${fractions.join(' ')}>`;
  };

  const getDislocationTypeName = (type: string = 'unknown'): string =>
    type.charAt(0).toUpperCase() + type.slice(1);

  const getDislocationTypeColor = (type: string = 'unknown'): string => {
    switch(type.toLowerCase()){
      case 'edge': return '#3b82f6';
      case 'screw': return '#ef4444';
      case 'mixed': return '#8b5cf6';
      case 'loop': return '#10b981';
      default: return '#6b7280';
    }
  };

  const typeStats = dislocationData.dislocations.reduce((acc, dislocation) => {
    acc[dislocation.type] = (acc[dislocation.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <EditorWidget draggable={false} className='dislocation-results-container'>
      <div className='dislocation-results-header-container'>
        <h3 className='dislocation-results-header-title'>{title}</h3>
        <div className='dislocation-type-legend'>
          {Object.entries(typeStats).map(([type, count]) => (
            <div key={type} className='type-legend-item'>
              <div style={{ backgroundColor: getDislocationTypeColor(type) }} className='type-legend-color' />
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
              <div style={{ backgroundColor: getDislocationTypeColor(segment.type) }} className='dislocation-result-type' />
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
          <span className='dislocation-summary-value'>{dislocationData.totalSegments}</span>
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
