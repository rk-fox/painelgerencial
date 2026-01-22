import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [filterSpecialties, setFilterSpecialties] = useState<string[]>([]);
  const [filterPeriodicities, setFilterPeriodicities] = useState<string[]>([]);

  // Rank definitions for permission logic
  const rankOrder: Record<string, number> = {
    'Major': 1, 'MAJ': 1,
    'Capitão': 2, 'CAP': 2,
    '1º Tenente': 3, '1TEN': 3,
    '2º Tenente': 4, '2TEN': 4,
    'Suboficial': 5, 'SO': 5,
    // Others are restricted
  };

  useEffect(() => {
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
      const user = JSON.parse(userJson);
      setCurrentUser(user);

      // Initialize filters based on permissions
      const userRankValue = rankOrder[user.rank] || 99;
      if (userRankValue <= 5) {
        // Officer/SO: Can see all, default to showing both? Or empty implies all?
        // User request: "podendo marcar 1, o outro ou ambos".
        // Let's start with NO filters (showing all) or BOTH filters enabled.
        // Usually showing all is better.
        setFilterSpecialties(['BCT', 'AIS']);
      } else {
        // Restricted: Lock to own specialty
        setFilterSpecialties([user.specialty]);
      }
    }
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Include tasks starting today (comparing with task start_date which is usually just a date string YYYY-MM-DD or ISODate)

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter tasks that strictly haven't started yet
      const activeTasks = (data || []).filter((task: any) => {
          if (!task.start_date) return true; // Show if no start date
          const startDate = new Date(task.start_date);
          // Set start date time to 00:00:00 to ensure we include tasks starting today
          startDate.setHours(0, 0, 0, 0); 
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          
          return startDate <= now;
      });

      setTasks(activeTasks);
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
        .update({ status: 'pendente' })
        .eq('id', taskId);

      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'pendente' } : t));
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
      // Update status in local state instead of removing, so it counts towards completed stats immediately
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: 'concluida', completed_at: new Date().toISOString() } : t
      ));

      // Also refetch to ensure server sync and correct timestamps
      await fetchTasks();
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

  // Filter Logic Helpers
  const isRestrictedUser = () => {
    if (!currentUser) return true;
    const rankValue = rankOrder[currentUser.rank] || 99;
    return rankValue > 5; // > 5 means restricted (Sgts, Civ)
  };

  const toggleSpecialty = (spec: string) => {
    if (isRestrictedUser()) return; // Prevent toggle for restricted users

    setFilterSpecialties(prev => {
      if (prev.includes(spec)) {
        // If unchecking, ensure at least one remains? Or allow empty?
        // User flow: "podendo marcar 1, o outro ou ambos".
        // If both unchecked, show none? Or show all? Usually empty filter means show all, BUT here it's explicit filtering.
        // Let's allow unchecking.
        return prev.filter(s => s !== spec);
      } else {
        return [...prev, spec];
      }
    });
  };

  const togglePeriodicity = (period: string) => {
    setFilterPeriodicities(prev => {
      if (prev.includes(period)) {
        return prev.filter(p => p !== period);
      } else {
        return [...prev, period];
      }
    });
  };

  const clearFilters = () => {
    setFilterPeriodicities([]); // Clear periodicities
    // Reset specialties based on rank
    if (isRestrictedUser()) {
      setFilterSpecialties([currentUser.specialty]);
    } else {
      setFilterSpecialties(['BCT', 'AIS']); // Reset to showing both
    }
  };

  const filterTask = (t: any) => {
    // 1. Filter by Specialty
    // Task must have at least one specialty that is in the filter list.
    // If filterSpecialties is empty, should we show none? Or all?
    // Given the explicit toggles, if BCT is off and AIS is off, likely show nothing or show all.
    // Let's assume if enabled list has items, match against them.
    if (filterSpecialties.length > 0) {
      const hasMatchingSpecialty = t.specialties?.some((s: string) => filterSpecialties.includes(s));
      if (!hasMatchingSpecialty) return false;
    } else {
      // If no specialty selected, maybe show none? Or all?
      // Since buttons are toggles, unselecting all -> Show nothing usually.
      // Let's return false if no specialty is selected (user deselected everything).
      return false;
    }

    // 2. Filter by Periodicity
    if (filterPeriodicities.length > 0) {
      if (!filterPeriodicities.includes(t.periodicity)) return false;
    }

    return true;
  };

  const bankTasks = tasks.filter(t => !t.assigned_to && t.status !== 'concluida' && filterTask(t));
  const myTasks = tasks
    .filter(t => t.assigned_to === currentUser?.id && t.status !== 'concluida' && filterTask(t))
    .sort((a, b) => {
      // Prioritize 'iniciada' tasks
      if (a.status === 'iniciada' && b.status !== 'iniciada') return -1;
      if (a.status !== 'iniciada' && b.status === 'iniciada') return 1;
      // Stable sort for others
      return 0;
    });

  // Modal State
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<any>(null);
  const [completionQuantity, setCompletionQuantity] = useState<number>(1);

  const handleCreateNew = () => {
    // Navigate to task form if needed, but mainly this is Dashboard logic
  };

  const calculateStats = () => {
    if (!currentUser) return { completed30: 0, completedTrend: 0, expiringCount: 0, pendingCount: 0 };

    const now = new Date();

    // Concluídas últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(now.getDate() - 60);

    const completedLast30 = tasks.filter(t =>
      // Ensure type safety (IDs should be strings, but safeguard)
      String(t.assigned_to) === String(currentUser.id) &&
      t.status === 'concluida' &&
      t.completed_at &&
      new Date(t.completed_at) >= thirtyDaysAgo
    ).length;

    const completedPrevious30 = tasks.filter(t =>
      String(t.assigned_to) === String(currentUser.id) &&
      t.status === 'concluida' &&
      t.completed_at &&
      new Date(t.completed_at) >= sixtyDaysAgo &&
      new Date(t.completed_at) < thirtyDaysAgo
    ).length;

    let trend = 0;
    if (completedPrevious30 > 0) {
      trend = Math.round(((completedLast30 - completedPrevious30) / completedPrevious30) * 100);
    } else if (completedLast30 > 0) {
      trend = 100; // 100% increase if previous was 0
    }

    // Prazos a expirar (Pontual, até 3 dias) - Only for my tasks
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    const expiringCount = tasks.filter(t => {
      // Logic: assigned to me, not concluded, is pontual, matches date range
      //if (t.assigned_to !== currentUser.id) return false;
      if (t.periodicity !== 'pontual' || t.status === 'concluida' || !t.end_date) return false;

      const endDate = new Date(t.end_date);
      // Reset times
      const todayZero = new Date(now.setHours(0, 0, 0, 0));
      const endZero = new Date(endDate.setHours(0, 0, 0, 0));
      const threeDaysZero = new Date(threeDaysFromNow.setHours(0, 0, 0, 0));

      return endZero >= todayZero && endZero <= threeDaysZero;
    }).length;

    // Tarefas Pendentes Logic:
    // "Count should happen when task is assigned to someone AND STARTED" -> Meaning it is REMOVED from pending count then.
    // So Pending = All tasks - Concluded - (Assigned AND Started)
    // AND we must apply filters (Specialty/Periodicity) so it reflects what is seen on dashboard.
    const pendingCount = tasks.filter(t => {
      // Must match filters
      if (!filterTask(t)) return false;

      // Exclude concluded
      if (t.status === 'concluida') return false;

      // Exclude if Assigned AND Started
      if (t.assigned_to && t.status === 'iniciada') return false;

      // Everything else is pending (Unassigned, Assigned+Pending, Assigned+Paused)
      return true;
    }).length;

    return { completed30: completedLast30, completedTrend: trend, expiringCount, pendingCount };
  };

  const stats = calculateStats();

  const handleRequestCompletion = (task: any) => {
    setTaskToComplete(task);
    setCompletionQuantity(task.quantidade || 1);
    setShowCompletionModal(true);
  };

  const confirmCompletion = async () => {
    if (!taskToComplete) return;
    await executeCompletion(taskToComplete.id, completionQuantity);
    setShowCompletionModal(false);
    setTaskToComplete(null);
  };

  const cancelCompletion = async () => {
    if (!taskToComplete) return;
    // "Caso cancele, deve manter a conclusão da tarefa com a quantidade inalterada."
    // So we complete with ORIGINAL quantity.
    await executeCompletion(taskToComplete.id, taskToComplete.quantidade || 1);
    setShowCompletionModal(false);
    setTaskToComplete(null);
  };

  const executeCompletion = async (taskId: string, qty: number) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'concluida',
          completed_at: new Date().toISOString(),
          quantidade: qty
        })
        .eq('id', taskId);

      if (error) throw error;
      // Update status in local state
      setTasks(prev => prev.map(t =>
        t.id === taskId ? {
          ...t,
          status: 'concluida',
          completed_at: new Date().toISOString(),
          quantidade: qty
        } : t
      ));

      // Also refetch
      await fetchTasks();
    } catch (err: any) {
      console.error('Error completing task:', err.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Concluídas Últ. 30 Dias"
          value={stats.completed30.toString()}
          trend={stats.completedTrend > 0 ? `+${stats.completedTrend}%` : `${stats.completedTrend}%`}
          trendType={stats.completedTrend >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          title="Prazos a Expirar"
          value={stats.expiringCount.toString()}
          badge={stats.expiringCount > 0 ? "Alerta" : ""}
          badgeType="custom"
          badgeColor="bg-[#FFF1F2] text-[#F43F5E]"
        />
        <StatCard
          title="Tarefas Pendentes"
          value={stats.pendingCount.toString()}
          icon="pending_actions"
          iconColor="bg-[#FFEDD5] text-[#F97316]"
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <FilterButton
              label="BCT"
              active={filterSpecialties.includes('BCT')}
              onClick={() => toggleSpecialty('BCT')}
              disabled={isRestrictedUser() && currentUser?.specialty !== 'BCT'}
            />
            <FilterButton
              label="AIS"
              active={filterSpecialties.includes('AIS')}
              onClick={() => toggleSpecialty('AIS')}
              disabled={isRestrictedUser() && currentUser?.specialty !== 'AIS'}
            />
          </div>
          <div className="h-6 w-px bg-[#e7edf3] dark:bg-slate-800 hidden md:block"></div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterButton
              label="Diária"
              active={filterPeriodicities.includes('diaria')}
              onClick={() => togglePeriodicity('diaria')}
            />
            <FilterButton
              label="Semanal"
              active={filterPeriodicities.includes('semanal')}
              onClick={() => togglePeriodicity('semanal')}
            />
            <FilterButton
              label="Mensal"
              active={filterPeriodicities.includes('mensal')}
              onClick={() => togglePeriodicity('mensal')}
            />
            <FilterButton
              label="Temporada"
              active={filterPeriodicities.includes('temporada')}
              onClick={() => togglePeriodicity('temporada')}
            />
            <FilterButton
              label="Pontual"
              active={filterPeriodicities.includes('pontual')}
              onClick={() => togglePeriodicity('pontual')}
            />
          </div>
        </div>
        <button
          onClick={clearFilters}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
        >
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
              <div className="text-center py-10 opacity-50 italic text-sm">Nenhuma tarefa corresponde aos filtros.</div>
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
                onComplete={() => handleRequestCompletion(task)}
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

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-[#e7edf3] dark:border-slate-800 flex flex-col gap-4 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-2xl">check_circle</span>
              </div>
              <h3 className="text-lg font-bold text-[#0d141b] dark:text-white">Conclusão de Tarefa</h3>
              <p className="text-[#4c739a] dark:text-slate-400 text-sm">
                Quantas tarefas iguais foram realizadas neste momento?
              </p>
            </div>

            <div className="flex justify-center py-2">
              <input
                type="number"
                min="1"
                value={completionQuantity}
                onChange={(e) => setCompletionQuantity(parseInt(e.target.value) || 1)}
                className="w-24 text-center text-2xl font-bold p-2 border-b-2 border-primary bg-transparent focus:outline-none"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={cancelCompletion}
                className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 py-3 rounded-xl font-bold transition-all active:scale-95"
              >
                <span className="material-symbols-outlined">close</span>
                Manter ({taskToComplete?.quantidade || 1})
              </button>
              <button
                onClick={confirmCompletion}
                className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white hover:bg-green-600 py-3 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-green-500/20"
              >
                <span className="material-symbols-outlined">check</span>
                Salvar ({completionQuantity})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, trend, trendType, progress, badge, badgeType, badgeColor, icon, iconColor }: any) => (
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
        <p className={`text-sm font-bold flex items-center gap-1 px-2 py-1 rounded-lg ${badgeColor ? badgeColor :
          badgeType === 'warning' ? 'text-orange-500 bg-orange-100 dark:bg-orange-900/30' : ''
          }`}>
          <span className="material-symbols-outlined text-sm">warning</span> {badge}
        </p>
      )}
      {icon && (
        <div className={`p-2 rounded-lg ${iconColor ? iconColor : 'bg-slate-100 dark:bg-slate-800 text-[#4c739a]'}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
      )}
    </div>
  </div>
);

const FilterButton = ({ label, active, onClick, disabled }: { label: string, active?: boolean, onClick?: () => void, disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-5 py-2 rounded-full border text-xs font-bold transition-all active:scale-95 
      ${disabled
        ? 'opacity-50 cursor-not-allowed border-[#e7edf3] bg-slate-100 text-[#94a3b8]'
        : active
          ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20'
          : 'border-[#e7edf3] dark:border-slate-700 bg-transparent text-[#4c739a] dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
      }`}
  >
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
          <span>Início: {task.start_date ? task.start_date.split('T')[0].split('-').reverse().join('/') : 'N/A'}</span>
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