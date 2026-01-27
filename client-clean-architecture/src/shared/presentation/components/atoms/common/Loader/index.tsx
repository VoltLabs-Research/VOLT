import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoaderProps {
    scale?: number;
    className?: string;
}

const Loader: React.FC<LoaderProps> = ({ scale = 1, className = '' }) => {
    return (
        <div className={`d-flex items-center content-center ${className}`} style={{ transform: `scale(${scale})` }}>
            <Loader2 className="animate-spin" size={32} />
        </div>
    );
};

export default Loader;
