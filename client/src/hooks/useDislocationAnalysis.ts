import { useState, useCallback } from 'react';
import { analyzeTimestep, getDefaultConfig } from '../services/api';
import type { AnalysisConfig, AnalysisResult } from '../types/index';

interface UseDislocationAnalysisReturn {
    analysis: AnalysisResult | null;
    isAnalyzing: boolean;
    error: string | null;
    config: AnalysisConfig | null;
    analyzeCurrentTimestep: (fileId: string, timestep: number, customConfig?: Partial<AnalysisConfig>) => Promise<AnalysisResult | null>;
    loadDefaultConfig: () => Promise<void>;
    updateConfig: (newConfig: Partial<AnalysisConfig>) => void;
    clearAnalysis: () => void;
}

export const useDislocationAnalysis = (): UseDislocationAnalysisReturn => {
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [config, setConfig] = useState<AnalysisConfig | null>(null);

    const loadDefaultConfig = useCallback(async () => {
        try {
            const defaultConfig = await getDefaultConfig();
            setConfig(defaultConfig);
        } catch (err) {
            console.error('Error loading default config:', err);
            setError(err instanceof Error ? err.message : 'Error loading default config');
        }
    }, []);

    const updateConfig = useCallback((newConfig: Partial<AnalysisConfig>) => {
        setConfig(prev => prev ? { ...prev, ...newConfig } : null);
    }, []);

    const analyzeCurrentTimestep = useCallback(async (
        fileId: string, 
        timestep: number, 
        customConfig?: Partial<AnalysisConfig>
    ): Promise<AnalysisResult | null> => {
        if (!config && !customConfig) {
            setError('No configuration available. Please load default config first.');
            return null;
        }

        setIsAnalyzing(true);
        setError(null);

        try {
            const analysisConfig = customConfig ? { ...config, ...customConfig } : config!;
            
            const result = await analyzeTimestep(
                fileId, 
                timestep, 
                analysisConfig,
                (status) => {
                    console.log('Analysis status:', status);
                }
            );

            setAnalysis(result);
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
            setError(errorMessage);
            console.error('Analysis error:', err);
            return null;
        } finally {
            setIsAnalyzing(false);
        }
    }, [config]);

    const clearAnalysis = useCallback(() => {
        setAnalysis(null);
        setError(null);
    }, []);

    return {
        analysis,
        isAnalyzing,
        error,
        config,
        analyzeCurrentTimestep,
        loadDefaultConfig,
        updateConfig,
        clearAnalysis
    };
};

export default useDislocationAnalysis;
