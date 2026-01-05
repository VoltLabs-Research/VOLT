import React from 'react';
import { TbSearch } from 'react-icons/tb';
import Container from '@/components/primitives/Container';
import '../CanvasSidebarScene/CanvasSidebarScene.css'; // Reusing CSS or should extract specific? 

interface AnalysisSearchInputProps {
    value: string;
    onChange: (value: string) => void;
}

const AnalysisSearchInput: React.FC<AnalysisSearchInputProps> = ({ value, onChange }) => {
    return (
        <Container className='analysis-search-container'>
            <Container className='analysis-search-input-wrapper d-flex items-center gap-05'>
                <TbSearch className='analysis-search-icon' />
                <input
                    type='text'
                    className='analysis-search-input'
                    placeholder='Search analyses...'
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </Container>
        </Container>
    );
};

export default AnalysisSearchInput;
