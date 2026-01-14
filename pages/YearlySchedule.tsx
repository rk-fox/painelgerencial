import React from 'react';
import { useNavigate } from 'react-router-dom';

const YearlySchedule: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-[#0d141b] dark:text-white text-3xl font-black tracking-tight">Cronograma Anual de Missões</h1>
                    <p className="text-[#4c739a] dark:text-slate-400">Visão consolidada da efetividade externa da equipe (Heatmap 2024).</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/app/schedule/adjustment')}
                        className="px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm">edit_calendar</span>
                        Ajustar Planejamento
                    </button>
                    <button className="px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined">add</span>
                        <span>Cadastrar Nova Viagem</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <MonthCard month="Janeiro" year="2024" days={31} startDay={1} heatmapData={[3, 4, 5, 9, 10, 11, 12, 16, 17, 18, 19, 20, 21]} />
                <MonthCard month="Fevereiro" year="2024" days={29} startDay={4} heatmapData={[5, 6, 7, 8, 9, 10, 18, 19, 20]} />
                <MonthCard month="Março" year="2024" days={31} startDay={5} heatmapData={[1, 2, 3, 4, 5, 6, 7, 22, 23, 24]} />
                <MonthCard month="Abril" year="2024" days={30} startDay={1} heatmapData={[5, 6, 7, 8, 9]} />

                {/* Placeholder months */}
                {['Maio', 'Junho', 'Julho', 'Agosto'].map(m => (
                    <div key={m} className="bg-white dark:bg-slate-900 rounded-2xl border border-[#e7edf3] dark:border-slate-800 p-5 shadow-sm opacity-50">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800 dark:text-white">{m}</h3>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">2024</span>
                        </div>
                        <div className="h-32 flex items-center justify-center text-xs text-slate-400">Dados não carregados</div>
                    </div>
                ))}
            </div>

            <div className="mt-8 bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">Efetividade (Integrantes fora):</div>
                <div className="flex flex-wrap gap-4">
                    <LegendItem color="bg-green-500" label="Baixa (1-3)" />
                    <LegendItem color="bg-yellow-500" label="Média (4-6)" />
                    <LegendItem color="bg-red-500" label="Alta (7+)" />
                    <div className="flex items-center gap-2 ml-4">
                        <div className="size-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"></div>
                        <span className="text-xs font-medium dark:text-slate-300">Sem Missão</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MonthCard = ({ month, year, days, startDay, heatmapData }: any) => {
    // Basic calendar logic for demo
    const cells = [];
    // Empty cells for start day (0=Sun, 1=Mon...)
    for (let i = 0; i < startDay; i++) {
        cells.push(<div key={`empty-${i}`} className="aspect-square"></div>);
    }
    for (let i = 1; i <= days; i++) {
        let bgClass = "bg-slate-50 dark:bg-slate-800 text-[#0d141b] dark:text-white";
        let textClass = "";

        // Mock heatmap logic
        if (heatmapData.includes(i)) {
            textClass = "text-white";
            if (i % 3 === 0) bgClass = "bg-green-500"; // Low
            else if (i % 2 === 0) bgClass = "bg-yellow-500"; // Mid
            else bgClass = "bg-red-500"; // High
        }

        cells.push(
            <div key={i} className={`aspect-square flex items-center justify-center text-xs font-bold rounded-sm ${bgClass} ${textClass}`}>
                {i}
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#e7edf3] dark:border-slate-800 p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 dark:text-white">{month}</h3>
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
}

const LegendItem = ({ color, label }: any) => (
    <div className="flex items-center gap-2">
        <div className={`size-4 ${color} rounded`}></div>
        <span className="text-xs font-medium dark:text-slate-300">{label}</span>
    </div>
);

export default YearlySchedule;