import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { parseLocalDate, formatLocalDate } from '../utils/dateUtils';

interface Member {
    id: string;
    name: string;
    war_name: string | null;
    rank: string | null;
    abrev: string | null;
}

interface Mission {
    id: string;
    nome: string;
    descricao: string | null;
    local: string;
    data_inicio: string;
    data_fim: string;
    deslocamento: string;
    fav: boolean;
    qtd_equipe: number;
    equipe: string[] | null;
    sector?: string;
}

// Rank Priority Logic
const getRankPriority = (rankStr: string | null, abrevStr: string | null): number => {
    const s = (rankStr || abrevStr || '').toUpperCase().trim();
    if (s.includes('MAJOR') || s.includes('MAJ')) return 0;
    if (s.includes('CAPIT')) return 1;
    if (s.includes('1º TEN') || s.includes('1.º TEN') || s.includes('1TEN')) return 2;
    if (s.includes('2º TEN') || s.includes('2.º TEN') || s.includes('2TEN') || s.includes('ASP')) return 3;
    if (s.includes('SUBOF') || s.includes('SO.')) return 4;
    if (s.includes('1º SAR') || s.includes('1.º SAR') || s.includes('1SGT')) return 5;
    if (s.includes('2º SAR') || s.includes('2.º SAR') || s.includes('2SGT')) return 6;
    if (s.includes('3º SAR') || s.includes('3.º SAR') || s.includes('3SGT')) return 7;
    if (s.includes('SGT')) return 7;
    if (s.includes('CIV')) return 8;
    return 99;
};

const YearlySchedule: React.FC = () => {
    const navigate = useNavigate();
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [availableYears, setAvailableYears] = useState<number[]>([]);
    const [missions, setMissions] = useState<Mission[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [isMonthPopupOpen, setIsMonthPopupOpen] = useState(false);
    const [isReviewPopupOpen, setIsReviewPopupOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [activeSector, setActiveSector] = useState<string>('CP');
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    useEffect(() => {
        const userJson = localStorage.getItem('currentUser');
        if (userJson) {
            const user = JSON.parse(userJson);
            setCurrentUser(user);
            if (user.sector === 'EA') {
                setActiveSector('EA');
            } else {
                setActiveSector('CP');
            }
        }
        fetchAvailableYears();
    }, []);

    useEffect(() => {
        if (activeSector) {
            fetchMembers();
            if (selectedYear) {
                fetchMissions(selectedYear);
            }
        }
    }, [activeSector, selectedYear]);

    const getThresholds = (sector: string) => {
        if (sector === 'EA') {
            return { low: 2, medium: 4 }; // Low 1-2, Med 3-4, High 5+
        }
        return { low: 3, medium: 6 }; // Low 1-3, Med 4-6, High 7+
    };

    const fetchAvailableYears = async () => {
        try {
            const startCheckYear = 2022;
            const endCheckYear = new Date().getFullYear() + 2;
            const foundYears: number[] = [];

            for (let year = startCheckYear; year <= endCheckYear; year++) {
                let query = supabase
                    .from('missions')
                    .select('id', { count: 'exact', head: true })
                    .gte('data_inicio', `${year}-01-01`)
                    .lte('data_inicio', `${year}-12-31`);
                
                if (activeSector === 'CP' || activeSector === 'EA') {
                    query = query.eq('sector', activeSector);
                }

                const { count } = await query;
                if (count && count > 0) {
                    foundYears.push(year);
                }
            }

            const sortedYears = foundYears.sort((a, b) => b - a);
            setAvailableYears(sortedYears.length > 0 ? sortedYears : [new Date().getFullYear()]);
            
            if (sortedYears.length > 0 && !sortedYears.includes(selectedYear)) {
                setSelectedYear(sortedYears[0]);
            }
        } catch (error) {
            console.error('Error fetching available years:', error);
        }
    };

    const fetchMissions = async (year: number) => {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        
        let query = supabase
            .from('missions')
            .select('*')
            .gte('data_inicio', startDate)
            .lte('data_inicio', endDate)
            .order('data_inicio');
            
        if (activeSector === 'CP' || activeSector === 'EA') {
            query = query.eq('sector', activeSector);
        }

        const { data, error } = await query;
        if (!error && data) {
            setMissions(data);
        }
    };

    const fetchMembers = async () => {
        let query = supabase.from('members').select('id, name, war_name, rank, abrev');
        if (activeSector === 'CP' || activeSector === 'EA') {
            query = query.eq('sector', activeSector);
        }
        const { data, error } = await query;
        if (!error && data) {
            const sorted = data.sort((a, b) => {
                const pA = getRankPriority(a.rank, a.abrev);
                const pB = getRankPriority(b.rank, b.abrev);
                if (pA !== pB) return pA - pB;
                const nameA = a.war_name || a.name || '';
                const nameB = b.war_name || b.name || '';
                return nameA.localeCompare(nameB);
            });
            setMembers(sorted);
        }
    };

    const getMemberNames = (equipe: string[] | null): string[] => {
        if (!equipe || equipe.length === 0) return [];
        
        // Pega os objetos dos membros da equipe
        const teamMembers = equipe
            .map(id => members.find(m => m.id === id))
            .filter((m): m is Member => !!m);

        // Ordena por Rank e depois por Nome
        teamMembers.sort((a, b) => {
            const pA = getRankPriority(a.rank, a.abrev);
            const pB = getRankPriority(b.rank, b.abrev);
            if (pA !== pB) return pA - pB;
            const nameA = a.war_name || a.name || '';
            const nameB = b.war_name || b.name || '';
            return nameA.localeCompare(nameB);
        });

        return teamMembers.map(member => {
            const abbrev = member.abrev || '';
            const name = member.war_name || member.name;
            return abbrev ? `${abbrev} ${name}` : name;
        });
    };

    // --- FUNÇÕES DE DATA CORRIGIDAS (AJUSTE DE FUSO HORÁRIO) ---

    // Função auxiliar para formatar a data visualmente (O "Terceiro Ajuste")
    // Transforma '2024-01-20' em '20/01/2024' manualmente
    const formatDateString = (dateString: string): string => {
        return formatLocalDate(dateString, '');
    };

    const getMissionsForMonth = (month: number, onlyStartingInMonth: boolean = false): Mission[] => {
        const firstDayOfMonth = new Date(selectedYear, month, 1).getTime();
        const lastDayOfMonth = new Date(selectedYear, month + 1, 0, 23, 59, 59).getTime();

        return missions.filter(m => {
            const startDate = parseLocalDate(m.data_inicio)?.getTime() || 0;
            const endD = parseLocalDate(m.data_fim);
            const endDate = endD ? new Date(endD.getFullYear(), endD.getMonth(), endD.getDate(), 23, 59, 59).getTime() : 0;

            // For the yearly review list, we only want to show missions that START in that month
            if (onlyStartingInMonth) {
                return (startDate >= firstDayOfMonth && startDate <= lastDayOfMonth);
            }

            // For the monthly popup/cards, we show anything that overlaps
            return (startDate <= lastDayOfMonth && endDate >= firstDayOfMonth);
        });
    };

    const getMissionsForDay = (month: number, day: number): Mission[] => {
        return missions.filter(m => {
            // Data do calendário que estamos verificando (Meia-noite Local)
            const checkDate = new Date(selectedYear, month, day).getTime();

            // Pega as datas de inicio e fim
            const startDate = parseLocalDate(m.data_inicio)?.getTime() || 0;
            const endDate = parseLocalDate(m.data_fim)?.getTime() || 0;

            return checkDate >= startDate && checkDate <= endDate;
        });
    };

    const getHeatmapDataForMonth = (month: number): number[] => {
        const daysWithMissions: number[] = [];
        const daysInMonth = new Date(selectedYear, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dayMissions = getMissionsForDay(month, day);
            if (dayMissions.length > 0) {
                daysWithMissions.push(day);
            }
        }
        return daysWithMissions;
    };

    const getTeamSizeForDay = (month: number, day: number): number => {
        const dayMissions = getMissionsForDay(month, day);
        return dayMissions.reduce((sum, m) => sum + (m.qtd_equipe || 0), 0);
    };

    const calculateDuration = (startDate: string, endDate: string): number => {
        const start = parseLocalDate(startDate);
        const end = parseLocalDate(endDate);
        if (!start || !end) return 0;
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays + 0.5;
    };

    const getStartDayOfMonth = (month: number): number => {
        return new Date(selectedYear, month, 1).getDay();
    };

    const getDaysInMonth = (month: number): number => {
        return new Date(selectedYear, month + 1, 0).getDate();
    };

    const openMonthPopup = (month: number) => {
        setSelectedMonth(month);
        setIsMonthPopupOpen(true);
    };

    const [missionToDelete, setMissionToDelete] = useState<Mission | null>(null);

    const handleEditMission = (missionId: string) => {
        navigate(`/app/schedule/adjustment?id=${missionId}`);
    };

    const handleDeleteClick = (mission: Mission) => {
        setMissionToDelete(mission);
    };

    const confirmDelete = async () => {
        if (!missionToDelete) return;
        const { error } = await supabase
            .from('missions')
            .delete()
            .eq('id', missionToDelete.id);
        if (!error) {
            fetchMissions(selectedYear);
            setMissionToDelete(null);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (missionToDelete) {
                if (e.key === 'Enter') {
                    confirmDelete();
                } else if (e.key === 'Escape') {
                    setMissionToDelete(null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [missionToDelete, confirmDelete]);

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-[#0d141b] dark:text-white text-3xl font-black tracking-tight">Cronograma Anual de Missões</h1>
                    <p className="text-[#4c739a] dark:text-slate-400">Visão consolidada da efetividade externa da equipe.</p>
                </div>
                <div className="flex gap-3 items-center">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="px-4 py-3 w-[90px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-primary"
                    >
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    {currentUser?.sector === 'CH' && (
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setActiveSector('CP')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                    activeSector === 'CP'
                                        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                CAPACIDADE (CP)
                            </button>
                            <button
                                onClick={() => setActiveSector('EA')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                    activeSector === 'EA'
                                        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                ESPAÇO AÉREO (EA)
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setIsReviewPopupOpen(true)}
                        className="px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        Rever Planejamento
                    </button>
                    <button 
                        onClick={() => navigate('/app/schedule/adjustment')}
                        className="px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">add</span>
                        <span>Cadastrar Nova Viagem</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {monthNames.map((month, index) => (
                    <MonthCard
                        key={month}
                        month={month}
                        year={selectedYear.toString()}
                        days={getDaysInMonth(index)}
                        startDay={getStartDayOfMonth(index)}
                        heatmapData={getHeatmapDataForMonth(index)}
                        missionsCount={getMissionsForMonth(index).length}
                        onMonthClick={() => openMonthPopup(index)}
                        monthIndex={index}
                        selectedYear={selectedYear}
                        getTeamSizeForDay={getTeamSizeForDay}
                        activeSector={activeSector}
                    />
                ))}
            </div>

            <div className="mt-8 bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">Efetividade (Integrantes fora):</div>
                <div className="flex flex-wrap gap-4">
                    <LegendItem color="bg-green-500" label={`Baixa (1-${getThresholds(activeSector).low})`} />
                    <LegendItem color="bg-yellow-500" label={`Média (${getThresholds(activeSector).low + 1}-${getThresholds(activeSector).medium})`} />
                    <LegendItem color="bg-red-500" label={`Alta (${getThresholds(activeSector).medium + 1}+)`} />
                    <div className="flex items-center gap-2 ml-4">
                        <div className="size-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"></div>
                        <span className="text-xs font-medium dark:text-slate-300">Sem Missão</span>
                    </div>
                </div>
            </div>

            {/* Month Popup Modal */}
            {isMonthPopupOpen && selectedMonth !== null && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsMonthPopupOpen(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-auto" onClick={e => e.stopPropagation()}>
                        <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                                {monthNames[selectedMonth]} {selectedYear}
                            </h2>
                            <button onClick={() => setIsMonthPopupOpen(false)} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <span className="material-symbols-outlined text-slate-500">close</span>
                            </button>
                        </div>
                        <div className="p-6">
                            {/* Larger Calendar */}
                            <div className="mb-6">
                                <div className="grid grid-cols-7 gap-3 mb-3">
                                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => (
                                        <div key={i} className="text-center text-xs font-bold text-slate-400 uppercase">{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-3">
                                    {Array.from({ length: getStartDayOfMonth(selectedMonth) }).map((_, i) => (
                                        <div key={`empty-${i}`} className="aspect-square"></div>
                                    ))}
                                    {Array.from({ length: getDaysInMonth(selectedMonth) }).map((_, i) => {
                                        const day = i + 1;
                                        const dayMissions = getMissionsForDay(selectedMonth, day);
                                        const teamSize = dayMissions.reduce((sum, m) => sum + (m.qtd_equipe || 0), 0);
                                        
                                        let bgClass = "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-white";
                                        let textClass = "";

                                        if (dayMissions.length > 0) {
                                            const thresholds = getThresholds(activeSector);
                                            textClass = "text-white";
                                            if (teamSize >= thresholds.medium + 1) bgClass = "bg-red-500";
                                            else if (teamSize >= thresholds.low + 1) bgClass = "bg-yellow-500";
                                            else bgClass = "bg-green-500";
                                        }

                                        return (
                                            <div
                                                key={day}
                                                className={`aspect-square flex items-center justify-center text-base font-bold rounded-xl ${bgClass} ${textClass} relative cursor-pointer hover:ring-2 hover:ring-primary transition-all group`}
                                            >
                                                {day}
                                                {dayMissions.length > 0 && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-[70] pointer-events-none">
                                                        <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                                                            {dayMissions.map(m => (
                                                                <div key={m.id} className="flex items-center gap-2">
                                                                    <span className="font-semibold">{m.nome}</span>
                                                                    <span className="text-slate-400">({m.qtd_equipe} pessoas)</span>
                                                                </div>
                                                            ))}
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Missions Table */}
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Missões do Mês</h3>
                                {getMissionsForMonth(selectedMonth).length === 0 ? (
                                    <p className="text-slate-500 text-center py-8">Nenhuma missão neste mês</p>
                                ) : (
                                    <div className="overflow-visible">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                                    <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Nome</th>
                                                    <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Local</th>
                                                    <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Período</th>
                                                    <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Duração</th>
                                                    <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Equipe</th>
                                                    <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {getMissionsForMonth(selectedMonth).map(mission => (
                                                    <tr key={mission.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                        <td className="py-3 px-2">
                                                            <div className="flex items-center gap-2">
                                                                {mission.fav && <span className="material-symbols-outlined text-yellow-500 text-sm">star</span>}
                                                                <span className="font-semibold text-slate-800 dark:text-white">{mission.nome}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-2 text-slate-600 dark:text-slate-400">{mission.local}</td>
                                                        <td className="py-3 px-2 text-slate-600 dark:text-slate-400">
                                                            {/* AQUI ESTAVA O PROBLEMA DE DATA VISUAL. CORRIGIDO COM formatDateString */}
                                                            {formatDateString(mission.data_inicio)} - {formatDateString(mission.data_fim)}
                                                        </td>
                                                        <td className="py-3 px-2">
                                                            <span className="bg-primary/10 text-primary px-2 py-1 rounded-lg font-bold text-xs">
                                                                {calculateDuration(mission.data_inicio, mission.data_fim)} dias
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-2 relative group">
                                                            <span className="font-bold text-slate-800 dark:text-white cursor-help">{mission.qtd_equipe}</span>
                                                            <span className="text-slate-500 text-xs ml-1">pessoas</span>
                                                            {mission.equipe && mission.equipe.length > 0 && (
                                                                <div className="absolute bottom-full left-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-[70] pointer-events-none">
                                                                    <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                                                                        {getMemberNames(mission.equipe).map((name, idx) => (
                                                                            <div key={idx}>{name}</div>
                                                                        ))}
                                                                        <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-900"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-2">
                                                            <div className="flex gap-1">
                                                                <button 
                                                                    onClick={() => handleEditMission(mission.id)}
                                                                    className="size-8 flex items-center justify-center rounded-lg hover:bg-primary/10 text-primary transition-colors"
                                                                    title="Editar"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDeleteClick(mission)}
                                                                    className="size-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                                                                    title="Excluir"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Popup Modal */}
            {isReviewPopupOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsReviewPopupOpen(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-auto" onClick={e => e.stopPropagation()}>
                        <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                                Planejamento Anual - {selectedYear}
                            </h2>
                            <button onClick={() => setIsReviewPopupOpen(false)} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <span className="material-symbols-outlined text-slate-500">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-8">
                            {monthNames.map((monthName, monthIndex) => {
                                const monthMissions = getMissionsForMonth(monthIndex, true);
                                if (monthMissions.length === 0) return null;
                                
                                return (
                                    <div key={monthName}>
                                        <div className="flex items-center gap-3 mb-4">
                                            <h3 className="text-lg font-bold text-primary">{monthName}</h3>
                                            <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                                                {monthMissions.length} {monthMissions.length === 1 ? 'missão' : 'missões'}
                                            </span>
                                        </div>
                                        <div className="overflow-visible">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                                        <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Nome</th>
                                                        <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Local</th>
                                                        <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Período</th>
                                                        <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Duração</th>
                                                        <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Equipe</th>
                                                        <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {monthMissions.map(mission => (
                                                        <tr key={mission.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                            <td className="py-3 px-2">
                                                                <div className="flex items-center gap-2">
                                                                    {mission.fav && <span className="material-symbols-outlined text-yellow-500 text-sm">star</span>}
                                                                    <span className="font-semibold text-slate-800 dark:text-white">{mission.nome}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-2 text-slate-600 dark:text-slate-400">{mission.local}</td>
                                                            <td className="py-3 px-2 text-slate-600 dark:text-slate-400">
                                                                {/* CORREÇÃO APLICADA AQUI TAMBÉM */}
                                                                {formatDateString(mission.data_inicio)} - {formatDateString(mission.data_fim)}
                                                            </td>
                                                            <td className="py-3 px-2">
                                                                <span className="bg-primary/10 text-primary px-2 py-1 rounded-lg font-bold text-xs">
                                                                    {calculateDuration(mission.data_inicio, mission.data_fim)} dias
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-2">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="font-bold text-slate-800 dark:text-white">{mission.qtd_equipe} pessoas</span>
                                                                    {mission.equipe && mission.equipe.length > 0 && (
                                                                        <span className="text-xs text-slate-500">
                                                                            {getMemberNames(mission.equipe).join(', ')}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-2">
                                                                <div className="flex gap-1">
                                                                    <button 
                                                                        onClick={() => handleEditMission(mission.id)}
                                                                        className="size-8 flex items-center justify-center rounded-lg hover:bg-primary/10 text-primary transition-colors"
                                                                        title="Editar"
                                                                    >
                                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleDeleteClick(mission)}
                                                                        className="size-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                                                                        title="Excluir"
                                                                    >
                                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                            {missions.length === 0 && (
                                <p className="text-slate-500 text-center py-8">Nenhuma missão cadastrada para {selectedYear}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {missionToDelete && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
                        <div className="p-8 flex flex-col items-center text-center">
                            <div className="size-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-3xl text-red-500">delete</span>
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">Confirmar Exclusão</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8">
                                Tem certeza que deseja deletar o registro de <strong className="text-slate-800 dark:text-white">{missionToDelete.nome}</strong>? <br/>
                                Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button 
                                    onClick={() => setMissionToDelete(null)}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={confirmDelete}
                                    className="flex-1 py-3 rounded-xl bg-red-500 font-bold text-white hover:bg-red-600 shadow-lg shadow-red-500/30 transition-colors"
                                >
                                    Excluir Registro
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

interface MonthCardProps {
    month: string;
    year: string;
    days: number;
    startDay: number;
    heatmapData: number[];
    missionsCount: number;
    onMonthClick: () => void;
    monthIndex: number;
    selectedYear: number;
    getTeamSizeForDay: (month: number, day: number) => number;
    activeSector: string;
}

const MonthCard: React.FC<MonthCardProps> = ({ month, year, days, startDay, heatmapData, missionsCount, onMonthClick, monthIndex, getTeamSizeForDay, activeSector }) => {
    const cells = [];
    for (let i = 0; i < startDay; i++) {
        cells.push(<div key={`empty-${i}`} className="aspect-square"></div>);
    }
    
    for (let i = 1; i <= days; i++) {
        const teamSize = getTeamSizeForDay(monthIndex, i);
        let bgClass = "bg-slate-50 dark:bg-slate-800 text-[#0d141b] dark:text-white";
        let textClass = "";
        if (heatmapData.includes(i)) {
            const thresholds = activeSector === 'EA' ? { low: 2, medium: 4 } : { low: 3, medium: 6 };
            textClass = "text-white";
            if (teamSize >= thresholds.medium + 1) bgClass = "bg-red-500";
            else if (teamSize >= thresholds.low + 1) bgClass = "bg-yellow-500";
            else bgClass = "bg-green-500";
        }

        cells.push(
            <div key={i} className={`aspect-square flex items-center justify-center text-xs font-bold rounded-sm ${bgClass} ${textClass}`}>
                {i}
            </div>
        );
    }

    return (
        <div 
            className="bg-white dark:bg-slate-900 rounded-2xl border border-[#e7edf3] dark:border-slate-800 p-5 shadow-sm cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all"
            onClick={onMonthClick}
        >
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 dark:text-white">{month}</h3>
                    {missionsCount > 0 && (
                        <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {missionsCount} {missionsCount === 1 ? 'missão' : 'missões'}
                        </span>
                    )}
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{year}</span>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-bold text-slate-400">{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {cells}
            </div>
        </div>
    );
};

const LegendItem = ({ color, label }: { color: string; label: string }) => (
    <div className="flex items-center gap-2">
        <div className={`size-4 ${color} rounded`}></div>
        <span className="text-xs font-medium dark:text-slate-300">{label}</span>
    </div>
);

export default YearlySchedule;
