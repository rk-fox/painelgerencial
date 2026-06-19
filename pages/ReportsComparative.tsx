import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { parseLocalDate } from '../utils/dateUtils';

interface Category {
    id: string;
    nome_cat: string;
}

interface TaskData {
    start_date: string;
    category: string;
    quantidade?: number;
    status: string;
}

type ViewMode = 'general' | 'category' | 'general-monthly' | 'category-monthly';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const ReportsComparative: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState<TaskData[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [viewMode, setViewMode] = useState<ViewMode>('general');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 4; // Last 5 years (e.g. 2022 to 2026)
    
    const years = useMemo(() => {
        return Array.from({ length: 5 }, (_, i) => startYear + i);
    }, [startYear]);

    useEffect(() => {
        fetchData();
    }, []);

    const getUserSector = () => {
        const userJson = localStorage.getItem('currentUser');
        if (userJson) {
            const user = JSON.parse(userJson);
            return user.sector;
        }
        return null;
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const sector = getUserSector();

            // 1. Fetch categories
            const { data: catData, error: catError } = await supabase
                .from('task_cat')
                .select('*')
                .order('nome_cat');
            
            if (catError) throw catError;
            setCategories(catData || []);
            if (catData && catData.length > 0) {
                setSelectedCategory(catData[0].nome_cat);
            }

            // 2. Fetch completed tasks over the last 5 years in chunks to handle pagination limits
            let allTasks: TaskData[] = [];
            let from = 0;
            let to = 999;
            let hasMore = true;

            while (hasMore) {
                let query = supabase
                    .from('tasks')
                    .select('start_date, category, quantidade, status')
                    .eq('status', 'concluida')
                    .gte('start_date', `${startYear}-01-01`)
                    .lte('start_date', `${currentYear}-12-31`)
                    .range(from, to);

                if (sector && (sector === 'CP' || sector === 'EA')) {
                    query = query.eq('sector', sector);
                }

                const { data, error } = await query;
                if (error) throw error;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allTasks = [...allTasks, ...data];
                    if (data.length < 1000) {
                        hasMore = false;
                    } else {
                        from += 1000;
                        to += 1000;
                    }
                }
            }

            setTasks(allTasks);
        } catch (error) {
            console.error('Error fetching comparative data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate chart data for General view (year-by-year)
    const generalChartData = useMemo(() => {
        return years.map(year => {
            const total = tasks
                .filter(t => {
                    const date = parseLocalDate(t.start_date);
                    return date && date.getFullYear() === year;
                })
                .reduce((acc, t) => acc + (t.quantidade || 1), 0);
            return { label: String(year), value: total };
        });
    }, [tasks, years]);

    // Calculate chart data for Category view (year-by-year)
    const categoryChartData = useMemo(() => {
        return years.map(year => {
            const total = tasks
                .filter(t => {
                    const date = parseLocalDate(t.start_date);
                    return date && date.getFullYear() === year && t.category === selectedCategory;
                })
                .reduce((acc, t) => acc + (t.quantidade || 1), 0);
            return { label: String(year), value: total };
        });
    }, [tasks, years, selectedCategory]);

    // Calculate chart data for General Monthly view (month-by-month for selected year)
    const generalMonthlyChartData = useMemo(() => {
        return MONTH_LABELS.map((label, monthIdx) => {
            const total = tasks
                .filter(t => {
                    const date = parseLocalDate(t.start_date);
                    return date && date.getFullYear() === selectedYear && date.getMonth() === monthIdx;
                })
                .reduce((acc, t) => acc + (t.quantidade || 1), 0);
            return { label, value: total };
        });
    }, [tasks, selectedYear]);

    // Calculate chart data for Category Monthly view (month-by-month for selected year + category)
    const categoryMonthlyChartData = useMemo(() => {
        return MONTH_LABELS.map((label, monthIdx) => {
            const total = tasks
                .filter(t => {
                    const date = parseLocalDate(t.start_date);
                    return date && date.getFullYear() === selectedYear && date.getMonth() === monthIdx && t.category === selectedCategory;
                })
                .reduce((acc, t) => acc + (t.quantidade || 1), 0);
            return { label, value: total };
        });
    }, [tasks, selectedYear, selectedCategory]);

    const activeChartData = useMemo(() => {
        switch (viewMode) {
            case 'general': return generalChartData;
            case 'category': return categoryChartData;
            case 'general-monthly': return generalMonthlyChartData;
            case 'category-monthly': return categoryMonthlyChartData;
        }
    }, [viewMode, generalChartData, categoryChartData, generalMonthlyChartData, categoryMonthlyChartData]);

    const isMonthlyView = viewMode === 'general-monthly' || viewMode === 'category-monthly';
    const showCategoryFilter = viewMode === 'category' || viewMode === 'category-monthly';
    const showYearFilter = isMonthlyView;

    // Calculate chart scale
    const maxVal = useMemo(() => {
        const values = activeChartData.map(d => d.value);
        const max = Math.max(...values, 0);
        return max > 0 ? max : 10; // Default to 10 if no data
    }, [activeChartData]);

    const yAxisTicks = useMemo(() => {
        return [
            Math.round(maxVal),
            Math.round(maxVal * 0.75),
            Math.round(maxVal * 0.5),
            Math.round(maxVal * 0.25),
            0
        ];
    }, [maxVal]);

    // Chart title
    const chartTitle = useMemo(() => {
        switch (viewMode) {
            case 'general': return 'Comparativo de Atividades Concluídas';
            case 'category': return `Comparativo: ${selectedCategory}`;
            case 'general-monthly': return `Atividades Concluídas em ${selectedYear}`;
            case 'category-monthly': return `${selectedCategory} em ${selectedYear}`;
        }
    }, [viewMode, selectedCategory, selectedYear]);

    const chartSubtitle = useMemo(() => {
        if (isMonthlyView) {
            return `Análise mês a mês — ${selectedYear}`;
        }
        return `Análise dos últimos 5 anos (${startYear} - ${currentYear})`;
    }, [isMonthlyView, selectedYear, startYear, currentYear]);

    // Gradient colors for monthly view to differentiate from yearly
    const barGradient = isMonthlyView
        ? 'from-emerald-600 to-teal-400 hover:from-emerald-700 hover:to-teal-500 hover:shadow-emerald-200/50'
        : 'from-blue-600 to-cyan-400 hover:from-blue-700 hover:to-cyan-500 hover:shadow-blue-200/50';

    // Total for monthly views
    const monthlyTotal = useMemo(() => {
        if (!isMonthlyView) return 0;
        return activeChartData.reduce((acc, d) => acc + d.value, 0);
    }, [isMonthlyView, activeChartData]);

    const viewModes: { key: ViewMode; label: string }[] = [
        { key: 'general', label: 'Geral' },
        { key: 'category', label: 'Por Categoria' },
        { key: 'general-monthly', label: 'Geral (Mês a Mês)' },
        { key: 'category-monthly', label: 'Categoria (Mês a Mês)' },
    ];

    return (
        <div className="flex flex-col min-h-full bg-[#f8fafc] dark:bg-background-dark animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <button
                    type="button"
                    onClick={() => navigate('/app/reports')}
                    className="flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <span className="material-symbols-outlined text-[#4c739a] text-[24px]">
                        arrow_back
                    </span>
                </button>
                <div>
                    <h1 className="text-[#0d141b] dark:text-white text-xl md:text-2xl font-black leading-tight tracking-tight">
                        Comparativo de Atividades
                    </h1>
                    <p className="text-[10px] text-blue-600 dark:text-blue-500 font-bold tracking-widest uppercase mt-0.5">
                        Análise de Desempenho
                    </p>
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">
                {/* Tabs & Filters Controls */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
                    {/* View Toggles */}
                    <div className="flex flex-wrap bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit gap-0.5">
                        {viewModes.map(mode => (
                            <button
                                key={mode.key}
                                type="button"
                                onClick={() => setViewMode(mode.key)}
                                className={`px-3 py-2 rounded-lg text-[10px] sm:text-xs font-black transition-all uppercase tracking-wider whitespace-nowrap ${
                                    viewMode === mode.key
                                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-400'
                                }`}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>

                    {/* Filters Row */}
                    {(showYearFilter || showCategoryFilter) && (
                        <div className="flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                            {/* Year Selector (Visible in monthly views) */}
                            {showYearFilter && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Ano:
                                    </span>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="block bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold px-4 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[100px]"
                                    >
                                        {years.map(year => (
                                            <option key={year} value={year}>
                                                {year}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Category Selector (Visible in Category views) */}
                            {showCategoryFilter && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Categoria:
                                    </span>
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                        className="block bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold px-4 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[160px]"
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.nome_cat}>
                                                {cat.nome_cat}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Main Chart Card */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative min-h-[360px] flex flex-col">
                    <div className="mb-6 flex items-start justify-between">
                        <div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                {chartTitle}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                {chartSubtitle}
                            </p>
                        </div>
                        {isMonthlyView && !loading && (
                            <div className="flex flex-col items-end animate-in fade-in duration-300">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total no ano</span>
                                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                                    {monthlyTotal.toLocaleString('pt-BR')}
                                </span>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-slate-200 border-t-blue-600"></div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                Carregando dados...
                            </span>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col justify-end pt-6">
                            {/* Chart Area */}
                            <div className="h-64 flex relative border-b border-slate-200 dark:border-slate-800 pb-2">
                                {/* Y-Axis Labels */}
                                <div className="absolute left-0 top-0 bottom-2 w-12 flex flex-col justify-between text-[10px] font-bold text-slate-400 pr-2 pointer-events-none select-none">
                                    {yAxisTicks.map((tick, idx) => (
                                        <div key={idx} className="text-right h-3 flex items-center justify-end">
                                            {tick}
                                        </div>
                                    ))}
                                </div>

                                {/* Chart Grid lines */}
                                <div className="absolute left-12 right-0 top-0 bottom-2 flex flex-col justify-between pointer-events-none select-none">
                                    {Array.from({ length: 5 }).map((_, idx) => (
                                        <div key={idx} className="border-t border-slate-100 dark:border-slate-800/60 w-full first:border-t-0 last:border-b-0 h-0"></div>
                                    ))}
                                </div>

                                {/* Columns Container */}
                                <div className={`flex-1 ml-12 h-full flex items-end justify-around relative z-10 ${isMonthlyView ? 'gap-0.5' : ''}`}>
                                    {activeChartData.map((d, idx) => {
                                        const heightPercent = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
                                        return (
                                            <div key={d.label} className={`flex flex-col items-center flex-1 h-full justify-end relative group ${isMonthlyView ? 'px-0.5' : 'px-2 max-w-[80px]'}`}>
                                                {/* Tooltip */}
                                                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-slate-800 text-white text-[10px] font-bold py-1 px-2.5 rounded-lg shadow-md transition-opacity pointer-events-none whitespace-nowrap z-20">
                                                    {d.value} concluída{d.value !== 1 ? 's' : ''}
                                                </div>

                                                {/* Bar Column */}
                                                <div
                                                    className={`w-full ${isMonthlyView ? 'max-w-[32px]' : 'max-w-[40px]'} bg-gradient-to-t ${barGradient} rounded-t-lg transition-all duration-700 ease-out shadow-lg dark:hover:shadow-none min-h-[4px] cursor-pointer`}
                                                    style={{ 
                                                        height: `${heightPercent}%`,
                                                        animationDelay: `${idx * 80}ms` 
                                                    }}
                                                ></div>

                                                {/* X-Axis Label */}
                                                <span className={`absolute -bottom-7 font-bold text-slate-500 dark:text-slate-400 ${isMonthlyView ? 'text-[9px] sm:text-[10px]' : 'text-[11px]'}`}>
                                                    {d.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="h-6"></div> {/* Spacer for X-axis labels */}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportsComparative;
