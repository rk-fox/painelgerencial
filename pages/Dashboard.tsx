import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
      setCurrentUser(JSON.parse(userJson));
    }
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (err: any) {
      console.error('Error fetching tasks:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const pullTask = async (taskId: string) => {
    if (!currentUser) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ assigned_to: currentUser.id })
        .eq('id', taskId);

      if (error) throw error;

      // Update local state
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, assigned_to: currentUser.id } : t
      ));
    } catch (err: any) {
      console.error('Error pulling task:', err.message);
      alert('Erro ao puxar tarefa: ' + err.message);
    }
  };
  const unassignTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ assigned_to: null, status: 'pendente' })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, assigned_to: null, status: 'pendente' } : t
      ));
    } catch (err: any) {
      console.error('Error unassigning task:', err.message);
      alert('Erro ao devolver tarefa: ' + err.message);
    }
  };

  const handleStartTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'iniciada', started_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'iniciada' } : t));
    } catch (err: any) {
      console.error('Error starting task:', err.message);
    }
  };

  const handleSuspendTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'pausada' })
        .eq('id', taskId);

      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'pausada' } : t));
    } catch (err: any) {
      console.error('Error suspending task:', err.message);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'concluida', completed_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;
      // Remove from list or update status (if we kept concluded tasks, we'd update. Here we might want to remove visually or just let the filter handle it on refetch, but updating local state is smoother)
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err: any) {
      console.error('Error completing task:', err.message);
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDropToMyActivities = async (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    // Prevent dropping if it's already in my tasks
    const task = tasks.find(t => t.id === taskId);
    if (taskId && task && task.assigned_to !== currentUser?.id) {
      await pullTask(taskId);
    }
  };

  const handleDropToBank = async (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    if (taskId && task && task.assigned_to === currentUser?.id) {
      await unassignTask(taskId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const bankTasks = tasks.filter(t => !t.assigned_to && t.status !== 'concluida');
  const myTasks = tasks
    .filter(t => t.assigned_to === currentUser?.id && t.status !== 'concluida')
    .sort((a, b) => {
      // Prioritize 'iniciada' tasks
      if (a.status === 'iniciada' && b.status !== 'iniciada') return -1;
      if (a.status !== 'iniciada' && b.status === 'iniciada') return 1;
      // Stable sort for others
      return 0;
    });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Concluídas Hoje"
          value="12"
          trend="+20%"
          trendType="positive"
        />
        <StatCard
          title="Disponibilidade"
          value="85%"
          progress={85}
        />
        <StatCard
          title="Tarefas Pendentes"
          value={bankTasks.length.toString()}
          badge={bankTasks.length > 5 ? "Alerta" : ""}
          badgeType="warning"
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <FilterButton label="BCT" active />
            <FilterButton label="AIS" />
          </div>
          <div className="h-6 w-px bg-[#e7edf3] dark:bg-slate-800 hidden md:block"></div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterButton label="Diária" active />
            <FilterButton label="Semanal" />
            <FilterButton label="Mensal" />
            <FilterButton label="Pontual" />
          </div>
        </div>
        <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all">
          Todas <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* Task Bank */}
        <section
          className="flex flex-col gap-6"
          onDrop={handleDropToBank}
          onDragOver={handleDragOver}
        >
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-200 dark:bg-slate-800 rounded-lg">
                <span className="material-symbols-outlined text-[#0d141b] dark:text-white">inventory_2</span>
              </div>
              <h3 className="text-lg font-bold text-[#0d141b] dark:text-white uppercase tracking-wide">Banco de Tarefas</h3>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-[#4c739a] uppercase">{bankTasks.length} DISPONÍVEIS</span>
          </div>

          <div className="grid gap-4 min-h-[100px] transition-colors rounded-2xl p-2 border-2 border-dashed border-transparent hover:border-slate-300 dark:hover:border-slate-700">
            {bankTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onPull={() => pullTask(task.id)}
                onDragStart={(e: React.DragEvent) => handleDragStart(e, task.id)}
              />
            ))}
            {bankTasks.length === 0 && !loading && (
              <div className="text-center py-10 opacity-50 italic text-sm">Nenhuma tarefa disponível no banco.</div>
            )}
            {loading && (
              <div className="text-center py-10 animate-pulse text-sm">Carregando tarefas...</div>
            )}
          </div>
        </section>

        {/* My Activities */}
        <section
          className="flex flex-col gap-6"
          onDrop={handleDropToMyActivities}
          onDragOver={handleDragOver}
        >
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <span className="material-symbols-outlined text-primary">person_check</span>
              </div>
              <h3 className="text-lg font-bold text-[#0d141b] dark:text-white uppercase tracking-wide">Minhas Atividades</h3>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-primary/20 text-primary uppercase">{myTasks.length} EM CURSO</span>
          </div>

          <div className="grid gap-4 min-h-[200px] p-2 bg-slate-50/50 dark:bg-slate-800/10 rounded-2xl border-2 border-dashed border-transparent hover:border-primary/20 transition-colors">
            {myTasks.map(task => (
              <MyTaskCard
                key={task.id}
                task={task}
                onDragStart={(e: React.DragEvent) => handleDragStart(e, task.id)}
                onStart={() => handleStartTask(task.id)}
                onSuspend={() => handleSuspendTask(task.id)}
                onComplete={() => handleCompleteTask(task.id)}
              />
            ))}
            {myTasks.length === 0 && (
              <div className="text-center py-12 border border-dashed border-[#cfdbe7] dark:border-slate-800 rounded-2xl opacity-50 flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-4xl">drag_indicator</span>
                <p className="text-xs font-bold leading-relaxed">
                  Arraste uma tarefa aqui<br />ou clique em "Puxar Tarefa"
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, trend, trendType, progress, badge, badgeType }: any) => (
  <div className="flex flex-col gap-2 rounded-2xl p-6 bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 shadow-sm transition-transform hover:-translate-y-1">
    <p className="text-[#4c739a] dark:text-slate-400 text-xs font-bold uppercase tracking-widest">{title}</p>
    <div className="flex items-end justify-between">
      <p className="text-[#0d141b] dark:text-white text-4xl font-extrabold">{value}</p>
      {trend && (
        <p className={`text-sm font-bold flex items-center gap-1 px-2 py-1 rounded-lg ${trendType === 'positive' ? 'text-green-600 bg-green-100 dark:bg-green-900/30' : 'text-red-600 bg-red-100'}`}>
          <span className="material-symbols-outlined text-sm">trending_up</span> {trend}
        </p>
      )}
      {progress !== undefined && (
        <div className="w-32 h-2.5 bg-[#e7edf3] dark:bg-slate-800 rounded-full overflow-hidden mb-2">
          <div className="bg-primary h-full rounded-full shadow-[0_0_8px_rgba(19,127,236,0.5)]" style={{ width: `${progress}%` }}></div>
        </div>
      )}
      {badge && (
        <p className={`text-sm font-bold flex items-center gap-1 px-2 py-1 rounded-lg ${badgeType === 'warning' ? 'text-orange-500 bg-orange-100 dark:bg-orange-900/30' : ''}`}>
          <span className="material-symbols-outlined text-sm">warning</span> {badge}
        </p>
      )}
    </div>
  </div>
);

const FilterButton = ({ label, active }: { label: string, active?: boolean }) => (
  <button className={`px-5 py-2 rounded-full border text-xs font-bold transition-all active:scale-95 ${active ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20' : 'border-[#e7edf3] dark:border-slate-700 bg-transparent text-[#4c739a] dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
    {label}
  </button>
);

const TaskCard = ({ task, onPull, onDragStart }: any) => {
  const periodicityColors: any = {
    diaria: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    semanal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    mensal: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    temporada: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    pontual: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const periodicityLabels: any = {
    diaria: 'Diária',
    semanal: 'Semanal',
    mensal: 'Mensal',
    temporada: 'Temporada',
    pontual: 'Pontual',
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group border-l-4 cursor-grab active:cursor-grabbing ${task.periodicity === 'diaria' ? 'border-l-green-500' :
        task.periodicity === 'semanal' ? 'border-l-blue-500' :
          task.periodicity === 'mensal' ? 'border-l-purple-500' :
            'border-l-amber-500'
        }`}
    >
      <div className="flex justify-between items-start mb-4">
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-widest ${periodicityColors[task.periodicity]}`}>
          {periodicityLabels[task.periodicity]}
        </span>
        <span className="text-[10px] font-bold text-[#4c739a] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
          {task.specialties?.join(' + ')}
        </span>
      </div>
      <h4 className="text-[#0d141b] dark:text-white font-bold text-lg mb-2">{task.name}</h4>
      <p className="text-[#4c739a] dark:text-slate-400 text-sm mb-6 line-clamp-2 leading-relaxed">{task.description}</p>
      <div className="flex items-center justify-between border-t border-[#e7edf3] dark:border-slate-800 pt-5 mt-auto">
        <div className="flex items-center gap-2 text-[10px] font-bold text-[#4c739a]">
          <span className="material-symbols-outlined text-lg">calendar_today</span>
          <span>Início: {task.start_date ? new Date(task.start_date).toLocaleDateString() : 'N/A'}</span>
        </div>
        <button
          onClick={onPull}
          className="bg-primary hover:bg-primary/90 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-sm"
        >
          Puxar Tarefa <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};

const MyTaskCard = ({ task, onDragStart, onStart, onSuspend, onComplete }: any) => {
  const isActive = task.status === 'iniciada';

  const periodicityColors: any = {
    diaria: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    semanal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    mensal: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    temporada: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    pontual: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const periodicityLabels: any = {
    diaria: 'Diária',
    semanal: 'Semanal',
    mensal: 'Mensal',
    temporada: 'Temporada',
    pontual: 'Pontual',
  };

  if (isActive) {
    // Active State
    return (
      <div
        draggable
        onDragStart={onDragStart}
        className="bg-white dark:bg-slate-900 border-2 border-primary rounded-2xl p-6 shadow-xl relative overflow-hidden cursor-grab active:cursor-grabbing"
      >
        <div className="absolute top-0 right-0 p-1.5">
          <div className="bg-primary text-white px-3 py-1 rounded-bl-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
            Ativo Agora
            <span className="text-[9px] font-normal opacity-90 ml-1">
              🕒 Início: {task.started_at ? new Date(task.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Agora'}
            </span>
          </div>
        </div>
        <div className="flex justify-between items-start mb-4">
          <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-widest ${periodicityColors[task.periodicity]}`}>
            {periodicityLabels[task.periodicity]}
          </span>
        </div>
        <h4 className="text-[#0d141b] dark:text-white font-bold text-lg mb-2">{task.name}</h4>
        <p className="text-[#4c739a] dark:text-slate-400 text-sm mb-4 leading-relaxed">{task.description}</p>

        <div className="flex items-center justify-between border-t border-[#e7edf3] dark:border-slate-800 pt-5">
          <button
            onClick={onSuspend}
            className="text-[#4c739a] hover:text-red-500 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 group"
          >
            <span className="material-symbols-outlined text-lg group-hover:rotate-90 transition-transform">cancel</span> Suspender
          </button>
          <button
            onClick={onComplete}
            className="bg-[#0d141b] dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white text-xs font-bold px-8 py-2.5 rounded-xl transition-all active:scale-95 shadow-md"
          >
            Concluir
          </button>
        </div>
      </div>
    );
  }

  // Inactive / Paused / Queue State
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing opacity-90 hover:opacity-100"
    >
      <div className="flex justify-between items-start mb-4">
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-widest opacity-80 ${periodicityColors[task.periodicity]}`}>
          {periodicityLabels[task.periodicity]}
        </span>
        <span className="text-[10px] font-bold text-[#4c739a] uppercase">Fila de espera</span>
      </div>

      <h4 className="text-[#0d141b] dark:text-white font-bold text-lg mb-2 opacity-90">{task.name}</h4>
      <p className="text-[#4c739a] dark:text-slate-400 text-sm mb-6 line-clamp-2 leading-relaxed">{task.description}</p>

      <div className="flex items-center justify-between border-t border-[#e7edf3] dark:border-slate-800 pt-5 mt-auto">
        <div className="flex items-center gap-2 text-[12px] font-bold text-[#4c739a] italic">
          <span className="material-symbols-outlined text-lg">history</span>
          <span>Aguardando...</span>
        </div>
        <button
          onClick={onStart}
          className="bg-white border-2 border-primary/20 hover:border-primary text-primary hover:bg-primary/5 text-xs font-bold px-6 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
        >
          Iniciar
        </button>
      </div>
    </div>
  );
};

export default Dashboard;