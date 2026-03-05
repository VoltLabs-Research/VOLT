import usePluginListingStore from '@/modules/plugin/presentation/stores/use-plugin-listing-store';
import type { ColumnConfig } from '@/modules/plugin/presentation/components/organisms/PluginCompactTable';
import Modal from '@/shared/presentation/components/Modal';
import { SUB_LISTING_MODAL_ID } from '../../../hooks/use-plugin-listing';
import formatSnakeCaseToTitle from '@/modules/plugin/presentation/utils/format-snake-case';

type SubListingRow = Record<string, unknown> & { _rowIndex: number };

const SubListingModal: React.FC = () => {
    const subListingData = usePluginListingStore((s) => s.subListingData);
    const isLoading = usePluginListingStore((s) => s.isSubListingLoading);

    const title = subListingData
        ? formatSnakeCaseToTitle(subListingData.subListingName)
        : 'Sub-Listing';

    const columns: ColumnConfig[] = (subListingData?.columns || []).map((column) => ({
        key: column.label,
        title: formatSnakeCaseToTitle(column.label),
        sortable: column.sortable
    }));

    const rows: SubListingRow[] = (subListingData?.rows || []).map((row, index) => ({
        ...row,
        _rowIndex: index
    }));

    return (
        <Modal
            id={SUB_LISTING_MODAL_ID}
            title={title}
            size="large"
        >
            {isLoading && <div className="plugin-exposure-loading">Loading...</div>}

            {!isLoading && rows.length === 0 && (
                <div className="plugin-exposure-empty">No data available</div>
            )}

            {!isLoading && rows.length > 0 && (
                <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        style={{
                                            padding: '0.5rem',
                                            textAlign: 'left',
                                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                                            fontSize: '0.85rem',
                                            fontWeight: 600
                                        }}
                                    >
                                        {col.title}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row._rowIndex}>
                                    {columns.map((col) => (
                                        <td
                                            key={col.key}
                                            style={{
                                                padding: '0.4rem 0.5rem',
                                                fontSize: '0.8rem',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)'
                                            }}
                                        >
                                            {String(row[col.key ?? ''] ?? '')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Modal>
    );
};

export default SubListingModal;
