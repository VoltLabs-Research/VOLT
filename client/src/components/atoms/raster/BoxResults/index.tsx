import EditorWidget from '@/components/organisms/scene/EditorWidget';
import type { RasterConfig } from '@/types/stores/plugins';
import './BoxResults.css';

export interface BoxResultsProps{
    data: any;
    config: RasterConfig;
    onItemSelect?: (item: any) => void;
};

const formatValue = (value: any, format?: string, decimals: number = 2): string => {
    if(value === undefined || value === null || (typeof value === 'number' && isNaN(value))){
        return 'N/A';
    }

    switch(format){
        case 'number':
            return typeof value === 'number' ? value.toLocaleString() : String(value);
        case 'decimal':
            return typeof value === 'number' ? value.toFixed(decimals) : String(value);
        case 'percentage':
            return typeof value === 'number' ? `${(value * 100).toFixed(decimals)}%` : String(value);
        case 'bytes':
            if(typeof value !== 'number') return String(value);
            const units = ['B', 'KB', 'MB', 'GB'];
            let size = value;
            let unitIndex = 0;
            while(size >= 1024 && unitIndex < units.length - 1){
                size /= 1024;
                unitIndex++;
            }
            return `${size.toFixed(decimals)} ${units[unitIndex]}`;
        default:
            return String(value);
    }
};

const getValueByPath = (obj: any, path: string): any => {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
};

const BoxResults = ({ data, config, onItemSelect }: BoxResultsProps) => {
    return(
        <EditorWidget draggable={false} className='box-results-container'>
            <div className='box-results-header-container'>
                <h3 className='box-results-header-title'>{config.title}</h3>
            </div>

            <div className='box-results-body-container'>
                {data.map((item: any, index: number) => (
                    <div
                        key={index}
                        className='box-result-item'
                        onClick={() => onItemSelect?.(item)}
                    >
                        <div className='box-result-data-container'>
                            {config.metrics?.map((metric) => {
                                const value = getValueByPath(item, metric.key);
                                const formattedValue = formatValue(value, metric.format, metric.decimals);
                                return(
                                    <div key={metric.key} className={`box-result-data ${metric.as_record_title ? 'as-record-title' : ''}`}>
                                        <div className='box-result-data-content'>
                                            <span className='data-label'>{metric.label}</span>
                                            <span className='data-value'>
                                                {formattedValue}
                                                {metric.unit && ` ${metric.unit}`}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </EditorWidget>
    )
};

export default BoxResults;
