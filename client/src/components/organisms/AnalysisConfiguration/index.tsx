/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import React, { useState } from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import { useNavigate } from 'react-router';
import FormField from '@/components/molecules/FormField';
import EditorWidget from '@/components/organisms/EditorWidget';
import Button from '@/components/atoms/Button';
import SystemNotification from '@/components/atoms/SystemNotification';
import useModifiersStore from '@/stores/modifiers';
import useTrajectoryStore from '@/stores/trajectories';
import useAnalysisConfigStore from '@/stores/analysis-config';
import './AnalysisConfiguration.css';

const AnalysisConfiguration = () => {
    const [showNotification, setShowNotification] = useState(false);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);
    const setAnalysisConfig = useAnalysisConfigStore((state) => state.setAnalysisConfig);
    const dislocationAnalysis = useModifiersStore((state) => state.dislocationAnalysis);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const navigate = useNavigate();

    const canPerformCpuIntensiveTask = (): boolean => {
        // For testing: always return false to prevent the analysis
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 5000);
        return false;
    };

    const configFields = [
        { 
            key: 'crystalStructure', 
            label: 'Crystal Structure', 
            type: 'select', 
            options: [
                { value: 'FCC', title: 'FCC (Face-Centered Cubic)' }, 
                { value: 'BCC', title: 'BCC (Body-Centered Cubic)' }, 
                { value: 'HCP', title: 'HCP (Hexagonal Close-Packed)' },
                { value: 'CUBIC_DIAMOND', title: 'Cubic Diamond' },
                { value: 'SC', title: 'Simple Cubic' }
            ] 
        },
        { 
            key: 'identificationMode', 
            label: 'Identification Mode', 
            type: 'select', 
            options: [
                { value: 'PTM', title: 'PTM (Polyhedral Template Matching)' },
                { value: 'CNA', title: 'CNA (Common Neighbor Analysis)' },
                { value: 'DIAMOND', title: 'Diamond' }
            ] 
        },
        { key: 'RMSD', label: 'RMSD', type: 'input', inputProps: { type: 'input', inputProps: { type: 'number', step: '0.1' } } },
        { key: 'maxTrialCircuitSize', label: 'Max Trial Circuit Size', type: 'input', inputProps: { type: 'number', step: '0.1' }},
        { key: 'circuitStretchability', label: 'Circuit Stretchability', type: 'input', inputProps: { type: 'number', step: '0.1' }},
        { key: 'defectMeshSmoothingLevel', label: 'Defect Mesh Smoothing', type: 'input', inputProps: { type: 'number', step: '1' }},
        { key: 'lineSmoothingLevel', label: 'Line Smoothing', type: 'input', inputProps: { type: 'number', step: '0.1' }},
        { key: 'linePointInterval', label: 'Line Point Interval', type: 'input', inputProps: { type: 'number', step: '0.1' }},
        { key: 'onlyPerfectDislocations', label: 'Only Perfect Dislocations', type: 'checkbox' },
        { key: 'markCoreAtoms', label: 'Mark Core Atoms', type: 'checkbox' },
    ];

    const startAnalysis = () => {
        if (!canPerformCpuIntensiveTask()) {
            return;
        }
        if (trajectory?._id) {
            dislocationAnalysis(trajectory._id, analysisConfig);
        }
        //navigate('/dashboard');
    };

    return (
        <EditorWidget className='editor-analysis-config' draggable={false}>
            <div className='editor-analysis-config-header-container'>
                <h3 className='editor-analysis-config-header-title'>Dislocation Analysis</h3>
                <IoIosArrowDown />
            </div>

            <div className='editor-analysis-config-body-container'>
            {configFields
                .filter(f => f.key !== 'RMSD' || analysisConfig.identificationMode === 'PTM')
                .map((field) => (
                    <FormField
                        key={field.key}
                        label={field.label}
                        fieldKey={field.key}
                        fieldType={field.type}
                        options={field.options}
                        inputProps={field.type === 'input' ? field.inputProps : undefined}
                        fieldValue={analysisConfig[field.key]}
                        onFieldChange={setAnalysisConfig}
                    />
            ))}
            </div>

            <div className='editor-analysis-config-footer-container'>
                <Button 
                    isLoading={false}
                    className='smooth click-scale start-analysis-btn' 
                    title='Start'
                    onClick={startAnalysis}
                />
            </div>
            {showNotification && <SystemNotification />}
        </EditorWidget>
    );
};

export default AnalysisConfiguration;