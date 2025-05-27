import React from 'react';
import type { AnalysisConfig } from '../types/index';

interface AnalysisConfigProps{
    config: AnalysisConfig;
    onChange: (config: AnalysisConfig) => void;
}

export const AnalysisConfigComponent: React.FC<AnalysisConfigProps> = ({ 
    config, 
    onChange 
}) => {
    const handleChange = (key: keyof AnalysisConfig, value: any) => {
        onChange({
            ...config,
            [key]: value,
        });
    };

    return (
        <div className="analysis-config">
        <h3>Configuración de Análisis</h3>
        
        <div className="config-section">
            <h4>Parámetros Básicos</h4>
            
            <div className="config-group">
            <label>
                Cutoff Distance:
                <input
                type="number"
                step="0.1"
                value={config.cutoff}
                onChange={(e) => handleChange('cutoff', parseFloat(e.target.value))}
                />
            </label>
            
            <label>
                Número de Vecinos:
                <input
                type="number"
                value={config.num_neighbors}
                onChange={(e) => handleChange('num_neighbors', parseInt(e.target.value))}
                />
            </label>
            
            <label>
                Tipo de Cristal:
                <select
                value={config.crystal_type}
                onChange={(e) => handleChange('crystal_type', e.target.value)}
                >
                <option value="fcc">FCC</option>
                <option value="bcc">BCC</option>
                <option value="hcp">HCP</option>
                <option value="auto">Auto</option>
                </select>
            </label>
            
            <label>
                Parámetro de Red (Å):
                <input
                type="number"
                step="0.1"
                value={config.lattice_parameter}
                onChange={(e) => handleChange('lattice_parameter', parseFloat(e.target.value))}
                />
            </label>
            </div>
        </div>

        <div className="config-section">
            <h4>Detección de Circuitos</h4>
            
            <div className="config-group">
            <label>
                Longitud Máxima de Loop:
                <input
                type="number"
                value={config.max_loop_length}
                onChange={(e) => handleChange('max_loop_length', parseInt(e.target.value))}
                />
            </label>
            
            <label>
                Umbral de Burgers:
                <input
                type="number"
                step="1e-5"
                value={config.burgers_threshold}
                onChange={(e) => handleChange('burgers_threshold', parseFloat(e.target.value))}
                />
            </label>
            
            <label>
                Tolerancia:
                <input
                type="number"
                step="0.01"
                value={config.tolerance}
                onChange={(e) => handleChange('tolerance', parseFloat(e.target.value))}
                />
            </label>
            </div>
        </div>

        <div className="config-section">
            <h4>Opciones Avanzadas</h4>
            
            <div className="config-group">
            <label className="checkbox-label">
                <input
                type="checkbox"
                checked={config.fast_mode}
                onChange={(e) => handleChange('fast_mode', e.target.checked)}
                />
                Modo Rápido
            </label>
            
            <label className="checkbox-label">
                <input
                type="checkbox"
                checked={config.allow_non_standard_burgers}
                onChange={(e) => handleChange('allow_non_standard_burgers', e.target.checked)}
                />
                Permitir Vectores de Burgers No Estándar
            </label>
            
            <label className="checkbox-label">
                <input
                type="checkbox"
                checked={config.include_segments}
                onChange={(e) => handleChange('include_segments', e.target.checked)}
                />
                Incluir Segmentos
            </label>
            </div>
        </div>
        </div>
    );
};