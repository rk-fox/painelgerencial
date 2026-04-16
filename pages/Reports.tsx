import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Member } from '../types';
import { parseLocalDate, formatLocalDate } from '../utils/dateUtils';

interface MemberRanking {
    id: string;
    name: string;
    war_name?: string;
    abrev?: string;
    avatar?: string;
    totalDiarias: number;
}

interface SectionTimeEntry {
    id: string;
    name: string;
    war_name?: string;
    abrev?: string;
    avatar?: string;
    years: number;
}

interface UnavailabilityRanking {
    id: string;
    name: string;
    war_name?: string;
    abrev?: string;
    avatar?: string;
    totalDays: number;
}

interface CategoryRanking {
    category: string;
    total: number;
}

interface StatusCounts {
    pendente: number;
    iniciada: number;
    concluida: number;
}

interface MissionStats {
    totalMissions: number;
    previousYearMissions: number;
    totalDays: number;
    totalDiarias: number; // days * team size
    workHours: number; // weekdays * 8h
}

const Reports: React.FC = () => {
    const [memberRankings, setMemberRankings] = useState<MemberRanking[]>([]);
    const [categoryRankings, setCategoryRankings] = useState<CategoryRanking[]>([]);
    const [statusCounts, setStatusCounts] = useState<StatusCounts>({ pendente: 0, iniciada: 0, concluida: 0 });
    const [missionStats, setMissionStats] = useState<MissionStats>({
        totalMissions: 0,
        previousYearMissions: 0,
        totalDays: 0,
        totalDiarias: 0,
        workHours: 0
    });
    const [loading, setLoading] = useState(true);
    const [avgTasksPerDay, setAvgTasksPerDay] = useState<string>("0");
    const [sectionTimeRanking, setSectionTimeRanking] = useState<SectionTimeEntry[]>([]);
    const [unavailRankings, setUnavailRankings] = useState<UnavailabilityRanking[]>([]);
    const [availableUnavailTypes, setAvailableUnavailTypes] = useState<string[]>([]);
    const [selectedUnavailType, setSelectedUnavailType] = useState<string>('Dispensa');
    
    // Filters State
    const [rankingTimeRange, setRankingTimeRange] = useState<string>('year');
    const [selectedRankingYear, setSelectedRankingYear] = useState<number>(new Date().getFullYear());
    const [availableRankingYears, setAvailableRankingYears] = useState<number[]>([]);
    const [selectedActivityYear, setSelectedActivityYear] = useState<number>(new Date().getFullYear());
    const [availableActivityYears, setAvailableActivityYears] = useState<number[]>([]);

    useEffect(() => {
        fetchAvailableYears();
        fetchAvailableTaskYears();
    }, []);

    useEffect(() => {
        fetchReportData();
        fetchMissionStats();
        fetchSectionTimeRanking();
    }, [rankingTimeRange, selectedActivityYear]);
    
    // Add effect to handle range changes vs year filter
    useEffect(() => {
        if (rankingTimeRange !== 'year') {
            setSelectedActivityYear(new Date().getFullYear());
        }
    }, [rankingTimeRange]);

    useEffect(() => {
        fetchMemberRanking();
        fetchUnavailRanking();
    }, [selectedRankingYear, selectedUnavailType]);

    // Calculate weekdays between two dates (excluding weekends)
    const countWeekdays = (startDate: string, endDate: string): number => {
        const start = parseLocalDate(startDate);
        const end = parseLocalDate(endDate);
        if (!start || !end) return 0;
        let count = 0;
        const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        
        while (current <= end) {
            const dayOfWeek = current.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        return count;
    };

    // Calculate weekdays between two dates (excluding weekends)
    const countWeekendays = (startDate: string, endDate: string): number => {
        const start = parseLocalDate(startDate);
        const end = parseLocalDate(endDate);
        if (!start || !end) return 0;
        let count = 0;
        const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        
        while (current <= end) {
            const dayOfWeek = current.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday (0) or Saturday (6)
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        return count;
    };

    const getUserSector = () => {
        const userJson = localStorage.getItem('currentUser');
        if (userJson) {
            const user = JSON.parse(userJson);
            return user.sector;
        }
        return null;
    };

    const fetchAvailableYears = async () => {
        try {
            const sector = getUserSector();
            let query = supabase.from('missions').select('data_inicio');
            if (sector && (sector === 'CP' || sector === 'EA')) {
                query = query.eq('sector', sector);
            }
            const { data, error } = await query;
            if (!error && data) {
                const years = [...new Set(data.map(m => {
                    const parsed = parseLocalDate(m.data_inicio);
                    return parsed ? parsed.getFullYear() : new Date().getFullYear();
                }))].sort((a, b) => b - a);
                setAvailableRankingYears(years.length > 0 ? years : [new Date().getFullYear()]);
                if (years.length > 0 && !years.includes(selectedRankingYear)) {
                    setSelectedRankingYear(years[0]);
                }
            }
        } catch (error) {
            console.error('Error fetching available years:', error);
        }
    };

    // Calculate duration (last day = 0.5)
    const fetchAvailableTaskYears = async () => {
        try {
            const sector = getUserSector();
            const startCheckYear = 2022;
            const endCheckYear = new Date().getFullYear() + 2;
            const foundYears: number[] = [];

            // Efficiently check each year individually to bypass 1000 row limit
            for (let year = startCheckYear; year <= endCheckYear; year++) {
                let query = supabase
                    .from('tasks')
                    .select('id', { count: 'exact', head: true })
                    .gte('start_date', `${year}-01-01`)
                    .lte('start_date', `${year}-12-31`);
                
                if (sector && (sector === 'CP' || sector === 'EA')) {
                    query = query.eq('sector', sector);
                }

                const { count } = await query;
                if (count && count > 0) {
                    foundYears.push(year);
                }
            }

            setAvailableActivityYears(foundYears.length > 0 ? foundYears.sort((a, b) => b - a) : [new Date().getFullYear()]);
        } catch (error) {
            console.error('Error fetching activity years:', error);
        }
    };

    const calculateDuration = (startDate: string, endDate: string): number => {
        const start = parseLocalDate(startDate);
        const end = parseLocalDate(endDate);
        if (!start || !end) return 0;
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)+1);
        return diffDays - 0.5;
    };

    const fetchMissionStats = async () => {
        const currentYear = new Date().getFullYear();
        const previousYear = currentYear - 1;
        const sector = getUserSector();

        let queryCurrent = supabase
            .from('missions')
            .select('*')
            .gte('data_inicio', `${currentYear}-01-01`)
            .lte('data_inicio', `${currentYear}-12-31`);

        let queryPrev = supabase
            .from('missions')
            .select('id')
            .gte('data_inicio', `${previousYear}-01-01`)
            .lte('data_inicio', `${previousYear}-12-31`);

        if (sector && (sector === 'CP' || sector === 'EA')) {
            queryCurrent = queryCurrent.eq('sector', sector);
            queryPrev = queryPrev.eq('sector', sector);
        }

        // Fetch current year missions
        const { data: currentMissions } = await queryCurrent;

        // Fetch previous year missions (count only)
        const { data: previousMissions } = await queryPrev;

        let totalDays = 0;
        let totalDiarias = 0;
        let workHours = 0;

        if (currentMissions) {
            currentMissions.forEach(mission => {
                const duration = calculateDuration(mission.data_inicio, mission.data_fim);
                const teamSize = mission.qtd_equipe || 1;
                const weekdays = countWeekdays(mission.data_inicio, mission.data_fim);
                const weekends = countWeekendays(mission.data_inicio, mission.data_fim);

                totalDays += duration;
                totalDiarias += duration * teamSize;
                workHours += (duration - weekends) * teamSize * 8; // Each weekday = 8h of work
            });
        }

        setMissionStats({
            totalMissions: currentMissions?.length || 0,
            previousYearMissions: previousMissions?.length || 0,
            totalDays: Math.round(totalDays * 10) / 10, // Round to 1 decimal
            totalDiarias: Math.round(totalDiarias * 10) / 10,
            workHours
        });
    };

    const fetchMemberRanking = async () => {
        try {
            const currentYear = new Date().getFullYear();
            const sector = getUserSector();

            let memQuery = supabase.from('members').select('*');
            let missQuery = supabase
                .from('missions')
                .select('id, data_inicio, data_fim, equipe')
                .gte('data_inicio', `${selectedRankingYear}-01-01`)
                .lte('data_inicio', `${selectedRankingYear}-12-31`);

            if (sector && (sector === 'CP' || sector === 'EA')) {
                memQuery = memQuery.eq('sector', sector);
                missQuery = missQuery.eq('sector', sector);
            }

            // Fetch members
            const { data: membersData } = await memQuery;

            // Filter for SO. and Sgt.
            const eligibleMembers = membersData?.filter(m => 
                ['SO.', 'Sgt.'].includes(m.abrev || '')
            ) || [];

            // Fetch missions for selected year
            const { data: missionsData } = await missQuery;

            // Calculate totals
            const memberMap = new Map<string, number>();
            
            // Initialize with 0 for all eligible members
            eligibleMembers.forEach(m => memberMap.set(m.id, 0));

            missionsData?.forEach(mission => {
                const duration = calculateDuration(mission.data_inicio, mission.data_fim);
                mission.equipe?.forEach((memberId: string) => {
                    if (memberMap.has(memberId)) {
                        memberMap.set(memberId, Number((memberMap.get(memberId)! + duration).toFixed(1)));
                    }
                });
            });

            // Create ranking array
            const rankings = eligibleMembers.map(m => ({
                id: m.id,
                name: m.name,
                war_name: m.war_name,
                abrev: m.abrev,
                avatar: m.avatar,
                totalDiarias: memberMap.get(m.id) || 0
            })).sort((a, b) => b.totalDiarias - a.totalDiarias);

            setMemberRankings(rankings);
        } catch (error) {
            console.error('Error fetching member ranking:', error);
        }
    };

    const fetchUnavailRanking = async () => {
        try {
            // Fetch all records from unavailability for selected year
            const { data: unavailData } = await supabase
                .from('unavailability')
                .select('*')
                .gte('start_date', `${selectedRankingYear}-01-01`)
                .lte('start_date', `${selectedRankingYear}-12-31`);

            if (!unavailData) return;

            // Extract unique types for filter
            const types = [...new Set(unavailData.map(u => u.type))].sort();
            setAvailableUnavailTypes(types);
            
            // If current selected type is not in the new types list and list isn't empty, pick first one
            // unless it's the initial default 'Dispensa' which we keep if possible
            if (types.length > 0 && !types.includes(selectedUnavailType)) {
                if (types.includes('Dispensa')) setSelectedUnavailType('Dispensa');
                else setSelectedUnavailType(types[0]);
            }

            // Fetch members
            let memQuery = supabase.from('members').select('*');
            const sector = getUserSector();
            if (sector && (sector === 'CP' || sector === 'EA')) {
                memQuery = memQuery.eq('sector', sector);
            }
            const { data: membersData } = await memQuery;

            const eligibleMembers = membersData?.filter(m => 
                ['SO.', 'Sgt.', 'Cv.'].includes(m.abrev || '')
            ) || [];

            const memberMap = new Map<string, number>();
            eligibleMembers.forEach(m => memberMap.set(m.id, 0));

            unavailData.forEach(u => {
                if (u.type === selectedUnavailType && memberMap.has(u.member)) {
                    const start = parseLocalDate(u.start_date);
                    const end = parseLocalDate(u.end_date);
                    if (start && end) {
                        const diffTime = Math.abs(end.getTime() - start.getTime());
                        const duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                        memberMap.set(u.member, (memberMap.get(u.member) || 0) + duration);
                    }
                }
            });

            const rankings = eligibleMembers
                .map(m => ({
                    id: m.id,
                    name: m.name,
                    war_name: m.war_name,
                    abrev: m.abrev,
                    avatar: m.avatar,
                    totalDays: memberMap.get(m.id) || 0
                }))
                .filter(r => r.totalDays > 0)
                .sort((a, b) => b.totalDays - a.totalDays);

            setUnavailRankings(rankings);
        } catch (error) {
            console.error('Error fetching unavailability ranking:', error);
        }
    };

    const fetchSectionTimeRanking = async () => {
        try {
            let memQuery = supabase.from('members').select('id, name, war_name, abrev, avatar, entry_date, status');
            const sector = getUserSector();
            if (sector && (sector === 'CP' || sector === 'EA')) {
                memQuery = memQuery.eq('sector', sector);
            }
            const { data: membersData } = await memQuery;

            if (!membersData) return;

            const today = new Date();
            const ranking: SectionTimeEntry[] = membersData
                .filter(m => m.entry_date && ['SO.', 'Sgt.', 'Cv.'].includes(m.abrev || ''))
                .map(m => {
                    const entryDate = parseLocalDate(m.entry_date);
                    if (!entryDate) return null;
                    const diffMs = today.getTime() - entryDate.getTime();
                    const years = Math.round((diffMs / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10;
                    return {
                        id: m.id,
                        name: m.name,
                        war_name: m.war_name,
                        abrev: m.abrev,
                        avatar: m.avatar,
                        years: Math.max(years, 0),
                    };
                })
                .filter((item): item is SectionTimeEntry => item !== null)
                .sort((a, b) => b.years - a.years);

            setSectionTimeRanking(ranking);
        } catch (error) {
            console.error('Error fetching section time ranking:', error);
        }
    };

    const fetchReportData = async () => {
        try {
            setLoading(true);
            const now = new Date();
            let startDateRange = '';
            let endDateRange = '';

            if (rankingTimeRange === '30d') {
                const date = new Date();
                date.setDate(now.getDate() - 30);
                startDateRange = date.toISOString().split('T')[0];
                endDateRange = now.toISOString().split('T')[0];
            } else if (rankingTimeRange === 'trimestre') {
                const date = new Date();
                date.setDate(now.getDate() - 90);
                startDateRange = date.toISOString().split('T')[0];
                endDateRange = now.toISOString().split('T')[0];
            } else { // year
                startDateRange = `${selectedActivityYear}-01-01`;
                endDateRange = `${selectedActivityYear}-12-31`;
            }

            const sector = getUserSector();
            
            // Function to fetch all tasks in range handling 1000 limit
            const fetchAllTasks = async (start: string, end: string) => {
                let allData: any[] = [];
                let from = 0;
                let to = 999;
                let hasMore = true;

                while (hasMore) {
                    let query = supabase
                        .from('tasks')
                        .select('status, quantidade, category, start_date, end_date')
                        .gte('start_date', start)
                        .lte('start_date', end)
                        .range(from, to);
                    
                    if (sector && (sector === 'CP' || sector === 'EA')) {
                        query = query.eq('sector', sector);
                    }

                    const { data, error } = await query;
                    if (error) throw error;
                    if (!data || data.length === 0) {
                        hasMore = false;
                    } else {
                        allData = [...allData, ...data];
                        if (data.length < 1000) {
                            hasMore = false;
                        } else {
                            from += 1000;
                            to += 1000;
                        }
                    }
                }
                return allData;
            };

            const tasks = await fetchAllTasks(startDateRange, endDateRange);
            
            // Calculate status counts
            const counts: StatusCounts = { pendente: 0, iniciada: 0, concluida: 0 };
            const categoryMap = new Map<string, number>();

            tasks.forEach(task => {
                const qty = task.quantidade || 1;

                // Status counts
                if (task.status === 'pendente') counts.pendente += qty;
                else if (task.status === 'iniciada') counts.iniciada += qty;
                else if (task.status === 'concluida') counts.concluida += qty;

                // Category ranking logic
                if (task.status === 'concluida' && task.category) {
                    const current = categoryMap.get(task.category) || 0;
                    categoryMap.set(task.category, current + qty);
                }
            });

            setStatusCounts(counts);

            // Calculate Tasks Per Day Average (Always for current year to keep consistent card)
            const today = new Date();
            const todayYear = today.getFullYear();
            const todayStr = today.toISOString().split('T')[0];
            const startOfYearStr = `${todayYear}-01-01`;
            
            // We need current year tasks for this specific calculation if not already loaded
            let currentYearTasks = tasks;
            if (selectedActivityYear !== todayYear || rankingTimeRange !== 'year') {
                const { data: cyTasks } = await supabase
                    .from('tasks')
                    .select('quantidade, start_date')
                    .gte('start_date', startOfYearStr)
                    .lte('start_date', todayStr);
                currentYearTasks = cyTasks || [];
            }

            const weekdaysInYearWindow = countWeekdays(startOfYearStr, todayStr);
            const totalTasksInWindow = currentYearTasks.reduce((acc, task) => {
                if (!task.start_date) return acc;
                const taskDate = task.start_date.split('T')[0];
                if (taskDate <= todayStr) {
                    return acc + (task.quantidade || 1);
                }
                return acc;
            }, 0);

            if (weekdaysInYearWindow > 0) {
                const avg = totalTasksInWindow / weekdaysInYearWindow;
                setAvgTasksPerDay(avg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
            }

            // Convert map to sorted array
            const rankings = Array.from(categoryMap.entries())
                .map(([category, total]) => ({ category, total }))
                .sort((a, b) => b.total - a.total);

            setCategoryRankings(rankings);
        } catch (err) {
            console.error('Error fetching report data:', err);
        } finally {
            setLoading(false);
        }
    };

    // Calculate efficiency
    const totalTasks = statusCounts.pendente + statusCounts.iniciada + statusCounts.concluida;
    const efficiency = totalTasks > 0 ? Math.round((statusCounts.concluida / totalTasks) * 100) : 0;

    // Calculate percentages for donut chart
    const pendingPercent = totalTasks > 0 ? (statusCounts.pendente / totalTasks) * 100 : 0;
    const inProgressPercent = totalTasks > 0 ? (statusCounts.iniciada / totalTasks) * 100 : 0;
    const completedPercent = totalTasks > 0 ? (statusCounts.concluida / totalTasks) * 100 : 0;

    // Max for bar chart scaling
    const maxCategoryTotal = categoryRankings.length > 0 ? categoryRankings[0].total : 1;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <ReportCard
                    icon="assignment" color="blue"
                    title="Total de Tarefas" value={totalTasks.toString()}
                    badge="Atual" badgeColor="blue"
                />
                <ReportCard
                    icon="calendar_today" color="indigo"
                    title="Média de Tarefas/Dia" value={avgTasksPerDay}
                    badge="Média Móvel" badgeColor="indigo"
                />
                <ReportCard
                    icon="task_alt" color="emerald"
                    title="Taxa de Conclusão" value={`${efficiency}%`}
                    badge="META 90%" badgeColor="emerald"
                    progress={efficiency}
                />
                <ReportCard
                    icon="pending_actions" color="rose"
                    title="Tarefas Pendentes" value={statusCounts.pendente.toString()}
                    badge="Atual" badgeColor="rose"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <ReportCard
                    icon="explore" color="amber"
                    title="Missões Únicas Previstas" 
                    value={missionStats.totalMissions.toString()}
                    badge={missionStats.totalMissions - missionStats.previousYearMissions >= 0 
                        ? `+${missionStats.totalMissions - missionStats.previousYearMissions}` 
                        : `${missionStats.totalMissions - missionStats.previousYearMissions}`}
                    badgeColor={missionStats.totalMissions >= missionStats.previousYearMissions ? "emerald" : "rose"}
                />
                <ReportCard
                    icon="date_range" color="sky"
                    title="Total de Dias Previstos em Missão" 
                    value={`${missionStats.totalDays} dias`}
                    badge="Consolidado" badgeColor="sky"
                />
                <ReportCard
                    icon="payments" color="violet"
                    title="Total de Diárias Previstas no Ano"
                    value={`${missionStats.totalDiarias} diárias`}
                    badge="Acumulado" badgeColor="violet"
                />
                <ReportCard
                    icon="timer" color="sky"
                    title="Carga Horária Esperada em Viagem" 
                    value={`${missionStats.workHours}h`}
                    badge="Consolidado" badgeColor="sky"
                />
            </div>

            {/* Ranking de Atividades and Conclusão de Tarefas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Ranking de Atividades (Categories) */}
                <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-6 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h4 className="text-base font-bold text-slate-800 dark:text-white">Ranking de Atividades</h4>
                            <p className="text-[10px] font-bold text-[#4c739a] uppercase tracking-widest mt-1">Categorias por Quantidade Concluída</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <select 
                                value={rankingTimeRange}
                                onChange={(e) => setRankingTimeRange(e.target.value)}
                                className="block appearance-none w-[120px] box-border flex-none bg-slate-50 dark:bg-slate-800 rounded-lg text-[10px] font-bold px-3 py-1 text-slate-500 focus:ring-1 focus:ring-primary cursor-pointer"
                            >
                                <option value="30d">Últimos 30 dias</option>
                                <option value="trimestre">Último trimestre</option>
                                <option value="year">Por Ano</option>
                            </select>
                            {rankingTimeRange === 'year' && (
                                <select 
                                    value={selectedActivityYear}
                                    onChange={(e) => setSelectedActivityYear(Number(e.target.value))}
                                    className="block appearance-none w-[70px] box-border flex-none bg-slate-50 dark:bg-slate-800 rounded-lg text-[10px] font-bold px-3 py-1 text-slate-500 focus:ring-1 focus:ring-primary cursor-pointer"
                                >
                                    {availableActivityYears.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>
                    <div className="space-y-6">
                        {loading ? (
                            <div className="text-center text-slate-400 py-8">Carregando...</div>
                        ) : categoryRankings.length > 0 ? (
                            categoryRankings.map((cat, index) => (
                                <BarChartItem
                                    key={cat.category}
                                    label={cat.category}
                                    value={`${cat.total} tarefa${cat.total > 1 ? 's' : ''}${index === 0 ? ' (Max)' : ''}`}
                                    percent={Math.round((cat.total / maxCategoryTotal) * 100)}
                                    color={index === 0 ? 'bg-emerald-500' : 'bg-primary'}
                                />
                            ))
                        ) : (
                            <div className="text-center text-slate-400 py-8 italic">Nenhuma tarefa concluída com categoria definida.</div>
                        )}
                    </div>
                </div>

                {/* Conclusão de Tarefas */}
                <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm">
                    <div className="mb-8">
                        <h4 className="text-base font-bold text-slate-800 dark:text-white">Conclusão de Tarefas</h4>
                        <p className="text-[10px] font-bold text-[#4c739a] uppercase tracking-widest mt-1">Status das Atividades</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="relative w-40 h-40 xl:w-48 xl:h-48">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                {/* Background circle */}
                                <circle className="text-slate-100 dark:text-slate-800" cx="18" cy="18" fill="transparent" r="16" stroke="currentColor" strokeWidth="3"></circle>
                                {/* Completed (Green) */}
                                <circle
                                    cx="18" cy="18" fill="transparent" r="16"
                                    stroke="#10b981"
                                    strokeDasharray={`${completedPercent}, 100`}
                                    strokeDashoffset="0"
                                    strokeLinecap="round"
                                    strokeWidth="3.5"
                                ></circle>
                                {/* In Progress (Blue) */}
                                <circle
                                    cx="18" cy="18" fill="transparent" r="16"
                                    stroke="#3b82f6"
                                    strokeDasharray={`${inProgressPercent}, 100`}
                                    strokeDashoffset={`${-completedPercent}`}
                                    strokeLinecap="round"
                                    strokeWidth="3.5"
                                ></circle>
                                {/* Pending (Gray) */}
                                <circle
                                    cx="18" cy="18" fill="transparent" r="16"
                                    stroke="#9ca3af"
                                    strokeDasharray={`${pendingPercent}, 100`}
                                    strokeDashoffset={`${-(completedPercent + inProgressPercent)}`}
                                    strokeLinecap="round"
                                    strokeWidth="3.5"
                                ></circle>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl xl:text-4xl font-black text-slate-800 dark:text-white">{efficiency}%</span>
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase">Eficiência</span>
                            </div>
                        </div>
                        <div className="mt-8 w-full space-y-3">
                            <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"></div>
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Concluídas</span>
                                </div>
                                <span className="text-[11px] font-extrabold text-slate-800 dark:text-white">{statusCounts.concluida}</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20"></div>
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Em Andamento</span>
                                </div>
                                <span className="text-[11px] font-extrabold text-slate-800 dark:text-white">{statusCounts.iniciada}</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-gray-400 ring-4 ring-gray-400/20"></div>
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Pendentes</span>
                                </div>
                                <span className="text-[11px] font-extrabold text-slate-800 dark:text-white">{statusCounts.pendente}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Diárias Realizadas pelo Efetivo (Full Width Bottom) */}
            <div className="grid grid-cols-1 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h4 className="text-base font-bold text-slate-800 dark:text-white">Diárias Realizadas pelo Efetivo</h4>
                            <p className="text-[10px] font-bold text-[#4c739a] uppercase tracking-widest mt-1">Acumulado - {selectedRankingYear}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <select 
                                value={selectedRankingYear}
                                onChange={(e) => setSelectedRankingYear(Number(e.target.value))}
                                className="block appearance-none w-[60px] box-border flex-none bg-slate-50 dark:bg-slate-800 rounded-lg text-[10px] font-bold px-3 py-1 text-slate-500 focus:ring-1 focus:ring-primary cursor-pointer"
                            >
                                {availableRankingYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                            {memberRankings.length > 0 && (
                                <div className="text-right">
                                    <span className="text-xs font-bold text-primary">{memberRankings[0].totalDiarias} diárias (Max)</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-6">
                        {memberRankings.map((member) => (
                            <div key={member.id} className="relative">
                                <div className="flex items-center gap-4 mb-2">
                                    {/* Avatar */}
                                    <div className="flex-shrink-0">
                                        {member.avatar ? (
                                            <img src={member.avatar} alt={member.war_name || member.name} className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm">
                                                <span className="text-xs font-bold text-slate-500">
                                                    {(member.war_name || member.name || '').charAt(0)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Name and Bar */}
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                {member.abrev} {member.war_name}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500">
                                                {member.totalDiarias} diárias
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-primary h-full rounded-full transition-all duration-500" 
                                                style={{ width: `${(member.totalDiarias / (memberRankings[0]?.totalDiarias || 1)) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {memberRankings.length === 0 && (
                            <div className="text-center text-slate-400 py-8">Nenhum membro encontrado.</div>
                        )}
                    </div>
                </div>
            </div>
            {/* Afastamentos (Unavailability) Ranking */}
            <div className="grid grid-cols-1 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h4 className="text-base font-bold text-slate-800 dark:text-white">Relatórios de Afastamentos</h4>
                            <p className="text-[10px] font-bold text-[#4c739a] uppercase tracking-widest mt-1">Acumulado - {selectedRankingYear}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <select 
                                value={selectedUnavailType}
                                onChange={(e) => setSelectedUnavailType(e.target.value)}
                                className="block appearance-none min-w-[120px] box-border flex-none bg-slate-50 dark:bg-slate-800 rounded-lg text-[10px] font-bold px-3 py-1 text-slate-500 focus:ring-1 focus:ring-primary cursor-pointer"
                            >
                                {availableUnavailTypes.length > 0 ? (
                                    availableUnavailTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))
                                ) : (
                                    <option value="">Nenhum registro</option>
                                )}
                            </select>
                            {unavailRankings.length > 0 && (
                                <div className="text-right">
                                    <span className="text-xs font-bold text-primary">{unavailRankings[0].totalDays} dias (Max)</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-6">
                        {unavailRankings.map((member) => (
                            <div key={member.id} className="relative">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="flex-shrink-0">
                                        {member.avatar ? (
                                            <img src={member.avatar} alt={member.war_name || member.name} className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm">
                                                <span className="text-xs font-bold text-slate-500">
                                                    {(member.war_name || member.name || '').charAt(0)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                {member.abrev} {member.war_name}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500">
                                                {member.totalDays} dias
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-primary h-full rounded-full transition-all duration-500" 
                                                style={{ width: `${(member.totalDays / (unavailRankings[0]?.totalDays || 1)) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {unavailRankings.length === 0 && (
                            <div className="text-center text-slate-400 py-8 italic">Nenhum afastamento do tipo "{selectedUnavailType}" registrado para {selectedRankingYear}.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tempo de Seção */}
            <div className="grid grid-cols-1 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h4 className="text-base font-bold text-slate-800 dark:text-white">Tempo de Seção</h4>
                            <p className="text-[10px] font-bold text-[#4c739a] uppercase tracking-widest mt-1">Calculado a partir da data de entrada</p>
                        </div>
                    </div>
                    <div className="space-y-6">
                        {sectionTimeRanking.map((member) => (
                            <div key={member.id} className="relative">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="flex-shrink-0">
                                        {member.avatar ? (
                                            <img src={member.avatar} alt={member.war_name || member.name} className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm">
                                                <span className="text-xs font-bold text-slate-500">
                                                    {(member.war_name || member.name || '').charAt(0)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                {member.abrev} {member.war_name}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500">
                                                {member.years.toFixed(1)} anos
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-primary h-full rounded-full transition-all duration-500" 
                                                style={{ width: `${(member.years / (sectionTimeRanking[0]?.years || 1)) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {sectionTimeRanking.length === 0 && (
                            <div className="text-center text-slate-400 py-8">Nenhum membro encontrado.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ReportCard = ({ icon, color, title, value, badge, badgeColor, progress }: any) => {
    const bgColors: any = {
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-500',
        indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500',
        rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-500',
        amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-500',
        sky: 'bg-sky-50 dark:bg-sky-900/20 text-sky-500',
        violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-500',
        slate: 'bg-slate-50 dark:bg-slate-800 text-slate-500',
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-lg ${bgColors[color]}`}>
                    <span className="material-symbols-outlined text-xl">{icon}</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${bgColors[badgeColor]}`}>
                    {badge}
                </span>
            </div>
            <p className="text-xs font-semibold text-[#4c739a] dark:text-slate-400">{title}</p>
            {progress !== undefined ? (
                <div className="flex items-center gap-3 mt-1">
                    <h3 className="text-xl font-extrabold text-[#0d141b] dark:text-white">{value}</h3>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            ) : (
                <h3 className="text-xl font-extrabold mt-1 text-[#0d141b] dark:text-white">{value}</h3>
            )}
        </div>
    );
}

const BarChartItem = ({ label, value, percent, color = 'bg-primary' }: any) => (
    <div className="space-y-2">
        <div className="flex justify-between text-[11px] font-bold">
            <span className="text-slate-700 dark:text-slate-300">{label}</span>
            <span className={percent === 100 ? "text-primary" : "text-slate-500"}>{value}</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3.5 rounded-md overflow-hidden ring-1 ring-inset ring-slate-200/50 dark:ring-slate-700">
            <div className={`${color} h-full rounded-md shadow-inner`} style={{ width: `${percent}%` }}></div>
        </div>
    </div>
);

export default Reports;