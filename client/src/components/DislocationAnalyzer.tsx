import React, { useState, useEffect } from 'react';
import DislocationResults from './DislocationResults';
import type { FileInfo, Dislocation } from '../types/index';
import EditorWidget from './EditorWidget';
import Loader from './Loader';
import { LiaAtomSolid } from "react-icons/lia";

interface DislocationAnalyzerProps {
    selectedFile: FileInfo;
    currentTimestep: number;
    showDislocationAnalysis: boolean;
    onDislocationVisualize?: (dislocation: Dislocation) => void;
    isAnalyzing: boolean;
    analysis: AnalysisResult | null;
    onClearAnalysis: () => void;
    onLoadDefaultConfig: () => Promise<void>;
}

const DislocationAnalyzer: React.FC<DislocationAnalyzerProps> = ({ 
    currentTimestep, 
    onDislocationVisualize,
    isAnalyzing,
    analysis,
    onClearAnalysis,
    onLoadDefaultConfig
}) => {
    const [selectedDislocation, setSelectedDislocation] = useState<string | undefined>();
    
    useEffect(() => {
        onLoadDefaultConfig();
    }, [onLoadDefaultConfig]);

    useEffect(() => {
        onClearAnalysis();
        setSelectedDislocation(undefined);
    }, [currentTimestep, onClearAnalysis]);

    const handleDislocationSelect = (dislocation: Dislocation) => {
        setSelectedDislocation(dislocation.id);
        onDislocationVisualize?.(dislocation);
    };
    
    return (
        <EditorWidget className='editor-dislocations-container'>
            <div className='editor-floating-header-container'>
                <h3 className='editor-floating-header-title'>Dislocations</h3>
                <LiaAtomSolid className='editor-floating-header-icon' />
            </div>
            {(isAnalyzing) ? (
                <div className='editor-floating-body-loader-container'>
                    <Loader scale={0.45} />
                </div>    
            ) : (
                !analysis?.dislocations ? (
                    <div className='editor-dislocations-not-ready-container'>
                        <p className='editor-dislocations-not-ready'>Run the analysis to see the dislocations</p>
                    </div>   
                ) : (
                    <div className='editor-floating-body-container'>
                        <DislocationResults
                            analysis={analysis}
                            onDislocationSelect={handleDislocationSelect}
                            selectedDislocationId={selectedDislocation}
                        />
                    </div>
                )
            )}
        </EditorWidget>
    );
};

export default DislocationAnalyzer;
