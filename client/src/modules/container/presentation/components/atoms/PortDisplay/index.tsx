import type { PortMapping } from '@/modules/container/domain/entities';

interface PortDisplayProps {
    ports: PortMapping[];
};

const PortDisplay = ({ ports }: PortDisplayProps) => {
    const port = ports[0];
    if(!port){
        return <span className='font-size-2 color-muted'>-</span>;
    }
    return <span className='font-size-2 font-weight-5'>{port.private} → {port.public}</span>;
};

export default PortDisplay;
