import React, { useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface TimestepSelectorProps {
    fileId: string;
    selectedTimestep?: number;
    onTimestepSelect: (timestep: number | undefined) => void;
}

export const TimestepSelector: React.FC<TimestepSelectorProps> = ({
    fileId,
    selectedTimestep,
    onTimestepSelect,
}) => {
    const { isConnected, connectionInfo, connectionError } = useWebSocket(fileId);

    if (!isConnected && !connectionError) {
        return <div className="loading">Conectando WebSocket...</div>;
    }
    
    if (connectionError) {
        return <div className="error">Error: {connectionError}</div>;
    }

    const timesteps = connectionInfo?.available_timesteps || [];

    return (
        <div className="timestep-selector">
            <h4>Seleccionar Timestep (WebSocket)</h4>
            <div className="connection-info">
                <p>📡 Conectado: {connectionInfo?.filename}</p>
                <p>📊 Total timesteps: {connectionInfo?.total_timesteps}</p>
            </div>
            
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
                            {timesteps.slice(0, 100).map((timestep: number) => (
                                <option key={timestep} value={timestep}>
                                    {timestep}
                                </option>
                            ))}
                        </select>
                        {timesteps.length > 100 && (
                            <small>Mostrando primeros 100 timesteps</small>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};