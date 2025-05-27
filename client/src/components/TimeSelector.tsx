import React, { useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { getTimesteps } from '../services/api';

interface TimestepSelectorProps {
    filename: string;
    selectedTimestep?: number;
    onTimestepSelect: (timestep: number | undefined) => void;
}

export const TimestepSelector: React.FC<TimestepSelectorProps> = ({
    filename,
    selectedTimestep,
    onTimestepSelect,
}) => {
    const { data: timestepsData, loading, error, execute } = useApi<{ timesteps: number[] }>();

    useEffect(() => {
        if(filename){
            execute(() => getTimesteps(filename));
        }
    }, [filename, execute]);

    if(loading) return <div className="loading">Cargando timesteps...</div>;
    if(error) return <div className="error">Error: {error}</div>;

    const timesteps = timestepsData?.timesteps || [];

    return (
        <div className="timestep-selector">
        <h4>Seleccionar Timestep</h4>
        <div className="timestep-options">
            <label>
            <input
                type="radio"
                name="timestep"
                checked={selectedTimestep === undefined}
                onChange={() => onTimestepSelect(undefined)}
            />
            Primer timestep disponible
            </label>
            
            {timesteps.length > 0 && (
            <div className="timestep-list">
                <label>Timestep específico:</label>
                <select
                value={selectedTimestep || ''}
                onChange={(e) => onTimestepSelect(e.target.value ? parseInt(e.target.value) : undefined)}
                >
                <option value="">Seleccionar...</option>
                {timesteps.map((timestep) => (
                    <option key={timestep} value={timestep}>
                    {timestep}
                    </option>
                ))}
                </select>
            </div>
            )}
        </div>
        
        <div className="timestep-info">
            <p>Total de timesteps disponibles: {timesteps.length}</p>
            {timesteps.length > 0 && (
            <p>Rango: {Math.min(...timesteps)} - {Math.max(...timesteps)}</p>
            )}
        </div>
        </div>
    );
};