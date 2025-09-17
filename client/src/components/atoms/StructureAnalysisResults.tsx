import React from 'react';
import type { StructureAnalysis, StructureTypeStat } from '@/services/structure-analysis';

interface StructureAnalysisResultsProps {
  title?: string;
  structureAnalysis: StructureAnalysis;
  onStructureTypeSelect?: (type: StructureTypeStat) => void;
}

const StructureAnalysisResults: React.FC<StructureAnalysisResultsProps> = ({ 
  structureAnalysis, 
}) => {

  const formatNumber = (num: number, options?: Intl.NumberFormatOptions) => {
    if (typeof num !== 'number' || isNaN(num)) return 'N/A';
    return num.toLocaleString(undefined, options);
  };

  const getStructureTypeColor = (name: string = 'unknown'): string => {
    const structureColors: { [key: string]: string } = {
      'FCC': 'rgb(102, 255, 102)',
      'HCP': 'rgb(255, 102, 102)',
      'BCC': 'rgb(102, 102, 255)',
      'CUBIC_DIAMOND': 'rgb(19, 160, 254)',
      'CUBIC_DIAMOND_FIRST_NEIGH': 'rgb(0, 254, 245)',
      'CUBIC_DIAMOND_SECOND_NEIGH': 'rgb(126, 254, 181)',
      'HEX_DIAMOND_FIRST_NEIGH': 'rgb(254, 220, 0)',
      'HEX_DIAMOND_SECOND_NEIGH': 'rgb(204, 229, 81)',
      'HEX_DIAMOND': 'rgb(254, 137, 0)',
      'OTHER': 'rgb(242, 242, 242)'
    };

    const normalizedName = name.toUpperCase().replace(/ /g, '_');
    
    return structureColors[normalizedName] || structureColors['OTHER'];
  };

  const sortedTypes = [...structureAnalysis.types].sort((a, b) => b.count - a.count);

  return (
    <div className='structure-analysis-results-container'>
    <div className='structure-type-legend'>
        {sortedTypes.slice(0, 7).map((type) => (
        <div key={type.name} className='type-legend-item'>
            <div style={{ backgroundColor: getStructureTypeColor(type.name) }} className='type-legend-color' />
            <span className='type-legend-text'>
            {type.name} ({formatNumber(type.count)} - {type.percentage.toFixed(2)}%)
            </span>
        </div>
        ))}
    </div>
    </div>
  );
};

export default StructureAnalysisResults;
