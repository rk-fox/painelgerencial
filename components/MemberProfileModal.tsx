import React from "react";
import { Member } from "../types";
import { formatLocalDate } from "../utils/dateUtils";

interface MemberProfileModalProps {
    member: Member;
    onClose: () => void;
}

const MemberProfileModal: React.FC<MemberProfileModalProps> = ({
    member,
    onClose,
}) => {
    const calculateSectionTime = (entryDate?: string) => {
        if (!entryDate) return "—";
        const today = new Date();
        const entry = new Date(entryDate);
        if (isNaN(entry.getTime())) return "—";

        let years = today.getFullYear() - entry.getFullYear();
        let months = today.getMonth() - entry.getMonth();
        let days = today.getDate() - entry.getDate();

        if (days < 0) {
            months--;
            const prevMonth = new Date(
                today.getFullYear(),
                today.getMonth(),
                0,
            );
            days += prevMonth.getDate();
        }
        if (months < 0) {
            years--;
            months += 12;
        }

        const parts: string[] = [];
        if (years > 0) parts.push(`${years} Ano${years > 1 ? "s" : ""}`);
        if (months > 0) parts.push(`${months} ${months > 1 ? "meses" : "mês"}`);
        parts.push(`${days} dia${days !== 1 ? "s" : ""}`);

        return parts.join(", ");
    };

    const formatDate = (dateStr?: string) => {
        return formatLocalDate(dateStr);
    };

    const courses = member.courses || [];

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#e7edf3] dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with close button */}
                <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 p-8 flex flex-col items-center">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all"
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            close
                        </span>
                    </button>

                    {/* Avatar - rounded rectangle */}
                    {member.avatar
                        ? (
                            <img
                                src={member.avatar}
                                alt={member.war_name || member.name}
                                className="w-28 h-36 rounded-xl object-cover border-4 border-white dark:border-slate-800 shadow-lg"
                            />
                        )
                        : (
                            <div className="w-28 h-36 rounded-xl bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-[48px] text-slate-300">
                                    person
                                </span>
                            </div>
                        )}

                    {/* Name and basic info */}
                    <h3 className="text-xl font-black text-slate-800 dark:text-white mt-4 text-center">
                        {member.rank === "Civil"
                            ? "Funcionário Civil"
                            : "Militar"}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            {member.rank}
                        </span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {member.war_name || member.name}
                        </span>
                        {member.rank !== "Civil" && member.specialty && (
                            <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    member.specialty === "BCT"
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                        : member.specialty === "CTA"
                                        ? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                }`}
                            >
                                <img
                                    src={(member.specialty === "BCT" ||
                                            member.specialty === "CTA")
                                        ? "https://raw.githubusercontent.com/rk-fox/painelgerencial/refs/heads/main/bct-icon-transp.png"
                                        : "https://raw.githubusercontent.com/rk-fox/painelgerencial/refs/heads/main/ais-icon-transp.png"}
                                    alt={member.specialty}
                                    className="size-4 object-contain"
                                />
                                {member.specialty}
                            </span>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* CAPACIDADE Section */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 text-center">
                            {member.sector === "CP"
                                ? "Capacidade"
                                : member.sector === "EA"
                                ? "Espaço Aéreo"
                                : member.sector || "—"}
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Entrada na Seção
                                </p>
                                <p className="text-sm font-bold text-primary">
                                    {formatDate(member.entry_date)}
                                </p>
                            </div>
                            {member.rank !== "Civil" && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        Última Promoção
                                    </p>
                                    <p className="text-sm font-bold text-primary">
                                        {formatDate(member.last_promotion_date)}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center mt-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Tempo de Seção
                            </p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                {member.entry_date
                                    ? calculateSectionTime(member.entry_date)
                                    : "—"}
                            </p>
                        </div>
                    </div>

                    {/* CURSOS Section */}
                    {courses.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 text-center">
                                Cursos
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                {courses.map((course: string) => (
                                    <div
                                        key={course}
                                        className="flex items-center justify-center h-10 border-2 border-primary/30 bg-primary/5 rounded-lg text-primary text-xs font-bold text-center px-2"
                                    >
                                        {course === "ATM043" &&
                                            "ATM043 - Planejador de EA"}
                                        {course === "ATM044" &&
                                            "ATM044 - Capacidade de Setor"}
                                        {course === "ATM045" &&
                                            "ATM045 - Capacidade de Pista"}
                                        {course === "ATM047" &&
                                            "ATM047 - Indicadores"}
                                        {course === "ATM049" &&
                                            "ATM049 - Análise Técnica de EA"}
                                        {course === "AGA001" &&
                                            "AGA001 - Introdução à Atividade AGA"}
                                        {course === "AGA004" &&
                                            "AGA004 - Análise Téc. Processos AGA"}
                                        {![
                                            "ATM043",
                                            "ATM044",
                                            "ATM045",
                                            "ATM047",
                                            "ATM049",
                                            "AGA001",
                                            "AGA004",
                                        ].includes(course) && course}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MemberProfileModal;
