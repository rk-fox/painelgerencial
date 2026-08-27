import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabase";

interface Member {
    id: string;
    name: string;
    war_name: string;
    rank?: string;
    abrev?: string;
    avatar?: string;
    status?: string;
    sector?: string;
    specialty?: string;
    last_promotion_date?: string;
    guia_antiguidade?: number;
}

interface Task {
    id: string;
    name: string;
    description?: string;
    despacho?: string;
    assigned_to?: string;
    status?: string;
    periodicity?: string;
    prazo_final?: string;
    end_date?: string;
    start_date?: string;
    created_at?: string;
    qb?: boolean;
    obs?: string;
    sector?: string;
}

const getRankPriority = (rank?: string, abrev?: string) => {
    const hierarchy = [
        "Cel", "Ten Cel", "Maj", "Cap", "1º Ten", "2º Ten", "Asp",
        "SO", "1S", "2S", "3S", "Cb", "S1", "S2", "CV"
    ];
    const p = hierarchy.indexOf(abrev || "");
    return p !== -1 ? p : 999;
};

const StrategicSummary: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [missions, setMissions] = useState<any[]>([]);
    const [unavailabilities, setUnavailabilities] = useState<any[]>([]);
    const [activeAssignedTasks, setActiveAssignedTasks] = useState<Task[]>([]);
    const [sdiaEvents, setSdiaEvents] = useState<any[]>([]);
    const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
    const [meetings, setMeetings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [currentSlide, setCurrentSlide] = useState(0);
    const [isSlidePaused, setIsSlidePaused] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isFullscreen, setIsFullscreen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

    // Helpers
    const parseLocalDate = (dateString: string | null) => {
        if (!dateString) return null;
        const [year, month, day] = dateString.split("-").map(Number);
        return new Date(year, month - 1, day);
    };

    const getUTC3DateTime = (date: Date) => {
        const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
        const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
        });

        const timeStr = timeFormatter.format(date);
        const dateStr = dateFormatter.format(date);
        const capitalizedDateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

        return { timeStr, dateStr: capitalizedDateStr };
    };

    const getMemberMission = (memberId: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return missions.find((miss) => {
            if (!miss.equipe || !miss.equipe.includes(memberId)) return false;
            const start = parseLocalDate(miss.data_inicio);
            const endD = parseLocalDate(miss.data_fim);
            const end = endD
                ? new Date(endD.getFullYear(), endD.getMonth(), endD.getDate(), 23, 59, 59)
                : null;
            if (!start || !end) return false;
            return today >= start && today <= end;
        });
    };

    const getMemberUnavailToday = (memberId: string) => {
        return unavailabilities.find((u) => u.member === memberId);
    };

    // Load User & All Data
    useEffect(() => {
        const loadAllData = async () => {
            try {
                setLoading(true);
                const userJson = localStorage.getItem("currentUser");
                const userObj = userJson ? JSON.parse(userJson) : null;
                setCurrentUser(userObj);

                const userSector = userObj?.sector;
                const today = new Date().toLocaleDateString("en-CA");
                const tenDaysLater = new Date();
                tenDaysLater.setDate(tenDaysLater.getDate() + 10);
                const tenDaysLaterStr = tenDaysLater.toLocaleDateString("en-CA");

                // 1. Fetch & Sort Members (Includes Hierarchy & CH Logic)
                const { data: membersData } = await supabase
                    .from("members")
                    .select("id, name, war_name, rank, abrev, avatar, status, sector, specialty, last_promotion_date, guia_antiguidade");

                if (membersData) {
                    let filtered = membersData;
                    // Lógica de exibição combinada: Setor Logado + CH
                    if (userSector === "CP" || userSector === "EA") {
                        filtered = filtered.filter((m) => m.sector === userSector || m.sector === "CH");
                    } else if (userSector === "CH") {
                        filtered = filtered.filter((m) =>
                            m.sector === "CP" || m.sector === "EA" || m.sector === "CH"
                        );
                    }

                    // Ordenação
                    const sorted = filtered.sort((a, b) => {
                        // Força CH para o topo
                        if (a.sector === 'CH' && b.sector !== 'CH') return -1;
                        if (a.sector !== 'CH' && b.sector === 'CH') return 1;

                        // 1ª Camada: Posto/Graduação (Rank)
                        const pA = getRankPriority(a.rank, a.abrev);
                        const pB = getRankPriority(b.rank, b.abrev);
                        if (pA !== pB) return pA - pB;

                        // 2ª Camada: Data da última promoção (Mais antiga primeiro)
                        const dateA = new Date(a.last_promotion_date || "9999-12-31").getTime();
                        const dateB = new Date(b.last_promotion_date || "9999-12-31").getTime();
                        if (dateA !== dateB) return dateA - dateB;

                        // 3ª Camada: Guia de Antiguidade (Menor número = mais antigo)
                        const guiaA = a.guia_antiguidade || 999999;
                        const guiaB = b.guia_antiguidade || 999999;
                        if (guiaA !== guiaB) return guiaA - guiaB;

                        // Desempate final: Nome de Guerra
                        const nameA = a.war_name || a.name || "";
                        const nameB = b.war_name || b.name || "";
                        return nameA.localeCompare(nameB);
                    });

                    setMembers(sorted);
                }

                // 2. Fetch Missions
                let missionsQuery = supabase.from("missions").select("*");
                if (userSector && (userSector === "CP" || userSector === "EA")) {
                    missionsQuery = missionsQuery.eq("sector", userSector);
                }
                const { data: missionsData } = await missionsQuery;
                if (missionsData) setMissions(missionsData);

                // 3. Fetch Unavailabilities
                const { data: unavailData } = await supabase
                    .from("unavailability")
                    .select("*")
                    .lte("start_date", today)
                    .gte("end_date", today);
                if (unavailData) setUnavailabilities(unavailData);

                // 4. Fetch Active Assigned Tasks for Member status
                let activeTasksQuery = supabase
                    .from("tasks")
                    .select("*")
                    .neq("status", "concluida");
                if (userSector && userSector !== "CH") {
                    activeTasksQuery = activeTasksQuery.eq("sector", userSector);
                }
                const { data: activeTasksData } = await activeTasksQuery;
                if (activeTasksData) {
                    const validActiveTasks = activeTasksData.filter((task: any) => {
                        if (!task.start_date) return true;
                        const startDate = parseLocalDate(task.start_date);
                        if (!startDate) return true;
                        startDate.setHours(0, 0, 0, 0);
                        const now = new Date();
                        now.setHours(0, 0, 0, 0);
                        return startDate <= now;
                    });
                    setActiveAssignedTasks(validActiveTasks);
                }

                // 5. Fetch SDIA events for the next 10 days
                let sdiaQuery = supabase
                    .from("sdia")
                    .select("*")
                    .gte("data_fim", today)
                    .lte("data_inicio", tenDaysLaterStr)
                    .order("data_inicio", { ascending: true });

                if (userSector && userSector !== "CH") {
                    sdiaQuery = sdiaQuery.eq("sector", userSector);
                }
                const { data: sdiaData } = await sdiaQuery;
                if (sdiaData) setSdiaEvents(sdiaData);

                // 6. Fetch Tasks for Quadro Branco slide logic (current month)
                let tasksQuery = supabase
                    .from("tasks")
                    .select("*")
                    .order("created_at", { ascending: false })
                    .limit(5000);

                if (userSector && userSector !== "CH") {
                    tasksQuery = tasksQuery.eq("sector", userSector);
                }
                const { data: tasksData } = await tasksQuery;

                if (tasksData) {
                    const now = new Date();
                    const currentMonth = now.getMonth();
                    const currentYear = now.getFullYear();

                    const getLatestTask = (head: Task): Task => {
                        let current = head;
                        while (current.despacho) {
                            const child = tasksData.find((t) => t.id === current.despacho);
                            if (!child) break;
                            current = child;
                        }
                        return current;
                    };

                    const filteredTasks = tasksData.filter((task: Task) => {
                        if (!task.qb) return false;
                        const isChild = tasksData.some((other) => other.despacho === task.id);
                        if (isChild) return false;

                        const latest = getLatestTask(task);
                        const taskDateStr = task.start_date || task.created_at;
                        const taskDate = taskDateStr
                            ? new Date(taskDateStr.length === 10 ? `${taskDateStr}T12:00:00` : taskDateStr)
                            : new Date();

                        const startMonth = taskDate.getMonth();
                        const startYear = taskDate.getFullYear();

                        let endMonth = startMonth;
                        let endYear = startYear;
                        const endDateStr = task.prazo_final || task.end_date;

                        if (endDateStr) {
                            const endDate = new Date(endDateStr.length === 10 ? `${endDateStr}T12:00:00` : endDateStr);
                            endMonth = endDate.getMonth();
                            endYear = endDate.getFullYear();
                        }

                        if (currentYear < startYear || (currentYear === startYear && currentMonth < startMonth)) {
                            return false;
                        }
                        if (currentYear > endYear || (currentYear === endYear && currentMonth > endMonth)) {
                            return latest.status !== "concluida";
                        }
                        return true;
                    });

                    setPendingTasks(filteredTasks);
                }

                // 7. Fetch Meetings
                const { data: meetingsData } = await supabase
                    .from("meeting")
                    .select("*")
                    .order("inicio", { ascending: true });

                const { data: allMembersData } = await supabase
                    .from("members")
                    .select("id, sector");

                if (meetingsData && allMembersData && userSector) {
                    const memberSectorMap = new Map<string, string>();
                    allMembersData.forEach((m: any) => {
                        if (m.sector) memberSectorMap.set(m.id, m.sector);
                    });

                    const filteredMeetings = meetingsData.filter((m: any) => {
                        const isUpcoming = m.inicio >= today;
                        if (!isUpcoming) return false;
                        if (userSector === "CH") return true;
                        return m.membros?.some((memberId: string) => memberSectorMap.get(memberId) === userSector);
                    });
                    setMeetings(filteredMeetings);
                } else if (meetingsData) {
                    const filteredMeetings = meetingsData.filter((m: any) => m.inicio >= today);
                    setMeetings(filteredMeetings);
                }
            } catch (err) {
                console.error("Error loading strategic summary data:", err);
            } finally {
                setLoading(false);
            }
        };

        loadAllData();
    }, []);

    // Real-time Clock & Slideshow loop
    useEffect(() => {
        const initialDay = new Date().getDate();

        const clockInterval = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);

            // Auto reload on day change
            if (now.getDate() !== initialDay) {
                window.location.reload();
            }
        }, 1000);

        let slideInterval: any;
        if (!isSlidePaused) {
            slideInterval = setInterval(() => {
                setCurrentSlide((prev) => (prev + 1) % 4);
            }, 10000);
        }

        return () => {
            clearInterval(clockInterval);
            if (slideInterval) clearInterval(slideInterval);
        };
    }, [isSlidePaused]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        }
    };

    useEffect(() => {
        const onFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", onFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
    }, []);

    const { timeStr, dateStr } = getUTC3DateTime(currentTime);
    const userSector = currentUser?.sector || "SE";
    const sectorFullName = userSector === "CP"
        ? "SEÇÃO DE CAPACIDADE ATC"
        : userSector === "EA"
        ? "SEÇÃO DE ESPAÇO AÉREO"
        : userSector === "CH"
        ? "CHEFIA"
        : "SUBDIVISÃO ESTRATÉGICA";

    const loggedUserLabel = currentUser
        ? `${currentUser.rank || ""} ${currentUser.war_name || ""}`.trim()
        : "OPERADOR";

    const tabs = [
        { num: "01", label: "Controle Efetivo" },
        { num: "02", label: "Tarefas em Andamento" },
        { num: "03", label: "D-10 • Próximos Eventos" },
        { num: "04", label: "Reuniões da Seção" },
    ];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-slate-500">
                <span className="material-symbols-outlined text-4xl animate-spin text-primary">progress_activity</span>
                <p className="text-sm font-medium">Carregando Resumo Estratégico...</p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`flex flex-col w-full bg-slate-50 dark:bg-[#0c1322] text-slate-800 dark:text-white rounded-2xl border border-slate-200 dark:border-[#1d2d44] shadow-xl overflow-hidden relative font-sans transition-all duration-300 ${
                isFullscreen ? "fixed inset-0 z-[9999] rounded-none border-none h-screen" : "min-h-[calc(100vh-8rem)]"
            }`}
        >
            {/* Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 dark:bg-[#cda250]/5 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />

            {/* Header Banner */}
            <div className="bg-white dark:bg-[#0f192b] border-b border-slate-200 dark:border-[#1d2d44] px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 relative z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full border-2 border-primary dark:border-[#cda250] flex items-center justify-center font-bold text-base text-primary dark:text-[#cda250] bg-slate-100 dark:bg-[#132039] shadow-inner">
                        {userSector}
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-800 dark:text-white tracking-wide leading-tight">
                            Resumo Estratégico
                        </h1>
                        <p className="text-[10px] md:text-xs text-primary dark:text-[#cda250] font-bold uppercase tracking-wider">
                            {sectorFullName} • {loggedUserLabel}
                        </p>
                    </div>
                </div>

                {/* Clock UTC-3 */}
                <div className="flex flex-col items-center">
                    <span className="text-3xl md:text-4xl font-black font-mono tracking-widest text-slate-800 dark:text-white leading-none">
                        {timeStr}
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {dateStr}
                    </span>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-100 dark:bg-[#132039] border border-slate-200 dark:border-[#1d2d44] rounded-lg p-1">
                        <button
                            onClick={() => setCurrentSlide((prev) => (prev - 1 + 4) % 4)}
                            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
                            title="Slide Anterior"
                        >
                            <span className="material-symbols-outlined text-[20px] block">navigate_before</span>
                        </button>
                        <button
                            onClick={() => setIsSlidePaused(!isSlidePaused)}
                            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-primary dark:text-[#cda250]"
                            title={isSlidePaused ? "Retomar Slideshow" : "Pausar Slideshow"}
                        >
                            <span className="material-symbols-outlined text-[20px] block">
                                {isSlidePaused ? "play_arrow" : "pause"}
                            </span>
                        </button>
                        <button
                            onClick={() => setCurrentSlide((prev) => (prev + 1) % 4)}
                            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
                            title="Próximo Slide"
                        >
                            <span className="material-symbols-outlined text-[20px] block">navigate_next</span>
                        </button>
                    </div>

                    <button
                        onClick={toggleFullscreen}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-[#132039] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#1d2d44] transition-colors"
                        title={isFullscreen ? "Sair da Tela Cheia" : "Modo Apresentação (Tela Cheia)"}
                    >
                        <span className="material-symbols-outlined text-[20px] block">
                            {isFullscreen ? "fullscreen_exit" : "fullscreen"}
                        </span>
                    </button>
                </div>
            </div>

            {/* Custom Tab Progress Navigation Bar */}
            <div className="bg-slate-100 dark:bg-[#0c1424] border-b border-slate-300 dark:border-[#17243c] px-6 py-2.5 flex items-center justify-around md:justify-start gap-6 md:gap-12 relative z-10">
                {tabs.map((tab, idx) => {
                    const isActive = currentSlide === idx;
                    return (
                        <button
                            key={idx}
                            onClick={() => setCurrentSlide(idx)}
                            className="flex items-center gap-2 text-left relative py-1 focus:outline-none group transition-all"
                        >
                            <span
                                className={`text-[10px] font-bold font-mono tracking-wider ${
                                    isActive ? "text-primary dark:text-[#cda250]" : "text-slate-500"
                                }`}
                            >
                                {tab.num}
                            </span>
                            <span
                                className={`text-xs md:text-sm font-semibold tracking-tight transition-colors ${
                                    isActive
                                        ? "text-slate-800 dark:text-white font-bold"
                                        : "text-slate-500 dark:text-slate-400 group-hover:text-slate-200"
                                }`}
                            >
                                {tab.label}
                            </span>
                            {isActive && (
                                <div className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-primary dark:bg-[#cda250] rounded-full shadow-lg" />
                            )}
                        </button>
                    );
                })}

                {/* Autoplay Slide Progress bar */}
                {!isSlidePaused && (
                    <div className="ml-auto hidden md:block w-32 h-1 bg-slate-300 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                            key={currentSlide}
                            className="h-full bg-primary dark:bg-[#cda250] rounded-full"
                            style={{
                                animation: "progress 10s linear forwards",
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Title and Subtitle Block */}
            <div className="px-8 pt-6 pb-3 relative z-10 flex flex-col gap-1">
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-800 dark:text-white tracking-wide">
                    {currentSlide === 0 && "Controle do Efetivo"}
                    {currentSlide === 1 && "Tarefas em Andamento"}
                    {currentSlide === 2 && "D-10 — Eventos dos Próximos 10 Dias"}
                    {currentSlide === 3 && "Reuniões da Seção"}
                </h2>
                <p className="text-xs md:text-sm text-primary dark:text-[#cda250] font-medium tracking-wide">
                    {currentSlide === 0 && "Status operacional e disponibilidade dos militares no momento"}
                    {currentSlide === 1 && "Atividades sob responsabilidade da seção neste mês"}
                    {currentSlide === 2 &&
                        `Janela: ${new Date().toLocaleDateString("pt-BR")} a ${new Date(
                            new Date().setDate(new Date().getDate() + 10)
                        ).toLocaleDateString("pt-BR")}`}
                    {currentSlide === 3 && "Próximos compromissos agendados"}
                </p>
            </div>

            {/* Slide Content Area */}
            <div className="flex-1 overflow-y-auto relative z-10 px-8 pb-8 custom-scrollbar">
                {/* SLIDE 0: CONTROLE EFETIVO */}
                {currentSlide === 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
                        {members.map((member) => {
                            const currentMission = getMemberMission(member.id);
                            const currentUnavail = getMemberUnavailToday(member.id);
                            const isUnavailable = member.status === "Indisponível" || !!currentUnavail;
                            const memberTasks = activeAssignedTasks.filter((t) => t.assigned_to === member.id);

                            let cardBg = "bg-white dark:bg-[#131f37] border-slate-200 dark:border-[#1d2d44]";
                            let borderAccent = "border-l-4 border-l-[#38bdf8]";
                            let statusBadge = (
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
                                    Disponível
                                </span>
                            );

                            if (currentMission) {
                                cardBg = "bg-blue-50/70 dark:bg-[#1a2035] border-blue-200 dark:border-[#252f4c]";
                                borderAccent = "border-l-4 border-l-[#cda250]";
                                statusBadge = (
                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-primary/10 dark:bg-[#cda250]/15 text-primary dark:text-[#cda250] border border-primary/20 dark:border-[#cda250]/20">
                                        Em Viagem
                                    </span>
                                );
                            } else if (isUnavailable && currentUnavail?.type === "Atividade") {
                                cardBg = "bg-emerald-50/70 dark:bg-[#142337] border-emerald-200 dark:border-[#1f3552]";
                                borderAccent = "border-l-4 border-l-[#10b981]";
                                statusBadge = (
                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/25">
                                        Atividade Interna
                                    </span>
                                );
                            } else if (isUnavailable) {
                                cardBg = "bg-red-50/70 dark:bg-[#221c29] border-red-200 dark:border-[#382b43]";
                                borderAccent = "border-l-4 border-l-red-500";
                                statusBadge = (
                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25">
                                        {currentUnavail ? currentUnavail.type : "Indisponível"}
                                    </span>
                                );
                            }

                            const tooltipLines = [];
                            if (currentMission) {
                                tooltipLines.push(`Viagem: ${currentMission.nome || ""} ${currentMission.local ? `(${currentMission.local})` : ""}`);
                            }
                            if (isUnavailable && currentUnavail) {
                                const details = currentUnavail.detalhes || currentUnavail.atividade || "";
                                tooltipLines.push(`Afastamento: ${currentUnavail.type}${details ? ` - ${details}` : ""}`);
                            }
                            if (memberTasks.length > 0) {
                                tooltipLines.push("Atividades:");
                                memberTasks.forEach((t) => tooltipLines.push(`- ${t.name}`));
                            } else {
                                tooltipLines.push("Nenhuma atividade em andamento");
                            }
                            const tooltipText = tooltipLines.join("\n");

                            return (
                                <div
                                    key={member.id}
                                    title={tooltipText}
                                    className={`p-4 rounded-xl border ${cardBg} ${borderAccent} flex flex-col justify-between gap-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-help`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0f192b] flex items-center justify-center font-bold text-xs uppercase text-slate-600 dark:text-slate-300">
                                            {member.avatar ? (
                                                <img
                                                    src={member.avatar}
                                                    alt={member.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                member.name.substring(0, 2)
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-extrabold text-slate-800 dark:text-white truncate">
                                                {member.abrev} {member.war_name}
                                            </h4>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                                                {member.name}
                                            </span>
                                            {/* VISUALIZAÇÃO DO SETOR */}
                                            {member.sector && (
                                                <span className="inline-block mt-0.5 px-1.5 py-[1px] rounded bg-slate-200 dark:bg-[#1a283e] text-slate-600 dark:text-slate-300 text-[8px] font-bold uppercase tracking-wider">
                                                    Setor: {member.sector}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-slate-200 dark:border-[#1d2d44]/50 pt-2 mt-1">
                                        {statusBadge}
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                                            {memberTasks.length} {memberTasks.length === 1 ? "Atividade" : "Atividades"}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* SLIDE 1: TAREFAS EM ANDAMENTO */}
                {currentSlide === 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
                        {pendingTasks.length > 0 ? (
                            pendingTasks.map((task, idx) => {
                                const respMember = members.find((m) => m.id === task.assigned_to);
                                const isEven = idx % 2 === 0;
                                return (
                                    <div
                                        key={task.id}
                                        className={`p-5 rounded-xl border border-slate-200 dark:border-[#1d2d44] bg-white dark:bg-[#131f37] flex flex-col justify-between gap-4 shadow-sm ${
                                            isEven ? "border-l-4 border-l-[#cda250]" : "border-l-4 border-l-[#3b82f6]"
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <span className="text-[10px] font-bold text-primary dark:text-[#cda250] uppercase tracking-wider mt-1">
                                                    {task.periodicity || "Tarefa"}
                                                </span>
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                                        Prazo:{" "}
                                                        {task.prazo_final
                                                            ? new Date(task.prazo_final).toLocaleDateString("pt-BR")
                                                            : "S/P"}
                                                    </span>
                                                    <span
                                                        className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                            task.status === "concluida"
                                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                : task.status === "iniciada"
                                                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                                        }`}
                                                    >
                                                        {task.status === "iniciada"
                                                            ? "Em andamento"
                                                            : task.status === "concluida"
                                                            ? "Concluída"
                                                            : "Pendente"}
                                                    </span>
                                                </div>
                                            </div>
                                            <h4 className="text-base font-extrabold text-slate-800 dark:text-white leading-tight">
                                                {task.name}
                                            </h4>
                                            <div className="mt-3 p-3 rounded bg-slate-50 dark:bg-[#0c1424]/60 border border-slate-200 dark:border-[#1c2a3f]">
                                                <span className="text-[9px] text-primary dark:text-[#cda250] font-black uppercase tracking-wider block mb-1">
                                                    Descrição
                                                </span>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    {task.description || (
                                                        <span className="text-slate-500 italic">
                                                            Nenhuma descrição informada
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-200 dark:border-[#1d2d44]/50 pt-3 flex items-center justify-between">
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase">
                                                Responsável:
                                            </span>
                                            <span className="text-xs font-bold text-slate-800 dark:text-white">
                                                {respMember
                                                    ? `${respMember.abrev || ""} ${respMember.war_name}`.trim()
                                                    : "Não designado"}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-3 py-12 text-center text-slate-500 text-sm">
                                Nenhuma atividade pendente encontrada para este mês.
                            </div>
                        )}
                    </div>
                )}

                {/* SLIDE 2: D-10 PROXIMOS EVENTOS */}
                {currentSlide === 2 && (() => {
                    const next10Days = Array.from({ length: 10 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() + i);
                        return d;
                    });

                    return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 animate-in fade-in duration-300">
                            {next10Days.map((date, index) => {
                                const dateStrFormatted = date.toLocaleDateString("en-CA");

                                const dayEvents = sdiaEvents.filter((sdia) => {
                                    if (!sdia.data_inicio) return false;
                                    const dataInicioPura = sdia.data_inicio.split("T")[0];
                                    const dataFimPura = sdia.data_fim ? sdia.data_fim.split("T")[0] : dataInicioPura;
                                    return dataInicioPura <= dateStrFormatted && dataFimPura >= dateStrFormatted;
                                });

                                const isToday = index === 0;
                                const weekday = date
                                    .toLocaleDateString("pt-BR", { weekday: "short" })
                                    .replace(".", "")
                                    .toUpperCase();
                                const formattedDayDate = date.toLocaleDateString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                });
                                const isEven = index % 2 === 0;

                                return (
                                    <div
                                        key={index}
                                        className={`p-4 rounded-xl border flex flex-col gap-3 min-h-[160px] shadow-sm transition-all duration-300 hover:border-slate-500 bg-white dark:bg-[#131f37] border-slate-200 dark:border-[#1d2d44] ${
                                            isToday
                                                ? "border-l-4 border-l-[#cda250]"
                                                : isEven
                                                ? "border-l-4 border-l-[#3b82f6]"
                                                : "border-l-4 border-l-[#cda250]/70"
                                        }`}
                                    >
                                        <div className="border-b border-slate-200 dark:border-[#1d2d44]/50 pb-2 flex items-center justify-between">
                                            <span
                                                className={`text-[10px] font-black tracking-wider ${
                                                    isToday ? "text-primary dark:text-[#cda250]" : "text-slate-500 dark:text-slate-400"
                                                }`}
                                            >
                                                {isToday ? "HOJE" : weekday}
                                            </span>
                                            <span className="text-sm font-bold text-slate-800 dark:text-white">
                                                {formattedDayDate}
                                            </span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto flex flex-col gap-2 max-h-[160px] custom-scrollbar">
                                            {dayEvents.length > 0 ? (
                                                dayEvents.map((sdia) => (
                                                    <div
                                                        key={sdia.id}
                                                        className="p-2 rounded bg-slate-50 dark:bg-[#0c1424]/60 border border-slate-200 dark:border-[#1a283e] flex flex-col gap-1"
                                                    >
                                                        <div className="text-xs font-mono font-bold text-primary dark:text-[#cda250] leading-none">
                                                            [{sdia.indicativo}]
                                                        </div>
                                                        <div className="text-xs font-semibold text-slate-800 dark:text-white leading-tight">
                                                            {sdia.titulo_sdia}
                                                        </div>
                                                        {(sdia.impacto || sdia.cap || sdia.clsd) && (
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {sdia.impacto && (
                                                                    <span
                                                                        title={sdia.analise || "Nenhuma análise informada"}
                                                                        className="cursor-help px-1 py-0.2 rounded bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-[7px] font-bold uppercase tracking-wide"
                                                                    >
                                                                        IMP
                                                                    </span>
                                                                )}
                                                                {sdia.cap && (
                                                                    <span
                                                                        title={sdia.r60 || "Sem valor R60"}
                                                                        className="cursor-help px-1 py-0.2 rounded bg-primary/10 dark:bg-[#cda250]/10 border border-primary/20 dark:border-[#cda250]/20 text-primary dark:text-[#cda250] text-[7px] font-bold uppercase tracking-wide"
                                                                    >
                                                                        CAP
                                                                    </span>
                                                                )}
                                                                {sdia.clsd && (
                                                                    <span
                                                                        title={sdia.analise || "Nenhuma análise informada"}
                                                                        className="cursor-help px-1 py-0.2 rounded bg-orange-500/10 border border-orange-500/20 text-orange-500 dark:text-orange-400 text-[7px] font-bold uppercase tracking-wide"
                                                                    >
                                                                        CLSD
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                                                    Sem eventos
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}

                {/* SLIDE 3: REUNIões DA SEÇÃO */}
                {currentSlide === 3 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
                        {meetings.length > 0 ? (
                            meetings.map((meeting, idx) => {
                                const startDate = new Date(meeting.inicio);
                                const meetingStartTime = startDate.toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                });
                                const dayMonthStr = startDate.toLocaleDateString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                });
                                const rawWeekday = startDate.toLocaleDateString("pt-BR", {
                                    weekday: "short",
                                });
                                const weekdayStr =
                                    rawWeekday.charAt(0).toUpperCase() + rawWeekday.slice(1).replace(".", "");
                                const formattedDate = `${dayMonthStr} - ${weekdayStr}`;

                                const summonedMembers = meeting.membros || [];
                                const summonedDetails = members.filter((m) => summonedMembers.includes(m.id));
                                const isEven = idx % 2 === 0;

                                return (
                                    <div
                                        key={meeting.id}
                                        className={`p-5 rounded-xl border border-slate-200 dark:border-[#1d2d44] bg-white dark:bg-[#131f37] flex flex-col justify-between gap-4 shadow-sm transition-all duration-300 hover:border-slate-500 ${
                                            isEven ? "border-l-4 border-l-[#cda250]" : "border-l-4 border-l-[#3b82f6]"
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <span className="text-sm font-bold text-primary dark:text-[#cda250] font-mono leading-none">
                                                    {meetingStartTime}
                                                </span>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                                                    {formattedDate}
                                                </span>
                                            </div>
                                            <h4 className="text-base font-extrabold text-slate-800 dark:text-white leading-tight font-serif">
                                                {meeting.assunto}
                                            </h4>
                                            {meeting.link && (
                                                <div className="mt-2.5 p-2 rounded bg-slate-50 dark:bg-[#0c1424]/40 border border-slate-200 dark:border-[#1a283e] flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-[14px] text-primary dark:text-[#cda250]">
                                                        link
                                                    </span>
                                                    <a
                                                        href={meeting.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-primary truncate hover:underline cursor-pointer"
                                                    >
                                                        {meeting.link}
                                                    </a>
                                                </div>
                                            )}
                                        </div>

                                        <div className="border-t border-slate-200 dark:border-[#1d2d44]/50 pt-3">
                                            <span className="text-[9px] text-primary dark:text-[#cda250] font-bold uppercase tracking-wider block mb-2">
                                                Convocados
                                            </span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {summonedDetails.length > 0 ? (
                                                    summonedDetails.map((m) => (
                                                        <span
                                                            key={m.id}
                                                            className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#0c1424] text-slate-600 dark:text-slate-300 text-[10px] font-semibold border border-slate-200 dark:border-[#1a283e]"
                                                        >
                                                            {m.abrev} {m.war_name}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-slate-500 italic">
                                                        Nenhum membro listado
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-2 py-12 text-center text-slate-500 text-sm">
                                Nenhuma reunião agendada a partir de hoje.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Animation CSS */}
            <style>
                {`
                @keyframes progress {
                    from { width: 0%; }
                    to { width: 100%; }
                }
                .animate-progress {
                    animation: progress 10s linear forwards;
                }
                `}
            </style>
        </div>
    );
};

export default StrategicSummary;
