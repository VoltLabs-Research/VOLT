import React from 'react';
import type { AnalysisResult, Dislocation } from '../types/index';

interface DislocationResultsProps {
    analysis: AnalysisResult;
    onDislocationSelect?: (dislocation: Dislocation) => void;
    selectedDislocationId?: string;
}

const DislocationResults: React.FC<DislocationResultsProps> = ({
    analysis,
    onDislocationSelect,
    selectedDislocationId
}) => {
    const formatBurgersVector = (vector: number[]): string => {
        return `[${vector.map(v => v.toFixed(3)).join(', ')}]`;
    };

    const formatLength = (length: number | undefined | null): string => {
        return (length !== null && length !== undefined && !isNaN(length)) ? length.toFixed(2) : 'N/A';
    };

    const getDislocationTypeName = (type: number | string): string => {
        if (typeof type === 'number') {
            switch (type) {
                case 0: return 'Edge';
                case 1: return 'Screw';
                case 2: return 'Mixed';
                default: return 'Unknown';
            }
        }
        return typeof type === 'string' ? type.charAt(0).toUpperCase() + type.slice(1) : 'Unknown';
    };

    const getDislocationTypeColor = (type: number | string): string => {
        // Convert numeric type to string for classification
        let typeStr: string;
        if (typeof type === 'number') {
            switch (type) {
                case 0: typeStr = 'edge'; break;
                case 1: typeStr = 'screw'; break;
                case 2: typeStr = 'mixed'; break;
                default: typeStr = 'unknown'; break;
            }
        } else {
            typeStr = type.toLowerCase();
        }

        switch (typeStr) {
            case 'edge': return '#3b82f6'; // blue
            case 'screw': return '#ef4444'; // red
            case 'mixed': return '#8b5cf6'; // purple
            case 'loop': return '#10b981'; // green
            default: return '#6b7280'; // gray
        }
    };

    if (!analysis.success) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">
                            Analysis Failed
                        </h3>
                        <div className="mt-2 text-sm text-red-700">
                            <p>{analysis.error || 'Unknown error occurred'}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Analysis Summary */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                    Analysis Results - Timestep {analysis.timestep}
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div className="flex flex-col">
                        <span className="text-gray-500">Dislocations Found</span>
                        <span className="font-semibold text-lg text-blue-600">
                            {analysis.dislocations.length}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-500">Execution Time</span>
                        <span className="font-semibold text-lg text-green-600">
                            {analysis.execution_time.toFixed(2)}s
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-500">Success</span>
                        <span className="font-semibold text-lg text-green-600">
                            ✓ Completed
                        </span>
                    </div>
                </div>
            </div>

            {/* Dislocations List */}
            {analysis.dislocations.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="px-4 py-3 border-b border-gray-200">
                        <h4 className="text-md font-medium text-gray-900">
                            Detected Dislocations
                        </h4>
                    </div>
                    
                    <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                        {analysis.dislocations.map((dislocation, index) => (
                            <div
                                key={dislocation.id || index}
                                className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                                    selectedDislocationId === dislocation.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                }`}
                                onClick={() => onDislocationSelect?.(dislocation)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: getDislocationTypeColor(dislocation.type) }}
                                            />
                                            <span className="text-sm font-medium text-gray-900">
                                                {getDislocationTypeName(dislocation.type)} Dislocation #{index + 1}
                                            </span>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                                            <div>
                                                <span className="font-medium">Length:</span> {formatLength(dislocation.length)} Å
                                            </div>
                                            <div>
                                                <span className="font-medium">Core atoms:</span> {dislocation.core_atoms?.length || 0}
                                            </div>
                                            <div className="sm:col-span-2">
                                                <span className="font-medium">Burgers vector:</span> {formatBurgersVector(dislocation.burgers_vector)}
                                            </div>
                                            {dislocation.segment_count && (
                                                <div>
                                                    <span className="font-medium">Segments:</span> {dislocation.segment_count}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="ml-4 flex-shrink-0">
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">
                                No Dislocations Found
                            </h3>
                            <div className="mt-2 text-sm text-yellow-700">
                                <p>No dislocations were detected in this timestep. This could be normal depending on your material and simulation conditions.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Analysis Metadata */}
            {Object.keys(analysis.analysis_metadata).length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Analysis Metadata</h4>
                    <div className="text-xs text-gray-600 space-y-1">
                        {Object.entries(analysis.analysis_metadata).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                                <span className="font-medium">{key}:</span>
                                <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DislocationResults;
