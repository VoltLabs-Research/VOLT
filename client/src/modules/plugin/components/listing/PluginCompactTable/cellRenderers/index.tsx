import type { ReactNode } from 'react';
import type { InferredColumnType, InferredCellKind } from '@/modules/plugin/components/listing/PluginCompactTable/typeInference';
import { inferCellKind } from '@/modules/plugin/components/listing/PluginCompactTable/typeInference';
import BooleanCell from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers/BooleanCell';
import IntegerCell from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers/IntegerCell';
import NumberCell from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers/NumberCell';
import StringCell from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers/StringCell';
import DateCell from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers/DateCell';
import VectorCell from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers/VectorCell';
import NumberArrayCell from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers/NumberArrayCell';
import PointsCell from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers/PointsCell';
import MatrixCell from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers/MatrixCell';
import ObjectCell from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers/ObjectCell';
import FallbackCell from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers/FallbackCell';

export const renderInferredCell = (value: unknown, inferred?: InferredColumnType): ReactNode => {
    const columnKind = inferred?.kind;
    const shouldInferFromValue = !columnKind || columnKind === 'mixed' || columnKind === 'empty';
    const kind: InferredCellKind = shouldInferFromValue ? inferCellKind(value) : columnKind;

    switch(kind){
        case 'boolean':
            return <BooleanCell value={value} />;
        case 'integer':
            return <IntegerCell value={value} />;
        case 'number':
            return <NumberCell value={value} />;
        case 'string':
            return <StringCell value={value} />;
        case 'date':
            return <DateCell value={value} />;
        case 'vector':
            return <VectorCell value={value} />;
        case 'numberArray':
            return <NumberArrayCell value={value} />;
        case 'points':
            return <PointsCell value={value} />;
        case 'matrix':
            return <MatrixCell value={value} />;
        case 'object':
            return <ObjectCell value={value} />;
        case 'empty':
            return <span className='plugin-cell-empty'>-</span>;
        case 'mixed':
        default:
            return <FallbackCell value={value} />;
    }
};
