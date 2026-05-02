interface PointsCellProps {
    value: unknown;
}

const isPointArray = (input: unknown): input is number[][] => {
    if(!Array.isArray(input)) return false;
    for(const entry of input){
        if(!Array.isArray(entry)) return false;
        if(entry.length === 0) return false;
        for(const cell of entry){
            if(typeof cell !== 'number') return false;
        }
    }
    return true;
};

const PointsCell = ({ value }: PointsCellProps) => {
    if(!isPointArray(value)){
        return <span className='plugin-cell-empty'>-</span>;
    }

    if(value.length === 0){
        return <span className='plugin-cell-empty'>[]</span>;
    }

    const title = `${value.length} point${value.length === 1 ? '' : 's'}`;

    return (
        <span className='plugin-cell-points tabular-nums' title={title}>
            {value.length}
        </span>
    );
};

export default PointsCell;
