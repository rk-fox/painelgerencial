import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

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

    useEffect(() => {
        fetchReportData();
        fetchMissionStats();
    }, []);

    // Calculate weekdays between two dates (excluding weekends)
    const countWeekdays = (startDate: string, endDate: string): number => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        let count = 0;
        const current = new Date(start);
        
        while (current <= end) {
            const dayOfWeek = current.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        return count;
    };

    // Calculate duration (last day = 0.5)
    const calculateDuration = (startDate: string, endDate: string): number => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays + 0.5;
    };

    const fetchMissionStats = async () => {
        const currentYear = new Date().getFullYear();
        const previousYear = currentYear - 1;

        // Fetch current year missions
        const { data: currentMissions } = await supabase
            .from('missions')
            .select('*')
            .gte('data_inicio', `${currentYear}-01-01`)
            .lte('data_inicio', `${currentYear}-12-31`);

        // Fetch previous year missions (count only)
        const { data: previousMissions } = await supabase
            .from('missions')
            .select('id')
            .gte('data_inicio', `${previousYear}-01-01`)
            .lte('data_inicio', `${previousYear}-12-31`);

        let totalDays = 0;
        let totalDiarias = 0;
        let workHours = 0;

        if (currentMissions) {
            currentMissions.forEach(mission => {
                const duration = calculateDuration(mission.data_inicio, mission.data_fim);
                const teamSize = mission.qtd_equipe || 1;
                const weekdays = countWeekdays(mission.data_inicio, mission.data_fim);

                totalDays += duration;
                totalDiarias += duration * teamSize;
                workHours += weekdays * 8; // Each weekday = 8h of work
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

    const fetchReportData = async () => {
        try {
            // Fetch status counts
            const { data: tasks, error: tasksError } = await supabase
                .from('tasks')
                .select('status, quantidade, category');

            if (tasksError) throw tasksError;

            // Calculate status counts
            const counts: StatusCounts = { pendente: 0, iniciada: 0, concluida: 0 };
            const categoryMap = new Map<string, number>();

            tasks?.forEach(task => {
                const qty = task.quantidade || 1;

                // Status counts
                if (task.status === 'pendente') counts.pendente += qty;
                else if (task.status === 'iniciada') counts.iniciada += qty;
                else if (task.status === 'concluida') counts.concluida += qty;

                // Category ranking (only completed tasks)
                if (task.status === 'concluida' && task.category) {
                    const current = categoryMap.get(task.category) || 0;
                    categoryMap.set(task.category, current + qty);
                }
            });

            setStatusCounts(counts);

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
                    badge="Atual" badgeColor="slate"
                />
                <ReportCard
                    icon="calendar_today" color="indigo"
                    title="Média de Tarefas/Dia" value="42,5"
                    badge="Média Móvel" badgeColor="slate"
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
                    title="Missões Únicas" 
                    value={missionStats.totalMissions.toString()}
                    badge={missionStats.totalMissions - missionStats.previousYearMissions >= 0 
                        ? `+${missionStats.totalMissions - missionStats.previousYearMissions}` 
                        : `${missionStats.totalMissions - missionStats.previousYearMissions}`}
                    badgeColor={missionStats.totalMissions >= missionStats.previousYearMissions ? "emerald" : "rose"}
                />
                <ReportCard
                    icon="date_range" color="sky"
                    title="Total de Dias em Missão" 
                    value={`${missionStats.totalDays} dias`}
                    badge="Consolidado" badgeColor="slate"
                />
                <ReportCard
                    icon="payments" color="violet"
                    title="Total de Diárias Realizadas" 
                    value={`${missionStats.totalDiarias} diárias`}
                    badge="Acumulado" badgeColor="emerald"
                />
                <ReportCard
                    icon="timer" color="slate"
                    title="Carga Horária em Viagem" 
                    value={`${missionStats.workHours}h`}
                    badge="Em trânsito" badgeColor="slate"
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
                        <select className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-[10px] font-bold px-3 py-1 text-slate-500 focus:ring-1 focus:ring-primary">
                            <option>Últimos 30 dias</option>
                            <option>Último trimestre</option>
                            <option>Esse ano</option>
                        </select>
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
                            <p className="text-[10px] font-bold text-[#4c739a] uppercase tracking-widest mt-1">Acumulado do Ano Corrente</p>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <BarChartItem label="SO. Ferraz" value="100 diárias (Max)" percent={100} color="bg-primary" />
                        <BarChartItem label="Sgt. Robson" value="90 diárias" percent={90} />
                        <BarChartItem label="Sgt. Railbolt" value="74 diárias" percent={74} />
                        <BarChartItem label="SO. Celso" value="65 diárias" percent={65} />
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