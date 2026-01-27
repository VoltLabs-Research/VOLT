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

import React from 'react';
import useConfirm from '@/shared/presentation/hooks/ui/use-confirm';
import { IoIosArrowDown } from 'react-icons/io';
import FileItem from '@/shared/presentation/components/molecules/common/FileItem';
import Loader from '@/shared/presentation/components/atoms/common/Loader';
import EditorWidget from '@/modules/canvas/presentation/components/organisms/EditorWidget';
import { useTrajectories, useDeleteTrajectory, useTrajectory } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';
import useLogger from '@/shared/presentation/hooks/core/use-logger';
import Container from '@/shared/presentation/components/primitives/Container';
import '@/modules/trajectory/presentation/components/organisms/TrajectoryList/TrajectoryList.css';
import Title from '@/shared/presentation/components/primitives/Title';
import { useParams } from 'react-router';

interface TrajectoryListProps {
    onFileSelect: (folder: any) => void;
}

const TrajectoryList: React.FC<TrajectoryListProps> = ({ onFileSelect }) => {
    const { trajectoryId } = useParams<{ trajectoryId: string }>();
    const { trajectories, isLoading } = useTrajectories();
    const deleteMutation = useDeleteTrajectory();
    const { data: currentTrajectory } = useTrajectory(trajectoryId!);
    
    const selectedTrajectoryId = currentTrajectory?._id;
    const logger = useLogger('trajectory-list');
    const { confirm } = useConfirm();

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!await confirm('Delete this trajectory?')) return;
        try {
            await deleteMutation.mutateAsync(id);
        } catch (err) {
            logger.error('Error deleting trajectory:', err);
        }
    };

    return (
        <EditorWidget className='overflow-hidden editor-file-list-container'>
            <Container className='editor-floating-header-container'>
                <Title className='font-size-3 editor-floating-header-title'>
                    Uploaded Trajectories({trajectories?.length || 0})
                </Title>
                <IoIosArrowDown className='editor-floating-header-icon' />
            </Container>

            <Container className='d-flex w-max column gap-05 y-scroll file-list-body-container'>
                {isLoading ? (
                    <Container className='d-flex content-center items-center file-list-loading-container'>
                        <Loader scale={0.5} />
                    </Container>
                ) : (
                    trajectories?.map((data) => (
                        <FileItem
                            key={data._id}
                            data={data}
                            isSelected={selectedTrajectoryId === data._id}
                            onSelect={() => onFileSelect(data)}
                            onDelete={(e) => handleDelete(data._id, e)}
                        />
                    ))
                )}
            </Container>
        </EditorWidget>
    );
};

export default TrajectoryList;
