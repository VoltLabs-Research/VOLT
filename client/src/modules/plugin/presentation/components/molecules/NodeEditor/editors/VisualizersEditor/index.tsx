import { useEffect, useMemo, useRef, useState } from 'react';
import { TbPlus, TbTrash } from 'react-icons/tb';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { useNodeForm } from '@/modules/plugin/presentation/hooks';
import { NodeType, type IVisualizersData } from '@/modules/plugin/domain/entities';
import usePluginBuilderStore from '@/modules/plugin/presentation/stores/use-plugin-builder-store';
import type { EditorProps } from '../types';

interface ListingRow {
    id: string;
    path: string;
    label: string;
}

const DEFAULT_VISUALIZERS_DATA: IVisualizersData = {
    canvas: false,
    raster: false,
    listingTitle: '',
    listing: {},
    perAtomProperties: []
};

const normalizePerAtomProperties = (properties: string[]): string[] => {
    const unique = new Set<string>();
    for(const value of properties){
        const trimmed = value.trim();
        if(trimmed){
            unique.add(trimmed);
        }
    }
    return Array.from(unique);
};

const buildListingRecord = (rows: ListingRow[]): Record<string, string> => {
    return rows.reduce<Record<string, string>>((acc, row) => {
        const path = row.path.trim();
        if(!path) return acc;
        const label = row.label.trim();
        acc[path] = label || path;
        return acc;
    }, {});
};

const areListingRecordsEqual = (
    left?: Record<string, string>,
    right?: Record<string, string>
): boolean => {
    const leftEntries = Object.entries(left ?? {});
    const rightEntries = Object.entries(right ?? {});
    if(leftEntries.length !== rightEntries.length) return false;

    return leftEntries.every(([path, label]) => right?.[path] === label);
};

const areStringArraysEqual = (left: string[] = [], right: string[] = []): boolean => {
    if(left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
};

const collectSchemaPaths = (value: unknown, prefix = ''): string[] => {
    if(value === null || value === undefined) return [];
    if(typeof value !== 'object' || Array.isArray(value)) {
        return prefix ? [prefix] : [];
    }

    const entries = Object.entries(value as Record<string, unknown>);
    if(entries.length === 0) return prefix ? [prefix] : [];

    const paths = entries.flatMap(([key, child]) => {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        return collectSchemaPaths(child, nextPrefix);
    });

    return Array.from(new Set(paths));
};

const findSchemaNodeForVisualizer = (
    visualizerNodeId: string,
    nodes: Array<{ id: string; type?: string; data?: Record<string, unknown> }>,
    edges: Array<{ source: string; target: string }>
) => {
    const nodeById = new Map(nodes.map((item) => [item.id, item]));
    const parentIds = edges
        .filter((edge) => edge.target === visualizerNodeId)
        .map((edge) => edge.source);

    for(const parentId of parentIds){
        const parent = nodeById.get(parentId);
        if(parent?.type === NodeType.SCHEMA){
            return parent;
        }
    }

    const exposureParent = parentIds
        .map((id) => nodeById.get(id))
        .find((node) => node?.type === NodeType.EXPOSURE);

    if(exposureParent){
        const visited = new Set<string>();
        const queue = [exposureParent.id];

        while(queue.length > 0){
            const current = queue.shift()!;
            if(visited.has(current)) continue;
            visited.add(current);

            const outgoing = edges.filter((edge) => edge.source === current);
            for(const edge of outgoing){
                const child = nodeById.get(edge.target);
                if(!child) continue;
                if(child.type === NodeType.SCHEMA){
                    return child;
                }
                queue.push(child.id);
            }
        }
    }

    return nodes.find((node) => node.type === NodeType.SCHEMA);
};

const getPerAtomPropertySuggestions = (schemaDefinition: unknown): string[] => {
    if(!schemaDefinition || typeof schemaDefinition !== 'object' || Array.isArray(schemaDefinition)){
        return [];
    }

    const dataNode = (schemaDefinition as Record<string, unknown>).data;
    if(!dataNode || typeof dataNode !== 'object' || Array.isArray(dataNode)){
        return [];
    }

    const itemsNode = (dataNode as Record<string, unknown>).items;
    if(!itemsNode || typeof itemsNode !== 'object' || Array.isArray(itemsNode)){
        return [];
    }

    return Object.keys(itemsNode as Record<string, unknown>);
};

const VisualizersEditor = ({ node }: EditorProps) => {
    const storeNodes = usePluginBuilderStore((state) => state.nodes);
    const storeEdges = usePluginBuilderStore((state) => state.edges);
    const { field, values, setValue } = useNodeForm<IVisualizersData>(
        node,
        'visualizers',
        DEFAULT_VISUALIZERS_DATA
    );
    const rowCounterRef = useRef(0);

    const nextRowId = () => {
        rowCounterRef.current += 1;
        return `listing-row-${rowCounterRef.current}`;
    };

    const toListingRows = (listing?: Record<string, string>): ListingRow[] => {
        return Object.entries(listing ?? {}).map(([path, label]) => ({
            id: nextRowId(),
            path,
            label: String(label)
        }));
    };

    const [listingRows, setListingRows] = useState<ListingRow[]>(() => toListingRows(values.listing));
    const [perAtomPropertyInputs, setPerAtomPropertyInputs] = useState<string[]>(() => values.perAtomProperties ?? []);

    const schemaNode = useMemo(() => {
        return findSchemaNodeForVisualizer(node.id, storeNodes as any, storeEdges as any);
    }, [node.id, storeNodes, storeEdges]);

    const schemaDefinition = useMemo(() => {
        return (schemaNode?.data as any)?.schema?.definition;
    }, [schemaNode]);

    const listingPathSuggestions = useMemo(() => {
        if(!schemaNode?.id || !schemaDefinition) return [];
        const paths = collectSchemaPaths(schemaDefinition);
        return paths.map((path) => `{{ ${schemaNode.id}.definition.${path} }}`);
    }, [schemaNode?.id, schemaDefinition]);

    const perAtomPropertySuggestions = useMemo(() => {
        return getPerAtomPropertySuggestions(schemaDefinition);
    }, [schemaDefinition]);

    useEffect(() => {
        setListingRows(toListingRows(values.listing));
        setPerAtomPropertyInputs(values.perAtomProperties ?? []);
    }, [node.id]);

    useEffect(() => {
        const nextListing = buildListingRecord(listingRows);
        if(!areListingRecordsEqual(values.listing, nextListing)){
            setValue('listing', nextListing);
        }
    }, [listingRows, setValue, values.listing]);

    useEffect(() => {
        const normalized = normalizePerAtomProperties(perAtomPropertyInputs);
        if(!areStringArraysEqual(values.perAtomProperties, normalized)){
            setValue('perAtomProperties', normalized);
        }
    }, [perAtomPropertyInputs, setValue, values.perAtomProperties]);

    const addListingRow = () => {
        setListingRows((prev) => [...prev, { id: nextRowId(), path: '', label: '' }]);
    };

    const updateListingRow = (id: string, key: 'path' | 'label', value: string) => {
        setListingRows((prev) => prev.map((row) => {
            if(row.id !== id) return row;
            return { ...row, [key]: value };
        }));
    };

    const removeListingRow = (id: string) => {
        setListingRows((prev) => prev.filter((row) => row.id !== id));
    };

    const addPerAtomProperty = () => {
        setPerAtomPropertyInputs((prev) => [...prev, '']);
    };

    const updatePerAtomProperty = (index: number, value: string) => {
        setPerAtomPropertyInputs((prev) => prev.map((item, idx) => idx === index ? value : item));
    };

    const removePerAtomProperty = (index: number) => {
        setPerAtomPropertyInputs((prev) => prev.filter((_, idx) => idx !== index));
    };

    return (
        <>
            <CollapsibleSection title='Visualization Options' defaultExpanded>
                <FormField
                    variant='inline'
                    label='Enable Canvas (3D Viewer)'
                    fieldType='checkbox'
                    {...field('canvas')}
                />
                <FormField
                    variant='inline'
                    label='Enable Raster (2D Images)'
                    fieldType='checkbox'
                    {...field('raster')}
                />
            </CollapsibleSection>

            <CollapsibleSection title='Listing Title'>
                <FormField
                    variant='inline'
                    label='Title'
                    fieldType='input'
                    {...field('listingTitle')}
                    placeholder='Results Table'
                />
            </CollapsibleSection>

            <CollapsibleSection title='Listing Columns'>
                <Container className='d-flex column gap-075'>
                    {listingRows.map((row) => (
                        <Container key={row.id} className='d-flex items-center gap-075'>
                            <Container className='d-flex column content-between gap-1 items-center flex-1'>
                                <Container className='w-max'>
                                    <FormField
                                        variant='inline'
                                        fieldType='input'
                                        name={`listing-path-${row.id}`}
                                        value={row.path}
                                        onChange={(e) => updateListingRow(row.id, 'path', e.target.value)}
                                        placeholder='{{ schema-xxxx.definition.value }}'
                                        autocomplete={{ options: listingPathSuggestions }}
                                    />
                                </Container>
                                <Container className='w-max'>
                                    <FormField
                                        variant='inline'
                                        fieldType='input'
                                        value={row.label}
                                        onChange={(e) => updateListingRow(row.id, 'label', e.target.value)}
                                        placeholder='Column Label'
                                    />
                                </Container>
                            </Container>
                            <Button
                                variant='ghost'
                                intent='danger'
                                size='sm'
                                iconOnly
                                onClick={() => removeListingRow(row.id)}
                            >
                                <TbTrash size={16} />
                            </Button>
                        </Container>
                    ))}

                    <Button
                        variant='outline'
                        intent='neutral'
                        size='sm'
                        leftIcon={<TbPlus size={14} />}
                        onClick={addListingRow}
                    >
                        Add Listing Column
                    </Button>
                </Container>
            </CollapsibleSection>

            <CollapsibleSection title='Per-Atom Properties'>
                <Container className='d-flex column gap-075'>
                    {perAtomPropertyInputs.map((property, index) => (
                        <Container key={`per-atom-property-${index}`} className='d-flex items-center gap-075'>
                            <Container className='flex-1'>
                                <FormField
                                    variant='inline'
                                    label='Property'
                                    fieldType='input'
                                    name={`per-atom-property-${index}`}
                                    value={property}
                                    onChange={(e) => updatePerAtomProperty(index, e.target.value)}
                                    placeholder='energy'
                                    suggestions={perAtomPropertySuggestions}
                                />
                            </Container>
                            <Button
                                variant='ghost'
                                intent='danger'
                                size='sm'
                                iconOnly
                                onClick={() => removePerAtomProperty(index)}
                            >
                                <TbTrash size={16} />
                            </Button>
                        </Container>
                    ))}

                    <Button
                        variant='outline'
                        intent='neutral'
                        size='sm'
                        leftIcon={<TbPlus size={14} />}
                        onClick={addPerAtomProperty}
                    >
                        Add Per-Atom Property
                    </Button>
                </Container>
            </CollapsibleSection>
        </>
    );
};

export default VisualizersEditor;
