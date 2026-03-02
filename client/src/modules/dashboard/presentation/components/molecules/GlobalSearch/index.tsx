import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TbObjectScan, TbCube3dSphere } from 'react-icons/tb';
import { IoCubeOutline, IoPeopleOutline } from 'react-icons/io5';
import { CiChat1 } from 'react-icons/ci';
import { GoWorkflow } from 'react-icons/go';
import SearchService, { type SearchResults } from '@/modules/dashboard/infrastructure/services/search-service';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import EmptyState from '@/shared/presentation/components/EmptyState';
import SearchInput from '@/shared/presentation/components/SearchInput';
import Button from '@/shared/presentation/components/Button';
import './GlobalSearch.css';

type SectionConfig = {
    key: keyof SearchResults;
    icon: React.ReactNode;
    title: string;
    getPath: (item: any) => string;
    getTitle: (item: any) => string;
    getSubtitle: (item: any) => string;
};

const SECTIONS: SectionConfig[] = [
    { key: 'analyses', icon: <GoWorkflow />, title: 'Analyses', getPath: () => '/dashboard/analysis-configs', getTitle: (i) => i.plugin, getSubtitle: (i) => new Date(i.createdAt).toLocaleDateString() },
    { key: 'trajectories', icon: <TbObjectScan />, title: 'Trajectories', getPath: (i) => `/dashboard/trajectories/${i._id}`, getTitle: (i) => i.name, getSubtitle: (i) => i.status },
    { key: 'containers', icon: <IoCubeOutline />, title: 'Containers', getPath: () => '/dashboard/containers', getTitle: (i) => i.name, getSubtitle: (i) => i.image },
    { key: 'plugins', icon: <TbCube3dSphere />, title: 'Plugins', getPath: (i) => `/dashboard/plugins/${i._id}`, getTitle: (i) => i.modifier?.name || i._id, getSubtitle: (i) => i.modifier?.description },
    { key: 'teams', icon: <IoPeopleOutline />, title: 'Teams', getPath: () => '/dashboard', getTitle: (i) => i.name, getSubtitle: (i) => i.description },
    { key: 'chats', icon: <CiChat1 />, title: 'Chats', getPath: () => '/dashboard/messages', getTitle: (i) => i.participants?.map((p: any) => p.firstName || p.email).join(', ') || 'Chat', getSubtitle: (i) => i.lastMessage?.content?.substring(0, 50) || 'No messages' }
];

const GlobalSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResults | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const navigate = useNavigate();
    const searchService = useMemo(() => new SearchService(), []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if(containerRef.current && !containerRef.current.contains(e.target as Node)) setShowResults(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if(debounceRef.current) clearTimeout(debounceRef.current);
        if(!query.trim()){ setResults(null); setShowResults(false); return; }

        setIsLoading(true);
        setShowResults(true);
        debounceRef.current = setTimeout(async () => {
            setResults(await searchService.search(query));
            setIsLoading(false);
        }, 300);

        return () => { if(debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query]);

    const handleNav = (path: string) => { navigate(path); setShowResults(false); setQuery(''); setResults(null); };

    const totalResults = useMemo(() => 
        results ? Object.values(results).reduce((acc, arr) => acc + (arr?.length || 0), 0) : 0
    , [results]);

    return (
        <Container className='global-search-wrapper p-relative w-max' ref={containerRef}>
            <SearchInput placeholder='Search...' value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => query && setShowResults(true)} />

            {showResults && (
                <Container className='global-search-results panel-floating p-absolute left-0 right-0 radius-md y-auto'>
                    {isLoading && <Container className='global-search-loading p-2'><EmptyState title='Searching...' description='' /></Container>}

                    {!isLoading && results && totalResults === 0 && <EmptyState title='No results found' description='' />}

                    {!isLoading && results && totalResults > 0 && SECTIONS.map(({ key, icon, title, getPath, getTitle, getSubtitle }) => {
                        const items = results[key];
                        if(!items?.length) return null;
                        return (
                            <Container key={key} className='global-search-section'>
                                <Container className='global-search-section-header d-flex items-center gap-05 p-075 font-size-3 color-muted'>
                                    {icon}
                                    <Paragraph className='font-size-1 font-weight-5'>{title}</Paragraph>
                                </Container>
                                {items.map((item: any) => (
                                    <Button key={item._id} onClick={() => handleNav(getPath(item))} className='global-search-item d-flex column items-start gap-025 p-075 w-max cursor-pointer' variant='ghost' intent='neutral' align='start'>
                                        <Paragraph className='font-size-2 font-weight-5'>{getTitle(item)}</Paragraph>
                                        <Paragraph className='font-size-1 color-muted'>{getSubtitle(item)}</Paragraph>
                                    </Button>
                                ))}
                            </Container>
                        );
                    })}
                </Container>
            )}
        </Container>
    );
};

export default GlobalSearch;
