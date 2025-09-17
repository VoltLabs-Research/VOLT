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
import StructureAnalysisResultsSkeleton from '@/components/atoms/StructureAnalysisResultsSkeleton';
import StructureAnalysisResults from '@/components/atoms/StructureAnalysisResults';
import { useStructureAnalysisStore } from '@/stores/structure-analysis';
import { useEffect, useMemo } from 'react';

interface StructureAnalysisPanelProps {
    configId?: string;
    timestep: number;
    show?: boolean;
}

const StructureAnalysisPanel: React.FC<StructureAnalysisPanelProps> = ({ 
    configId,
    timestep, 
    show = true 
}) => {
    const { 
        structureAnalysesByConfig,
        loading,
        fetchStructureAnalysesByConfig
    } = useStructureAnalysisStore();
    
    // Cargamos los datos solo si no los tenemos ya
    useEffect(() => {
        if (!show || !configId || structureAnalysesByConfig[configId]) return;
        
        // Cargar todos los análisis para este configId
        fetchStructureAnalysesByConfig(configId);
    }, [
        configId, 
        fetchStructureAnalysesByConfig, 
        show,
        structureAnalysesByConfig
    ]);
    
    const currentAnalysis = useMemo(() => {
        if (!configId || !structureAnalysesByConfig[configId]) return null;
        
        return structureAnalysesByConfig[configId].find(
            analysis => analysis.timestep === timestep
        );
    }, [structureAnalysesByConfig, configId, timestep]);

    // Solo mostrar el esqueleto de carga si no tenemos análisis y estamos cargando
    const isLoading = loading && !currentAnalysis;

    if (!show) return null;

    return (
        <>
            {isLoading ? (
                <StructureAnalysisResultsSkeleton />
            ) : (
                currentAnalysis && <StructureAnalysisResults 
                    structureAnalysis={currentAnalysis} 
                />
            )}
        </>
    );
};

export default StructureAnalysisPanel;
