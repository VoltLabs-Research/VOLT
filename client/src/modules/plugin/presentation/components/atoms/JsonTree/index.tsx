import { useState, useCallback } from 'react';
import Container from '@/shared/presentation/components/Container';
import { ChevronRight, ChevronDown } from 'lucide-react';
import './JsonTree.css';

interface JsonTreeProps {
    data: any;
    label?: string;
    depth?: number;
    defaultExpanded?: boolean;
};

const JsonTree = ({ data, label, depth = 0, defaultExpanded = true }: JsonTreeProps) => {
    const [expanded, setExpanded] = useState(defaultExpanded && depth < 2);

    const toggle = useCallback(() => setExpanded((prev) => !prev), []);

    if (data === null || data === undefined) {
        return (
            <Container className='d-flex flex-wrap items-start'>
                {label && <span className='json-tree-key'>{label}: </span>}
                <span className='json-tree-null'>null</span>
            </Container>
        );
    }

    if (typeof data === 'string') {
        return (
            <Container className='d-flex flex-wrap items-start'>
                {label && <span className='json-tree-key'>{label}: </span>}
                <span className='json-tree-string'>"{data.length > 200 ? data.slice(0, 200) + '...' : data}"</span>
            </Container>
        );
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
        return (
            <Container className='d-flex flex-wrap items-start'>
                {label && <span className='json-tree-key'>{label}: </span>}
                <span className='json-tree-primitive'>{String(data)}</span>
            </Container>
        );
    }

    if (data._truncated) {
        return (
            <Container className='d-flex flex-wrap items-start'>
                {label && (
                    <span className='json-tree-key cursor-pointer' onClick={toggle}>
                        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {label}
                    </span>
                )}
                <span className='json-tree-meta'> Array({data.totalLength}) [truncated]</span>
                {expanded && data.preview && (
                    <Container className='json-tree-children w-max'>
                        {data.preview.map((item: any, i: number) => (
                            <JsonTree key={i} data={item} label={String(i)} depth={depth + 1} defaultExpanded={false} />
                        ))}
                    </Container>
                )}
            </Container>
        );
    }

    if (Array.isArray(data)) {
        return (
            <Container className='d-flex flex-wrap items-start'>
                <span className='json-tree-key cursor-pointer' onClick={toggle}>
                    {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {label ? `${label}: ` : ''}
                    <span className='json-tree-meta'>Array({data.length})</span>
                </span>
                {expanded && (
                    <Container className='json-tree-children w-max'>
                        {data.map((item, i) => (
                            <JsonTree key={i} data={item} label={String(i)} depth={depth + 1} defaultExpanded={false} />
                        ))}
                    </Container>
                )}
            </Container>
        );
    }

    if (typeof data === 'object') {
        const keys = Object.keys(data);
        return (
            <Container className='d-flex flex-wrap items-start'>
                <span className='json-tree-key cursor-pointer' onClick={toggle}>
                    {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {label ? `${label}: ` : ''}
                    <span className='json-tree-meta'>{`{${keys.length}}`}</span>
                </span>
                {expanded && (
                    <Container className='json-tree-children w-max'>
                        {keys.map((key) => (
                            <JsonTree key={key} data={data[key]} label={key} depth={depth + 1} defaultExpanded={depth < 1} />
                        ))}
                    </Container>
                )}
            </Container>
        );
    }

    return (
        <Container className='d-flex flex-wrap items-start'>
            {label && <span className='json-tree-key'>{label}: </span>}
            <span className='json-tree-primitive'>{String(data)}</span>
        </Container>
    );
};

export default JsonTree;
