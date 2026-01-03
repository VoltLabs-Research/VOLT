import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoSearchOutline } from 'react-icons/io5';
import { TbObjectScan, TbCube3dSphere } from 'react-icons/tb';
import { IoCubeOutline, IoPeopleOutline } from 'react-icons/io5';
import { CiChat1 } from 'react-icons/ci';
import { GoWorkflow } from 'react-icons/go';
import { searchApi } from '@/services/api/search/search';
import Container from '@/components/primitives/Container';
import Paragraph from '@/components/primitives/Paragraph';
import './GlobalSearch.css';

const GlobalSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (!query.trim()) {
            setResults(null);
            setShowResults(false);
            return;
        }

        setIsLoading(true);
        setShowResults(true);
        debounceRef.current = setTimeout(async () => {
            const data = await searchApi.search(query);
            setResults(data);
            setIsLoading(false);
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query]);

    const handleNavigation = (path: string) => {
        navigate(path);
        setShowResults(false);
        setQuery('');
        setResults(null);
    };

    const getTotalResults = () => {
        if (!results) return 0;
        return Object.values(results).reduce((acc: number, arr: any) => acc + (arr?.length || 0), 0);
    };

    return (
        <Container className='global-search-wrapper' ref={containerRef}>
            <Container className='d-flex gap-1 search-container'>
                <i className='search-icon-container'>
                    <IoSearchOutline />
                </i>
                <input
                    placeholder='Search...'
                    className='search-input h-max'
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query && setShowResults(true)}
                />
            </Container>

            {showResults && (
                <Container className='global-search-results'>
                    {isLoading && (
                        <Container className='global-search-loading'>
                            <Paragraph className='color-muted font-size-1'>Searching...</Paragraph>
                        </Container>
                    )}

                    {!isLoading && results && getTotalResults() === 0 && (
                        <Container className='global-search-empty'>
                            <Paragraph className='color-muted font-size-2'>No results found</Paragraph>
                        </Container>
                    )}

                    {!isLoading && results && getTotalResults() > 0 && (
                        <>
                            {results.analyses?.length > 0 && (
                                <Container className='global-search-section'>
                                    <Container className='global-search-section-header'>
                                        <GoWorkflow />
                                        <Paragraph className='font-size-1 font-weight-5'>Analyses</Paragraph>
                                    </Container>
                                    {results.analyses.map((item: any) => (
                                        <button
                                            key={item._id}
                                            onClick={() => handleNavigation(`/dashboard/analysis-configs`)}
                                            className='global-search-item'
                                        >
                                            <Paragraph className='font-size-2 font-weight-5'>{item.plugin}</Paragraph>
                                            <Paragraph className='font-size-1 color-muted'>
                                                {new Date(item.createdAt).toLocaleDateString()}
                                            </Paragraph>
                                        </button>
                                    ))}
                                </Container>
                            )}

                            {results.trajectories?.length > 0 && (
                                <Container className='global-search-section'>
                                    <Container className='global-search-section-header'>
                                        <TbObjectScan />
                                        <Paragraph className='font-size-1 font-weight-5'>Trajectories</Paragraph>
                                    </Container>
                                    {results.trajectories.map((item: any) => (
                                        <button
                                            key={item._id}
                                            onClick={() => handleNavigation(`/dashboard/trajectories/${item._id}`)}
                                            className='global-search-item'
                                        >
                                            <Paragraph className='font-size-2 font-weight-5'>{item.name}</Paragraph>
                                            <Paragraph className='font-size-1 color-muted'>{item.status}</Paragraph>
                                        </button>
                                    ))}
                                </Container>
                            )}

                            {results.containers?.length > 0 && (
                                <Container className='global-search-section'>
                                    <Container className='global-search-section-header'>
                                        <IoCubeOutline />
                                        <Paragraph className='font-size-1 font-weight-5'>Containers</Paragraph>
                                    </Container>
                                    {results.containers.map((item: any) => (
                                        <button
                                            key={item._id}
                                            onClick={() => handleNavigation(`/dashboard/containers`)}
                                            className='global-search-item'
                                        >
                                            <Paragraph className='font-size-2 font-weight-5'>{item.name}</Paragraph>
                                            <Paragraph className='font-size-1 color-muted'>{item.image}</Paragraph>
                                        </button>
                                    ))}
                                </Container>
                            )}

                            {results.plugins?.length > 0 && (
                                <Container className='global-search-section'>
                                    <Container className='global-search-section-header'>
                                        <TbCube3dSphere />
                                        <Paragraph className='font-size-1 font-weight-5'>Plugins</Paragraph>
                                    </Container>
                                    {results.plugins.map((item: any) => (
                                        <button
                                            key={item._id}
                                            onClick={() => handleNavigation(`/dashboard/plugins/${item.slug}`)}
                                            className='global-search-item'
                                        >
                                            <Paragraph className='font-size-2 font-weight-5'>
                                                {item.modifier?.name || item.slug}
                                            </Paragraph>
                                            <Paragraph className='font-size-1 color-muted'>
                                                {item.modifier?.description}
                                            </Paragraph>
                                        </button>
                                    ))}
                                </Container>
                            )}

                            {results.teams?.length > 0 && (
                                <Container className='global-search-section'>
                                    <Container className='global-search-section-header'>
                                        <IoPeopleOutline />
                                        <Paragraph className='font-size-1 font-weight-5'>Teams</Paragraph>
                                    </Container>
                                    {results.teams.map((item: any) => (
                                        <button
                                            key={item._id}
                                            onClick={() => handleNavigation(`/dashboard`)}
                                            className='global-search-item'
                                        >
                                            <Paragraph className='font-size-2 font-weight-5'>{item.name}</Paragraph>
                                            <Paragraph className='font-size-1 color-muted'>{item.description}</Paragraph>
                                        </button>
                                    ))}
                                </Container>
                            )}

                            {results.chats?.length > 0 && (
                                <Container className='global-search-section'>
                                    <Container className='global-search-section-header'>
                                        <CiChat1 />
                                        <Paragraph className='font-size-1 font-weight-5'>Chats</Paragraph>
                                    </Container>
                                    {results.chats.map((item: any) => (
                                        <button
                                            key={item._id}
                                            onClick={() => handleNavigation(`/dashboard/messages`)}
                                            className='global-search-item'
                                        >
                                            <Paragraph className='font-size-2 font-weight-5'>
                                                {item.participants?.map((p: any) => 
                                                    p.firstName || p.email
                                                ).join(', ') || 'Chat'}
                                            </Paragraph>
                                            <Paragraph className='font-size-1 color-muted'>
                                                {item.lastMessage?.content?.substring(0, 50) || 'No messages'}
                                            </Paragraph>
                                        </button>
                                    ))}
                                </Container>
                            )}
                        </>
                    )}
                </Container>
            )}
        </Container>
    );
};

export default GlobalSearch;
