import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

interface Task {
    id: string;
    name: string;
    periodicity: string;
    start_date: string;
    end_date: string | null;
    recurrence_active: boolean;
    status: string;
    preassigned_to?: string | null;
}

interface MemberBasic {
    id: string;
    name: string;
    war_name?: string;
    rank: string;
    abrev?: string;
    avatar: string;
    specialty: string;
}

interface Unavailability {
    id: number;
    member: string;
    type: string;
    start_date: string;
    end_date: string;
}

interface Mission {
    id: string;
    nome: string;
    data_inicio: string;
    data_fim: string;
    equipe: string[] | null;
}

const UNAVAIL_TYPES = ['SALOP', 'CAIS', 'RISAER', 'Férias', 'Dispensa', 'Home Office', 'Aniversário', 'Outros'];
const ABREV_ORDER = ['SO.', 'Sgt.', 'Cv.'];

const MonthlyPlanner: React.FC = () => {
    const navigate = useNavigate();
    const today = new Date();
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [anchorDate, setAnchorDate] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    const [tasks, setTasks] = useState<Task[]>([]);
    const [members, setMembers] = useState<MemberBasic[]>([]);
    const [allMembers, setAllMembers] = useState<MemberBasic[]>([]);
    const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([]);
    const [missions, setMissions] = useState<Mission[]>([]);
    const [loading, setLoading] = useState(true);

    // Unavailability Modal
    const [showUnavailModal, setShowUnavailModal] = useState(false);
    const [unavailForm, setUnavailForm] = useState<{
        id?: number;
        member: string;
        type: string;
        start_date: string;
        end_date: string;
    }>({ member: '', type: '', start_date: '', end_date: '' });

    // Task Assignment Modal
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignTask, setAssignTask] = useState<Task | null>(null);
    const [assignMemberId, setAssignMemberId] = useState('');

    const currentMonth = anchorDate.getMonth();
    const currentYear = anchorDate.getFullYear();

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [tasksRes, membersRes, allMembersRes, unavailRes, missionsRes] = await Promise.all([
                supabase.from('tasks').select('*'),
                supabase.from('members').select('id, name, war_name, rank, abrev, avatar, specialty').in('abrev', ABREV_ORDER),
                supabase.from('members').select('id, name, war_name, rank, abrev, avatar, specialty'),
                supabase.from('unavailability').select('*'),
                supabase.from('missions').select('id, nome, data_inicio, data_fim, equipe'),
            ]);
            if (tasksRes.error) throw tasksRes.error;
            if (membersRes.error) throw membersRes.error;
            if (allMembersRes.error) throw allMembersRes.error;
            if (unavailRes.error) throw unavailRes.error;
            if (missionsRes.error) throw missionsRes.error;
            setTasks(tasksRes.data || []);
            setMembers(membersRes.data || []);
            setAllMembers(allMembersRes.data || []);
            setUnavailabilities(unavailRes.data || []);
            setMissions(missionsRes.data || []);
        } catch (err: any) {
            console.error('Error fetching data:', err.message);
        } finally {
            setLoading(false);
        }
    };

    const allMembersMap = useMemo(() => {
        const map: Record<string, MemberBasic> = {};
        allMembers.forEach(m => { map[m.id] = m; });
        return map;
    }, [allMembers]);

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const isBusinessDay = (date: Date) => {
        const day = date.getDay();
        return day !== 0 && day !== 6;
    };

    const getFirstBusinessDayOfMonth = (year: number, month: number) => {
        for (let day = 1; day <= 7; day++) {
            const date = new Date(year, month, day);
            if (isBusinessDay(date)) return day;
        }
        return 1;
    };

    const getNextWeekRange = () => {
        const now = new Date();
        const nextSunday = new Date(now);
        nextSunday.setDate(now.getDate() + (7 - now.getDay()));
        nextSunday.setHours(0, 0, 0, 0);
        const nextSaturday = new Date(nextSunday);
        nextSaturday.setDate(nextSunday.getDate() + 6);
        nextSaturday.setHours(23, 59, 59, 999);
        return { start: nextSunday, end: nextSaturday };
    };

    const nextWeekRange = getNextWeekRange();

    // Returns tasks for a given day with a flag indicating if each is projected
    const getTasksForDay = (day: number, month?: number, year?: number): { task: Task; isProjected: boolean }[] => {
        const targetMonth = month !== undefined ? month : currentMonth;
        const targetYear = year !== undefined ? year : currentYear;
        const date = new Date(targetYear, targetMonth, day);
        const dayOfWeek = date.getDay();
        const dateString = date.toISOString().split('T')[0];

        const periodicityOrder: Record<string, number> = {
            'pontual': 1, 'temporada': 2, 'mensal': 3,
            'quinzenal': 4, 'semanal': 5, 'diaria': 6
        };

        const results: { task: Task; isProjected: boolean }[] = [];

        tasks.forEach(task => {
            const taskStartStr = task.start_date.split('T')[0];
            const taskStart = new Date(taskStartStr);
            if (date < taskStart) return;

            // Real task instance for this day
            if (taskStartStr === dateString) {
                results.push({ task, isProjected: false });
                return;
            }

            // Handle recurring templates
            if (task.recurrence_active) {
                let isProjected = false;
                const p = task.periodicity.toLowerCase();

                if (p === 'diaria') isProjected = isBusinessDay(date);
                else if (p === 'semanal') isProjected = dayOfWeek === 1;
                else if (p === 'quinzenal') {
                    const diffTime = date.getTime() - taskStart.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    isProjected = diffDays >= 0 && diffDays % 14 === 0;
                }
                else if (p === 'mensal') isProjected = day === getFirstBusinessDayOfMonth(targetYear, targetMonth);

                if (isProjected) {
                    if (date >= nextWeekRange.start && date <= nextWeekRange.end) {
                        const existsReal = tasks.some(t =>
                            t.name === task.name &&
                            t.start_date.split('T')[0] === dateString &&
                            !t.recurrence_active
                        );
                        if (existsReal) return;
                    }
                    results.push({ task, isProjected: true });
                }
            }
        });

        results.sort((a, b) => {
            const orderA = periodicityOrder[a.task.periodicity.toLowerCase()] || 99;
            const orderB = periodicityOrder[b.task.periodicity.toLowerCase()] || 99;
            return orderA - orderB;
        });

        return results;
    };

    const getUnavailForDay = (dateStr: string) => {
        return unavailabilities.filter(u => {
            const start = u.start_date.split('T')[0];
            const end = u.end_date.split('T')[0];
            return dateStr >= start && dateStr <= end;
        });
    };

    const getMissionsForDay = (dateStr: string) => {
        return missions.filter(m => {
            const start = m.data_inicio.split('T')[0];
            const end = m.data_fim.split('T')[0];
            return dateStr >= start && dateStr <= end;
        });
    };

    const handlePrev = () => {
        const newDate = new Date(anchorDate);
        if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
        else newDate.setDate(newDate.getDate() - 7);
        setAnchorDate(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(anchorDate);
        if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
        else newDate.setDate(newDate.getDate() + 7);
        setAnchorDate(newDate);
    };

    const getWeekDays = () => {
        const startOfWeek = new Date(anchorDate);
        startOfWeek.setDate(anchorDate.getDate() - anchorDate.getDay());
        return Array.from({ length: 7 }).map((_, i) => {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            return date;
        });
    };

    // ========== Unavailability CRUD ==========
    const openUnavailModal = (dateStr: string) => {
        setUnavailForm({ member: '', type: '', start_date: dateStr, end_date: '' });
        setShowUnavailModal(true);
    };

    const openEditUnavail = (u: Unavailability, e: React.MouseEvent) => {
        e.stopPropagation();
        setUnavailForm({
            id: u.id,
            member: u.member,
            type: u.type,
            start_date: u.start_date.split('T')[0],
            end_date: u.end_date.split('T')[0],
        });
        setShowUnavailModal(true);
    };

    const saveUnavail = async () => {
        if (!unavailForm.member || !unavailForm.type || !unavailForm.start_date || !unavailForm.end_date) {
            console.warn("Missing fields in unavailability form", unavailForm);
            return;
        }
        try {
            const payload = {
                member: unavailForm.member,
                type: unavailForm.type,
                start_date: unavailForm.start_date,
                end_date: unavailForm.end_date,
            };
            
            if (unavailForm.id) {
                const { error } = await supabase.from('unavailability').update(payload).eq('id', unavailForm.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('unavailability').insert(payload);
                if (error) throw error;
            }
            setShowUnavailModal(false);
            fetchAll();
        } catch (err: any) {
            console.error('Error saving unavailability:', err.message);
            alert('Erro ao salvar indisponibilidade: ' + err.message);
        }
    };

    const deleteUnavail = async () => {
        if (!unavailForm.id) return;
        try {
            const { error } = await supabase.from('unavailability').delete().eq('id', unavailForm.id);
            if (error) throw error;
            setShowUnavailModal(false);
            fetchAll();
        } catch (err: any) {
            console.error('Error deleting unavailability:', err.message);
        }
    };

    // ========== Task Assignment (real tasks only) ==========
    const openAssignModal = (task: Task, isProjected: boolean, e: React.MouseEvent) => {
        e.stopPropagation();
        if (isProjected) return; // Only allow assignment for real tasks
        setAssignTask(task);
        setAssignMemberId(task.preassigned_to || '');
        setShowAssignModal(true);
    };

    const saveAssignment = async () => {
        if (!assignTask) return;
        try {
            const { error } = await supabase.from('tasks').update({
                preassigned_to: assignMemberId || null,
            }).eq('id', assignTask.id);
            if (error) throw error;
            setShowAssignModal(false);
            fetchAll();
        } catch (err: any) {
            console.error('Error assigning task:', err.message);
        }
    };

    // ========== Unavailability color map ==========
    const unavailColor = (type: string) => {
        switch (type) {
            case 'SALOP': return 'bg-red-100 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400';
            case 'CAIS': return 'bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400';
            case 'Férias': return 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400';
            case 'HO': return 'bg-sky-100 border-sky-300 text-sky-700 dark:bg-sky-900/30 dark:border-sky-800 dark:text-sky-400';
            case 'Dispensa': return 'bg-yellow-100 border-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-400';
            case 'RISAER': return 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400';
            case 'Aniversário': return 'bg-pink-100 border-pink-300 text-pink-700 dark:bg-pink-900/30 dark:border-pink-800 dark:text-pink-400';
            case 'Outros': return 'bg-slate-100 border-slate-300 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400';
            default: return 'bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300';
        }
    };

    // ========== Render Helpers ==========
    const renderTaskItem = (task: Task, day: number, isProjected: boolean, tooltipDown: boolean = false) => {
        const assignedMember = task.preassigned_to ? allMembersMap[task.preassigned_to] : null;

        const periodColors: any = {
            'diaria': 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-300',
            'semanal': 'bg-indigo-50 border-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400',
            'quinzenal': 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400',
            'mensal': 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400',
            'temporada': 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400',
            'pontual': 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400',
        };

        const periodBar: any = {
            'diaria': 'bg-slate-400',
            'semanal': 'bg-indigo-500',
            'quinzenal': 'bg-blue-500',
            'mensal': 'bg-emerald-600',
            'temporada': 'bg-amber-500',
            'pontual': 'bg-rose-500',
        };

        const colors = periodColors[task.periodicity] || periodColors['diária'];
        const barColor = periodBar[task.periodicity] || periodBar['diária'];

        return (
            <div
                key={`${task.id}-${day}-${isProjected ? 'p' : 'r'}`}
                onClick={(e) => openAssignModal(task, isProjected, e)}
                className={`group/task relative flex items-center h-12 ${colors} border rounded-lg px-3 overflow-visible transition-all hover:shadow-md ${isProjected ? 'cursor-default opacity-70' : 'cursor-pointer'}`}
            >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${barColor}`} />

                {assignedMember && assignedMember.avatar && (
                    <img
                        src={assignedMember.avatar}
                        alt=""
                        className="size-7 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm ml-1 mr-1.5 flex-shrink-0"
                    />
                )}

                <div className={`${assignedMember ? '' : 'ml-1'} w-full flex flex-col justify-center gap-0.5 min-w-0`}>
                    <div className="text-[11px] font-black leading-none truncate uppercase tracking-tight">
                        {task.name}
                    </div>
                    <div className="text-[9px] font-bold opacity-70 leading-none truncate capitalize">
                        {task.periodicity}
                    </div>
                </div>

                {/* Custom Tooltip */}
                {assignedMember && (
                    <div className={`absolute ${tooltipDown ? 'top-full mt-2' : 'bottom-full mb-2'} left-1/2 -translate-x-1/2 opacity-0 group-hover/task:opacity-100 transition-opacity z-[70] pointer-events-none`}>
                        <div className="bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-lg px-3 py-1.5 whitespace-nowrap shadow-xl border border-white/10 relative">
                            {assignedMember.abrev || assignedMember.rank} {assignedMember.war_name || assignedMember.name}
                            <div className={`absolute ${tooltipDown ? 'bottom-full border-b-slate-900 dark:border-b-slate-800' : 'top-full border-t-slate-900 dark:border-t-slate-800'} left-1/2 -translate-x-1/2 border-[6px] border-transparent`} />
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderUnavailItem = (u: Unavailability, dateStr: string) => {
        const member = allMembersMap[u.member];
        if (!member) return null;
        return (
            <div
                key={`unavail-${u.id}-${dateStr}`}
                onClick={(e) => openEditUnavail(u, e)}
                className={`flex items-center gap-1.5 h-8 ${unavailColor(u.type)} border rounded-lg px-2 cursor-pointer hover:shadow-md transition-all`}
            >
                <span className="material-symbols-outlined text-[14px]">event_busy</span>
                <span className="text-[10px] font-black truncate uppercase tracking-tight">
                    {member.war_name || member.name} — {u.type}
                </span>
            </div>
        );
    };

    const renderMissionItem = (m: Mission, dateStr: string) => {
        const teamMembers = (m.equipe || [])
            .map(id => allMembersMap[id])
            .filter(Boolean);

        return (
            <div
                key={`mission-${m.id}-${dateStr}`}
                className="group/mission relative flex items-center gap-1.5 h-8 bg-cyan-100 border border-cyan-300 text-cyan-800 dark:bg-cyan-900/30 dark:border-cyan-800 dark:text-cyan-400 rounded-lg px-2 cursor-default hover:shadow-md transition-all overflow-visible"
                onClick={(e) => e.stopPropagation()}
            >
                <span className="material-symbols-outlined text-[14px]">flight_takeoff</span>
                <span className="text-[10px] font-black truncate uppercase tracking-tight">
                    {m.nome}
                </span>

                {/* Custom Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover/mission:opacity-100 transition-opacity z-[70] pointer-events-none">
                    <div className="bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold rounded-lg px-3 py-2 whitespace-nowrap shadow-xl border border-white/10 relative">
                        <div className="text-cyan-400 mb-1 font-black uppercase text-[9px] tracking-widest border-b border-white/10 pb-1">Equipe da Missão</div>
                        {teamMembers.length > 0 ? (
                            <div className="space-y-0.5">
                                {teamMembers.map(mem => (
                                    <div key={mem.id}>{mem.abrev || mem.rank} {mem.war_name || mem.name}</div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-slate-400">Sem equipe definida</div>
                        )}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-b-slate-900 dark:border-b-slate-800"></div>
                    </div>
                </div>
            </div>
        );
    };

    const renderDayContent = (dateObj: Date, dayTaskItems: { task: Task; isProjected: boolean }[], dateStr: string) => {
        const dayUnavails = getUnavailForDay(dateStr);
        const dayMissions = getMissionsForDay(dateStr);

        return (
            <>
                {dayMissions.map(m => renderMissionItem(m, dateStr))}
                {dayUnavails.map(u => renderUnavailItem(u, dateStr))}
                {dayTaskItems.map(({ task, isProjected }, index) => {
                    // Tooltip goes down if it's the first task item in the list
                    const tooltipDown = index === 0;
                    return renderTaskItem(task, dateObj.getDate(), isProjected, tooltipDown);
                })}
            </>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-background-dark animate-in fade-in duration-500">

            {/* Action Bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#f8fafc] dark:bg-background-dark">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center justify-center p-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[#4c739a] text-[24px]">arrow_back</span>
                    </button>
                    <h1 className="text-[#0d141b] dark:text-white text-[28px] font-black leading-tight tracking-[-0.033em]">Cronograma</h1>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500'}`}
                        >
                            Mês
                        </button>
                        <button
                            onClick={() => setViewMode('week')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'week' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500'}`}
                        >
                            Semana
                        </button>
                    </div>

                    <div className="flex items-center bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        <button
                            onClick={handlePrev}
                            className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#4c739a] border-r border-[#e7edf3] dark:border-slate-800 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                        </button>
                        <div className="px-8 py-2 min-w-[200px] text-center">
                            <span className="text-lg font-bold text-[#0d141b] dark:text-white">
                                {viewMode === 'month'
                                    ? `${monthNames[currentMonth]} ${currentYear}`
                                    : `Semana de ${getWeekDays()[0].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
                                }
                            </span>
                        </div>
                        <button
                            onClick={handleNext}
                            className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#4c739a] border-l border-[#e7edf3] dark:border-slate-800 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 p-6 pt-0 overflow-hidden">
                <div className="h-full border border-[#e7edf3] dark:border-slate-800 rounded-[28px] bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden flex flex-col">
                    <div className="grid grid-cols-7 border-b border-[#e7edf3] dark:border-slate-800">
                        {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(day => (
                            <div key={day} className="py-5 text-center text-sm font-black text-[#5c85ad] dark:text-slate-400 uppercase tracking-widest">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className={`flex-1 grid grid-cols-7 ${viewMode === 'month' ? 'auto-rows-fr' : ''} overflow-hidden`}>
                        {viewMode === 'month' ? (
                            <>
                                {Array.from({ length: getFirstDayOfMonth(currentYear, currentMonth) }).map((_, i) => (
                                    <div key={`empty-${i}`} className="border-r border-b border-[#e7edf3] dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20" />
                                ))}

                                {Array.from({ length: getDaysInMonth(currentYear, currentMonth) }).map((_, i) => {
                                    const day = i + 1;
                                    const dateObj = new Date(currentYear, currentMonth, day);
                                    const dateStr = dateObj.toISOString().split('T')[0];
                                    const dayTaskItems = getTasksForDay(day);
                                    const isToday = today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;

                                    return (
                                        <div
                                            key={day}
                                            onClick={() => openUnavailModal(dateStr)}
                                            className="relative flex flex-col border-r border-b border-[#e7edf3] dark:border-slate-800 p-3 group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer"
                                        >
                                            <div className="flex justify-start mb-2">
                                                <span className={`text-base font-black ${isToday ? 'size-8 flex items-center justify-center bg-blue-600 text-white rounded-full' : 'text-[#0d141b] dark:text-slate-300'}`}>
                                                    {day}
                                                </span>
                                            </div>
                                            <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                                {renderDayContent(dateObj, dayTaskItems, dateStr)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        ) : (
                            getWeekDays().map((date, i) => {
                                const dateStr = date.toISOString().split('T')[0];
                                const dayTaskItems = getTasksForDay(date.getDate(), date.getMonth(), date.getFullYear());
                                const isToday = date.toDateString() === today.toDateString();

                                return (
                                    <div
                                        key={`week-day-${i}`}
                                        onClick={() => openUnavailModal(dateStr)}
                                        className="relative flex flex-col border-r border-b border-[#e7edf3] dark:border-slate-800 p-3 min-h-[400px] group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer"
                                    >
                                        <div className="flex justify-start mb-2">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">{['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][date.getDay()]}</span>
                                                <span className={`text-base font-black ${isToday ? 'size-8 flex items-center justify-center bg-blue-600 text-white rounded-full' : 'text-[#0d141b] dark:text-slate-300'}`}>
                                                    {date.getDate()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                            {renderDayContent(date, dayTaskItems, dateStr)}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="px-6 py-4 flex items-center justify-center gap-8 flex-wrap text-sm font-bold text-[#4c739a] dark:text-slate-400">
                <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-slate-400 shadow-sm shadow-slate-200" /><span>Diária</span></div>
                <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-indigo-500 shadow-sm shadow-indigo-200" /><span>Semanal</span></div>
                <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-blue-500 shadow-sm shadow-blue-200" /><span>Quinzenal</span></div>
                <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-emerald-600 shadow-sm shadow-emerald-200" /><span>Mensal</span></div>
                <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-amber-500 shadow-sm shadow-amber-200" /><span>Temporada</span></div>
                <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-rose-500 shadow-sm shadow-rose-200" /><span>Pontual</span></div>
                <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px]">event_busy</span><span>Indisponibilidade</span></div>
                <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-cyan-600">flight_takeoff</span><span>Missão</span></div>
            </div>

            {/* ========== Unavailability Modal ========== */}
            {showUnavailModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => setShowUnavailModal(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
                            <h2 className="text-lg font-black text-[#0d141b] dark:text-white">
                                {unavailForm.id ? 'Editar Indisponibilidade' : 'Cadastrar Indisponibilidade'}
                            </h2>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Membro</label>
                                <select
                                    value={unavailForm.member}
                                    onChange={e => setUnavailForm({ ...unavailForm, member: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-[#0d141b] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Selecione...</option>
                                    {members
                                        .sort((a, b) => ABREV_ORDER.indexOf(a.abrev || '') - ABREV_ORDER.indexOf(b.abrev || ''))
                                        .map(m => (
                                            <option key={m.id} value={m.id}>{m.abrev} {m.war_name || m.name}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Tipo</label>
                                <select
                                    value={unavailForm.type}
                                    onChange={e => setUnavailForm({ ...unavailForm, type: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-[#0d141b] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Selecione...</option>
                                    {UNAVAIL_TYPES.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Início</label>
                                    <input
                                        type="date"
                                        value={unavailForm.start_date}
                                        onChange={e => setUnavailForm({ ...unavailForm, start_date: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-[#0d141b] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Término</label>
                                    <input
                                        type="date"
                                        value={unavailForm.end_date}
                                        onChange={e => setUnavailForm({ ...unavailForm, end_date: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-[#0d141b] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <div>
                                {unavailForm.id && (
                                    <button
                                        onClick={deleteUnavail}
                                        className="px-4 py-2.5 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        Excluir
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowUnavailModal(false)}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveUnavail}
                                    disabled={!unavailForm.member || !unavailForm.type || !unavailForm.start_date || !unavailForm.end_date}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-200 dark:shadow-none"
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========== Task Assignment Modal ========== */}
            {showAssignModal && assignTask && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => setShowAssignModal(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
                            <h2 className="text-lg font-black text-[#0d141b] dark:text-white">Designar Tarefa</h2>
                            <p className="text-sm font-bold text-slate-400 mt-1">{assignTask.name}</p>
                        </div>

                        <div className="p-6">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Designar para</label>
                            <select
                                value={assignMemberId}
                                onChange={e => setAssignMemberId(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-[#0d141b] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Nenhum</option>
                                {members
                                    .sort((a, b) => ABREV_ORDER.indexOf(a.abrev || '') - ABREV_ORDER.indexOf(b.abrev || ''))
                                    .map(m => (
                                        <option key={m.id} value={m.id}>{m.abrev} {m.war_name || m.name}</option>
                                    ))
                                }
                            </select>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveAssignment}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 dark:shadow-none"
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #334155;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}} />
        </div>
    );
};

export default MonthlyPlanner;
