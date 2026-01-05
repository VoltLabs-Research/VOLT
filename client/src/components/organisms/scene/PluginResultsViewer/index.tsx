/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

import { useState, useMemo } from 'react';
import { RiCloseLine } from 'react-icons/ri';
import PluginExposureTable from '@/components/organisms/common/PluginExposureTable';
import PluginAtomsTable from '@/components/organisms/common/PluginAtomsTable';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import { useUIStore } from '@/stores/slices/ui';
import { usePluginStore } from '@/stores/slices/plugin/plugin-slice';
import { useTrajectoryStore } from '@/stores/slices/trajectory';
import { useTeamStore } from '@/stores/slices/team';
import type { RenderableExposure } from '@/stores/slices/plugin/plugin-slice';
import './PluginResultsViewer.css';

interface PluginResultsViewerProps {
    pluginSlug: string;
    pluginName: string;
    analysisId: string;
    exposures: RenderableExposure[];
}

const PluginResultsViewer = ({
    pluginSlug,
    pluginName,
    analysisId,
    exposures
}: PluginResultsViewerProps) => {
    const closeResultsViewer = useUIStore((state) => state.closeResultsViewer);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const team = useTeamStore((state) => state.selectedTeam);

    const [activeTab, setActiveTab] = useState(0);

    // Get exposure names that have listings (visualizers with listing config)
    const listingExposures = useMemo(() => {
        const filtered = exposures.filter(exp => {
            const hasName = Boolean(exp.name);
            return hasName;
        });
        return filtered;
    }, [exposures]);

    // Use backend-computed perAtomProperties from exposures instead of workflow traversal
    const perAtomProperties = useMemo(() => {
        const properties = new Set<string>();
        // Use perAtomProperties from RenderableExposure (which comes from backend)
        exposures.forEach(exp => {
            if (exp.perAtomProperties) {
                exp.perAtomProperties.forEach(p => properties.add(p));
            }
        });
        return Array.from(properties);
    }, [exposures]);

    const hasAtomsTab = perAtomProperties.length > 0;
    const atomsTabIndex = listingExposures.length; // Atoms tab is after exposures

    const activeExposure = activeTab < listingExposures.length ? listingExposures[activeTab] : null;
    const isAtomsTabActive = hasAtomsTab && activeTab === atomsTabIndex;

    // Use backend-computed exposures to find one with perAtomProperties
    const atomExposureId = useMemo(() => {
        const plugin = usePluginStore.getState().pluginsBySlug[pluginSlug];
        if (!plugin?.exposures) return exposures[0]?.exposureId;

        // Find exposure with perAtomProperties
        const atomExposure = plugin.exposures.find(e =>
            e.perAtomProperties && e.perAtomProperties.length > 0
        );
        return atomExposure?._id || exposures[0]?.exposureId;
    }, [exposures, pluginSlug]);

    if (listingExposures.length === 0 && !hasAtomsTab) {
        return (
            <Container className='plugin-results-viewer-container d-flex column'>
                <Container className='plugin-results-header d-flex items-center content-between p-1'>
                    <Title className='font-size-3 font-weight-5'>{pluginName}</Title>
                    <i className='plugin-results-close cursor-pointer' onClick={closeResultsViewer}>
                        <RiCloseLine size={20} />
                    </i>
                </Container>
                <Container className='plugin-results-empty d-flex items-center content-center flex-1'>
                    <span className='color-muted font-size-2'>No listings available for this analysis</span>
                </Container>
            </Container>
        );
    }

    return (
        <Container className='plugin-results-viewer-container d-flex column'>
            {/* Header */}
            <Container className='plugin-results-header d-flex items-center content-between p-1'>
                <Title className='font-size-3 font-weight-5'>{pluginName}</Title>
                <i className='plugin-results-close cursor-pointer' onClick={closeResultsViewer}>
                    <RiCloseLine size={20} />
                </i>
            </Container>

            {/* Tabs */}
            <Container className='plugin-results-tabs-container d-flex gap-05 px-1'>
                {listingExposures.map((exposure, index) => (
                    <button
                        key={`${exposure.exposureId}-${index}`}
                        className={`plugin-results-tab ${activeTab === index ? 'active' : ''}`}
                        onClick={() => setActiveTab(index)}
                    >
                        <span className='plugin-results-tab-name'>{exposure.name}</span>
                    </button>
                ))}
                {hasAtomsTab && (
                    <button
                        className={`plugin-results-tab ${isAtomsTabActive ? 'active' : ''}`}
                        onClick={() => setActiveTab(atomsTabIndex)}
                    >
                        <span className='plugin-results-tab-name'>Atoms</span>
                    </button>
                )}
            </Container>

            {/* Content */}
            <Container className='plugin-results-content flex-1'>
                {activeExposure && (
                    <PluginExposureTable
                        key={`${activeExposure.exposureId}-${analysisId}`}
                        pluginSlug={pluginSlug}
                        listingSlug={activeExposure.name}
                        trajectoryId={trajectory?._id}
                        teamId={team?._id}
                        compact
                    />
                )}
                {isAtomsTabActive && (
                    <PluginAtomsTable
                        trajectoryId={trajectory!._id}
                        analysisId={analysisId}
                        exposureId={atomExposureId}
                    />
                )}
            </Container>
        </Container>
    );
};

export default PluginResultsViewer;
