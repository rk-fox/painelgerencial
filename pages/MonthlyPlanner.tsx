import React, { useState, useEffect } from 'react';
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
}

const MonthlyPlanner: React.FC = () => {
    const navigate = useNavigate();
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('tasks')
                .select('*');
            if (error) throw error;
            setTasks(data || []);
        } catch (err: any) {
            console.error('Error fetching tasks:', err.message);
        } finally {
            setLoading(false);
        }
    };

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

    const getTasksForDay = (day: number) => {
        const date = new Date(currentYear, currentMonth, day);
        const dayOfWeek = date.getDay();
        const dateString = date.toISOString().split('T')[0];

        return tasks.filter(task => {
            const taskStart = new Date(task.start_date.split('T')[0]);
            if (date < taskStart) return false;

            if (task.start_date.split('T')[0] === dateString) return true;

            if (task.recurrence_active) {
                if (task.periodicity.toLowerCase() === 'diaria') return isBusinessDay(date);
                if (task.periodicity.toLowerCase() === 'semanal') return dayOfWeek === 1;
                if (task.periodicity.toLowerCase() === 'mensal') return day === getFirstBusinessDayOfMonth(currentYear, currentMonth);
            }
            return false;
        });
    };

    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-background-dark animate-in fade-in duration-500">
            {/* Action Bar from Image */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#f8fafc] dark:bg-background-dark">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center justify-center p-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[#4c739a] text-[24px]">arrow_back</span>
                    </button>
                    <h1 className="text-[#0d141b] dark:text-white text-[28px] font-black leading-tight tracking-[-0.033em]">Cronograma Mensal</h1>
                </div>

                <div className="flex items-center bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <button 
                        onClick={handlePrevMonth}
                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#4c739a] border-r border-[#e7edf3] dark:border-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                    </button>
                    <div className="px-8 py-2 min-w-[200px] text-center">
                        <span className="text-lg font-bold text-[#0d141b] dark:text-white">
                            {monthNames[currentMonth]} {currentYear}
                        </span>
                    </div>
                    <button 
                        onClick={handleNextMonth}
                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#4c739a] border-l border-[#e7edf3] dark:border-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                    </button>
                </div>
            </div>

            {/* Calendar Grid Container */}
            <div className="flex-1 p-6 pt-0 overflow-hidden">
                <div className="h-full border border-[#e7edf3] dark:border-slate-800 rounded-[28px] bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden flex flex-col">
                    {/* Weekdays */}
                    <div className="grid grid-cols-7 border-b border-[#e7edf3] dark:border-slate-800">
                        {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(day => (
                            <div key={day} className="py-5 text-center text-sm font-black text-[#5c85ad] dark:text-slate-400 uppercase tracking-widest">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-hidden">
                        {/* Empty cells before month start */}
                        {Array.from({ length: getFirstDayOfMonth(currentYear, currentMonth) }).map((_, i) => (
                            <div key={`empty-${i}`} className="border-r border-b border-[#e7edf3] dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20" />
                        ))}
                        
                        {/* Month days */}
                        {Array.from({ length: getDaysInMonth(currentYear, currentMonth) }).map((_, i) => {
                            const day = i + 1;
                            const dayTasks = getTasksForDay(day);
                            const isToday = today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;

                            return (
                                <div 
                                    key={day} 
                                    className={`relative flex flex-col border-r border-b border-[#e7edf3] dark:border-slate-800 p-3 group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30`}
                                >
                                    <div className="flex justify-start mb-2">
                                        <span className={`text-base font-black ${isToday ? 'size-8 flex items-center justify-center bg-blue-600 text-white rounded-full' : 'text-[#0d141b] dark:text-slate-300'}`}>
                                            {day}
                                        </span>
                                    </div>

                                    {/* Task List in Day Cell */}
                                    <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                        {dayTasks.map(task => {
                                            const periodicity = task.periodicity.toLowerCase();
                                            let colors = "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300";
                                            let barColor = "bg-slate-400";

                                            if (periodicity === 'diaria') {
                                                colors = "bg-[#edf5ff] border-[#dae9ff] text-[#1a5fb4] dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400";
                                                barColor = "bg-[#1a5fb4]";
                                            } else if (periodicity === 'semanal') {
                                                colors = "bg-[#f5f1ff] border-[#e8deff] text-[#7c4dff] dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400";
                                                barColor = "bg-[#7c4dff]";
                                            } else if (periodicity === 'mensal') {
                                                colors = "bg-[#fff9eb] border-[#ffedc2] text-[#c67c00] dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400";
                                                barColor = "bg-[#c67c00]";
                                            } else if (periodicity === 'pontual' || periodicity === 'temporada') {
                                                colors = "bg-[#f8f9fa] border-[#e9ecef] text-[#495057] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300";
                                                barColor = "bg-[#6c757d]";
                                            }

                                            return (
                                                <div 
                                                    key={`${task.id}-${day}`}
                                                    className={`group/task relative flex items-center h-12 ${colors} border rounded-lg px-3 overflow-hidden transition-all hover:shadow-md cursor-default`}
                                                >
                                                    {/* Side colored bar */}
                                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${barColor}`} />
                                                    
                                                    <div className="ml-1 w-full flex flex-col justify-center gap-0.5">
                                                        <div className="text-[11px] font-black leading-none truncate uppercase tracking-tight">
                                                            {task.name}
                                                        </div>
                                                        <div className="text-[9px] font-bold opacity-70 leading-none truncate capitalize">
                                                            {task.periodicity}
                                                        </div>
                                                    </div>

                                                    {/* Scrollbar-like indicator if content might overflow (from image) */}
                                                    {dayTasks.length > 3 && (
                                                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-20 group-hover/task:opacity-40">
                                                            <div className="size-1 rounded-full bg-current" />
                                                            <div className="size-1 rounded-full bg-current" />
                                                            <div className="size-1 rounded-full bg-current" />
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Sub-Legend Footer */}
            <div className="px-6 py-4 flex items-center justify-center gap-12 text-sm font-bold text-[#4c739a] dark:text-slate-400">
                <div className="flex items-center gap-2">
                    <div className="size-3 rounded-full bg-blue-600 shadow-sm shadow-blue-200" />
                    <span>Diária</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="size-3 rounded-full bg-purple-600 shadow-sm shadow-purple-200" />
                    <span>Semanal</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="size-3 rounded-full bg-amber-600 shadow-sm shadow-amber-200" />
                    <span>Mensal</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="size-3 rounded-full bg-slate-400 shadow-sm shadow-slate-200" />
                    <span>Pontual/Temporada</span>
                </div>
            </div>

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
