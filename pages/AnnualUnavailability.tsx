import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { Member } from "../types";
import MemberProfileModal from "../components/MemberProfileModal";

// === INTERFACES ===

interface MemberBasic {
    id: string;
    name: string;
    war_name?: string;
    rank: string;
    abrev?: string;
    avatar: string;
    specialty: string;
    sector?: string;
    last_promotion_date?: string;
    guia_antiguidade?: number;
    status?: string;
}

interface Unavailability {
    id: number;
    member: string;
    type: string;
    start_date: string;
    end_date: string;
    detalhes?: string | null;
    sector?: string;
}

interface Mission {
    id: string;
    nome: string;
    data_inicio: string;
    data_fim: string;
    equipe: string[] | null;
    sector?: string;
}

// === CONSTANTS ===

const getRankPriority = (
    rankStr: string | null,
    abrevStr: string | null,
): number => {
    const s = (rankStr || abrevStr || "").toUpperCase().trim();
    if (s.includes("MAJOR") || s.includes("MAJ")) return 0;
    if (s.includes("CAPIT")) return 1;
    if (s.includes("1º TEN") || s.includes("1.º TEN") || s.includes("1TEN")) {
        return 2;
    }
    if (
        s.includes("2º TEN") || s.includes("2.º TEN") || s.includes("2TEN") ||
        s.includes("ASP")
    ) return 3;
    if (s.includes("SUBOF") || s.includes("SO.")) return 4;
    if (s.includes("1º SAR") || s.includes("1.º SAR") || s.includes("1SGT")) {
        return 5;
    }
    if (s.includes("2º SAR") || s.includes("2.º SAR") || s.includes("2SGT")) {
        return 6;
    }
    if (s.includes("3º SAR") || s.includes("3.º SAR") || s.includes("3SGT")) {
        return 7;
    }
    if (s.includes("SGT")) return 7;
    if (s.includes("CIV")) return 8;
    return 99;
};

const getCompactRank = (member: MemberBasic): string => {
    const r = (member.rank || "").toUpperCase().trim();
    if (r.includes("MAJOR") || r === "MAJ") return "Maj";
    if (r.includes("CAPIT") || r === "CAP") return "Cap";
    if (r.includes("1º TEN") || r.includes("1.º TEN") || r === "1TEN") {
        return "1T";
    }
    if (
        r.includes("2º TEN") || r.includes("2.º TEN") || r === "2TEN" ||
        r.includes("ASP")
    ) return "2T";
    if (r.includes("SUBOF") || r === "SO") return "SO";
    if (r.includes("1º SAR") || r.includes("1.º SAR") || r === "1SGT") {
        return "1S";
    }
    if (r.includes("2º SAR") || r.includes("2.º SAR") || r === "2SGT") {
        return "2S";
    }
    if (r.includes("3º SAR") || r.includes("3.º SAR") || r === "3SGT") {
        return "3S";
    }
    if (r.includes("CIV")) return "Cv";
    return member.abrev || "";
};

const MONTH_NAMES = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
];

const DAY_ABBREVS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const TYPE_CONFIG: Record<
    string,
    { abbrev: string; color: string; textColor: string }
> = {
    "Missão": { abbrev: "M", color: "#dc2626", textColor: "#ffffff" },
    "Férias": { abbrev: "F", color: "#16a34a", textColor: "#ffffff" },
    "CAIS": { abbrev: "S", color: "#eab308", textColor: "#422006" },
    "SALOP": { abbrev: "S", color: "#eab308", textColor: "#422006" },
    "Sobreaviso": { abbrev: "SO", color: "#1e3a5f", textColor: "#ffffff" },
    "RISAER": { abbrev: "R", color: "#6b7280", textColor: "#ffffff" },
    "Dispensa": { abbrev: "D", color: "#38bdf8", textColor: "#0c4a6e" },
    "Home Office": { abbrev: "HO", color: "#0d9488", textColor: "#ffffff" },
    "Aniversário": { abbrev: "A", color: "#ec4899", textColor: "#ffffff" },
    "Outros": { abbrev: "O", color: "#fbbf24", textColor: "#451a03" },
};

interface LegendItem {
    key: string;
    label: string;
    types: string[];
    color: string;
    textColor: string;
    abbrev: string;
}

const LEGEND_ITEMS: LegendItem[] = [
    {
        key: "Missão",
        label: "Missão",
        types: ["Missão"],
        color: "#dc2626",
        textColor: "#ffffff",
        abbrev: "M",
    },
    {
        key: "Férias",
        label: "Férias",
        types: ["Férias"],
        color: "#16a34a",
        textColor: "#ffffff",
        abbrev: "F",
    },
    {
        key: "CAIS/SALOP",
        label: "CAIS/SALOP",
        types: ["CAIS", "SALOP"],
        color: "#eab308",
        textColor: "#422006",
        abbrev: "S",
    },
    {
        key: "Sobreaviso",
        label: "Sobreaviso",
        types: ["Sobreaviso"],
        color: "#1e3a5f",
        textColor: "#ffffff",
        abbrev: "SO",
    },
    {
        key: "RISAER",
        label: "RISAER",
        types: ["RISAER"],
        color: "#6b7280",
        textColor: "#ffffff",
        abbrev: "R",
    },
    {
        key: "Dispensa",
        label: "Dispensa",
        types: ["Dispensa"],
        color: "#38bdf8",
        textColor: "#0c4a6e",
        abbrev: "D",
    },
    {
        key: "Home Office",
        label: "Home Office",
        types: ["Home Office"],
        color: "#0d9488",
        textColor: "#ffffff",
        abbrev: "HO",
    },
    {
        key: "Aniversário",
        label: "Aniversário",
        types: ["Aniversário"],
        color: "#ec4899",
        textColor: "#ffffff",
        abbrev: "A",
    },
    {
        key: "Outros",
        label: "Outros",
        types: ["Outros"],
        color: "#fbbf24",
        textColor: "#451a03",
        abbrev: "O",
    },
];

// === COMPONENT ===

const AnnualUnavailability: React.FC = () => {
    const navigate = useNavigate();
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [availableYears, setAvailableYears] = useState<number[]>([
        new Date().getFullYear(),
    ]);
    const [members, setMembers] = useState<MemberBasic[]>([]);
    const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>(
        [],
    );
    const [missions, setMissions] = useState<Mission[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [selectedSectorFilter, setSelectedSectorFilter] = useState<
        "Todos" | "Capacidade" | "Espaço Aéreo"
    >("Todos");
    const [activeFilters, setActiveFilters] = useState<Set<string>>(() =>
        new Set(LEGEND_ITEMS.map((l) => l.key))
    );
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);

    // Load current user
    useEffect(() => {
        const userJson = localStorage.getItem("currentUser");
        if (userJson) {
            setCurrentUser(JSON.parse(userJson));
        }
    }, []);

    // Fetch data when year or user changes
    useEffect(() => {
        if (currentUser !== null) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedYear, currentUser]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const sector = currentUser?.sector || null;
            const startOfYear = `${selectedYear}-01-01`;
            const endOfYear = `${selectedYear}-12-31`;

            let membersQuery = supabase.from("members")
                .select(
                    "id, name, war_name, rank, abrev, avatar, specialty, sector, last_promotion_date, guia_antiguidade, status",
                );

            let unavailQuery = supabase.from("unavailability")
                .select("*")
                .lte("start_date", endOfYear)
                .gte("end_date", startOfYear);

            let missionsQuery = supabase.from("missions")
                .select("id, nome, data_inicio, data_fim, equipe, sector")
                .lte("data_inicio", endOfYear)
                .gte("data_fim", startOfYear);

            if (sector && (sector === "CP" || sector === "EA")) {
                membersQuery = membersQuery.eq("sector", sector);
                unavailQuery = unavailQuery.eq("sector", sector);
                missionsQuery = missionsQuery.eq("sector", sector);
            }

            const [membersRes, unavailRes, missionsRes] = await Promise.all([
                membersQuery,
                unavailQuery,
                missionsQuery,
            ]);

            if (membersRes.error) throw membersRes.error;
            if (unavailRes.error) throw unavailRes.error;
            if (missionsRes.error) throw missionsRes.error;

            // Sort members by seniority (same as Login)
            const sortedMembers = [...(membersRes.data || [])].sort((a, b) => {
                const pA = getRankPriority(a.rank, a.abrev);
                const pB = getRankPriority(b.rank, b.abrev);
                if (pA !== pB) return pA - pB;
                const dateA = a.last_promotion_date
                    ? new Date(a.last_promotion_date).getTime()
                    : Infinity;
                const dateB = b.last_promotion_date
                    ? new Date(b.last_promotion_date).getTime()
                    : Infinity;
                if (dateA !== dateB) return dateA - dateB;
                const guiaA = a.guia_antiguidade ?? 9999;
                const guiaB = b.guia_antiguidade ?? 9999;
                if (guiaA !== guiaB) return guiaA - guiaB;
                const nameA = a.war_name || a.name || "";
                const nameB = b.war_name || b.name || "";
                return nameA.localeCompare(nameB);
            });

            setMembers(sortedMembers);
            setUnavailabilities(unavailRes.data || []);
            setMissions(missionsRes.data || []);
        } catch (err: any) {
            console.error("Error fetching annual data:", err.message);
        } finally {
            setLoading(false);
        }
    };

    // === FILTERED DATA (for CH sector toggle) ===

    const filteredMembers = useMemo(() => {
        const active = members.filter((m) => m.status !== "Indisponível");
        if (currentUser?.sector === "CH" && selectedSectorFilter !== "Todos") {
            const sectorKey = selectedSectorFilter === "Capacidade"
                ? ["CP", "CH"]
                : ["EA", "CH"];
            return active.filter((m) => m.sector === sectorKey);
        }
        return active;
    }, [members, currentUser, selectedSectorFilter]);

    const filteredUnavailabilities = useMemo(() => {
        if (currentUser?.sector === "CH" && selectedSectorFilter !== "Todos") {
            const sectorKey = selectedSectorFilter === "Capacidade"
                ? ["CP", "CH"]
                : ["EA", "CH"];
            return unavailabilities.filter((u) => u.sector === sectorKey);
        }
        return unavailabilities;
    }, [unavailabilities, currentUser, selectedSectorFilter]);

    const filteredMissions = useMemo(() => {
        if (currentUser?.sector === "CH" && selectedSectorFilter !== "Todos") {
            const sectorKey = selectedSectorFilter === "Capacidade"
                ? ["CP", "CH"]
                : ["EA", "CH"];
            return missions.filter((m) => m.sector === sectorKey);
        }
        return missions;
    }, [missions, currentUser, selectedSectorFilter]);

    // === PRE-COMPUTED CELL DATA MAP ===
    // Structure: memberId -> dateStr -> { type, details }

    const cellDataMap = useMemo(() => {
        const map: Record<
            string,
            Record<string, { type: string; details?: string }>
        > = {};
        const yearStart = new Date(selectedYear, 0, 1, 12, 0, 0);
        const yearEnd = new Date(selectedYear, 11, 31, 12, 0, 0);
        const yearStartMs = yearStart.getTime();
        const yearEndMs = yearEnd.getTime();

        // 1. Unavailabilities (lower priority — processed first)
        filteredUnavailabilities.forEach((u) => {
            const start = new Date(u.start_date.split("T")[0] + "T12:00:00");
            const end = new Date(u.end_date.split("T")[0] + "T12:00:00");
            const iterStart = new Date(Math.max(start.getTime(), yearStartMs));
            const iterEnd = new Date(Math.min(end.getTime(), yearEndMs));

            for (
                let d = new Date(iterStart);
                d <= iterEnd;
                d.setDate(d.getDate() + 1)
            ) {
                const ds = `${d.getFullYear()}-${
                    String(d.getMonth() + 1).padStart(2, "0")
                }-${String(d.getDate()).padStart(2, "0")}`;
                if (!map[u.member]) map[u.member] = {};
                if (!map[u.member][ds]) {
                    map[u.member][ds] = {
                        type: u.type,
                        details: u.detalhes || undefined,
                    };
                }
            }
        });

        // 2. Missions (higher priority — overwrites)
        filteredMissions.forEach((m) => {
            if (!m.equipe || m.equipe.length === 0) return;
            const start = new Date(m.data_inicio.split("T")[0] + "T12:00:00");
            const end = new Date(m.data_fim.split("T")[0] + "T12:00:00");
            const iterStart = new Date(Math.max(start.getTime(), yearStartMs));
            const iterEnd = new Date(Math.min(end.getTime(), yearEndMs));

            for (
                let d = new Date(iterStart);
                d <= iterEnd;
                d.setDate(d.getDate() + 1)
            ) {
                const ds = `${d.getFullYear()}-${
                    String(d.getMonth() + 1).padStart(2, "0")
                }-${String(d.getDate()).padStart(2, "0")}`;
                m.equipe!.forEach((memberId) => {
                    if (!map[memberId]) map[memberId] = {};
                    map[memberId][ds] = { type: "Missão", details: m.nome };
                });
            }
        });

        return map;
    }, [filteredUnavailabilities, filteredMissions, selectedYear]);

    // === FILTER LOGIC ===

    const isTypeVisible = useCallback((type: string): boolean => {
        return LEGEND_ITEMS.some((item) =>
            item.types.includes(type) && activeFilters.has(item.key)
        );
    }, [activeFilters]);

    const toggleFilter = (key: string) => {
        setActiveFilters((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // === MEMBER PROFILE ===

    const handleMemberClick = async (memberId: string) => {
        try {
            const { data, error } = await supabase
                .from("members")
                .select("*")
                .eq("id", memberId)
                .single();
            if (!error && data) {
                setSelectedMember(data);
            }
        } catch (error) {
            console.error("Error fetching member details:", error);
        }
    };

    // === YEAR RANGE ===

    useEffect(() => {
        const fetchYears = async () => {
            try {
                const [unavailRes, missionsRes] = await Promise.all([
                    supabase.from("unavailability").select(
                        "start_date, end_date",
                    ),
                    supabase.from("missions").select("data_inicio, data_fim"),
                ]);

                const years = new Set<number>();

                unavailRes.data?.forEach((item) => {
                    if (item.start_date) {
                        years.add(new Date(item.start_date).getFullYear());
                    }
                    if (item.end_date) {
                        years.add(new Date(item.end_date).getFullYear());
                    }
                });

                missionsRes.data?.forEach((item) => {
                    if (item.data_inicio) {
                        years.add(new Date(item.data_inicio).getFullYear());
                    }
                    if (item.data_fim) {
                        years.add(new Date(item.data_fim).getFullYear());
                    }
                });

                if (years.size === 0) {
                    years.add(new Date().getFullYear());
                }

                setAvailableYears(Array.from(years).sort((a, b) => a - b));
            } catch (error) {
                console.error("Error fetching available years:", error);
            }
        };

        fetchYears();
    }, []);

    // === RENDER ===

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96 animate-in fade-in duration-500">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-slate-200 border-t-primary">
                    </div>
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                        Carregando dados...
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full bg-[#f8fafc] dark:bg-background-dark animate-in fade-in duration-500">
            {/* ===== HEADER BAR ===== */}
            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 gap-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[#4c739a] text-[24px]">
                            arrow_back
                        </span>
                    </button>
                    <div>
                        <h1 className="text-[#0d141b] dark:text-white text-xl md:text-2xl font-black leading-tight tracking-tight">
                            Gestão Anual
                        </h1>
                        <p className="text-[10px] text-primary font-bold tracking-widest uppercase mt-0.5">
                            Visão consolidada do efetivo
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                    {/* Year selector */}
                    <select
                        value={selectedYear}
                        onChange={(e) =>
                            setSelectedYear(Number(e.target.value))}
                        className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm focus:ring-2 focus:ring-primary w-[90px]"
                    >
                        {availableYears.map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>

                    {/* Sector filter (CH only) */}
                    {currentUser?.sector === "CH" && (
                        <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
                            {(["Todos", "Capacidade", "Espaço Aéreo"] as const)
                                .map((filter) => (
                                    <button
                                        key={filter}
                                        type="button"
                                        onClick={() =>
                                            setSelectedSectorFilter(filter)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-wider ${
                                            selectedSectorFilter === filter
                                                ? "bg-white dark:bg-slate-700 text-primary shadow-sm"
                                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-400"
                                        }`}
                                    >
                                        {filter}
                                    </button>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ===== BODY ===== */}
            <div className="flex flex-col lg:flex-row flex-1">
                {/* --- TABLES AREA --- */}
                <div className="flex-1 p-4 md:p-6 space-y-6 order-2 lg:order-1 min-w-0">
                    {MONTH_NAMES.map((monthName, monthIndex) => {
                        const daysInMonth = new Date(
                            selectedYear,
                            monthIndex + 1,
                            0,
                        ).getDate();
                        const days = Array.from(
                            { length: daysInMonth },
                            (_, i) => {
                                const date = new Date(
                                    selectedYear,
                                    monthIndex,
                                    i + 1,
                                );
                                return {
                                    day: i + 1,
                                    dow: date.getDay(),
                                    isWeekend: date.getDay() === 0 ||
                                        date.getDay() === 6,
                                    dateStr: `${selectedYear}-${
                                        String(monthIndex + 1).padStart(2, "0")
                                    }-${String(i + 1).padStart(2, "0")}`,
                                };
                            },
                        );

                        return (
                            <div
                                key={monthIndex}
                                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-300"
                                style={{
                                    animationDelay: `${monthIndex * 40}ms`,
                                }}
                            >
                                {/* Month banner */}
                                <div className="bg-gradient-to-r from-amber-200/80 via-amber-100/60 to-amber-200/80 dark:from-amber-900/40 dark:via-amber-900/20 dark:to-amber-900/40 px-4 py-2.5 border-b border-amber-300/60 dark:border-amber-800/40">
                                    <h2 className="text-center text-sm md:text-base font-black uppercase tracking-[0.25em] text-amber-800 dark:text-amber-300">
                                        {monthName}
                                    </h2>
                                </div>

                                {/* Scrollable table */}
                                <div className="overflow-x-auto annual-scrollbar">
                                    <table
                                        className="border-collapse"
                                        style={{
                                            minWidth: `${
                                                150 + daysInMonth * 30
                                            }px`,
                                        }}
                                    >
                                        <thead>
                                            {/* Day-of-week row */}
                                            <tr>
                                                <th
                                                    rowSpan={2}
                                                    className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-left font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400"
                                                    style={{
                                                        minWidth: "150px",
                                                        width: "150px",
                                                    }}
                                                >
                                                    Efetivo
                                                </th>
                                                {days.map((d) => (
                                                    <th
                                                        key={`dow-${d.day}`}
                                                        className={`border border-slate-300 dark:border-slate-700 px-0 py-0.5 text-center font-bold text-[8px] uppercase tracking-tight ${
                                                            d.isWeekend
                                                                ? "bg-orange-200/70 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400"
                                                                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                                                        }`}
                                                        style={{
                                                            minWidth: "30px",
                                                            width: "30px",
                                                        }}
                                                    >
                                                        {DAY_ABBREVS[d.dow]}
                                                    </th>
                                                ))}
                                            </tr>
                                            {/* Day-number row */}
                                            <tr>
                                                {days.map((d) => (
                                                    <th
                                                        key={`dn-${d.day}`}
                                                        className={`border border-slate-300 dark:border-slate-700 px-0 py-1 text-center font-black text-[11px] ${
                                                            d.isWeekend
                                                                ? "bg-orange-200/70 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400"
                                                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                                        }`}
                                                        style={{
                                                            minWidth: "30px",
                                                            width: "30px",
                                                        }}
                                                    >
                                                        {d.day}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredMembers.map((member) => (
                                                <tr
                                                    key={member.id}
                                                    className="group/row"
                                                >
                                                    {/* Member name (sticky) */}
                                                    <td
                                                        className="sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/60 border border-slate-300 dark:border-slate-700 px-3 py-1 font-black text-[11px] text-slate-800 dark:text-slate-200 cursor-pointer hover:!text-primary transition-colors whitespace-nowrap"
                                                        style={{
                                                            minWidth: "150px",
                                                            width: "150px",
                                                        }}
                                                        onClick={() =>
                                                            handleMemberClick(
                                                                member.id,
                                                            )}
                                                        title={`Ver currículo: ${
                                                            member.abrev ||
                                                            member.rank
                                                        } ${
                                                            member.war_name ||
                                                            member.name
                                                        }`}
                                                    >
                                                        {getCompactRank(member)}
                                                        {" "}
                                                        {(member.war_name ||
                                                            member.name || "")
                                                            .toUpperCase()}
                                                    </td>
                                                    {/* Day cells */}
                                                    {days.map((d) => {
                                                        const cell =
                                                            cellDataMap[
                                                                member.id
                                                            ]?.[d.dateStr];
                                                        const visible = cell &&
                                                            isTypeVisible(
                                                                cell.type,
                                                            );

                                                        if (!visible) {
                                                            return (
                                                                <td
                                                                    key={d.day}
                                                                    className={`border border-slate-200 dark:border-slate-700/60 px-0 py-1 text-center ${
                                                                        d.isWeekend
                                                                            ? "bg-slate-50 dark:bg-slate-800/40"
                                                                            : ""
                                                                    }`}
                                                                    style={{
                                                                        minWidth:
                                                                            "30px",
                                                                        width:
                                                                            "30px",
                                                                    }}
                                                                />
                                                            );
                                                        }

                                                        const config =
                                                            TYPE_CONFIG[
                                                                cell!.type
                                                            ];
                                                        if (!config) {
                                                            return (
                                                                <td
                                                                    key={d.day}
                                                                    className="border border-slate-200 dark:border-slate-700/60 px-0 py-1 text-center"
                                                                    style={{
                                                                        minWidth:
                                                                            "30px",
                                                                        width:
                                                                            "30px",
                                                                    }}
                                                                />
                                                            );
                                                        }

                                                        return (
                                                            <td
                                                                key={d.day}
                                                                className="border border-slate-200 dark:border-slate-700/60 p-0 text-center"
                                                                style={{
                                                                    minWidth:
                                                                        "30px",
                                                                    width:
                                                                        "30px",
                                                                }}
                                                                title={`${
                                                                    cell!.type
                                                                }${
                                                                    cell!
                                                                            .details
                                                                        ? ": " +
                                                                            cell!
                                                                                .details
                                                                        : ""
                                                                }`}
                                                            >
                                                                <div
                                                                    className="flex items-center justify-center w-full h-full font-black text-[10px] py-1 leading-none"
                                                                    style={{
                                                                        backgroundColor:
                                                                            config
                                                                                .color,
                                                                        color:
                                                                            config
                                                                                .textColor,
                                                                    }}
                                                                >
                                                                    {config
                                                                        .abbrev}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                            {filteredMembers.length === 0 && (
                                                <tr>
                                                    <td
                                                        colSpan={daysInMonth +
                                                            1}
                                                        className="text-center py-6 text-slate-400 text-sm italic"
                                                    >
                                                        Nenhum membro encontrado
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* --- LEGEND SIDEBAR --- */}
                <div className="w-full lg:w-56 shrink-0 order-1 lg:order-2 p-4 border-b lg:border-b-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="lg:sticky lg:top-4">
                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-3">
                            Legenda / Filtros
                        </h3>
                        <div className="flex flex-wrap lg:flex-col gap-1.5">
                            {LEGEND_ITEMS.map((item) => {
                                const isActive = activeFilters.has(item.key);
                                return (
                                    <button
                                        key={item.key}
                                        onClick={() => toggleFilter(item.key)}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-left border ${
                                            isActive
                                                ? "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm"
                                                : "opacity-30 border-transparent hover:opacity-50"
                                        }`}
                                    >
                                        <span
                                            className="inline-flex items-center justify-center w-7 h-5 rounded font-black text-[9px] shrink-0 shadow-sm"
                                            style={{
                                                backgroundColor: item.color,
                                                color: item.textColor,
                                            }}
                                        >
                                            {item.abbrev}
                                        </span>
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                            {item.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Quick actions */}
                        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                            <button
                                onClick={() =>
                                    setActiveFilters(
                                        new Set(LEGEND_ITEMS.map((l) => l.key)),
                                    )}
                                className="flex-1 text-[9px] font-black uppercase tracking-wider text-primary hover:bg-primary/10 rounded-lg py-1.5 transition-colors"
                            >
                                Mostrar Todos
                            </button>
                            <button
                                onClick={() => setActiveFilters(new Set())}
                                className="flex-1 text-[9px] font-black uppercase tracking-wider text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg py-1.5 transition-colors"
                            >
                                Ocultar Todos
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== MEMBER PROFILE MODAL ===== */}
            {selectedMember && (
                <MemberProfileModal
                    member={selectedMember}
                    onClose={() => setSelectedMember(null)}
                />
            )}

            {/* ===== CUSTOM SCROLLBAR STYLES ===== */}
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                .annual-scrollbar::-webkit-scrollbar {
                    height: 6px;
                }
                .annual-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .annual-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
                .dark .annual-scrollbar::-webkit-scrollbar-thumb {
                    background: #334155;
                }
                .annual-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `,
                }}
            />
        </div>
    );
};

export default AnnualUnavailability;
