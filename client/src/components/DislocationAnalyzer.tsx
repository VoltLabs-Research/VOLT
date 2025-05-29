import React, { useState, useEffect } from 'react';
import DislocationResults from './DislocationResults';
import useDislocationAnalysis from '../hooks/useDislocationAnalysis';
import type { FileInfo, Dislocation } from '../types/index';

interface DislocationAnalyzerProps {
    selectedFile: FileInfo;
    currentTimestep: number;
    onDislocationVisualize?: (dislocation: Dislocation) => void;
}

const DislocationAnalyzer: React.FC<DislocationAnalyzerProps> = ({
    selectedFile,
    currentTimestep,
    onDislocationVisualize
}) => {
    const [showConfig, setShowConfig] = useState(false);
    const [selectedDislocation, setSelectedDislocation] = useState<string | undefined>();
    
    const {
        analysis,
        isAnalyzing,
        error,
        config,
        analyzeCurrentTimestep,
        loadDefaultConfig,
        clearAnalysis
    } = useDislocationAnalysis();

    // Load default config on mount
    useEffect(() => {
        loadDefaultConfig();
    }, [loadDefaultConfig]);

    // Clear analysis when timestep changes
    useEffect(() => {
        clearAnalysis();
        setSelectedDislocation(undefined);
    }, [currentTimestep, clearAnalysis]);

    const handleAnalyze = async () => {
        if (!selectedFile || !config) return;
        
        await analyzeCurrentTimestep(selectedFile.file_id, currentTimestep);
    };

    const handleDislocationSelect = (dislocation: Dislocation) => {
        setSelectedDislocation(dislocation.id);
        onDislocationVisualize?.(dislocation);
    };

    return (
        <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Dislocation Analysis
                        </h2>
                        <p className="text-sm text-gray-600">
                            File: {selectedFile.filename} | Timestep: {currentTimestep}
                        </p>
                    </div>
                    
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setShowConfig(!showConfig)}
                            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            {showConfig ? 'Hide Config' : 'Show Config'}
                        </button>
                        
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || !config}
                            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                                isAnalyzing || !config
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {isAnalyzing ? (
                                <div className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Analyzing...
                                </div>
                            ) : (
                                'Analyze Dislocations'
                            )}
                        </button>
                    </div>
                </div>

                {/* Configuration status */}
                {showConfig && config && (
                    <div className="border-t border-gray-200 pt-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Current Configuration</h4>
                            <div className="text-xs text-gray-600 space-y-1">
                                <div>Cutoff: {config.cutoff}</div>
                                <div>Neighbors: {config.num_neighbors}</div>
                                <div>Crystal Type: {config.crystal_type}</div>
                                <div>Lattice Parameter: {config.lattice_parameter}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Error</h3>
                            <div className="mt-2 text-sm text-red-700">
                                <p>{error}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Analysis Progress */}
            {isAnalyzing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-blue-800">
                                Analyzing Timestep {currentTimestep}
                            </h3>
                            <div className="mt-2 text-sm text-blue-700">
                                <p>Running dislocation extraction algorithm...</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Analysis Results */}
            {analysis && !isAnalyzing && (
                <DislocationResults
                    analysis={analysis}
                    onDislocationSelect={handleDislocationSelect}
                    selectedDislocationId={selectedDislocation}
                />
            )}

            {/* Instructions */}
            {!analysis && !isAnalyzing && !error && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Ready to Analyze</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Click "Analyze Dislocations" to detect dislocations in the current timestep.
                        </p>
                        <div className="mt-2 text-xs text-gray-400">
                            You can adjust the analysis parameters by clicking "Show Config" if needed.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DislocationAnalyzer;
