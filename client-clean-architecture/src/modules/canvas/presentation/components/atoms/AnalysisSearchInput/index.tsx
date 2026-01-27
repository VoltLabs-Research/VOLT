import React from 'react';
import { TbSearch } from 'react-icons/tb';
import Container from '@/shared/presentation/components/primitives/Container';

interface AnalysisSearchInputProps {
    value: string;
    onChange: (value: string) => void;
}

const AnalysisSearchInput: React.FC<AnalysisSearchInputProps> = ({ value, onChange }) => {
    return (
        <Container className='analysis-search-container'>
            <Container className='analysis-search-input-wrapper d-flex items-center gap-05'>
                <TbSearch className='analysis-search-icon font-size-3' />
                <input
                    type='text'
                    className='analysis-search-input font-size-2'
                    placeholder='Search analyses...'
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </Container>
        </Container>
    );
};

export default AnalysisSearchInput;
