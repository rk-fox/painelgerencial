import React from 'react';

const Reports: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard 
          icon="assignment" color="blue" 
          title="Total de Tarefas" value="1.284" 
          badge="+12%" badgeColor="emerald"
        />
        <ReportCard 
          icon="calendar_today" color="indigo" 
          title="Média de Tarefas/Dia" value="42,5" 
          badge="Média Móvel" badgeColor="slate"
        />
        <ReportCard 
          icon="task_alt" color="emerald" 
          title="Taxa de Conclusão" value="92%" 
          badge="META 90%" badgeColor="emerald"
          progress={92}
        />
        <ReportCard 
          icon="pending_actions" color="rose" 
          title="Tarefas Pendentes" value="56" 
          badge="-4%" badgeColor="rose"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard 
            icon="explore" color="amber" 
            title="Missões Únicas" value="10" 
            badge="+2" badgeColor="emerald"
        />
        <ReportCard 
            icon="date_range" color="sky" 
            title="Total de Dias em Missão" value="55 dias" 
            badge="Consolidado" badgeColor="slate"
        />
        <ReportCard 
            icon="payments" color="violet" 
            title="Total de Diárias Realizadas" value="180 diárias" 
            badge="Acumulado" badgeColor="emerald"
        />
        <ReportCard 
            icon="timer" color="slate" 
            title="Carga Horária em Viagem" value="242h" 
            badge="Em trânsito" badgeColor="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Task Completion Chart Mock */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-6 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h4 className="text-base font-bold text-slate-800 dark:text-white">Tarefas Concluídas por Membro</h4>
                    <p className="text-[10px] font-bold text-[#4c739a] uppercase tracking-widest mt-1">Acumulado do Mês Corrente</p>
                </div>
                <select className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-[10px] font-bold px-3 py-1 text-slate-500 focus:ring-1 focus:ring-primary">
                    <option>Últimos 30 dias</option>
                    <option>Último trimestre</option>
                </select>
            </div>
            <div className="space-y-6">
                <BarChartItem label="Silva, Sgt" value="84 tarefas (Max)" percent={100} />
                <BarChartItem label="Santos, Sgt" value="62 tarefas" percent={74} />
                <BarChartItem label="Oliveira, Sgt" value="55 tarefas" percent={65} />
                <BarChartItem label="Melo, Sgt" value="93 tarefas" percent={100} color="bg-primary" />
            </div>
        </div>

        {/* Efficiency Circle Chart Mock */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm">
            <div className="mb-8">
                <h4 className="text-base font-bold text-slate-800 dark:text-white">Ocupação da Seção</h4>
                <p className="text-[10px] font-bold text-[#4c739a] uppercase tracking-widest mt-1">Tempo em Atividade vs Ociosidade</p>
            </div>
            <div className="flex flex-col items-center">
                <div className="relative w-40 h-40 xl:w-48 xl:h-48">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <circle className="text-slate-100 dark:text-slate-800" cx="18" cy="18" fill="transparent" r="16" stroke="currentColor" strokeWidth="3"></circle>
                        <circle cx="18" cy="18" fill="transparent" r="16" stroke="#137fec" strokeDasharray="85, 100" strokeLinecap="round" strokeWidth="3.5"></circle>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl xl:text-4xl font-black text-slate-800 dark:text-white">85%</span>
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase">Eficiência</span>
                    </div>
                </div>
                <div className="mt-8 w-full space-y-3">
                    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20"></div>
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Tempo Ativo</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-slate-800 dark:text-white">1.054h</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Ociosidade</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-slate-800 dark:text-white">186h</span>
                    </div>
                </div>
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
            {progress ? (
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