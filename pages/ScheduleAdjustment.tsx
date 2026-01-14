import React from 'react';
import { useNavigate } from 'react-router-dom';

const ScheduleAdjustment: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-[#0d141b] dark:text-white text-3xl font-black tracking-tight mb-2">Ajuste de Planejamento de Viagem</h1>
                    <p className="text-[#4c739a] dark:text-slate-400">Gerencie a distribuição de diárias e membros da equipe técnica.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => navigate('/app/schedule')} className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95">Cancelar</button>
                    <button className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">send</span> Finalizar Planejamento
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                <div className="xl:col-span-8 space-y-6">
                    {/* Mission Info */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#e7edf3] dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">info</span>
                            <h2 className="text-slate-900 dark:text-white font-bold">Informações da Missão</h2>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-700 dark:text-slate-300 text-sm font-bold">Assunto da Missão</label>
                                <input className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-primary h-12 px-4 text-sm" placeholder="Ex: Manutenção Preventiva de Radares" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="flex flex-col gap-2">
                                    <label className="text-slate-700 dark:text-slate-300 text-sm font-bold">Destino</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400 text-xl">location_on</span>
                                        <input className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-primary h-12 pl-11 text-sm" placeholder="Selecione a localidade..." />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-slate-700 dark:text-slate-300 text-sm font-bold">Tipo de Diária</label>
                                    <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl h-12">
                                        <button className="flex-1 rounded-lg bg-white dark:bg-slate-700 shadow-sm text-primary font-bold text-xs transition-all active:scale-95">Geral</button>
                                        <button className="flex-1 rounded-lg text-slate-500 font-bold text-xs hover:text-slate-700 transition-all active:scale-95">Capital</button>
                                        <button className="flex-1 rounded-lg text-slate-500 font-bold text-xs hover:text-slate-700 transition-all active:scale-95">Especial</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#e7edf3] dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">calendar_today</span>
                                <h2 className="text-slate-900 dark:text-white font-bold">Período Selecionado</h2>
                            </div>
                            <div className="flex items-center gap-4">
                                <button className="size-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95">
                                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                                </button>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Abril 2024</span>
                                <button className="size-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95">
                                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black text-slate-400 mb-4 uppercase tracking-tighter">
                                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
                            </div>
                            <div className="grid grid-cols-7 gap-2">
                                <div className="h-10 flex items-center justify-center text-slate-300 text-sm">31</div>
                                <div className="h-10 flex items-center justify-center font-bold bg-slate-50 dark:bg-slate-800 rounded-xl text-sm">1</div>
                                <div className="h-10 flex items-center justify-center font-bold bg-slate-50 dark:bg-slate-800 rounded-xl text-sm">2</div>
                                <div className="h-10 flex items-center justify-center font-bold bg-slate-50 dark:bg-slate-800 rounded-xl text-sm">3</div>
                                <div className="h-10 flex items-center justify-center font-bold bg-slate-50 dark:bg-slate-800 rounded-xl text-sm">4</div>
                                <div className="h-10 flex items-center justify-center font-bold bg-primary text-white rounded-l-xl text-sm relative">5</div>
                                <div className="h-10 flex items-center justify-center font-bold bg-primary/20 text-primary text-sm">6</div>
                                <div className="h-10 flex items-center justify-center font-bold bg-primary/20 text-primary text-sm">7</div>
                                <div className="h-10 flex items-center justify-center font-bold bg-primary/20 text-primary text-sm">8</div>
                                <div className="h-10 flex items-center justify-center font-bold bg-primary text-white rounded-r-xl text-sm">9</div>
                                {[10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map(d => (
                                    <div key={d} className="h-10 flex items-center justify-center font-bold bg-slate-50 dark:bg-slate-800 rounded-xl text-sm">{d}</div>
                                ))}
                            </div>
                            <div className="mt-6 p-4 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/10 flex items-center gap-4">
                                <div className="size-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined">event_note</span>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase">Resumo de Datas</p>
                                    <p className="text-sm dark:text-slate-200">De <span className="font-bold text-primary">05/04</span> a <span className="font-bold text-primary">09/04</span> — 5 diárias estimadas</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Team Selection Sidebar */}
                <div className="xl:col-span-4 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#e7edf3] dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/30">
                            <span className="material-symbols-outlined text-primary">groups</span>
                            <h2 className="text-slate-900 dark:text-white font-bold">Equipe da Missão</h2>
                        </div>
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-2 text-slate-400 text-lg">search</span>
                                <input className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 border-none rounded-lg focus:ring-1 focus:ring-primary" placeholder="Filtrar integrantes..." />
                            </div>
                        </div>
                        <div className="max-h-[350px] overflow-y-auto p-2 space-y-1">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20">
                                <div className="flex items-center gap-3">
                                    <div className="size-2 rounded-full bg-green-500"></div>
                                    <div>
                                        <p className="text-sm font-bold text-primary">2º Sgt Almeida</p>
                                        <p className="text-[10px] text-primary/70 font-medium">(08 diárias no ano)</p>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-primary">check_circle</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="size-2 rounded-full bg-slate-300"></div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">1º Sgt Silva</p>
                                        <p className="text-[10px] text-slate-500">(12 diárias no ano)</p>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-all">add_circle</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="size-2 rounded-full bg-green-500"></div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Cap Oliveira</p>
                                        <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">(22 diárias no ano)</p>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-all">add_circle</span>
                            </div>
                        </div>
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Equipe Selecionada</span>
                                <span className="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full">1 INTEGRANTE</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <div className="flex items-center gap-2 bg-white dark:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                                    <span className="text-xs font-bold dark:text-white">2º Sgt Almeida</span>
                                    <span className="material-symbols-outlined text-base text-slate-400 hover:text-red-500 cursor-pointer">close</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-primary rounded-2xl p-6 text-white shadow-xl shadow-primary/20 relative overflow-hidden">
                        <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-9xl opacity-10 rotate-12">summarize</span>
                        <h3 className="text-xs font-black opacity-70 uppercase tracking-[0.2em] mb-6">Resumo Estimado</h3>
                        <div className="space-y-4 relative z-10">
                            <div className="flex justify-between items-center border-b border-white/10 pb-3">
                                <span className="text-sm opacity-90">Diárias (Total)</span>
                                <span className="font-bold text-lg">5.0</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/10 pb-3">
                                <span className="text-sm opacity-90">Integrantes</span>
                                <span className="font-bold text-lg">01</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-sm opacity-90">Status</span>
                                <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded uppercase">Em Planejamento</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduleAdjustment;