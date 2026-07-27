// App.jsx
import React, { useState } from "react";
import {
  Trophy,
  BookOpen,
  Crown,
  Check,
  X,
  Heart,
  CheckCircle2,
  Edit3,
} from "lucide-react";

// Importando metadados e as 125 lições do arquivo separado
import { MODULES_META, LESSON_TITLES, LESSONS } from "./lessonsData";

/* Configuração de Temas e Cores */
const T = {
  bg: "#0A0E17",
  surface: "#121824",
  surfaceAlt: "#1E2638",
  border: "#2A3447",
  gold: "#F59E0B",
  goldShadow: "#B45309",
  call: "#10B981",
  put: "#EF4444",
  textMuted: "#64748B",
};

function getTheme(isDarkMode) {
  if (isDarkMode) {
    return {
      bg: T.bg,
      surface: T.surface,
      surfaceAlt: T.surfaceAlt,
      border: T.border,
      text: "#FFFFFF",
      muted: T.textMuted,
    };
  }
  return {
    bg: "#F8FAFC",
    surface: "#FFFFFF",
    surfaceAlt: "#F1F5F9",
    border: "#E2E8F0",
    text: "#0F172A",
    muted: "#64748B",
  };
}

/* Componente de Mascote Visando Performance */
function PipMascot({ className = "w-16 h-16", mood = "neutral" }) {
  const eyeColor = mood === "gold" ? "#F59E0B" : "#10B981";
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="45" fill="#1E2638" stroke={eyeColor} strokeWidth="4" />
      <circle cx="35" cy="40" r="6" fill={eyeColor} />
      <circle cx="65" cy="40" r="6" fill={eyeColor} />
      <path d="M 35 65 Q 50 80 65 65" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function StatCard({ label, value, c }) {
  return (
    <div className="p-3 rounded-xl border flex flex-col items-center justify-center text-center" style={{ backgroundColor: c.surface, borderColor: c.border }}>
      <span className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: c.muted }}>{label}</span>
      <span className="text-base font-black" style={{ color: c.text }}>{value}</span>
    </div>
  );
}

function Pressable({ children, bg, shadow, className = "", onClick, disabled }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`transition-all active:translate-y-1 ${className}`}
      style={{
        backgroundColor: bg,
        boxShadow: shadow ? `0 4px 0 ${shadow}` : "none",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

/* ============================== PERFIL ============================== */
function ProfileScreen({ stats, completed, displayName, onUpdateName, saveStatus, isDarkMode }) {
  const c = getTheme(isDarkMode);
  const [isEditing, setIsEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName);

  const totalLessons = 125;
  const completedCount = Object.keys(completed).length;
  const level = Math.floor(stats.xp / 100) + 1;
  const xpIntoLevel = stats.xp % 100;
  const accuracy = stats.totalAnswered > 0 ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0;

  function saveEditing() {
    onUpdateName(nameDraft);
    setIsEditing(false);
  }

  function cancelEditing() {
    setNameDraft(displayName);
    setIsEditing(false);
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-md mx-auto" style={{ backgroundColor: c.bg, fontFamily: "Inter, sans-serif" }}>
      <div className="rounded-2xl p-5 border text-center relative mb-6" style={{ backgroundColor: c.surface, borderColor: c.border }}>
        <div className="flex justify-center mb-2">
          <div className="p-2 rounded-full border-2" style={{ borderColor: T.gold, backgroundColor: T.surfaceAlt }}>
            <PipMascot mood={accuracy >= 70 ? "gold" : "neutral"} className="w-20 h-20" />
          </div>
        </div>

        {isEditing ? (
          <div className="flex items-center justify-center gap-2 mt-2">
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="px-3 py-1 rounded-lg border text-sm font-bold text-center focus:outline-none"
              style={{ backgroundColor: c.surfaceAlt, borderColor: T.gold, color: c.text }}
              maxLength={20}
              autoFocus
            />
            <button onClick={saveEditing} className="p-1.5 rounded-lg text-white" style={{ backgroundColor: T.call }}>
              <Check size={16} />
            </button>
            <button onClick={cancelEditing} className="p-1.5 rounded-lg text-white" style={{ backgroundColor: T.put }}>
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 mt-2">
            <h2 className="text-xl font-black" style={{ fontFamily: "Sora, sans-serif", color: c.text }}>
              {displayName}
            </h2>
            <button onClick={() => setIsEditing(true)} className="p-1 rounded-md opacity-60 hover:opacity-100" style={{ color: c.muted }}>
              <Edit3 size={16} />
            </button>
          </div>
        )}

        <p className="text-xs font-semibold mt-1" style={{ color: T.gold }}>
          Trader Nível {level}
        </p>

        <div className="mt-4">
          <div className="flex justify-between text-[11px] font-bold mb-1" style={{ color: c.muted }}>
            <span>Nível {level}</span>
            <span>{xpIntoLevel} / 100 XP</span>
          </div>
          <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: c.surfaceAlt }}>
            <div className="h-full transition-all duration-300" style={{ width: `${xpIntoLevel}%`, backgroundColor: T.gold }} />
          </div>
        </div>
      </div>

      <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: c.muted, fontFamily: "Sora, sans-serif" }}>
        Estatísticas
      </h3>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard c={c} label="Ofensiva Diária" value={`${stats.streak} dias`} />
        <StatCard c={c} label="Precisão Geral" value={`${accuracy}%`} />
        <StatCard c={c} label="Total de XP" value={`${stats.xp} XP`} />
        <StatCard c={c} label="Gemas" value={stats.gems} />
        <StatCard c={c} label="Vidas" value={`${stats.hearts}/5`} />
        <StatCard c={c} label="Lições Concluídas" value={`${completedCount}/${totalLessons}`} />
      </div>

      <div className="rounded-xl p-4 border flex items-center justify-between" style={{ backgroundColor: c.surface, borderColor: c.border }}>
        <div className="flex items-center gap-3">
          <CheckCircle2 color={saveStatus === "saved" ? T.call : T.gold} size={20} />
          <div>
            <p className="text-xs font-bold" style={{ color: c.text }}>Sincronização em Nuvem</p>
            <p className="text-[11px]" style={{ color: c.muted }}>
              {saveStatus === "saved" ? "Seus dados estão seguros na nuvem" : "Sincronizando..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== HOME / TRILHA ============================== */
function HomeScreen({ completed, examPassed, onOpenLesson, onOpenExam }) {
  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-md mx-auto" style={{ backgroundColor: T.bg, fontFamily: "Inter, sans-serif" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: "Sora, sans-serif" }}>
            Trilha <span style={{ color: T.gold }}>Master</span>
          </h1>
          <p className="text-xs text-slate-400">125 Lições rumo à consistência</p>
        </div>
      </div>

      <div className="space-y-6">
        {MODULES_META.map((mod) => (
          <div key={mod.id} className="p-4 rounded-2xl border" style={{ backgroundColor: T.surface, borderColor: T.border }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: mod.color }}>
                  Módulo {mod.id}
                </span>
                <h3 className="text-base font-bold text-white">{mod.title}</h3>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${mod.color}20`, color: mod.color }}>
                25 Lições
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2 mt-4">
              {Array.from({ length: 25 }).map((_, idx) => {
                const key = `${mod.id}-${idx}`;
                const isDone = !!completed[key];
                return (
                  <button
                    key={idx}
                    onClick={() => onOpenLesson(mod.id, idx)}
                    className="h-10 rounded-xl flex items-center justify-center font-bold text-xs transition-transform active:scale-95"
                    style={{
                      backgroundColor: isDone ? mod.color : T.surfaceAlt,
                      color: isDone ? "#0F172A" : "#FFFFFF",
                      border: `1px solid ${isDone ? mod.color : T.border}`,
                    }}
                  >
                    {isDone ? <Check size={16} /> : idx + 1}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onOpenExam(mod.id)}
              className="w-full mt-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-transform active:scale-95"
              style={{
                backgroundColor: examPassed[mod.id] ? `${T.gold}20` : T.surfaceAlt,
                borderColor: examPassed[mod.id] ? T.gold : T.border,
                color: examPassed[mod.id] ? T.gold : "#FFFFFF",
              }}
            >
              <Trophy size={14} />
              {examPassed[mod.id] ? "Prova do Módulo Concluída!" : `Fazer Prova Final do Módulo ${mod.id}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== PRINCIPAL ============================== */
export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [completed, setCompleted] = useState({});
  const [examPassed] = useState({});
  const [stats, setStats] = useState({ streak: 1, gems: 20, hearts: 5, xp: 0, totalCorrect: 0, totalAnswered: 0 });
  const [displayName, setDisplayName] = useState("Trader Camaleão");
  const [activeLesson, setActiveLesson] = useState(null);

  function handleFinishLesson(modId, lessonIdx) {
    const key = `${modId}-${lessonIdx}`;
    setCompleted((prev) => ({ ...prev, [key]: true }));
    setStats((prev) => ({ ...prev, xp: prev.xp + 20, gems: prev.gems + 5 }));
    setActiveLesson(null);
  }

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: T.bg }}>
      {activeTab === "home" && (
        <HomeScreen
          completed={completed}
          examPassed={examPassed}
          onOpenLesson={(modId, lessonIdx) => setActiveLesson({ modId, lessonIdx })}
          onOpenExam={() => {}}
        />
      )}

      {activeTab === "profile" && (
        <ProfileScreen
          completed={completed}
          displayName={displayName}
          isDarkMode={true}
          onUpdateName={setDisplayName}
          saveStatus="saved"
          stats={stats}
        />
      )}

      {/* Modal da Lição */}
      {activeLesson && (
        <div className="fixed inset-0 z-50 flex flex-col justify-between p-4 max-w-md mx-auto" style={{ backgroundColor: T.bg, fontFamily: "Inter, sans-serif" }}>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setActiveLesson(null)} className="p-1 rounded-lg text-slate-400">
              <X size={24} />
            </button>
            <span className="text-xs font-bold text-white uppercase">
              {LESSON_TITLES[`${activeLesson.modId}-${activeLesson.lessonIdx}`]}
            </span>
            <div className="flex items-center gap-1 text-pink-500 font-bold text-xs">
              <Heart size={16} fill="#EC4899" /> {stats.hearts}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-4 text-white">
            <h3 className="text-xl font-black mb-2" style={{ fontFamily: "Sora, sans-serif" }}>
              {LESSONS[`${activeLesson.modId}-${activeLesson.lessonIdx}`]?.steps[0].title}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              {LESSONS[`${activeLesson.modId}-${activeLesson.lessonIdx}`]?.steps[0].body}
            </p>
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900 text-xs text-slate-300">
              💡 {LESSONS[`${activeLesson.modId}-${activeLesson.lessonIdx}`]?.steps[0].pipTip}
            </div>
          </div>

          <Pressable
            bg={T.gold}
            className="w-full py-3.5 rounded-xl font-black text-center text-slate-950 uppercase tracking-wide text-sm"
            onClick={() => handleFinishLesson(activeLesson.modId, activeLesson.lessonIdx)}
            shadow={T.goldShadow}
          >
            Concluir Lição
          </Pressable>
        </div>
      )}

      {/* Menu Inferior */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t py-3 px-6 max-w-md mx-auto flex items-center justify-around" style={{ backgroundColor: T.surface, borderColor: T.border }}>
        <button onClick={() => setActiveTab("home")} className={`flex flex-col items-center gap-1 ${activeTab === "home" ? "text-amber-500" : "text-slate-400"}`}>
          <BookOpen size={20} />
          <span className="text-[10px] font-bold">Trilha</span>
        </button>
        <button onClick={() => setActiveTab("profile")} className={`flex flex-col items-center gap-1 ${activeTab === "profile" ? "text-amber-500" : "text-slate-400"}`}>
          <Crown size={20} />
          <span className="text-[10px] font-bold">Perfil</span>
        </button>
      </div>
    </div>
  );
}
