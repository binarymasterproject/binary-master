import React, { useState, useEffect } from "react";
import {
  Heart, Gem, Flame, Lock, Check, X,
  TrendingUp, TrendingDown, Trophy, BookOpen, BarChart3,
  Sparkles, Award, Play, LayoutGrid, Brain, Crown, Settings as SettingsIcon,
  Sun, Moon, LogOut, MoreHorizontal, User, CheckCircle2, Edit3, RotateCcw
} from "lucide-react";

/* ============================== DESIGN TOKENS ============================== */
const T = {
  bg: "#0F172A",
  bgDeep: "#0A1120",
  surface: "#172136",
  surfaceRaised: "#1C2A45",
  shadowDeep: "#060A14",
  border: "#25314C",
  textPrimary: "#F1F5F9",
  textMuted: "#8FA0BD",
  gold: "#F2B705",
  goldShadow: "#B58600",
  flame: "#FF9500",
  heart: "#FF4757",
  call: "#16C784",
  callShadow: "#0E8F5E",
  put: "#EA3943",
  putShadow: "#AE2028",
};

// A trilha, as lições e os gráficos permanecem sempre no Dark Mode (identidade fixa da marca).
// Só as telas de conta (Perfil, Conquistas, Progresso, Plus, Ajustes) respeitam o alternador claro/escuro.
function getTheme(dark) {
  return dark
    ? { bg: T.bg, surface: T.surface, surfaceAlt: T.bgDeep, border: T.border, text: T.textPrimary, muted: T.textMuted }
    : { bg: "#F1F5F9", surface: "#FFFFFF", surfaceAlt: "#E2E8F0", border: "#E2E8F0", text: "#0F172A", muted: "#64748B" };
}

// Backup manual de progresso: codifica/decodifica em base64 puro (sem depender de
// nenhuma API de armazenamento do ambiente) para que o usuário possa copiar/colar
// o progresso manualmente caso o salvamento automático não funcione.
/* ============================== SUPABASE (auth + progresso) ============================== */
const SUPABASE_URL = "https://nbymgwvuizgqvcywoeta.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Qsbu00vao59cdyV8GMwLhQ_ZB4gG851";

async function supabaseSignUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.error_description || data.error || "Falha ao criar conta.");
  return data;
}

async function supabaseSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || "E-mail ou senha incorretos.");
  return data;
}

async function supabaseRefreshToken(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Sessão expirada.");
  return data;
}

// Faz a requisição autenticada e, se o token expirou (401), atualiza com o refresh_token
// e tenta de novo uma única vez — evita pedir login de novo por causa de um token vencido.
async function supabaseAuthedFetch(url, options, session, onRefresh) {
  let res = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${session.access_token}` } });
  if (res.status === 401 && session.refresh_token) {
    const refreshed = await supabaseRefreshToken(session.refresh_token);
    onRefresh(refreshed);
    res = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${refreshed.access_token}` } });
  }
  return res;
}

async function fetchProgress(session, onRefresh) {
  const res = await supabaseAuthedFetch(
    `${SUPABASE_URL}/rest/v1/user_progress?user_id=eq.${session.user.id}&select=*`,
    { headers: { apikey: SUPABASE_ANON_KEY } },
    session,
    onRefresh
  );
  if (!res.ok) throw new Error("Falha ao carregar progresso.");
  const rows = await res.json();
  return rows[0] || null;
}

async function saveProgressToSupabase(session, payload, onRefresh) {
  const res = await supabaseAuthedFetch(
    `${SUPABASE_URL}/rest/v1/user_progress`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: session.user.id, ...payload }),
    },
    session,
    onRefresh
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Falha ao salvar progresso.");
  }
}

function encodeProgress(data) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  } catch (err) {
    return null;
  }
}
function decodeProgress(code) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  } catch (err) {
    return null;
  }
}

const MODULES_META = [
  { id: 1, title: "Fundamentos", subtitle: "A base de tudo", color: "#3B82F6", shadow: "#1D4ED8", icon: BookOpen },
  { id: 2, title: "Análise Gráfica I", subtitle: "Suporte, Resistência & Tendência", color: "#8B5CF6", shadow: "#5B21B6", icon: TrendingUp },
  { id: 3, title: "Candlestick", subtitle: "Padrões de velas japonesas", color: "#EC4899", shadow: "#9D174D", icon: BarChart3 },
  { id: 4, title: "Indicadores", subtitle: "RSI, Bollinger & Médias", color: "#06B6D4", shadow: "#0E7490", icon: Sparkles },
  { id: 5, title: "Gestão & Mente", subtitle: "Banca, Soros & Psicologia", color: "#F2B705", shadow: "#B58600", icon: Award },
];

const LESSON_TITLES_BY_MODULE = {
  1: ["O que são Opções Binárias?", "Payout e Corretoras", "Linha vs Vela", "Revisão do Módulo", "Prática: Cenários Reais"],
  2: ["Suporte e Resistência", "LTA e LTB", "Canais de Alta e Baixa", "Revisão do Módulo", "Prática: Leitura de Zonas"],
  3: ["Martelo e Enforcado", "Padrão de Engolfo", "Doji", "Pinbar & Revisão", "Prática: Reconhecimento de Padrões"],
  4: ["Índice de Força (RSI)", "Bandas de Bollinger", "Médias Móveis", "Revisão do Módulo", "Prática: Sinais Combinados"],
  5: ["Gerenciamento de Banca", "Estratégia Soros", "Martingale: risco real", "Psicologia do Trader", "Prática: Decisões sob Pressão"],
};

/* ============================== CANDLE DATASETS ============================== */
const RESISTANCE_CANDLES = [
  { o: 40, c: 55, h: 60, l: 38 }, { o: 55, c: 70, h: 75, l: 52 },
  { o: 70, c: 85, h: 90, l: 68 }, { o: 85, c: 96, h: 101, l: 83 },
  { o: 96, c: 88, h: 118, l: 86 },
];
const SUPPORT_CANDLES = [
  { o: 120, c: 105, h: 122, l: 103 }, { o: 105, c: 90, h: 107, l: 88 },
  { o: 90, c: 78, h: 92, l: 76 }, { o: 78, c: 65, h: 80, l: 63 },
  { o: 65, c: 72, h: 66, l: 40 },
];
const RANGE_CANDLES = [
  { o: 50, c: 65, h: 80, l: 48 }, { o: 65, c: 55, h: 68, l: 52 },
  { o: 55, c: 70, h: 81, l: 53 }, { o: 70, c: 60, h: 72, l: 58 },
  { o: 60, c: 75, h: 79, l: 59 },
];
const BREAKOUT_UP_CANDLES = [
  { o: 60, c: 72, h: 75, l: 58 }, { o: 72, c: 68, h: 80, l: 65 },
  { o: 68, c: 75, h: 82, l: 66 }, { o: 75, c: 78, h: 83, l: 73 },
  { o: 78, c: 98, h: 100, l: 76 },
];
const BREAKDOWN_CANDLES = [
  { o: 100, c: 88, h: 102, l: 85 }, { o: 88, c: 92, h: 94, l: 80 },
  { o: 92, c: 85, h: 93, l: 78 }, { o: 85, c: 82, h: 87, l: 77 },
  { o: 82, c: 60, h: 83, l: 58 },
];
const LTA_CANDLES = [
  { o: 40, c: 55, h: 58, l: 38 }, { o: 55, c: 48, h: 57, l: 45 },
  { o: 48, c: 65, h: 68, l: 46 }, { o: 65, c: 58, h: 67, l: 55 },
  { o: 58, c: 75, h: 78, l: 56 },
];
const LTB_CANDLES = [
  { o: 100, c: 88, h: 103, l: 85 }, { o: 88, c: 95, h: 97, l: 83 },
  { o: 95, c: 80, h: 96, l: 76 }, { o: 80, c: 90, h: 92, l: 77 },
  { o: 90, c: 70, h: 91, l: 66 },
];
const CHANNEL_BOTTOM_CANDLES = [
  { o: 70, c: 82, h: 85, l: 68 }, { o: 82, c: 95, h: 98, l: 80 },
  { o: 95, c: 85, h: 97, l: 70 }, { o: 85, c: 72, h: 87, l: 65 },
  { o: 72, c: 88, h: 90, l: 70 },
];
const CHANNEL_TOP_CANDLES = [
  { o: 60, c: 75, h: 78, l: 58 }, { o: 75, c: 90, h: 93, l: 73 },
  { o: 90, c: 105, h: 112, l: 88 }, { o: 105, c: 95, h: 107, l: 93 },
  { o: 95, c: 80, h: 96, l: 78 },
];
const HAMMER_CANDLES = [
  { o: 100, c: 88, h: 102, l: 86 }, { o: 88, c: 76, h: 90, l: 74 },
  { o: 76, c: 65, h: 78, l: 63 }, { o: 65, c: 60, h: 67, l: 58 },
  { o: 60, c: 63, h: 64, l: 40 },
];
const ENFORCADO_CANDLES = [
  { o: 40, c: 55, h: 57, l: 38 }, { o: 55, c: 68, h: 70, l: 53 },
  { o: 68, c: 80, h: 82, l: 66 }, { o: 80, c: 90, h: 92, l: 78 },
  { o: 90, c: 87, h: 91, l: 65 },
];
const ENGULF_BULL_CANDLES = [
  { o: 100, c: 90, h: 101, l: 88 }, { o: 90, c: 80, h: 91, l: 78 },
  { o: 80, c: 72, h: 82, l: 70 }, { o: 72, c: 66, h: 74, l: 64 },
  { o: 64, c: 85, h: 87, l: 62 },
];
const ENGULF_BEAR_CANDLES = [
  { o: 40, c: 52, h: 54, l: 38 }, { o: 52, c: 64, h: 66, l: 50 },
  { o: 64, c: 76, h: 78, l: 62 }, { o: 76, c: 83, h: 85, l: 74 },
  { o: 85, c: 62, h: 87, l: 60 },
];
const DOJI_CANDLES = [
  { o: 40, c: 55, h: 57, l: 38 }, { o: 55, c: 68, h: 70, l: 53 },
  { o: 68, c: 80, h: 82, l: 66 }, { o: 80, c: 81, h: 92, l: 70 },
  { o: 80, c: 66, h: 82, l: 64 },
];
const PINBAR_SUPPORT_CANDLES = [
  { o: 100, c: 88, h: 102, l: 86 }, { o: 88, c: 78, h: 90, l: 76 },
  { o: 78, c: 70, h: 80, l: 68 }, { o: 70, c: 68, h: 72, l: 66 },
  { o: 68, c: 71, h: 73, l: 45 },
];
const PINBAR_RESISTANCE_CANDLES = [
  { o: 40, c: 52, h: 54, l: 38 }, { o: 52, c: 64, h: 66, l: 50 },
  { o: 64, c: 76, h: 78, l: 62 }, { o: 76, c: 80, h: 82, l: 74 },
  { o: 80, c: 77, h: 105, l: 75 },
];
const RSI_OVERBOUGHT_CANDLES = [
  { o: 50, c: 62, h: 64, l: 48 }, { o: 62, c: 74, h: 76, l: 60 },
  { o: 74, c: 86, h: 88, l: 72 }, { o: 86, c: 96, h: 99, l: 84 },
  { o: 96, c: 104, h: 107, l: 94 },
];
const RSI_OVERSOLD_CANDLES = [
  { o: 104, c: 92, h: 106, l: 90 }, { o: 92, c: 80, h: 94, l: 78 },
  { o: 80, c: 68, h: 82, l: 66 }, { o: 68, c: 58, h: 70, l: 55 },
  { o: 58, c: 50, h: 60, l: 46 },
];
const BOLLINGER_UPPER_CANDLES = [
  { o: 60, c: 70, h: 72, l: 58 }, { o: 70, c: 80, h: 82, l: 68 },
  { o: 80, c: 92, h: 94, l: 78 }, { o: 92, c: 100, h: 103, l: 90 },
  { o: 100, c: 96, h: 112, l: 94 },
];
const BOLLINGER_LOWER_CANDLES = [
  { o: 100, c: 90, h: 102, l: 88 }, { o: 90, c: 80, h: 92, l: 78 },
  { o: 80, c: 68, h: 82, l: 66 }, { o: 68, c: 60, h: 70, l: 58 },
  { o: 60, c: 64, h: 66, l: 44 },
];
const MA_CROSS_UP_CANDLES = [
  { o: 80, c: 74, h: 82, l: 72 }, { o: 74, c: 70, h: 76, l: 66 },
  { o: 70, c: 73, h: 75, l: 68 }, { o: 73, c: 82, h: 85, l: 71 },
  { o: 82, c: 92, h: 94, l: 80 },
];
const MA_CROSS_DOWN_CANDLES = [
  { o: 60, c: 68, h: 70, l: 58 }, { o: 68, c: 74, h: 76, l: 66 },
  { o: 74, c: 70, h: 76, l: 68 }, { o: 70, c: 60, h: 72, l: 58 },
  { o: 60, c: 50, h: 62, l: 48 },
];

/* ============================== PIP - O MASCOTE CAMALEÃO ============================== */
function PipMascot({ mood = "neutral", className = "w-20 h-20" }) {
  let mainColor = "#06B6D4"; // Neutro (Ciano/Petróleo)
  let eyeColor = "#F2B705";  // Ouro
  let expression = "neutral";

  if (mood === "correct") {
    mainColor = "#16C784";    // Verde CALL
    expression = "happy";
  } else if (mood === "wrong") {
    mainColor = "#EA3943";    // Vermelho PUT
    expression = "sad";
  } else if (mood === "gold" || mood === "trophy") {
    mainColor = "#F2B705";    // Ouro
    expression = "excited";
  } else if (mood === "tired") {
    mainColor = "#64748B";    // Cinza/Cansado
    expression = "tired";
  }

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-md">
        <path d="M 25 75 C 10 75 10 95 25 95 C 35 95 35 85 28 85" fill="none" stroke={mainColor} strokeWidth="8" strokeLinecap="round" />
        <ellipse cx="60" cy="65" rx="32" ry="26" fill={mainColor} />
        <rect x="45" y="32" width="5" height="12" fill="#F2B705" rx="1" />
        <rect x="58" y="28" width="5" height="14" fill="#F2B705" rx="1" />
        <rect x="71" y="34" width="5" height="10" fill="#F2B705" rx="1" />
        <path d="M 65 45 C 65 35 80 32 95 42 C 102 48 102 68 90 72 C 75 75 65 65 65 45 Z" fill={mainColor} />
        <path d="M 62 48 C 60 30 90 25 96 42" fill="none" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
        <rect x="58" y="44" width="7" height="14" fill="#1E293B" rx="2" />
        <rect x="94" y="42" width="7" height="14" fill="#1E293B" rx="2" />
        <circle cx="82" cy="50" r="12" fill="#FFFFFF" />
        <circle cx="82" cy="50" r="9" fill={eyeColor} />
        {expression === "sad" ? (
          <path d="M 78 54 L 86 46" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
        ) : expression === "happy" || expression === "excited" ? (
          <circle cx="83" cy="49" r="4" fill="#0F172A" />
        ) : (
          <rect x="80" y="45" width="4" height="9" fill="#0F172A" rx="1" />
        )}
        {expression === "happy" && <path d="M 85 64 Q 92 68 96 61" fill="none" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />}
        {expression === "excited" && <path d="M 83 62 Q 91 72 97 62 Z" fill="#0F172A" />}
        {expression === "sad" && <path d="M 86 64 Q 91 59 96 64" fill="none" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />}
        {expression === "neutral" && <line x1="86" y1="63" x2="95" y2="63" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />}
        {expression === "tired" && <path d="M 82 43 L 90 46" stroke="#0F172A" strokeWidth="2" />}
        <circle cx="52" cy="88" r="5" fill={mainColor} />
        <circle cx="72" cy="88" r="5" fill={mainColor} />
      </svg>
    </div>
  );
}

const PIP_HOME_TIPS = [
  "Mantenha sua disciplina emocional. O mercado premia quem se adapta!",
  "Como um bom camaleão, eu não brigo com a tendência — eu me ajusto a ela.",
  "Gerenciamento de banca não é frescura, é sobrevivência a longo prazo.",
  "Toda entrada sem confirmação é só um palpite disfarçado de análise.",
  "Errar faz parte. O segredo é errar pequeno e acertar consistente.",
];

/* ============================== CANDLESTICK CHART ============================== */
function CandleChart({ candles, lines = [] }) {
  const candleW = 28;
  const gap = 16;
  const height = 220;
  const width = candles.length * (candleW + gap) + gap;

  const lineVals = lines.flatMap((l) => l.points.map((p) => p.value));
  const all = candles.flatMap((c) => [c.h, c.l]).concat(lineVals);
  const min = Math.min(...all) - 8;
  const max = Math.max(...all) + 8;
  const scaleY = (v) => height - ((v - min) / (max - min)) * height;

  return (
    <div className="w-full overflow-x-auto rounded-2xl p-3" style={{ backgroundColor: T.bgDeep, border: `1px solid ${T.border}` }}>
      <svg viewBox={`0 0 ${width} ${height + 30}`} width="100%" height={height + 30} style={{ display: "block", margin: "0 auto" }}>
        {lines.map((line, li) => {
          const [p1, p2] = line.points;
          const x1 = p1.xFrac * width, x2 = p2.xFrac * width;
          const y1 = scaleY(p1.value), y2 = scaleY(p2.value);
          return (
            <g key={li}>
              <line x1={x1} x2={x2} y1={y1} y2={y2} stroke={line.color} strokeWidth="2" strokeDasharray="6,5" opacity="0.9" />
              <text x={x1 + 2} y={y1 - 6} fill={line.color} fontSize="11" fontFamily="JetBrains Mono, monospace">{line.label}</text>
            </g>
          );
        })}

        {candles.map((c, i) => {
          const x = i * (candleW + gap) + gap;
          const up = c.c >= c.o;
          const color = up ? T.call : T.put;
          const bodyTop = scaleY(Math.max(c.o, c.c));
          const bodyBottom = scaleY(Math.min(c.o, c.c));
          const bodyH = Math.max(bodyBottom - bodyTop, 3);
          return (
            <g key={i}>
              <line x1={x + candleW / 2} x2={x + candleW / 2} y1={scaleY(c.h)} y2={scaleY(c.l)} stroke={color} strokeWidth="2" />
              <rect x={x} y={bodyTop} width={candleW} height={bodyH} fill={color} rx="2" />
            </g>
          );
        })}

        <line x1={0} x2={width} y1={height} y2={height} stroke={T.border} strokeWidth="1" />
      </svg>
    </div>
  );
}

function RSIMeter({ value }) {
  const width = 280, height = 46;
  const x = Math.min(Math.max(value, 0), 100) / 100 * width;
  const zoneColor = value >= 70 ? T.put : value <= 30 ? T.call : T.gold;
  return (
    <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: T.bgDeep, border: `1px solid ${T.border}` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: T.textMuted, fontFamily: "JetBrains Mono, monospace" }}>RSI (14)</span>
        <span className="text-sm font-black" style={{ color: zoneColor, fontFamily: "JetBrains Mono, monospace" }}>{value}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
        <rect x={0} y={16} width={width * 0.3} height={14} fill={T.call} opacity="0.25" rx="4" />
        <rect x={width * 0.3} y={16} width={width * 0.4} height={14} fill="#334155" opacity="0.5" rx="4" />
        <rect x={width * 0.7} y={16} width={width * 0.3} height={14} fill={T.put} opacity="0.25" rx="4" />
        <line x1={width * 0.3} x2={width * 0.3} y1={8} y2={38} stroke={T.call} strokeWidth="1" strokeDasharray="3,3" />
        <line x1={width * 0.7} x2={width * 0.7} y1={8} y2={38} stroke={T.put} strokeWidth="1" strokeDasharray="3,3" />
        <circle cx={x} cy={23} r="6" fill={zoneColor} stroke="#0F172A" strokeWidth="2" />
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[10px]" style={{ color: T.call }}>Sobrevendido &lt;30</span>
        <span className="text-[10px]" style={{ color: T.put }}>Sobrecomprado &gt;70</span>
      </div>
    </div>
  );
}

function MiniChartIcon({ variant }) {
  if (variant === "candle") {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-16">
        {[10, 28, 46, 64, 82].map((x, i) => {
          const up = i % 2 === 0;
          return (
            <g key={i}>
              <line x1={x + 5} x2={x + 5} y1={8 + i * 2} y2={52 - i} stroke={up ? T.call : T.put} strokeWidth="2" />
              <rect x={x} y={20 + i} width="10" height={16 - i} fill={up ? T.call : T.put} rx="1.5" />
            </g>
          );
        })}
      </svg>
    );
  }
  if (variant === "line") {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-16">
        <polyline points="5,45 25,30 45,38 65,15 85,20" fill="none" stroke={T.gold} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {[[5, 45], [25, 30], [45, 38], [65, 15], [85, 20]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill={T.gold} />
        ))}
      </svg>
    );
  }
  if (variant === "lta") {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-16">
        <line x1="4" y1="52" x2="92" y2="14" stroke={T.call} strokeWidth="2" strokeDasharray="5,4" />
        {[[14, 44], [34, 34], [54, 30], [74, 20]].map(([x, y], i) => (
          <g key={i}>
            <line x1={x + 3} y1={y - 8} x2={x + 3} y2={y + 6} stroke={T.call} strokeWidth="2" />
            <rect x={x} y={y - 3} width="6" height="8" fill={T.call} rx="1" />
          </g>
        ))}
      </svg>
    );
  }
  if (variant === "ltb") {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-16">
        <line x1="4" y1="10" x2="92" y2="48" stroke={T.put} strokeWidth="2" strokeDasharray="5,4" />
        {[[14, 18], [34, 26], [54, 32], [74, 40]].map(([x, y], i) => (
          <g key={i}>
            <line x1={x + 3} y1={y - 8} x2={x + 3} y2={y + 6} stroke={T.put} strokeWidth="2" />
            <rect x={x} y={y - 3} width="6" height="8" fill={T.put} rx="1" />
          </g>
        ))}
      </svg>
    );
  }
  const patternSpecs = {
    hammer: [
      { x: 8, bodyY: 8, bodyH: 10, wY1: 6, wY2: 20, color: "#64748B" },
      { x: 26, bodyY: 16, bodyH: 10, wY1: 14, wY2: 28, color: "#64748B" },
      { x: 44, bodyY: 24, bodyH: 8, wY1: 22, wY2: 34, color: "#64748B" },
      { x: 62, bodyY: 26, bodyH: 8, wY1: 20, wY2: 56, color: T.call },
    ],
    engulfBull: [
      { x: 8, bodyY: 10, bodyH: 8, wY1: 8, wY2: 20, color: "#64748B" },
      { x: 26, bodyY: 16, bodyH: 8, wY1: 14, wY2: 26, color: "#64748B" },
      { x: 44, bodyY: 24, bodyH: 6, wY1: 22, wY2: 32, color: T.put },
      { x: 62, bodyY: 14, bodyH: 26, wY1: 12, wY2: 42, color: T.call },
    ],
    engulfBear: [
      { x: 8, bodyY: 30, bodyH: 8, wY1: 28, wY2: 40, color: "#64748B" },
      { x: 26, bodyY: 22, bodyH: 8, wY1: 20, wY2: 32, color: "#64748B" },
      { x: 44, bodyY: 14, bodyH: 6, wY1: 12, wY2: 22, color: T.call },
      { x: 62, bodyY: 10, bodyH: 28, wY1: 8, wY2: 40, color: T.put },
    ],
    doji: [
      { x: 8, bodyY: 30, bodyH: 8, wY1: 28, wY2: 40, color: "#64748B" },
      { x: 26, bodyY: 22, bodyH: 8, wY1: 20, wY2: 32, color: "#64748B" },
      { x: 44, bodyY: 16, bodyH: 6, wY1: 14, wY2: 24, color: "#64748B" },
      { x: 62, bodyY: 20, bodyH: 2, wY1: 6, wY2: 38, color: T.gold },
    ],
    pinbarBull: [
      { x: 8, bodyY: 20, bodyH: 8, wY1: 18, wY2: 30, color: "#64748B" },
      { x: 26, bodyY: 18, bodyH: 8, wY1: 16, wY2: 28, color: "#64748B" },
      { x: 44, bodyY: 22, bodyH: 8, wY1: 20, wY2: 32, color: "#64748B" },
      { x: 62, bodyY: 16, bodyH: 8, wY1: 14, wY2: 52, color: T.call },
    ],
    pinbarBear: [
      { x: 8, bodyY: 20, bodyH: 8, wY1: 18, wY2: 30, color: "#64748B" },
      { x: 26, bodyY: 22, bodyH: 8, wY1: 20, wY2: 32, color: "#64748B" },
      { x: 44, bodyY: 18, bodyH: 8, wY1: 16, wY2: 28, color: "#64748B" },
      { x: 62, bodyY: 26, bodyH: 8, wY1: 4, wY2: 34, color: T.put },
    ],
  };

  if (patternSpecs[variant]) {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-16">
        {patternSpecs[variant].map((s, i) => (
          <g key={i}>
            <line x1={s.x + 4} x2={s.x + 4} y1={s.wY1} y2={s.wY2} stroke={s.color} strokeWidth="2" />
            <rect x={s.x} y={s.bodyY} width="9" height={Math.max(s.bodyH, 2)} fill={s.color} rx="1" />
          </g>
        ))}
      </svg>
    );
  }

  return null;
}

/* ============================== PRESSABLE 3D BUTTON ============================== */
function Pressable({ children, onClick, bg, shadow, disabled, className = "", style = {} }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      className={`transition-transform duration-75 select-none ${className}`}
      style={{
        backgroundColor: disabled ? "#334155" : bg,
        boxShadow: disabled ? "0 4px 0 0 #1E293B" : `0 ${pressed ? "1px" : "4px"} 0 0 ${shadow}`,
        transform: pressed && !disabled ? "translateY(3px)" : "translateY(0)",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ============================== LESSON CONTENT ============================== */
const LESSONS = {
  /* ---------- MÓDULO 1 ---------- */
  "1-0": {
    title: "O que são Opções Binárias?",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "O que são Opções Binárias?",
        body: "Opções Binárias são contratos onde você prevê se o preço de um ativo vai subir (CALL) ou cair (PUT) até um horário de expiração. Se você acertar a direção, recebe o Payout — um percentual do valor investido, definido pela corretora antes da entrada.",
        pipTip: "Adapte sua visão: no trading, o segredo é nunca lutar contra a tendência do mercado.",
      },
      {
        level: "Nível 1 · Introdução", type: "mcq",
        question: "O que é o 'Payout' em uma operação de Opções Binárias?",
        options: ["O valor mínimo para abrir conta na corretora", "O percentual de lucro pago quando o trader acerta a direção", "A taxa cobrada para sacar dinheiro", "O tempo de expiração da operação"],
        correct: 1,
        explain: "O Payout é o percentual de retorno que a corretora paga sobre o valor investido quando a previsão está correta.",
      },
      {
        level: "Nível 2 · Identificação Visual", type: "mcq-visual",
        question: "Qual dessas representações é um Gráfico de Candlestick (Velas)?",
        options: [{ variant: "line", label: "Gráfico de Linha" }, { variant: "candle", label: "Gráfico de Candlestick" }],
        correct: 1,
        explain: "O gráfico de velas mostra abertura, fechamento, máxima e mínima de cada período — muito mais rico em informação que a linha, que só liga os fechamentos.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "O preço subiu, tocou a resistência e deixou um pavio de rejeição longo, fechando abaixo da máxima. Qual a sua entrada?",
        chart: { candles: RESISTANCE_CANDLES, lines: [{ label: "Resistência", color: T.put, points: [{ xFrac: 0, value: 105 }, { xFrac: 1, value: 105 }] }] },
        correct: "PUT",
        explain: "O pavio longo na resistência mostra rejeição dos vendedores. Sinal clássico de reversão para baixo — entrada em PUT.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "O preço caiu, tocou o suporte e formou um martelo com pavio inferior longo, fechando próximo à máxima. Qual a sua entrada?",
        chart: { candles: SUPPORT_CANDLES, lines: [{ label: "Suporte", color: T.call, points: [{ xFrac: 0, value: 42 }, { xFrac: 1, value: 42 }] }] },
        correct: "CALL",
        explain: "O martelo no suporte mostra que os compradores retomaram o controle. Sinal de reversão para cima — entrada em CALL.",
      },
    ],
  },
  "1-1": {
    title: "Payout e Corretoras",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "Escolhendo sua Corretora",
        body: "A corretora é a plataforma onde você executa suas operações. O Payout não é fixo: ele varia por ativo, horário e volatilidade do mercado — geralmente entre 70% e 95%. Antes de operar dinheiro real, verifique se a corretora é regulamentada e se os saques são rápidos e sem burocracia.",
        pipTip: "Como um bom camaleão, escolha seu ambiente com cuidado — a corretora certa protege sua banca.",
      },
      {
        level: "Nível 1 · Introdução", type: "mcq",
        question: "Por que o Payout pode variar entre diferentes ativos e horários?",
        options: ["É um valor fixo definido por lei", "Depende da liquidez e volatilidade do ativo naquele momento", "Sempre aumenta durante a madrugada", "O Payout nunca muda"],
        correct: 1,
        explain: "Ativos mais líquidos e com maior volume de negociação tendem a oferecer payouts mais altos e estáveis.",
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "Qual desses é o critério MAIS importante ao escolher uma corretora?",
        options: ["Ter o aplicativo com cores bonitas", "Ser regulamentada e ter histórico confiável de saques", "Oferecer o maior número de ativos possível", "Ter propaganda em redes sociais"],
        correct: 1,
        explain: "Regulamentação e histórico de saques protegem seu capital — é o critério mais importante, acima de estética ou marketing.",
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "Se uma operação tem Payout de 87% e você investe R$100 e acerta, quanto recebe de lucro?",
        options: ["R$13", "R$87", "R$100", "R$187"],
        correct: 1,
        explain: "87% de R$100 = R$87 de lucro, além da devolução do valor investido.",
      },
    ],
  },
  "1-2": {
    title: "Linha vs Vela",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "Anatomia de uma Vela (Candlestick)",
        body: "Cada vela tem 4 informações: Abertura, Fechamento, Máxima e Mínima. O 'corpo' é o espaço entre abertura e fechamento. Os 'pavios' (sombras) mostram até onde o preço chegou antes de recuar. Vela verde = fechou acima da abertura (compradores no controle). Vela vermelha = fechou abaixo da abertura (vendedores no controle).",
        pipTip: "Preste atenção aos detalhes pequenos: um pavio pode contar mais da história que o corpo da vela.",
      },
      {
        level: "Nível 2 · Identificação Visual", type: "mcq-visual",
        question: "Qual gráfico permite ver a máxima e a mínima de cada período (não só o fechamento)?",
        options: [{ variant: "line", label: "Gráfico de Linha" }, { variant: "candle", label: "Gráfico de Candlestick" }],
        correct: 1,
        explain: "Somente o candlestick mostra abertura, fechamento, máxima e mínima — a linha mostra apenas os fechamentos conectados.",
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "O que representa um pavio (sombra) longo em uma vela?",
        options: ["Um erro no gráfico da corretora", "Que o preço foi rejeitado naquela região e recuou", "Que o mercado estava fechado", "Que o payout aumentou"],
        correct: 1,
        explain: "Um pavio longo mostra que o preço chegou até ali mas foi 'empurrado de volta' — é força de compradores ou vendedores.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "Sequência de velas verdes fortes, sem pavios de rejeição relevantes, com fechamentos sempre mais altos. O que essa força sugere para a próxima vela?",
        chart: { candles: [{ o: 40, c: 52, h: 53, l: 39 }, { o: 52, c: 64, h: 65, l: 51 }, { o: 64, c: 76, h: 77, l: 63 }, { o: 76, c: 88, h: 89, l: 75 }, { o: 88, c: 100, h: 101, l: 87 }], lines: [] },
        correct: "CALL",
        explain: "Velas de força contínua sem rejeição indicam predomínio comprador — a tendência de curtíssimo prazo favorece CALL.",
      },
    ],
  },
  "1-3": {
    title: "Revisão do Módulo",
    steps: [
      { level: "Revisão · Módulo 1", type: "info", title: "Vamos revisar!", body: "Antes de avançar para Análise Gráfica, vamos consolidar os conceitos de Opções Binárias, Payout, Corretoras e Candlestick que você aprendeu neste módulo.", pipTip: "Revisar é como trocar de cor: reforça o que você aprendeu antes de seguir em frente." },
      { level: "Revisão · Módulo 1", type: "mcq", question: "O que acontece se sua previsão de direção estiver ERRADA na expiração?", options: ["Você recebe metade do payout", "Você perde o valor investido na operação", "A corretora devolve o dinheiro", "A operação se prorroga automaticamente"], correct: 1, explain: "Se a direção prevista estiver errada, o valor investido naquela operação é perdido." },
      { level: "Revisão · Módulo 1", type: "mcq", question: "Vela vermelha significa que:", options: ["O fechamento foi maior que a abertura", "O fechamento foi menor que a abertura", "Não houve negociação", "O payout foi reduzido"], correct: 1, explain: "Vela vermelha (de baixa) fecha abaixo de onde abriu — vendedores dominaram o período." },
      { level: "Revisão · Módulo 1", type: "mcq", question: "Qual desses NÃO é um critério relevante para escolher corretora?", options: ["Regulamentação", "Histórico de saques", "Cor do aplicativo", "Suporte ao cliente"], correct: 2, explain: "Estética não impacta a segurança do seu capital — foque em regulamentação, saques e suporte." },
    ],
  },

  /* ---------- MÓDULO 2 ---------- */
  "2-0": {
    title: "Suporte e Resistência",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "Suporte e Resistência",
        body: "Resistência é uma região onde o preço historicamente tem dificuldade de subir além — há mais vendedores que compradores ali. Suporte é o oposto: uma região onde o preço tende a parar de cair, pois há mais compradores. Quanto mais vezes o preço testa e respeita uma região, mais forte ela é considerada.",
        pipTip: "Suporte e resistência são os limites do território — respeite-os antes de avançar.",
      },
      {
        level: "Nível 1 · Introdução", type: "chart-info",
        title: "Veja na prática",
        body: "Observe como o preço tocou a mesma região de resistência (linha pontilhada) duas vezes e foi rejeitado em ambas — isso reforça a força dessa zona.",
        chart: { candles: RANGE_CANDLES, lines: [{ label: "Resistência", color: T.put, points: [{ xFrac: 0, value: 80 }, { xFrac: 1, value: 80 }] }] },
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "O que torna uma zona de resistência mais 'forte'?",
        options: ["Ela ter sido testada e respeitada várias vezes", "O gráfico estar no modo escuro", "Ela existir há menos de 1 minuto", "O ativo ser uma criptomoeda"],
        correct: 0,
        explain: "Quanto mais toques e rejeições uma região acumula, mais relevante ela é para os traders — e mais forte tende a ser.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "O preço consolidou logo abaixo da resistência e rompeu com uma vela forte, fechando bem acima da linha. Qual a sua entrada?",
        chart: { candles: BREAKOUT_UP_CANDLES, lines: [{ label: "Resistência", color: T.put, points: [{ xFrac: 0, value: 82 }, { xFrac: 1, value: 82 }] }] },
        correct: "CALL",
        explain: "Esse é um rompimento (breakout) de resistência: vela forte fechando acima da zona sugere continuação para cima — entrada em CALL.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "O preço consolidou perto do suporte e rompeu para baixo com uma vela forte, fechando bem abaixo da linha. Qual a sua entrada?",
        chart: { candles: BREAKDOWN_CANDLES, lines: [{ label: "Suporte", color: T.call, points: [{ xFrac: 0, value: 78 }, { xFrac: 1, value: 78 }] }] },
        correct: "PUT",
        explain: "Rompimento de suporte com força vendedora sugere continuação de queda — entrada em PUT.",
      },
    ],
  },
  "2-1": {
    title: "LTA e LTB",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "Linhas de Tendência",
        body: "LTA (Linha de Tendência de Alta) conecta fundos ascendentes — cada mínima mais alta que a anterior — e funciona como um suporte dinâmico. LTB (Linha de Tendência de Baixa) conecta topos descendentes — cada máxima mais baixa que a anterior — e funciona como uma resistência dinâmica.",
        pipTip: "Eu sigo a linha, não brigo com ela. Uma LTA ou LTB bem traçada evita entradas no escuro.",
      },
      {
        level: "Nível 2 · Identificação Visual", type: "mcq-visual",
        question: "Qual das opções representa uma LTA (Linha de Tendência de Alta)?",
        options: [{ variant: "lta", label: "LTA — fundos ascendentes" }, { variant: "ltb", label: "LTB — topos descendentes" }],
        correct: 0,
        explain: "A LTA é traçada conectando fundos cada vez mais altos, formando uma linha ascendente que sustenta o preço.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "O preço forma fundos cada vez mais altos e toca a LTA novamente, com uma vela de rejeição para cima. Qual a sua entrada?",
        chart: { candles: LTA_CANDLES, lines: [{ label: "LTA", color: T.call, points: [{ xFrac: 0.02, value: 36 }, { xFrac: 0.98, value: 60 }] }] },
        correct: "CALL",
        explain: "O toque respeitado na LTA, com rejeição para cima, reforça a tendência de alta — entrada em CALL.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "O preço forma topos cada vez mais baixos e toca a LTB novamente, com uma vela de rejeição para baixo. Qual a sua entrada?",
        chart: { candles: LTB_CANDLES, lines: [{ label: "LTB", color: T.put, points: [{ xFrac: 0.02, value: 106 }, { xFrac: 0.98, value: 78 }] }] },
        correct: "PUT",
        explain: "O toque respeitado na LTB, com rejeição para baixo, reforça a tendência de baixa — entrada em PUT.",
      },
    ],
  },
  "2-2": {
    title: "Canais de Alta e Baixa",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "Canais de Preço",
        body: "Um canal é formado por duas linhas paralelas: a LTA (parte de baixo, suporte) e uma linha superior de resistência traçada nos topos. Em um canal de alta, o preço tende a oscilar entre essas duas bandas — comprando no fundo e vendendo no topo do canal.",
        pipTip: "Dentro de um canal, cada banda é uma pista — eu me movo com o fluxo, não contra ele.",
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "Em um canal de alta, a região mais comum para buscar entradas em CALL é:",
        options: ["No meio exato do canal", "Perto da banda inferior (fundo do canal)", "Perto da banda superior (topo do canal)", "Fora do canal"],
        correct: 1,
        explain: "Traders costumam buscar CALL perto da banda inferior, onde historicamente o preço encontra suporte dentro do canal.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "O preço está dentro de um canal de alta e acabou de tocar a banda inferior, com pavio de rejeição. Qual a sua entrada?",
        chart: {
          candles: CHANNEL_BOTTOM_CANDLES,
          lines: [
            { label: "Topo do canal", color: T.put, points: [{ xFrac: 0, value: 90 }, { xFrac: 1, value: 108 }] },
            { label: "Fundo do canal", color: T.call, points: [{ xFrac: 0, value: 60 }, { xFrac: 1, value: 78 }] },
          ],
        },
        correct: "CALL",
        explain: "Toque respeitado na banda inferior do canal de alta sugere continuação de alta dentro do canal — entrada em CALL.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "O preço está dentro do mesmo canal e agora toca a banda superior, com pavio de rejeição para baixo. Qual a sua entrada?",
        chart: {
          candles: CHANNEL_TOP_CANDLES,
          lines: [
            { label: "Topo do canal", color: T.put, points: [{ xFrac: 0, value: 82 }, { xFrac: 1, value: 100 }] },
            { label: "Fundo do canal", color: T.call, points: [{ xFrac: 0, value: 50 }, { xFrac: 1, value: 68 }] },
          ],
        },
        correct: "PUT",
        explain: "Toque na banda superior com rejeição sugere um recuo até a próxima banda do canal — entrada em PUT.",
      },
    ],
  },
  "2-3": {
    title: "Revisão do Módulo",
    steps: [
      { level: "Revisão · Módulo 2", type: "info", title: "Vamos revisar!", body: "Você aprendeu Suporte, Resistência, Rompimentos, LTA, LTB e Canais. Vamos consolidar antes de seguir para Padrões de Candlestick.", pipTip: "Toda boa caçada começa com a revisão do terreno. Vamos relembrar o que aprendemos." },
      { level: "Revisão · Módulo 2", type: "mcq", question: "Um rompimento de resistência com vela forte geralmente sugere:", options: ["Reversão imediata para baixo", "Continuação do movimento para cima", "Que o gráfico travou", "Redução do payout"], correct: 1, explain: "Rompimentos com força tendem a indicar continuação na direção do rompimento." },
      { level: "Revisão · Módulo 2", type: "mcq", question: "A LTB (Linha de Tendência de Baixa) conecta:", options: ["Fundos ascendentes", "Topos descendentes", "Apenas o fechamento diário", "Zonas de payout"], correct: 1, explain: "A LTB conecta máximas cada vez mais baixas, funcionando como resistência dinâmica." },
      { level: "Revisão · Módulo 2", type: "mcq", question: "Em um canal de alta, a banda superior funciona como:", options: ["Suporte dinâmico", "Resistência dinâmica", "Payout mínimo", "Ponto de entrada obrigatório em CALL"], correct: 1, explain: "A banda superior do canal atua como resistência dinâmica, região onde o preço tende a ser rejeitado." },
      { level: "Revisão · Módulo 2", type: "mcq", question: "Quanto mais vezes uma região de suporte é testada e respeitada, ela se torna:", options: ["Mais fraca", "Irrelevante", "Mais forte", "Automaticamente um canal"], correct: 2, explain: "Regiões testadas e respeitadas repetidamente ganham relevância técnica e força." },
    ],
  },

  /* ---------- MÓDULO 3 ---------- */
  "3-0": {
    title: "Martelo e Enforcado",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "Martelo e Enforcado",
        body: "Martelo e Enforcado têm exatamente o mesmo formato: corpo pequeno no topo e um pavio inferior longo (pelo menos 2x o corpo). A diferença está no contexto. Depois de uma tendência de BAIXA, esse formato é chamado de Martelo e sinaliza possível reversão para cima. Depois de uma tendência de ALTA, o mesmo formato é chamado de Enforcado e sinaliza possível reversão para baixo.",
        pipTip: "Mesma forma, sinais diferentes — o contexto muda tudo, até para um camaleão.",
      },
      {
        level: "Nível 2 · Identificação Visual", type: "mcq-visual",
        question: "Qual dessas velas tem o formato de Martelo/Enforcado (corpo pequeno no topo, pavio inferior longo)?",
        options: [{ variant: "candle", label: "Sequência comum" }, { variant: "hammer", label: "Martelo / Enforcado" }],
        correct: 1,
        explain: "O formato característico é corpo pequeno próximo ao topo com um pavio inferior bem mais longo que o corpo.",
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "O que diferencia um Martelo de um Enforcado, já que o formato da vela é idêntico?",
        options: ["A cor do corpo da vela", "O contexto: a tendência que veio antes da vela", "O tamanho do pavio superior", "O horário em que a vela se formou"],
        correct: 1,
        explain: "O mesmo formato de vela muda de nome e de sinal dependendo se aparece após uma tendência de baixa (Martelo) ou de alta (Enforcado).",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "Após uma sequência de quedas, surge uma vela com corpo pequeno no topo e pavio inferior longo. Qual a sua entrada?",
        chart: { candles: HAMMER_CANDLES, lines: [] },
        correct: "CALL",
        explain: "Depois de uma tendência de baixa, esse formato é um Martelo — os compradores rejeitaram preços mais baixos. Sinal de reversão para cima.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "Após uma sequência de altas, surge uma vela com corpo pequeno no topo e pavio inferior longo. Qual a sua entrada?",
        chart: { candles: ENFORCADO_CANDLES, lines: [] },
        correct: "PUT",
        explain: "Depois de uma tendência de alta, esse mesmo formato é um Enforcado — alerta de que os vendedores começam a aparecer. Sinal de reversão para baixo.",
      },
    ],
  },
  "3-1": {
    title: "Padrão de Engolfo",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "Padrão de Engolfo (Engulfing)",
        body: "O Engolfo de Alta acontece quando, após uma tendência de baixa, surge uma vela verde cujo corpo engole completamente o corpo da vela vermelha anterior — sinal de que os compradores tomaram o controle com força. O Engolfo de Baixa é o oposto: após uma tendência de alta, uma vela vermelha engole o corpo da vela verde anterior.",
        pipTip: "Quando um corpo engole o outro, o mercado está gritando uma nova direção.",
      },
      {
        level: "Nível 2 · Identificação Visual", type: "mcq-visual",
        question: "Qual das opções mostra um Engolfo de Alta (corpo verde engolindo o corpo vermelho anterior)?",
        options: [{ variant: "engulfBull", label: "Engolfo de Alta" }, { variant: "engulfBear", label: "Engolfo de Baixa" }],
        correct: 0,
        explain: "No Engolfo de Alta, a vela verde abre abaixo e fecha acima do corpo da vela vermelha anterior, 'engolindo-a' por completo.",
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "Para o Engolfo ser válido, o que precisa acontecer com os CORPOS das velas?",
        options: ["O corpo novo precisa ser menor que o anterior", "O corpo novo precisa cobrir totalmente o corpo da vela anterior", "Os pavios precisam ser iguais", "As duas velas precisam ter a mesma cor"],
        correct: 1,
        explain: "O que caracteriza o Engolfo é o corpo da nova vela cobrindo por completo o corpo (não necessariamente os pavios) da vela anterior.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "Depois de uma sequência de baixa, surge uma vela verde grande que engole totalmente o corpo da vela vermelha anterior. Qual a sua entrada?",
        chart: { candles: ENGULF_BULL_CANDLES, lines: [] },
        correct: "CALL",
        explain: "Engolfo de Alta após tendência de baixa é um forte sinal de reversão compradora — entrada em CALL.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "Depois de uma sequência de alta, surge uma vela vermelha grande que engole totalmente o corpo da vela verde anterior. Qual a sua entrada?",
        chart: { candles: ENGULF_BEAR_CANDLES, lines: [] },
        correct: "PUT",
        explain: "Engolfo de Baixa após tendência de alta é um forte sinal de reversão vendedora — entrada em PUT.",
      },
    ],
  },
  "3-2": {
    title: "Doji",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "Doji: o sinal de indecisão",
        body: "O Doji acontece quando abertura e fechamento ficam praticamente no mesmo preço, formando um corpo quase inexistente — geralmente com pavios para os dois lados. Ele representa um empate de forças entre compradores e vendedores. Sozinho, o Doji NÃO é um sinal de entrada: é preciso esperar a vela seguinte para confirmar a direção.",
        pipTip: "Diante da indecisão, eu espero. Um Doji sozinho não é ordem de entrada.",
      },
      {
        level: "Nível 2 · Identificação Visual", type: "mcq-visual",
        question: "Qual dessas velas é um Doji (corpo quase inexistente, pavios dos dois lados)?",
        options: [{ variant: "doji", label: "Doji" }, { variant: "candle", label: "Sequência comum" }],
        correct: 0,
        explain: "O Doji tem corpo praticamente nulo — abertura e fechamento quase no mesmo nível — com pavios visíveis para cima e para baixo.",
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "Um Doji isolado, sem nenhuma vela de confirmação depois dele, deve ser interpretado como:",
        options: ["Sinal garantido de reversão", "Sinal garantido de continuação", "Indecisão — é preciso aguardar a próxima vela para confirmar", "Um erro no gráfico"],
        correct: 2,
        explain: "O Doji mostra apenas equilíbrio momentâneo entre compradores e vendedores. A confirmação vem da vela seguinte.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "Após uma tendência de alta, surge um Doji próximo à resistência e, na sequência, uma vela de confirmação vermelha e forte. Qual a sua entrada?",
        chart: { candles: DOJI_CANDLES, lines: [{ label: "Resistência", color: T.put, points: [{ xFrac: 0, value: 90 }, { xFrac: 1, value: 90 }] }] },
        correct: "PUT",
        explain: "O Doji sinalizou indecisão no topo, e a vela de confirmação vermelha após ele reforça a reversão para baixo — entrada em PUT.",
      },
    ],
  },
  "3-3": {
    title: "Pinbar & Revisão",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "Pinbar (Pin Bar)",
        body: "O Pinbar tem corpo pequeno e um pavio bem longo de um dos lados — o 'nariz' que dá nome ao padrão (de Pinocchio Bar). Pinbar de alta: pavio inferior longo, sinaliza rejeição de preços baixos. Pinbar de baixa: pavio superior longo, sinaliza rejeição de preços altos. Ao contrário do Martelo, o Pinbar pode aparecer em qualquer ponto do gráfico, não só após uma tendência definida.",
        pipTip: "O pavio é o nariz do Pinóquio do mercado — ele sempre entrega quando o preço mentiu.",
      },
      {
        level: "Nível 2 · Identificação Visual", type: "mcq-visual",
        question: "Qual dessas opções é um Pinbar de Alta (pavio inferior longo)?",
        options: [{ variant: "pinbarBull", label: "Pinbar de Alta" }, { variant: "pinbarBear", label: "Pinbar de Baixa" }],
        correct: 0,
        explain: "O Pinbar de Alta tem o 'nariz' (pavio longo) apontando para baixo, mostrando rejeição de preços mais baixos.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "Um Pinbar com pavio inferior longo se forma bem próximo ao suporte. Qual a sua entrada?",
        chart: { candles: PINBAR_SUPPORT_CANDLES, lines: [{ label: "Suporte", color: T.call, points: [{ xFrac: 0, value: 45 }, { xFrac: 1, value: 45 }] }] },
        correct: "CALL",
        explain: "Pinbar de alta no suporte mostra forte rejeição de preços baixos — entrada em CALL.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "Um Pinbar com pavio superior longo se forma bem próximo à resistência. Qual a sua entrada?",
        chart: { candles: PINBAR_RESISTANCE_CANDLES, lines: [{ label: "Resistência", color: T.put, points: [{ xFrac: 0, value: 105 }, { xFrac: 1, value: 105 }] }] },
        correct: "PUT",
        explain: "Pinbar de baixa na resistência mostra forte rejeição de preços altos — entrada em PUT.",
      },
      { level: "Revisão · Módulo 3", type: "mcq", question: "Martelo e Enforcado têm o mesmo formato. O que define qual dos dois é?", options: ["A cor da vela", "A tendência anterior a ela", "O tamanho da tela", "O payout do ativo"], correct: 1, explain: "Depois de baixa = Martelo (alta). Depois de alta = Enforcado (baixa). O contexto é o que muda o nome e o sinal." },
      { level: "Revisão · Módulo 3", type: "mcq", question: "No Engolfo de Alta, o corpo da vela verde precisa:", options: ["Ser menor que o corpo anterior", "Engolir totalmente o corpo da vela vermelha anterior", "Ter o mesmo tamanho da vela anterior", "Ter pavios maiores que o corpo"], correct: 1, explain: "O corpo verde precisa cobrir totalmente o corpo vermelho anterior para o Engolfo ser válido." },
      { level: "Revisão · Módulo 3", type: "mcq", question: "Um Doji sozinho, sem confirmação, deve levar você a:", options: ["Entrar imediatamente em CALL", "Entrar imediatamente em PUT", "Aguardar a vela seguinte antes de decidir", "Dobrar o valor da entrada"], correct: 2, explain: "O Doji mostra indecisão — a decisão de entrada só deve vir após a confirmação da vela seguinte." },
    ],
  },

  /* ---------- MÓDULO 4 ---------- */
  "4-0": {
    title: "Índice de Força (RSI)",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "RSI — Índice de Força Relativa",
        body: "O RSI é um oscilador que varia de 0 a 100 e mede a velocidade e a força dos movimentos de preço. Acima de 70, o ativo é considerado 'sobrecomprado' (movimento de alta esticado). Abaixo de 30, é considerado 'sobrevendido' (movimento de baixa esticado). Ele não deve ser usado sozinho — funciona melhor combinado com suporte, resistência e padrões de candlestick.",
        pipTip: "RSI é como sentir a temperatura do ambiente antes de decidir mudar de cor.",
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "Um RSI acima de 70 normalmente indica que o ativo está:",
        options: ["Sobrevendido", "Sobrecomprado", "Em payout máximo", "Fora do horário de negociação"],
        correct: 1,
        explain: "RSI acima de 70 mostra um movimento de alta esticado — região de sobrecompra.",
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "Um RSI abaixo de 30 normalmente indica que o ativo está:",
        options: ["Sobrecomprado", "Sobrevendido", "Em tendência lateral obrigatória", "Com payout reduzido"],
        correct: 1,
        explain: "RSI abaixo de 30 mostra um movimento de baixa esticado — região de sobrevenda.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "O preço sobe de forma esticada e o RSI está em 78 (zona de sobrecompra). Qual a sua entrada?",
        chart: { candles: RSI_OVERBOUGHT_CANDLES, lines: [] }, rsi: 78,
        correct: "PUT",
        explain: "RSI em zona de sobrecompra, junto com um movimento de alta esticado, aumenta a chance de uma correção — entrada em PUT.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "O preço cai de forma esticada e o RSI está em 21 (zona de sobrevenda). Qual a sua entrada?",
        chart: { candles: RSI_OVERSOLD_CANDLES, lines: [] }, rsi: 21,
        correct: "CALL",
        explain: "RSI em zona de sobrevenda, junto com um movimento de baixa esticado, aumenta a chance de um repique — entrada em CALL.",
      },
    ],
  },
  "4-1": {
    title: "Bandas de Bollinger",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "Bandas de Bollinger",
        body: "As Bandas de Bollinger são formadas por três linhas: uma média móvel central e duas bandas (superior e inferior) baseadas no desvio-padrão do preço. Elas se alargam quando a volatilidade aumenta e se estreitam quando o mercado fica mais calmo. Quando o preço toca a banda superior, o movimento está estatisticamente esticado para cima; quando toca a inferior, está esticado para baixo.",
        pipTip: "Quando o preço se estica demais, ele tende a voltar para casa — de olho nas bandas!",
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "Quando o preço toca a banda SUPERIOR de Bollinger, isso geralmente sugere:",
        options: ["Que o preço vai subir infinitamente", "Um movimento esticado, com possível recuo", "Que o payout vai aumentar", "Que a corretora vai fechar a operação"],
        correct: 1,
        explain: "Tocar a banda superior mostra um preço estatisticamente esticado para cima, aumentando a chance de um recuo.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "O preço sobe e toca a banda superior de Bollinger, deixando um pavio de rejeição. Qual a sua entrada?",
        chart: {
          candles: BOLLINGER_UPPER_CANDLES,
          lines: [
            { label: "Banda Superior", color: T.put, points: [{ xFrac: 0, value: 90 }, { xFrac: 1, value: 108 }] },
            { label: "Média Móvel", color: T.gold, points: [{ xFrac: 0, value: 70 }, { xFrac: 1, value: 85 }] },
            { label: "Banda Inferior", color: T.call, points: [{ xFrac: 0, value: 50 }, { xFrac: 1, value: 62 }] },
          ],
        },
        correct: "PUT",
        explain: "Rejeição na banda superior sugere que o preço estava esticado e tende a recuar em direção à média — entrada em PUT.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "O preço cai e toca a banda inferior de Bollinger, deixando um pavio de rejeição. Qual a sua entrada?",
        chart: {
          candles: BOLLINGER_LOWER_CANDLES,
          lines: [
            { label: "Banda Superior", color: T.put, points: [{ xFrac: 0, value: 108 }, { xFrac: 1, value: 90 }] },
            { label: "Média Móvel", color: T.gold, points: [{ xFrac: 0, value: 88 }, { xFrac: 1, value: 70 }] },
            { label: "Banda Inferior", color: T.call, points: [{ xFrac: 0, value: 68 }, { xFrac: 1, value: 48 }] },
          ],
        },
        correct: "CALL",
        explain: "Rejeição na banda inferior sugere que o preço estava esticado para baixo e tende a repicar em direção à média — entrada em CALL.",
      },
    ],
  },
  "4-2": {
    title: "Médias Móveis",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "Médias Móveis",
        body: "A Média Móvel suaviza o preço, calculando a média dos últimos períodos, e ajuda a visualizar a direção da tendência. Quando o preço cruza ACIMA da média, isso sugere um viés comprador de curto prazo. Quando cruza ABAIXO, sugere um viés vendedor. O cruzamento de duas médias (uma rápida e uma lenta) também é muito usado para identificar mudanças de tendência.",
        pipTip: "A média móvel é a minha bússola: mostra a direção sem o ruído do dia a dia.",
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "Quando o preço cruza ACIMA da média móvel, isso geralmente sugere um viés de:",
        options: ["Alta", "Baixa", "Payout reduzido", "Mercado fechado"],
        correct: 0,
        explain: "O cruzamento do preço para cima da média móvel é lido como um sinal de força compradora de curto prazo.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "O preço estava abaixo da média móvel e acabou de cruzar para cima dela com força. Qual a sua entrada?",
        chart: { candles: MA_CROSS_UP_CANDLES, lines: [{ label: "Média Móvel", color: T.gold, points: [{ xFrac: 0, value: 78 }, { xFrac: 1, value: 82 }] }] },
        correct: "CALL",
        explain: "O cruzamento do preço para cima da média móvel reforça o novo viés comprador — entrada em CALL.",
      },
      {
        level: "Nível 3 · Decisão CALL/PUT", type: "chart",
        question: "O preço estava acima da média móvel e acabou de cruzar para baixo dela com força. Qual a sua entrada?",
        chart: { candles: MA_CROSS_DOWN_CANDLES, lines: [{ label: "Média Móvel", color: T.gold, points: [{ xFrac: 0, value: 64 }, { xFrac: 1, value: 66 }] }] },
        correct: "PUT",
        explain: "O cruzamento do preço para baixo da média móvel reforça o novo viés vendedor — entrada em PUT.",
      },
    ],
  },
  "4-3": {
    title: "Revisão do Módulo",
    steps: [
      { level: "Revisão · Módulo 4", type: "info", title: "Vamos revisar!", body: "Você aprendeu RSI, Bandas de Bollinger e Médias Móveis. Vamos consolidar antes de seguir para Gestão e Mentalidade.", pipTip: "Nenhum indicador substitui a leitura do preço — eles são apoio, não decisão final." },
      { level: "Revisão · Módulo 4", type: "mcq", question: "RSI acima de 70 é sinal de:", options: ["Sobrevenda", "Sobrecompra", "Payout alto", "Mercado lateral obrigatório"], correct: 1, explain: "RSI acima de 70 indica sobrecompra — movimento de alta esticado." },
      { level: "Revisão · Módulo 4", type: "mcq", question: "As Bandas de Bollinger se alargam quando:", options: ["A volatilidade aumenta", "O payout diminui", "O RSI está em 50", "A corretora está fechada"], correct: 0, explain: "As bandas se movem com base no desvio-padrão do preço — mais volatilidade, bandas mais largas." },
      { level: "Revisão · Módulo 4", type: "mcq", question: "Quando o preço cruza ABAIXO da média móvel, o viés sugerido é de:", options: ["Alta", "Baixa", "Sobrecompra automática", "Reversão garantida"], correct: 1, explain: "Cruzamento para baixo da média reforça um viés vendedor de curto prazo." },
      { level: "Revisão · Módulo 4", type: "mcq", question: "A melhor forma de usar indicadores como RSI, Bollinger e Médias Móveis é:", options: ["Sempre sozinhos, sem olhar o gráfico", "Combinados com suporte, resistência e candlestick", "Apenas em horário de almoço", "Somente em gráficos de linha"], correct: 1, explain: "Indicadores funcionam melhor como confirmação, combinados com a leitura de preço (price action)." },
    ],
  },

  /* ---------- MÓDULO 5 ---------- */
  "5-0": {
    title: "Gerenciamento de Banca",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "O que é Gerenciamento de Banca",
        body: "Banca é o capital total que você reserva para operar. A regra mais usada é arriscar apenas 1% a 3% da banca por entrada — nunca o valor todo. Isso não é sobre acertar sempre, é sobre sobreviver a sequências de perdas (que TODO trader tem) sem quebrar a banca. Gerenciamento é o que separa quem dura anos de quem some em poucas semanas.",
        pipTip: "Proteger a banca é como proteger minha cauda: sem ela, não sobrevivo até a próxima operação.",
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "Qual a principal razão para nunca arriscar mais de 2-3% da banca por operação?",
        options: ["Porque a corretora exige isso por lei", "Para preservar capital e sobreviver a sequências de perdas", "Para pagar menos taxas", "Para aumentar o payout automaticamente"],
        correct: 1,
        explain: "Sequências de perdas acontecem com qualquer estratégia. Arriscar pouco por entrada garante que você continue no jogo depois delas.",
      },
      {
        level: "Nível 2 · Aplicação", type: "mcq",
        question: "Sua banca é de R$1.000 e você segue a regra de 2% por entrada. Qual o valor de cada entrada?",
        options: ["R$10", "R$20", "R$50", "R$200"],
        correct: 1,
        explain: "2% de R$1.000 = R$20. Esse é o valor máximo recomendado para uma única entrada nesse cenário.",
      },
      {
        level: "Nível 3 · Disciplina", type: "mcq",
        question: "O que é o 'stop diário' (limite de perda do dia)?",
        options: ["O horário em que a corretora fecha", "Um valor máximo de perda que, ao ser atingido, você para de operar naquele dia", "O momento de dobrar as entradas para recuperar", "Uma taxa cobrada pela corretora"],
        correct: 1,
        explain: "O stop diário protege sua banca das suas próprias emoções depois de um dia ruim — ao atingi-lo, a ordem é parar, não insistir.",
      },
      {
        level: "Nível 3 · Disciplina", type: "mcq",
        question: "Depois de perder 3 operações seguidas, o que um trader disciplinado deve fazer?",
        options: ["Dobrar o valor da próxima entrada para recuperar rápido", "Respeitar o stop diário e parar de operar", "Trocar de ativo até acertar", "Aumentar o número de entradas simultâneas"],
        correct: 1,
        explain: "Insistir depois de uma sequência de perdas é o caminho mais comum para quebrar a banca. Parar e revisar é a atitude profissional.",
      },
    ],
  },
  "5-1": {
    title: "Estratégia Soros",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "O que é a Estratégia Soros",
        body: "Soros é reinvestir o lucro de uma operação vencedora na entrada seguinte, somando o valor original + o lucro obtido. Isso faz o ganho crescer mais rápido em sequências de acertos. Mas atenção: se a entrada com Soros for perdida, a perda também é maior que uma entrada normal — por isso a maioria dos traders limita o Soros a no máximo 2 níveis antes de voltar ao valor base.",
        pipTip: "Reinvestir o lucro é ótimo — mas eu sempre sei a hora certa de parar o ciclo.",
      },
      {
        level: "Nível 2 · Aplicação", type: "mcq",
        question: "Você entra com R$20, o payout é de 90% e você acerta (lucro de R$18). No Soros nível 1, qual valor você reinveste na próxima entrada?",
        options: ["R$18", "R$20", "R$38", "R$40"],
        correct: 2,
        explain: "No Soros, você reinveste o valor original + o lucro: R$20 + R$18 = R$38.",
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "Qual é o principal risco da estratégia Soros?",
        options: ["Ela reduz o payout da corretora", "Se a entrada com Soros for perdida, a perda é maior que uma entrada normal", "Ela é proibida na maioria das corretoras", "Ela exige uma banca infinita"],
        correct: 1,
        explain: "Como o valor reinvestido é maior, um erro no ciclo de Soros custa mais caro do que uma entrada comum — por isso o controle de níveis é essencial.",
      },
      {
        level: "Nível 3 · Disciplina", type: "mcq",
        question: "Qual prática a maioria dos traders experientes recomenda para usar Soros com segurança?",
        options: ["Nunca parar o ciclo enquanto estiver ganhando", "Limitar a no máximo 2 ou 3 níveis e depois voltar ao valor base", "Usar Soros em toda e qualquer entrada", "Dobrar o valor a cada novo nível, como no Martingale"],
        correct: 1,
        explain: "Limitar o número de níveis protege os lucros já conquistados — depois de 2 ou 3 acertos em sequência, volta-se ao valor base da banca.",
      },
    ],
  },
  "5-2": {
    title: "Martingale: risco real",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "Martingale: entenda o risco real",
        body: "Martingale é dobrar o valor da entrada após uma perda, na tentativa de recuperar tudo em uma única vitória. O problema é que sequências de perdas consecutivas são normais no trading — e o valor cresce exponencialmente a cada dobra. Poucas perdas seguidas já são suficientes para exigir um valor de entrada muito maior do que a banca suporta.",
        pipTip: "Dobrar a aposta parece sedutor, mas é a armadilha mais perigosa da savana do trading.",
      },
      {
        level: "Nível 2 · Aplicação", type: "mcq",
        question: "Você perde uma entrada de R$20 e aplica Martingale, dobrando o valor. Qual será a próxima entrada?",
        options: ["R$20", "R$30", "R$40", "R$60"],
        correct: 2,
        explain: "No Martingale, o valor dobra a cada perda: R$20 x 2 = R$40.",
      },
      {
        level: "Nível 2 · Aplicação", type: "mcq",
        question: "Partindo de R$20 e dobrando a cada perda, depois de 5 perdas seguidas (R$20, R$40, R$80, R$160, R$320), qual seria o valor da 6ª entrada?",
        options: ["R$320", "R$640", "R$100", "R$1.000"],
        correct: 1,
        explain: "A sequência dobra a cada perda: 20, 40, 80, 160, 320, 640. Após 5 perdas, a 6ª entrada já exige R$640 — um crescimento explosivo a partir de apenas R$20.",
      },
      {
        level: "Nível 3 · Disciplina", type: "mcq",
        question: "Por que o Martingale é considerado uma estratégia de altíssimo risco?",
        options: ["Porque as corretoras proíbem seu uso", "Porque o valor cresce exponencialmente e pode quebrar a banca em poucas perdas seguidas", "Porque reduz o payout a cada entrada", "Porque só funciona em gráficos de linha"],
        correct: 1,
        explain: "O crescimento exponencial do valor apostado é o que torna o Martingale extremamente arriscado — sequências de perdas fazem parte do jogo.",
      },
      {
        level: "Nível 3 · Disciplina", type: "mcq",
        question: "Qual seria uma alternativa mais segura ao Martingale?",
        options: ["Dobrar o valor, mas só até 3 vezes", "Manter o valor fixo por entrada, seguindo o gerenciamento de banca", "Usar Martingale apenas com Soros junto", "Aumentar o valor sempre que estiver ansioso"],
        correct: 1,
        explain: "Manter o valor fixo e respeitar o gerenciamento de banca é a forma mais sustentável de operar no longo prazo.",
      },
    ],
  },
  "5-3": {
    title: "Psicologia do Trader",
    steps: [
      {
        level: "Nível 1 · Introdução", type: "info",
        title: "A Mente do Trader",
        body: "Estratégia e gerenciamento de banca só funcionam se vierem acompanhados de controle emocional. Medo e ganância levam a decisões impulsivas — entrar sem análise, aumentar valores por raiva ou sair de uma operação por ansiedade. Um trader profissional segue seu plano mesmo depois de perdas, e trata cada operação como uma entre centenas, não como uma final decisiva.",
        pipTip: "Mente calma, banca protegida. Essa é a combinação de quem dura anos nesse mercado.",
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "O que é 'revenge trading' (operar por vingança)?",
        options: ["Uma estratégia avançada de reversão", "Aumentar valores ou entrar sem análise logo após uma perda, tentando recuperar rápido", "Um tipo de gráfico de velas", "Um bônus oferecido pela corretora"],
        correct: 1,
        explain: "Revenge trading é a tentativa emocional de 'se vingar' do mercado depois de uma perda — geralmente piora ainda mais os resultados.",
      },
      {
        level: "Nível 2 · Identificação", type: "mcq",
        question: "Qual a função de um diário de operações (trade journal)?",
        options: ["Servir apenas de comprovante para a Receita Federal", "Registrar entradas, resultados e emoções para identificar padrões e melhorar a disciplina", "Aumentar automaticamente o payout", "Substituir a análise técnica"],
        correct: 1,
        explain: "O diário de operações ajuda o trader a enxergar seus próprios padrões de erro e acerto — inclusive os emocionais — ao longo do tempo.",
      },
      {
        level: "Nível 3 · Disciplina", type: "mcq",
        question: "Depois de uma sequência de perdas, a atitude mais recomendada é:",
        options: ["Aumentar o valor das próximas entradas para recuperar rápido", "Respeitar o stop diário, parar e revisar as operações com calma", "Trocar de corretora imediatamente", "Ignorar o gerenciamento de banca só dessa vez"],
        correct: 1,
        explain: "Parar, respirar e revisar é o que evita que uma sequência ruim de operações vire uma sequência ruim de decisões.",
      },
      {
        level: "Revisão Final · Curso Completo", type: "mcq",
        question: "Qual frase resume melhor uma boa gestão de risco?",
        options: ["Arriscar tudo quando a confiança está alta", "Arriscar um percentual pequeno e constante da banca em cada entrada", "Aumentar o valor sempre que perder", "Usar Martingale sem limite de níveis"],
        correct: 1,
        explain: "Constância e disciplina no tamanho das entradas é o que sustenta uma banca no longo prazo, muito mais do que qualquer sinal isolado.",
      },
      {
        level: "Revisão Final · Curso Completo", type: "mcq",
        question: "Depois deste módulo, qual é a ordem de prioridade mais saudável para um trader iniciante?",
        options: ["Estratégia > Gerenciamento > Psicologia", "Psicologia > Gerenciamento > Estratégia", "Só a estratégia importa", "Só o payout importa"],
        correct: 1,
        explain: "Sem controle emocional e gerenciamento de banca, nenhuma estratégia sobrevive a uma sequência de perdas — por isso mente e gestão vêm antes da técnica.",
      },
    ],
  },

  /* ---------- LIÇÕES DE PRÁTICA / REFORÇO ---------- */
  "1-4": {
    title: "Prática: Cenários Reais",
    steps: [
      { level: "Prática · Módulo 1", type: "info", title: "Hora de praticar!", body: "Vamos aplicar tudo que você aprendeu em Fundamentos com situações do dia a dia de um trader iniciante.", pipTip: "Prática é onde a teoria vira instinto. Vamos treinar juntos!" },
      { level: "Prática · Módulo 1", type: "mcq", question: "Você tem R$200 na conta e vê uma corretora oferecendo payout de 95%, mas sem nenhuma informação sobre regulamentação. O que fazer?", options: ["Entrar direto pois o payout é ótimo", "Pesquisar a regulamentação e o histórico de saques antes de depositar", "Perguntar em um grupo de Telegram se é confiável", "Depositar o valor mínimo só para testar o payout"], correct: 1, explain: "Payout alto sem transparência sobre regulamentação é um sinal de alerta — pesquise antes de depositar." },
      { level: "Prática · Módulo 1", type: "mcq", question: "Numa vela de alta (verde), o fechamento ficou em 1,2050 e a abertura em 1,2020. Isso confirma que:", options: ["O preço fechou abaixo de onde abriu", "O preço fechou acima de onde abriu", "A vela é neutra", "Não é possível saber sem o payout"], correct: 1, explain: "Vela verde sempre fecha acima de onde abriu — nesse caso, 1,2050 é maior que 1,2020." },
      { level: "Prática · Módulo 1", type: "mcq", question: "Você investiu R$80 com payout de 92% e acertou a direção. Quanto você recebe de volta no total (lucro + valor investido)?", options: ["R$73,60", "R$80,00", "R$153,60", "R$172,00"], correct: 2, explain: "Lucro = 92% de R$80 = R$73,60. Total devolvido = R$80 + R$73,60 = R$153,60." },
      { level: "Prática · Módulo 1", type: "mcq", question: "Antes de escolher entre gráfico de linha e candlestick para operar, o mais indicado é:", options: ["Usar sempre linha, é mais simples", "Usar candlestick, pois mostra mais informação por período", "Tanto faz, o resultado é igual", "Usar linha apenas à noite"], correct: 1, explain: "O candlestick mostra abertura, fechamento, máxima e mínima — informação essencial que a linha não mostra." },
    ],
  },
  "2-4": {
    title: "Prática: Leitura de Zonas",
    steps: [
      { level: "Prática · Módulo 2", type: "info", title: "Praticando Suporte, Resistência e Tendência", body: "Questões práticas para fixar como identificar zonas e linhas de tendência no dia a dia do gráfico.", pipTip: "Ler zonas de preço é como ler o terreno antes de dar o próximo passo." },
      { level: "Prática · Módulo 2", type: "mcq", question: "Uma zona foi testada e respeitada 4 vezes sem ser rompida. Isso significa que ela é:", options: ["Irrelevante para a análise", "Uma zona fraca que já vai romper com certeza", "Uma zona forte, com boa chance de ser respeitada de novo", "Uma média móvel"], correct: 2, explain: "Zonas testadas e respeitadas várias vezes ganham relevância técnica." },
      { level: "Prática · Módulo 2", type: "mcq", question: "O preço rompeu a resistência mas fechou de volta abaixo dela na mesma vela, deixando um pavio de rejeição. Isso é sinal de:", options: ["Rompimento confirmado, força total para cima", "Possível falso rompimento — a resistência ainda pode valer", "Início automático de um canal", "Fim do gráfico"], correct: 1, explain: "Fechar de volta abaixo da resistência na mesma vela é um sinal clássico de falso rompimento." },
      { level: "Prática · Módulo 2", type: "mcq", question: "Se os fundos do gráfico estão cada vez mais altos, a linha que conecta esses pontos é a:", options: ["LTB", "LTA", "Banda de Bollinger", "Média móvel"], correct: 1, explain: "A LTA conecta fundos ascendentes (cada vez mais altos)." },
      { level: "Prática · Módulo 2", type: "mcq", question: "Em um canal de baixa, a banda superior costuma funcionar como:", options: ["Suporte dinâmico", "Resistência dinâmica", "Zona de payout", "Linha de Soros"], correct: 1, explain: "A banda superior de um canal de baixa age como resistência dinâmica, limitando as altas." },
    ],
  },
  "3-4": {
    title: "Prática: Reconhecimento de Padrões",
    steps: [
      { level: "Prática · Módulo 3", type: "info", title: "Reconhecendo Padrões na Prática", body: "Questões rápidas para testar se você já reconhece Martelo, Engolfo, Doji e Pinbar de cabeça.", pipTip: "Quanto mais você pratica reconhecer o formato, mais rápido a decisão fica natural." },
      { level: "Prática · Módulo 3", type: "mcq", question: "Corpo pequeno no topo, pavio inferior longo, formado depois de uma sequência de altas. Esse padrão se chama:", options: ["Martelo", "Enforcado", "Doji", "Engolfo de Alta"], correct: 1, explain: "O mesmo formato após uma tendência de alta é chamado de Enforcado, não Martelo." },
      { level: "Prática · Módulo 3", type: "mcq", question: "Uma vela verde grande que cobre totalmente o corpo da vela vermelha anterior, após uma queda, é um:", options: ["Doji", "Pinbar de Baixa", "Engolfo de Alta", "Enforcado"], correct: 2, explain: "Corpo verde cobrindo totalmente o corpo vermelho anterior, após queda, é Engolfo de Alta." },
      { level: "Prática · Módulo 3", type: "mcq", question: "Corpo quase inexistente, com pavios para os dois lados. Esse é um:", options: ["Pinbar", "Doji", "Engolfo", "Martelo"], correct: 1, explain: "Corpo quase nulo com pavios dos dois lados é a definição de Doji." },
      { level: "Prática · Módulo 3", type: "mcq", question: "Um Pinbar com pavio superior longo, formado perto de uma resistência, sugere uma entrada em:", options: ["CALL", "PUT", "Não operar nunca mais", "Soros automático"], correct: 1, explain: "Pinbar de baixa (pavio superior longo) na resistência sugere rejeição de preços altos — entrada em PUT." },
    ],
  },
  "4-4": {
    title: "Prática: Sinais Combinados",
    steps: [
      { level: "Prática · Módulo 4", type: "info", title: "Combinando Indicadores com Price Action", body: "Nenhum indicador funciona sozinho. Vamos praticar como combiná-los com o que você já aprendeu sobre candles e zonas.", pipTip: "Quando vários sinais apontam na mesma direção, a confiança da análise aumenta." },
      { level: "Prática · Módulo 4", type: "mcq", question: "RSI em 82 e o preço tocando exatamente uma resistência forte. Esses dois sinais juntos reforçam uma possível entrada em:", options: ["CALL", "PUT", "Soros automático", "Nenhuma, os sinais se contradizem"], correct: 1, explain: "RSI sobrecomprado + toque em resistência forte reforçam um cenário de reversão para baixo." },
      { level: "Prática · Módulo 4", type: "mcq", question: "Preço tocando a banda inferior de Bollinger e formando um Martelo. Isso é um exemplo de:", options: ["Sinais se contradizendo", "Confluência de sinais reforçando uma possível reversão para cima", "Um novo indicador chamado 'Martelo-Bollinger'", "Erro de gráfico"], correct: 1, explain: "Quando indicador e padrão de candle apontam na mesma direção, chamamos isso de confluência." },
      { level: "Prática · Módulo 4", type: "mcq", question: "Se o RSI está em 50 (neutro) mas o preço está numa resistência forte, o que é mais prudente?", options: ["Entrar em CALL com confiança total", "Ter mais cautela, pois o RSI não está confirmando um extremo", "Ignorar o RSI para sempre", "Dobrar o valor da entrada"], correct: 1, explain: "Sem confirmação do RSI, o sinal fica mais fraco — vale ter mais cautela." },
      { level: "Prática · Módulo 4", type: "mcq", question: "A combinação mais robusta para uma entrada costuma vir de:", options: ["Um único indicador isolado", "Vários indicadores e a leitura do preço apontando na mesma direção", "Sempre usar Martingale", "Escolher aleatoriamente CALL ou PUT"], correct: 1, explain: "Confluência entre indicadores e price action é o que dá mais robustez a uma análise." },
    ],
  },
  "5-4": {
    title: "Prática: Decisões sob Pressão",
    steps: [
      { level: "Prática · Módulo 5", type: "info", title: "Decisões sob Pressão", body: "Gerenciamento e psicologia só valem alguma coisa quando testados na prática — inclusive nos momentos difíceis.", pipTip: "O verdadeiro teste de disciplina acontece depois de uma sequência de perdas, não de vitórias." },
      { level: "Prática · Módulo 5", type: "mcq", question: "Você perdeu 4 entradas seguidas e sente vontade de dobrar o valor da próxima para 'recuperar tudo de uma vez'. Essa vontade é um exemplo clássico de:", options: ["Gerenciamento correto", "Revenge trading", "Estratégia Soros", "Payout dinâmico"], correct: 1, explain: "A vontade de recuperar tudo rapidamente após perdas é a essência do revenge trading." },
      { level: "Prática · Módulo 5", type: "mcq", question: "Sua banca é R$500 e você já perdeu R$25 hoje (5%, seu stop diário). O que fazer?", options: ["Continuar operando para recuperar", "Parar de operar por hoje, conforme o stop diário definido", "Sacar tudo da corretora imediatamente", "Trocar de corretora na hora"], correct: 1, explain: "Atingir o stop diário é o sinal para parar, não para insistir." },
      { level: "Prática · Módulo 5", type: "mcq", question: "Depois de 2 acertos seguidos usando Soros, a prática mais recomendada é:", options: ["Continuar o Soros indefinidamente", "Considerar resetar para o valor base e preservar o lucro", "Trocar para Martingale", "Dobrar o valor do Soros"], correct: 1, explain: "Resetar após 2-3 níveis protege o lucro já conquistado no ciclo de Soros." },
      { level: "Prática · Módulo 5", type: "mcq", question: "Manter um diário de operações ajuda principalmente a:", options: ["Aumentar o payout automaticamente", "Identificar padrões de erro e acerto, inclusive emocionais", "Substituir o gerenciamento de banca", "Garantir mais vitórias"], correct: 1, explain: "O diário revela padrões de comportamento — inclusive emocionais — que passariam despercebidos." },
    ],
  },
};

/* ============================== NAVEGAÇÃO INFERIOR ============================== */
function BottomNav({ active, onNavigate, onOpenMenu, menuOpen }) {
  const items = [
    { key: "home", icon: LayoutGrid, label: "Início" },
    { key: "achievements", icon: Award, label: "Conquistas" },
    { key: "profile", icon: User, label: "Perfil" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t px-6 py-3 flex justify-between items-center z-40" style={{ backgroundColor: T.surface, borderColor: T.border }}>
      {items.map(({ key, icon: Icon, label }) => (
        <button key={key} onClick={() => onNavigate(key)} className="flex flex-col items-center gap-1 px-2">
          <Icon size={22} color={active === key ? T.gold : T.textMuted} />
          <span className="text-[10px] font-bold" style={{ color: active === key ? T.gold : T.textMuted }}>{label}</span>
        </button>
      ))}
      <button onClick={onOpenMenu} className="p-2.5 rounded-xl transition-colors" style={{ backgroundColor: menuOpen ? T.gold : T.surfaceRaised }}>
        <MoreHorizontal size={22} color={menuOpen ? "#241900" : T.textMuted} />
      </button>
    </nav>
  );
}

/* ============================== MENU FLUTUANTE ============================== */
function MenuPopup({ onNavigate, onClose, isDarkMode, onToggleDark, onLogout }) {
  const items = [
    { key: "home", icon: LayoutGrid, label: "Início", color: "#38BDF8" },
    { key: "practice", icon: Brain, label: "Praticar", color: "#22D3EE" },
    { key: "achievements", icon: Award, label: "Conquistas", color: "#C084FC" },
    { key: "progress", icon: BarChart3, label: "Progresso", color: "#A3E635" },
    { key: "plus", icon: Crown, label: "BinaryMaster Plus", color: T.gold },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl p-5" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
        <div className="space-y-4">
          {items.map(({ key, icon: Icon, label, color }) => (
            <button key={key} onClick={() => onNavigate(key)} className="flex items-center gap-3 w-full text-left font-bold text-sm transition-opacity hover:opacity-80">
              <Icon size={20} color={color} />
              <span style={{ color: T.textPrimary }}>{label.toUpperCase()}</span>
            </button>
          ))}
        </div>
        <hr className="my-4" style={{ borderColor: T.border }} />
        <div className="space-y-4">
          <button onClick={() => onNavigate("settings")} className="flex items-center gap-3 w-full text-left font-bold text-sm">
            <SettingsIcon size={20} color={T.textMuted} />
            <span style={{ color: T.textPrimary }}>AJUSTES</span>
          </button>
          <button onClick={onToggleDark} className="flex items-center justify-between w-full text-left font-bold text-sm">
            <span className="flex items-center gap-3" style={{ color: T.textPrimary }}>
              {isDarkMode ? <Sun size={20} color={T.gold} /> : <Moon size={20} color={T.textMuted} />}
              {isDarkMode ? "MODO CLARO (telas de conta)" : "MODO ESCURO"}
            </span>
          </button>
          <button onClick={onLogout} className="flex items-center gap-3 w-full text-left font-bold text-sm" style={{ color: T.put }}>
            <LogOut size={20} color={T.put} />
            <span>SAIR</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================== HOME / TRAIL SCREEN ============================== */
function HomeScreen({ stats, completed, examPassed, onOpenLesson, onOpenExam, saveStatus }) {
  const tipIndex = Object.keys(completed).length % PIP_HOME_TIPS.length;
  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: T.bg, fontFamily: "Inter, sans-serif" }}>
      <TopBar stats={stats} saveStatus={saveStatus} />
      <div className="max-w-md mx-auto px-4 pt-6">
        <div className="rounded-2xl p-4 flex items-center gap-4 border" style={{ backgroundColor: T.surface, borderColor: T.border }}>
          <PipMascot mood="neutral" className="w-16 h-16 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.gold }}>Dica do Pip</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: T.textPrimary }}>{PIP_HOME_TIPS[tipIndex]}</p>
          </div>
        </div>
      </div>
      <div className="max-w-md mx-auto px-4 pt-6">
        {MODULES_META.map((mod, mi) => {
          const lessons = LESSON_TITLES_BY_MODULE[mod.id];
          // Um módulo só destrava depois que a Prova Final do módulo anterior é aprovada.
          const moduleUnlocked = mi === 0 || !!examPassed[MODULES_META[mi - 1].id];
          const allLessonsDone = lessons.every((_, li) => !!completed[`${mod.id}-${li}`]);
          const examDone = !!examPassed[mod.id];
          const examUnlocked = moduleUnlocked && allLessonsDone;
          return (
            <div key={mod.id} className="mb-10">
              <ModuleBanner mod={mod} locked={!moduleUnlocked} />
              <div className="relative mt-8 flex flex-col items-center gap-7">
                {lessons.map((lessonTitle, li) => {
                  const key = `${mod.id}-${li}`;
                  const isDone = !!completed[key];
                  const prevDone = li === 0 ? moduleUnlocked : !!completed[`${mod.id}-${li - 1}`];
                  const unlocked = moduleUnlocked && prevDone;
                  const hasContent = !!LESSONS[key];
                  const isPlayable = unlocked && hasContent;
                  const isNext = isPlayable && !isDone;
                  const offset = [0, -54, -78, -54, 0, 54, 78, 54][li % 8];

                  return (
                    <div key={key} style={{ transform: `translateX(${offset}px)` }} className="relative">
                      {isNext && (
                        <div
                          className="absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap animate-bounce"
                          style={{ backgroundColor: T.surfaceRaised, color: mod.color, border: `1px solid ${mod.color}` }}
                        >
                          COMEÇAR
                        </div>
                      )}
                      <Pressable
                        onClick={() => isPlayable && onOpenLesson(mod.id, li)}
                        disabled={!isPlayable}
                        bg={isDone ? T.gold : unlocked ? mod.color : T.surfaceRaised}
                        shadow={isDone ? T.goldShadow : unlocked ? mod.shadow : T.shadowDeep}
                        className="w-20 h-20 rounded-full flex items-center justify-center"
                      >
                        {isDone ? (
                          <Check size={30} color="#0F172A" strokeWidth={3} />
                        ) : unlocked ? (
                          <Play size={26} color="#0F172A" fill="#0F172A" />
                        ) : (
                          <Lock size={24} color={T.textMuted} />
                        )}
                      </Pressable>
                      <p className="text-center text-[11px] mt-2 font-semibold w-24 leading-tight" style={{ color: unlocked ? T.textPrimary : T.textMuted }}>
                        {lessonTitle}
                      </p>
                    </div>
                  );
                })}

                <div className="relative">
                  {examUnlocked && !examDone && (
                    <div
                      className="absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap animate-bounce"
                      style={{ backgroundColor: T.surfaceRaised, color: T.gold, border: `1px solid ${T.gold}` }}
                    >
                      PROVA FINAL
                    </div>
                  )}
                  <Pressable
                    onClick={() => examUnlocked && onOpenExam(mod.id)}
                    disabled={!examUnlocked}
                    bg={examDone ? T.gold : examUnlocked ? T.surfaceRaised : T.surfaceRaised}
                    shadow={examDone ? T.goldShadow : T.shadowDeep}
                    className="w-24 h-20 rounded-2xl flex items-center justify-center"
                    style={{ border: `2px solid ${examDone ? T.gold : examUnlocked ? T.gold : T.border}` }}
                  >
                    {examDone ? (
                      <Trophy size={28} color="#241900" />
                    ) : examUnlocked ? (
                      <Award size={26} color={T.gold} />
                    ) : (
                      <Lock size={22} color={T.textMuted} />
                    )}
                  </Pressable>
                  <p className="text-center text-[11px] mt-2 font-semibold w-24 leading-tight" style={{ color: examUnlocked ? T.textPrimary : T.textMuted }}>
                    Prova do Módulo
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModuleBanner({ mod, locked }) {
  const Icon = mod.icon;
  return (
    <div className="rounded-2xl px-5 py-4 flex items-center gap-4" style={{ backgroundColor: locked ? T.surface : mod.color, opacity: locked ? 0.55 : 1 }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
        <Icon size={22} color="#fff" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-black text-lg leading-tight" style={{ fontFamily: "Sora, sans-serif" }}>Módulo {mod.id} · {mod.title}</p>
        <p className="text-white/80 text-xs mt-0.5">{mod.subtitle}</p>
      </div>
      {locked && <Lock size={18} color="#fff" />}
    </div>
  );
}

function TopBar({ stats, saveStatus }) {
  const statusConfig = {
    saving: { color: T.gold, label: "Salvando..." },
    saved: { color: T.call, label: "Progresso salvo" },
    error: { color: T.put, label: "Falha ao salvar — use o Backup Manual em Ajustes" },
    idle: null,
  };
  const status = saveStatus ? statusConfig[saveStatus] : null;

  return (
    <div className="sticky top-0 z-20 backdrop-blur border-b" style={{ backgroundColor: "rgba(15,23,42,0.9)", borderColor: T.border }}>
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PipMascot mood="neutral" className="w-8 h-8" />
          <p className="font-black text-lg tracking-tight" style={{ fontFamily: "Sora, sans-serif", color: T.textPrimary }}>
            Binary<span style={{ color: T.gold }}>Master</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Stat icon={<Flame size={18} fill={T.flame} color={T.flame} />} value={stats.streak} />
          <Stat icon={<Gem size={18} fill={T.call} color={T.call} />} value={stats.gems} />
          <Stat icon={<Heart size={18} fill={T.heart} color={T.heart} />} value={stats.hearts} />
        </div>
      </div>
      {status && (
        <div className="max-w-md mx-auto px-4 pb-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
          <span className="text-[10px] font-semibold" style={{ color: status.color }}>{status.label}</span>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, value }) {
  return (
    <div className="flex items-center gap-1.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>
      {icon}
      <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, c }) {
  return (
    <div className="p-3 rounded-xl border" style={{ backgroundColor: c.surfaceAlt, borderColor: c.border }}>
      <span className="text-xs block" style={{ color: c.muted }}>{label}</span>
      <span className="text-lg font-bold" style={{ color: c.text, fontFamily: "JetBrains Mono, monospace" }}>{value}</span>
    </div>
  );
}

/* ============================== PERFIL ============================== */
function ProfileScreen({ stats, completed, isDarkMode, saveStatus, displayName, onUpdateName }) {
  const c = getTheme(isDarkMode);
  const totalLessons = Object.values(LESSON_TITLES_BY_MODULE).flat().length;
  const completedCount = Object.keys(completed).length;
  const level = Math.floor(stats.xp / 100) + 1;
  const xpIntoLevel = stats.xp % 100;
  const accuracy = stats.totalAnswered > 0 ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0;
  const [isEditing, setIsEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName);

  function startEditing() {
    setNameDraft(displayName);
    setIsEditing(true);
  }

  function saveName() {
    const trimmed = nameDraft.trim();
    if (trimmed) onUpdateName(trimmed.slice(0, 30));
    setIsEditing(false);
  }

  const initials = displayName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "BM";

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: c.bg }}>
      <TopBar stats={stats} saveStatus={saveStatus} />
      <div className="max-w-md mx-auto px-4 pt-6 space-y-6">
        <div className="p-6 rounded-2xl border text-center relative" style={{ backgroundColor: c.surface, borderColor: c.border }}>
          {!isEditing && (
            <button onClick={startEditing} className="absolute top-4 right-4 p-2 rounded-lg transition-colors" style={{ color: c.muted }}>
              <Edit3 size={18} />
            </button>
          )}
          <div className="w-24 h-24 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl font-black" style={{ backgroundColor: T.gold, color: "#241900" }}>{initials}</div>

          {isEditing ? (
            <div className="max-w-xs mx-auto space-y-2 mb-2">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={30}
                className="w-full text-center text-lg font-bold rounded-xl px-3 py-2 outline-none"
                style={{ backgroundColor: c.surfaceAlt, color: c.text, border: `1px solid ${T.gold}` }}
                placeholder="Seu nome de trader"
              />
              <div className="flex gap-2">
                <Pressable onClick={saveName} bg={T.gold} shadow={T.goldShadow} className="flex-1 py-2 rounded-xl font-bold text-sm">
                  <span style={{ color: "#241900" }}>Salvar</span>
                </Pressable>
                <Pressable onClick={() => setIsEditing(false)} bg={c.surfaceAlt} shadow={T.shadowDeep} className="flex-1 py-2 rounded-xl font-bold text-sm">
                  <span style={{ color: c.text }}>Cancelar</span>
                </Pressable>
              </div>
            </div>
          ) : (
            <h1 className="text-xl font-bold" style={{ color: c.text }}>{displayName}</h1>
          )}

          <p className="text-sm mb-4" style={{ color: c.muted }}>{completedCount}/{totalLessons} lições concluídas</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold" style={{ color: c.muted }}>
              <span>Nível {level}</span>
              <span>{xpIntoLevel} / 100 XP</span>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: c.surfaceAlt }}>
              <div className="h-full rounded-full" style={{ width: `${xpIntoLevel}%`, backgroundColor: T.gold }} />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl border" style={{ backgroundColor: c.surface, borderColor: c.border }}>
          <h2 className="text-lg font-bold mb-4" style={{ color: c.text }}>Estatísticas Gerais</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard c={c} label="XP Total" value={stats.xp} />
            <StatCard c={c} label="Sequência" value={`${stats.streak} dias`} />
            <StatCard c={c} label="Precisão" value={`${accuracy}%`} />
            <StatCard c={c} label="Gems" value={stats.gems} />
          </div>
        </div>

        <div className="p-4 rounded-2xl border flex items-center gap-3" style={{ backgroundColor: c.surface, borderColor: c.border }}>
          <PipMascot mood="neutral" className="w-14 h-14 flex-shrink-0" />
          <p className="text-xs font-medium" style={{ color: c.muted }}>
            {completedCount >= totalLessons ? "Você já concluiu o curso todo! Que tal revisar algum módulo?" : `Continue firme! Faltam ${totalLessons - completedCount} lições para você concluir o curso.`}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================== CONQUISTAS ============================== */
const ACHIEVEMENTS = [
  { id: "first", label: "Primeiros Passos", desc: "Complete sua primeira lição", icon: Play, check: (s, c) => Object.keys(c).length >= 1 },
  { id: "mod1", label: "Fundamentos Dominados", desc: "Aprove a Prova do Módulo 1", icon: BookOpen, check: (s, c, e) => !!e[1] },
  { id: "mod2", label: "Leitor de Gráficos", desc: "Aprove a Prova do Módulo 2", icon: TrendingUp, check: (s, c, e) => !!e[2] },
  { id: "mod3", label: "Mestre das Velas", desc: "Aprove a Prova do Módulo 3", icon: BarChart3, check: (s, c, e) => !!e[3] },
  { id: "mod4", label: "Analista Técnico", desc: "Aprove a Prova do Módulo 4", icon: Sparkles, check: (s, c, e) => !!e[4] },
  { id: "mod5", label: "Trader Disciplinado", desc: "Aprove a Prova do Módulo 5", icon: Crown, check: (s, c, e) => !!e[5] },
  { id: "course", label: "BinaryMaster Certificado", desc: "Complete o curso e aprove todas as provas", icon: Trophy, check: (s, c, e) => Object.keys(e).length >= 5 },
  { id: "streak", label: "Chama Acesa", desc: "Alcance 3 dias de sequência", icon: Flame, check: (s) => s.streak >= 3 },
  { id: "gems", label: "Cofre Cheio", desc: "Acumule 100 Gems", icon: Gem, check: (s) => s.gems >= 100 },
];

function AchievementsScreen({ stats, completed, examPassed, isDarkMode, saveStatus }) {
  const c = getTheme(isDarkMode);
  const unlockedCount = ACHIEVEMENTS.filter((a) => a.check(stats, completed, examPassed)).length;
  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: c.bg }}>
      <TopBar stats={stats} saveStatus={saveStatus} />
      <div className="max-w-md mx-auto px-4 pt-6">
        <h1 className="text-xl font-black mb-1" style={{ color: c.text, fontFamily: "Sora, sans-serif" }}>Conquistas</h1>
        <p className="text-sm mb-5" style={{ color: c.muted }}>{unlockedCount} de {ACHIEVEMENTS.length} desbloqueadas</p>
        <div className="grid grid-cols-2 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = a.check(stats, completed, examPassed);
            const Icon = a.icon;
            return (
              <div key={a.id} className="p-4 rounded-2xl border relative" style={{ backgroundColor: unlocked ? c.surface : c.surfaceAlt, borderColor: unlocked ? T.gold : c.border, opacity: unlocked ? 1 : 0.6 }}>
                {unlocked && <CheckCircle2 size={16} color={T.call} className="absolute top-3 right-3" />}
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: unlocked ? T.gold : c.border }}>
                  {unlocked ? <Icon size={20} color="#241900" /> : <Lock size={18} color={c.muted} />}
                </div>
                <p className="text-xs font-bold" style={{ color: c.text }}>{a.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: c.muted }}>{a.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================== PROGRESSO ============================== */
function ProgressScreen({ stats, completed, examPassed, isDarkMode, saveStatus }) {
  const c = getTheme(isDarkMode);
  const totalLessons = Object.values(LESSON_TITLES_BY_MODULE).flat().length;
  const completedCount = Object.keys(completed).length;
  const overallPct = Math.round((completedCount / totalLessons) * 100);
  const accuracy = stats.totalAnswered > 0 ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0;
  const examsPassedCount = Object.keys(examPassed).length;

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: c.bg }}>
      <TopBar stats={stats} saveStatus={saveStatus} />
      <div className="max-w-md mx-auto px-4 pt-6 space-y-6">
        <div className="p-5 rounded-2xl border" style={{ backgroundColor: c.surface, borderColor: c.border }}>
          <div className="flex justify-between items-baseline mb-2">
            <h2 className="text-lg font-bold" style={{ color: c.text }}>Progresso Geral</h2>
            <span className="text-2xl font-black" style={{ color: T.gold, fontFamily: "JetBrains Mono, monospace" }}>{overallPct}%</span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: c.surfaceAlt }}>
            <div className="h-full rounded-full" style={{ width: `${overallPct}%`, backgroundColor: T.gold }} />
          </div>
          <p className="text-xs mt-2" style={{ color: c.muted }}>{completedCount} de {totalLessons} lições concluídas</p>
        </div>

        <div className="p-5 rounded-2xl border" style={{ backgroundColor: c.surface, borderColor: c.border }}>
          <h2 className="text-lg font-bold mb-4" style={{ color: c.text }}>Progresso por Módulo</h2>
          <div className="space-y-4">
            {MODULES_META.map((mod) => {
              const titles = LESSON_TITLES_BY_MODULE[mod.id];
              const done = titles.filter((_, li) => completed[`${mod.id}-${li}`]).length;
              const pct = Math.round((done / titles.length) * 100);
              const examOk = !!examPassed[mod.id];
              return (
                <div key={mod.id}>
                  <div className="flex justify-between text-xs font-bold mb-1" style={{ color: c.text }}>
                    <span className="flex items-center gap-1.5">
                      Módulo {mod.id} · {mod.title}
                      {examOk && <Trophy size={12} color={T.gold} />}
                    </span>
                    <span style={{ color: c.muted }}>{done}/{titles.length}</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: c.surfaceAlt }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: mod.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard c={c} label="XP Acumulado" value={stats.xp} />
          <StatCard c={c} label="Precisão Geral" value={`${accuracy}%`} />
          <StatCard c={c} label="Provas Aprovadas" value={`${examsPassedCount}/5`} />
          <StatCard c={c} label="Gems" value={stats.gems} />
        </div>
      </div>
    </div>
  );
}

/* ============================== BINARYMASTER PLUS ============================== */
function PlusScreen({ stats, isDarkMode, saveStatus }) {
  const c = getTheme(isDarkMode);
  const [requested, setRequested] = useState(false);
  const benefits = [
    "Vidas ilimitadas — treine sem esperar recarregar corações",
    "Simulador avançado de gráficos com mais cenários",
    "Conteúdo exclusivo de estratégias avançadas",
    "Sem limite diário de lições",
  ];
  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: c.bg }}>
      <TopBar stats={stats} saveStatus={saveStatus} />
      <div className="max-w-md mx-auto px-4 pt-6">
        <div className="rounded-2xl p-6 text-center" style={{ background: `linear-gradient(160deg, ${T.gold}, #B58600)` }}>
          <Crown size={40} color="#241900" className="mx-auto mb-2" />
          <h1 className="text-xl font-black" style={{ color: "#241900", fontFamily: "Sora, sans-serif" }}>BinaryMaster Plus</h1>
          <p className="text-sm mt-1" style={{ color: "#3B2A00" }}>Acelere seus estudos sem limites</p>
        </div>
        <div className="mt-5 rounded-2xl border p-5 space-y-3" style={{ backgroundColor: c.surface, borderColor: c.border }}>
          {benefits.map((b, i) => (
            <div key={i} className="flex items-start gap-3">
              <CheckCircle2 size={18} color={T.call} className="flex-shrink-0 mt-0.5" />
              <p className="text-sm" style={{ color: c.text }}>{b}</p>
            </div>
          ))}
        </div>
        <div className="mt-5">
          {requested ? (
            <div className="text-center p-4 rounded-2xl border" style={{ backgroundColor: c.surfaceAlt, borderColor: T.gold }}>
              <p className="text-sm font-bold" style={{ color: T.gold }}>Em breve! 🚀</p>
              <p className="text-xs mt-1" style={{ color: c.muted }}>O BinaryMaster Plus ainda está em desenvolvimento — protótipo, sem cobrança real.</p>
            </div>
          ) : (
            <Pressable onClick={() => setRequested(true)} bg={T.gold} shadow={T.goldShadow} className="w-full py-3.5 rounded-2xl font-black">
              <span style={{ color: "#241900", fontFamily: "Sora, sans-serif" }}>QUERO SER PLUS</span>
            </Pressable>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== AJUSTES ============================== */
function ManualBackupCard({ c, progressSnapshot, onImportProgress }) {
  const [mode, setMode] = useState(null); // null | "export" | "import"
  const [exportCode, setExportCode] = useState("");
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [copied, setCopied] = useState(false);

  function doExport() {
    setExportCode(encodeProgress(progressSnapshot) || "");
    setMode("export");
    setImportResult(null);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(exportCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Clipboard pode falhar em alguns ambientes — o texto continua selecionável na caixa abaixo.
    }
  }

  function doImport() {
    const data = decodeProgress(importText);
    if (!data) {
      setImportResult({ ok: false, message: "Código inválido — confira se colou tudo, sem cortar nenhum caractere." });
      return;
    }
    onImportProgress(data);
    setImportResult({ ok: true, message: "Progresso importado com sucesso!" });
  }

  return (
    <div className="w-full p-4 rounded-2xl border" style={{ backgroundColor: c.surface, borderColor: c.border }}>
      <p className="text-sm font-bold mb-1" style={{ color: c.text }}>Backup manual do progresso</p>
      <p className="text-xs mb-3" style={{ color: c.muted }}>
        Isso funciona independente do armazenamento automático. Gere um código, guarde em qualquer lugar (bloco de notas, mensagem para você mesmo) e cole de volta aqui na próxima vez que abrir o app.
      </p>
      <div className="flex gap-2 mb-3">
        <Pressable onClick={doExport} bg={T.gold} shadow={T.goldShadow} className="flex-1 py-2 rounded-xl font-bold text-xs">
          <span style={{ color: "#241900" }}>Gerar código</span>
        </Pressable>
        <Pressable onClick={() => { setMode("import"); setImportResult(null); }} bg={c.surfaceAlt} shadow={T.shadowDeep} className="flex-1 py-2 rounded-xl font-bold text-xs">
          <span style={{ color: c.text }}>Importar código</span>
        </Pressable>
      </div>

      {mode === "export" && (
        <div className="space-y-2">
          <textarea
            readOnly
            value={exportCode}
            onFocus={(e) => e.target.select()}
            rows={4}
            className="w-full text-[10px] p-2 rounded-lg font-mono"
            style={{ backgroundColor: c.surfaceAlt, color: c.text, border: `1px solid ${c.border}` }}
          />
          <Pressable onClick={copyCode} bg={c.surfaceAlt} shadow={T.shadowDeep} className="w-full py-2 rounded-xl font-bold text-xs">
            <span style={{ color: c.text }}>{copied ? "Copiado!" : "Copiar código"}</span>
          </Pressable>
        </div>
      )}

      {mode === "import" && (
        <div className="space-y-2">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Cole aqui o código gerado anteriormente"
            rows={4}
            className="w-full text-[10px] p-2 rounded-lg font-mono"
            style={{ backgroundColor: c.surfaceAlt, color: c.text, border: `1px solid ${c.border}` }}
          />
          <Pressable onClick={doImport} disabled={!importText.trim()} bg={T.call} shadow={T.callShadow} className="w-full py-2 rounded-xl font-bold text-xs">
            <span style={{ color: "#08281A" }}>Importar</span>
          </Pressable>
        </div>
      )}

      {importResult && (
        <div className="mt-3 p-3 rounded-xl" style={{ backgroundColor: importResult.ok ? "#0F2E22" : "#2E1315" }}>
          <p className="text-xs font-semibold" style={{ color: importResult.ok ? T.call : T.put }}>{importResult.ok ? "✅ " : "❌ "}{importResult.message}</p>
        </div>
      )}
    </div>
  );
}


function SettingsScreen({ stats, isDarkMode, onToggleDark, onLogout, onResetProgress, saveStatus, progressSnapshot, onImportProgress, userEmail }) {
  const c = getTheme(isDarkMode);
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: c.bg }}>
      <TopBar stats={stats} saveStatus={saveStatus} />
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <h1 className="text-xl font-black mb-2" style={{ color: c.text, fontFamily: "Sora, sans-serif" }}>Ajustes</h1>

        <div className="w-full p-4 rounded-2xl border" style={{ backgroundColor: c.surface, borderColor: c.border }}>
          <p className="text-xs uppercase font-bold tracking-wider mb-1" style={{ color: T.gold }}>Conta</p>
          <p className="text-sm font-semibold" style={{ color: c.text }}>{userEmail}</p>
        </div>

        <div className="w-full p-4 rounded-2xl border flex items-center gap-3" style={{ backgroundColor: c.surface, borderColor: c.border }}>
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: saveStatus === "error" ? T.put : T.call }}
          />
          <div>
            <p className="text-sm font-bold" style={{ color: c.text }}>
              {saveStatus === "error" ? "Falha ao salvar automaticamente" : "Progresso salvo na nuvem"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: c.muted }}>
              {saveStatus === "error"
                ? "Não foi possível conectar ao servidor agora. Use o Backup Manual abaixo para não perder seu progresso."
                : "Lições, XP, gems, sequência e provas ficam salvos na sua conta e disponíveis em qualquer aparelho."}
            </p>
          </div>
        </div>

        <ManualBackupCard c={c} progressSnapshot={progressSnapshot} onImportProgress={onImportProgress} />

        <button onClick={onToggleDark} className="w-full flex items-center justify-between p-4 rounded-2xl border" style={{ backgroundColor: c.surface, borderColor: c.border }}>
          <span className="flex items-center gap-3 text-sm font-bold" style={{ color: c.text }}>
            {isDarkMode ? <Moon size={18} color={c.muted} /> : <Sun size={18} color={T.gold} />}
            Tema das telas de conta
          </span>
          <span className="text-xs font-bold" style={{ color: T.gold }}>{isDarkMode ? "ESCURO" : "CLARO"}</span>
        </button>

        <div className="w-full p-4 rounded-2xl border" style={{ backgroundColor: c.surface, borderColor: c.border }}>
          <p className="text-xs" style={{ color: c.muted }}>
            A trilha de lições, os gráficos de candlestick e o modo de estudo continuam sempre no Dark Mode — essa é a identidade visual fixa do BinaryMaster.
          </p>
        </div>

        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="w-full flex items-center gap-3 p-4 rounded-2xl border text-left" style={{ backgroundColor: c.surface, borderColor: c.border }}>
            <RotateCcw size={18} color={c.muted} />
            <span className="text-sm font-bold" style={{ color: c.text }}>Reiniciar progresso</span>
          </button>
        ) : (
          <div className="w-full p-4 rounded-2xl border space-y-3" style={{ backgroundColor: c.surface, borderColor: T.put }}>
            <p className="text-sm font-bold" style={{ color: T.put }}>Isso vai apagar todo o seu progresso. Tem certeza?</p>
            <div className="flex gap-3">
              <Pressable onClick={() => { onResetProgress(); setConfirmReset(false); }} bg={T.put} shadow={T.putShadow} className="flex-1 py-2.5 rounded-xl font-bold text-sm">
                <span style={{ color: "#fff" }}>Sim, apagar</span>
              </Pressable>
              <Pressable onClick={() => setConfirmReset(false)} bg={c.surfaceAlt} shadow={T.shadowDeep} className="flex-1 py-2.5 rounded-xl font-bold text-sm">
                <span style={{ color: c.text }}>Cancelar</span>
              </Pressable>
            </div>
          </div>
        )}

        <button onClick={onLogout} className="w-full flex items-center gap-3 p-4 rounded-2xl border text-left" style={{ backgroundColor: c.surface, borderColor: c.border }}>
          <LogOut size={18} color={T.put} />
          <span className="text-sm font-bold" style={{ color: T.put }}>Sair</span>
        </button>

        <p className="text-center text-[11px] pt-2" style={{ color: c.muted }}>BinaryMaster · v1.0 protótipo</p>
      </div>
    </div>
  );
}

/* ============================== SESSÃO ENCERRADA ============================== */
/* ============================== LESSON SCREEN ============================== */
/* ============================== PROVA DO MÓDULO ============================== */
function ExamScreen({ exam, moduleColor, onExit, onFinish }) {
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const q = exam.questions[qIdx];
  const progress = (qIdx / exam.questions.length) * 100;

  function handleSelect(i) {
    if (!checked) setSelected(i);
  }

  function handleCheck() {
    setChecked(true);
    if (selected === q.correct) setCorrectCount((c) => c + 1);
  }

  function handleNext() {
    setChecked(false);
    setSelected(null);
    if (qIdx + 1 >= exam.questions.length) setShowResult(true);
    else setQIdx((i) => i + 1);
  }

  function restart() {
    setQIdx(0);
    setSelected(null);
    setChecked(false);
    setCorrectCount(0);
    setShowResult(false);
  }

  if (showResult) {
    const pct = Math.round((correctCount / exam.questions.length) * 100);
    const passed = pct >= Math.round(exam.passScore * 100);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ backgroundColor: T.bg }}>
        <PipMascot mood={passed ? "trophy" : "wrong"} className="w-24 h-24 mb-4" />
        <h2 className="text-2xl font-black mb-1" style={{ color: T.textPrimary, fontFamily: "Sora, sans-serif" }}>{passed ? "Prova aprovada! 🎉" : "Não foi dessa vez"}</h2>
        <p className="text-sm mb-1" style={{ color: T.textMuted }}>Você acertou {correctCount} de {exam.questions.length} questões ({pct}%).</p>
        <p className="text-sm mb-8 max-w-xs" style={{ color: T.textMuted }}>
          {passed ? "Você já pode avançar para o próximo módulo." : `É preciso pelo menos ${Math.round(exam.passScore * 100)}% para passar. Revise o módulo e tente novamente!`}
        </p>
        <div className="w-full max-w-xs space-y-3">
          {passed ? (
            <Pressable onClick={() => onFinish(true, correctCount, exam.questions.length)} bg={T.gold} shadow={T.goldShadow} className="w-full py-3.5 rounded-2xl font-black">
              <span style={{ color: "#241900", fontFamily: "Sora, sans-serif" }}>CONTINUAR</span>
            </Pressable>
          ) : (
            <>
              <Pressable onClick={restart} bg={moduleColor} shadow={T.shadowDeep} className="w-full py-3.5 rounded-2xl font-black">
                <span style={{ color: "#fff", fontFamily: "Sora, sans-serif" }}>TENTAR NOVAMENTE</span>
              </Pressable>
              <Pressable onClick={() => onFinish(false, correctCount, exam.questions.length)} bg={T.surfaceRaised} shadow={T.shadowDeep} className="w-full py-3 rounded-2xl font-bold">
                <span style={{ color: T.textPrimary }}>Voltar para a trilha</span>
              </Pressable>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: T.bg, fontFamily: "Inter, sans-serif" }}>
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onExit} className="p-1"><X size={26} color={T.textMuted} /></button>
        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: T.surfaceRaised }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: T.gold }} />
        </div>
        <span className="text-xs font-bold" style={{ color: T.textMuted, fontFamily: "JetBrains Mono, monospace" }}>{qIdx + 1}/{exam.questions.length}</span>
      </div>

      <div className="flex-1 max-w-md w-full mx-auto px-5 pt-6 pb-32">
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: T.gold }}>{exam.title}</p>
        <h2 className="text-xl font-black mb-5 leading-snug" style={{ color: T.textPrimary, fontFamily: "Sora, sans-serif" }}>{q.question}</h2>
        <div className="space-y-3">
          {q.options.map((opt, i) => (
            <OptionRow key={i} label={opt} selected={selected === i} checked={checked} correct={i === q.correct} onClick={() => handleSelect(i)} />
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-5 py-4" style={{ backgroundColor: checked ? (selected === q.correct ? "#0F2E22" : "#2E1315") : T.surface, borderTop: `1px solid ${checked ? (selected === q.correct ? T.call : T.put) : T.border}` }}>
        <div className="max-w-md mx-auto">
          {checked && <p className="text-xs mb-3" style={{ color: T.textMuted }}>{q.explain}</p>}
          {!checked ? (
            <Pressable onClick={handleCheck} disabled={selected === null} bg={T.gold} shadow={T.goldShadow} className="w-full py-3.5 rounded-2xl font-black text-sm">
              <span style={{ color: "#241900", fontFamily: "Sora, sans-serif" }}>VERIFICAR</span>
            </Pressable>
          ) : (
            <Pressable onClick={handleNext} bg={selected === q.correct ? T.call : T.put} shadow={selected === q.correct ? T.callShadow : T.putShadow} className="w-full py-3.5 rounded-2xl font-black text-sm">
              <span style={{ color: selected === q.correct ? "#08281A" : "#fff", fontFamily: "Sora, sans-serif" }}>CONTINUAR</span>
            </Pressable>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== LESSON SCREEN ============================== */
function LessonScreen({ title, moduleColor, steps, hearts, onAnswerResult, onExit, onFinish }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [noHearts, setNoHearts] = useState(false);

  const step = steps[stepIdx];
  const progress = (stepIdx / steps.length) * 100;
  const isInfoStep = step.type === "info" || step.type === "chart-info";

  function handleSelect(val) {
    if (checked) return;
    setSelected(val);
  }

  function handleCheck() {
    if (isInfoStep) {
      advance();
      return;
    }
    let correct = false;
    if (step.type === "mcq" || step.type === "mcq-visual") correct = selected === step.correct;
    if (step.type === "chart") correct = selected === step.correct;

    setIsCorrect(correct);
    setChecked(true);

    if (correct) {
      setCorrectCount((c) => c + 1);
      onAnswerResult(true);
    } else {
      const heartsLeft = onAnswerResult(false);
      if (heartsLeft <= 0) setNoHearts(true);
    }
  }

  function advance() {
    setChecked(false);
    setSelected(null);
    setIsCorrect(null);
    if (stepIdx + 1 >= steps.length) {
      onFinish(correctCount);
    } else {
      setStepIdx((i) => i + 1);
    }
  }

  if (noHearts) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ backgroundColor: T.bg }}>
        <PipMascot mood="tired" className="w-28 h-28 mb-4" />
        <h2 className="text-2xl font-black mb-2" style={{ color: T.textPrimary, fontFamily: "Sora, sans-serif" }}>Você ficou sem vidas!</h2>
        <p className="text-sm mb-8 max-w-xs" style={{ color: T.textMuted }}>Sem problemas — todo trader leva stop. Recupere suas vidas com o Pip para continuar treinando.</p>
        <div className="w-full max-w-xs space-y-3">
          <Pressable bg={T.call} shadow={T.callShadow} className="w-full py-3 rounded-2xl font-bold" onClick={onExit}>
            <span style={{ color: "#08281A" }}>Usar 50 Gems para continuar</span>
          </Pressable>
          <Pressable bg={T.surfaceRaised} shadow={T.shadowDeep} className="w-full py-3 rounded-2xl font-bold" onClick={onExit}>
            <span style={{ color: T.textPrimary }}>Voltar para a trilha</span>
          </Pressable>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: T.bg, fontFamily: "Inter, sans-serif" }}>
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onExit} className="p-1"><X size={26} color={T.textMuted} /></button>
        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: T.surfaceRaised }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: moduleColor }} />
        </div>
        <div className="flex items-center gap-1">
          <Heart size={20} fill={T.heart} color={T.heart} />
          <span className="text-sm font-bold" style={{ color: T.textPrimary, fontFamily: "JetBrains Mono, monospace" }}>{hearts}</span>
        </div>
      </div>

      <div className="flex-1 max-w-md w-full mx-auto px-5 pt-6 pb-32">
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: moduleColor }}>{step.level}</p>

        {step.type === "info" && (
          <div>
            <h2 className="text-2xl font-black mb-4 leading-tight" style={{ color: T.textPrimary, fontFamily: "Sora, sans-serif" }}>{step.title}</h2>
            <div className="rounded-2xl p-5" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
              <p className="text-sm leading-relaxed" style={{ color: T.textMuted }}>{step.body}</p>
            </div>
            {step.pipTip && (
              <div className="flex items-center gap-3 p-4 mt-4 rounded-2xl border" style={{ borderColor: "rgba(6,182,212,0.3)", backgroundColor: "rgba(8,51,68,0.35)" }}>
                <PipMascot mood="neutral" className="w-12 h-12 flex-shrink-0" />
                <p className="text-xs font-medium" style={{ color: "#A5F3FC" }}>{step.pipTip}</p>
              </div>
            )}
          </div>
        )}

        {step.type === "chart-info" && (
          <div>
            <h2 className="text-2xl font-black mb-3 leading-tight" style={{ color: T.textPrimary, fontFamily: "Sora, sans-serif" }}>{step.title}</h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: T.textMuted }}>{step.body}</p>
            <CandleChart candles={step.chart.candles} lines={step.chart.lines} />
          </div>
        )}

        {step.type === "mcq" && (
          <div>
            <h2 className="text-xl font-black mb-5 leading-snug" style={{ color: T.textPrimary, fontFamily: "Sora, sans-serif" }}>{step.question}</h2>
            <div className="space-y-3">
              {step.options.map((opt, i) => (
                <OptionRow key={i} label={opt} selected={selected === i} checked={checked} correct={i === step.correct} onClick={() => handleSelect(i)} />
              ))}
            </div>
          </div>
        )}

        {step.type === "mcq-visual" && (
          <div>
            <h2 className="text-xl font-black mb-5 leading-snug" style={{ color: T.textPrimary, fontFamily: "Sora, sans-serif" }}>{step.question}</h2>
            <div className="grid grid-cols-2 gap-4">
              {step.options.map((opt, i) => {
                const isSel = selected === i;
                const showCorrect = checked && i === step.correct;
                const showWrong = checked && isSel && i !== step.correct;
                return (
                  <button key={i} onClick={() => handleSelect(i)} className="rounded-2xl p-4 text-left transition-colors"
                    style={{ backgroundColor: T.surface, border: `2px solid ${showCorrect ? T.call : showWrong ? T.put : isSel ? moduleColor : T.border}` }}>
                    <MiniChartIcon variant={opt.variant} />
                    <p className="text-xs font-semibold mt-2 text-center" style={{ color: T.textPrimary }}>{opt.label}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step.type === "chart" && (
          <div>
            <h2 className="text-base font-bold mb-4 leading-snug" style={{ color: T.textPrimary }}>{step.question}</h2>
            <CandleChart candles={step.chart.candles} lines={step.chart.lines} />
            {step.rsi !== undefined && <RSIMeter value={step.rsi} />}
            <div className="grid grid-cols-2 gap-4 mt-5">
              <Pressable onClick={() => handleSelect("CALL")} bg={selected === "CALL" ? T.call : T.surface} shadow={selected === "CALL" ? T.callShadow : T.shadowDeep} disabled={checked} className="py-5 rounded-2xl flex flex-col items-center gap-1" style={{ border: `2px solid ${T.call}` }}>
                <TrendingUp size={26} color={selected === "CALL" ? "#08281A" : T.call} />
                <span className="font-black text-sm" style={{ color: selected === "CALL" ? "#08281A" : T.call, fontFamily: "Sora, sans-serif" }}>CALL</span>
              </Pressable>
              <Pressable onClick={() => handleSelect("PUT")} bg={selected === "PUT" ? T.put : T.surface} shadow={selected === "PUT" ? T.putShadow : T.shadowDeep} disabled={checked} className="py-5 rounded-2xl flex flex-col items-center gap-1" style={{ border: `2px solid ${T.put}` }}>
                <TrendingDown size={26} color={selected === "PUT" ? "#2B0A0A" : T.put} />
                <span className="font-black text-sm" style={{ color: selected === "PUT" ? "#2B0A0A" : T.put, fontFamily: "Sora, sans-serif" }}>PUT</span>
              </Pressable>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-5 py-4 transition-colors"
        style={{ backgroundColor: checked ? (isCorrect ? "#0F2E22" : "#2E1315") : T.surface, borderTop: `1px solid ${checked ? (isCorrect ? T.call : T.put) : T.border}` }}>
        <div className="max-w-md mx-auto">
          {checked && (
            <div className="flex items-center gap-3 mb-3">
              <PipMascot mood={isCorrect ? "correct" : "wrong"} className="w-12 h-12 flex-shrink-0" />
              <div>
                <p className="font-black text-sm" style={{ color: isCorrect ? T.call : T.put, fontFamily: "Sora, sans-serif" }}>{isCorrect ? "Análise perfeita!" : "Atenção ao sinal!"}</p>
                <p className="text-xs" style={{ color: T.textMuted }}>{step.explain}</p>
              </div>
            </div>
          )}
          {!checked ? (
            <Pressable onClick={handleCheck} disabled={!isInfoStep && selected === null} bg={T.gold} shadow={T.goldShadow} className="w-full py-3.5 rounded-2xl font-black text-sm">
              <span style={{ color: "#241900", fontFamily: "Sora, sans-serif" }}>{isInfoStep ? "CONTINUAR" : "VERIFICAR"}</span>
            </Pressable>
          ) : (
            <Pressable onClick={advance} bg={isCorrect ? T.call : T.put} shadow={isCorrect ? T.callShadow : T.putShadow} className="w-full py-3.5 rounded-2xl font-black text-sm">
              <span style={{ color: isCorrect ? "#08281A" : "#fff", fontFamily: "Sora, sans-serif" }}>CONTINUAR</span>
            </Pressable>
          )}
        </div>
      </div>
    </div>
  );
}

function OptionRow({ label, selected, checked, correct, onClick }) {
  let border = T.border, bg = T.surface;
  if (selected && !checked) border = "#475569";
  if (checked && correct) { border = T.call; bg = "#0F2E22"; }
  if (checked && selected && !correct) { border = T.put; bg = "#2E1315"; }
  return (
    <button onClick={onClick} className="w-full text-left rounded-xl px-4 py-3.5 transition-colors flex items-center justify-between" style={{ backgroundColor: bg, border: `2px solid ${border}` }}>
      <span className="text-sm font-medium" style={{ color: T.textPrimary }}>{label}</span>
      {checked && correct && <Check size={18} color={T.call} />}
      {checked && selected && !correct && <X size={18} color={T.put} />}
    </button>
  );
}

/* ============================== COMPLETE SCREEN ============================== */
function CompleteScreen({ correctCount, total, courseComplete, onContinue }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ backgroundColor: T.bg }}>
      <div className="relative mb-6">
        <PipMascot mood="trophy" className="w-28 h-28" />
        <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: T.gold }}>
          <Trophy size={20} color="#241900" />
        </div>
      </div>
      {courseComplete ? (
        <>
          <h2 className="text-2xl font-black mb-1" style={{ color: T.textPrimary, fontFamily: "Sora, sans-serif" }}>Curso completo! 🏆</h2>
          <p className="text-sm mb-1 max-w-xs" style={{ color: T.textMuted }}>O Pip está muito orgulhoso! Você concluiu os 5 módulos do BinaryMaster: Fundamentos, Análise Gráfica, Candlestick, Indicadores e Gestão & Mentalidade.</p>
          <p className="text-sm mb-8" style={{ color: T.textMuted }}>Você acertou {correctCount} de {total} questões nesta última lição.</p>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-black mb-1" style={{ color: T.textPrimary, fontFamily: "Sora, sans-serif" }}>Lição concluída!</h2>
          <p className="text-sm mb-8" style={{ color: T.textMuted }}>O Pip adorou sua análise! Você acertou {correctCount} de {total} questões.</p>
        </>
      )}
      <div className="flex gap-4 mb-10">
        <div className="rounded-2xl px-6 py-4 flex flex-col items-center" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
          <p className="text-2xl font-black" style={{ color: T.gold, fontFamily: "JetBrains Mono, monospace" }}>+50</p>
          <p className="text-xs mt-1" style={{ color: T.textMuted }}>XP</p>
        </div>
        <div className="rounded-2xl px-6 py-4 flex flex-col items-center" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
          <p className="text-2xl font-black" style={{ color: T.call, fontFamily: "JetBrains Mono, monospace" }}>+10</p>
          <p className="text-xs mt-1" style={{ color: T.textMuted }}>Gems</p>
        </div>
      </div>
      <Pressable onClick={onContinue} bg={T.gold} shadow={T.goldShadow} className="w-full max-w-xs py-3.5 rounded-2xl font-black">
        <span style={{ color: "#241900", fontFamily: "Sora, sans-serif" }}>{courseComplete ? "VOLTAR À TRILHA" : "CONTINUAR"}</span>
      </Pressable>
    </div>
  );
}

/* ============================== APP ROOT ============================== */
/* ============================== PROVAS DE MÓDULO ============================== */
const MODULE_EXAMS = {
  1: {
    title: "Prova Final · Módulo 1: Fundamentos",
    passScore: 0.7,
    questions: [
      { question: "O que acontece com o valor investido se sua previsão estiver errada na expiração?", options: ["Você recebe metade do payout", "Você perde o valor investido na operação", "A corretora devolve o dinheiro", "A operação se prorroga automaticamente"], correct: 1, explain: "Se a direção prevista estiver errada, o valor investido naquela operação é perdido." },
      { question: "Payout de 85% sobre uma entrada de R$50. Qual o lucro em caso de acerto?", options: ["R$8,50", "R$42,50", "R$50,00", "R$85,00"], correct: 1, explain: "85% de R$50 = R$42,50 de lucro, além da devolução do valor investido." },
      { question: "Qual desses NÃO é um critério relevante para escolher uma corretora?", options: ["Regulamentação", "Histórico de saques", "Cor do aplicativo", "Suporte ao cliente"], correct: 2, explain: "Estética não impacta a segurança do seu capital." },
      { question: "O que um pavio longo em uma vela normalmente indica?", options: ["Um erro no gráfico", "Rejeição de preço naquela região", "Mercado fechado", "Aumento do payout"], correct: 1, explain: "Um pavio longo mostra que o preço foi rejeitado e recuou." },
      { question: "Vela verde significa que:", options: ["O fechamento foi maior que a abertura", "O fechamento foi menor que a abertura", "Não houve negociação", "O payout foi reduzido"], correct: 0, explain: "Vela verde (de alta) fecha acima de onde abriu." },
      { question: "Qual gráfico mostra abertura, fechamento, máxima e mínima de cada período?", options: ["Gráfico de linha", "Gráfico de candlestick", "Gráfico de barras de volume", "Nenhum gráfico mostra isso"], correct: 1, explain: "Somente o candlestick mostra as 4 informações de cada período." },
    ],
  },
  2: {
    title: "Prova Final · Módulo 2: Análise Gráfica",
    passScore: 0.7,
    questions: [
      { question: "O que é uma resistência?", options: ["Região onde o preço sobe sem parar", "Região onde o preço tem dificuldade de subir além, pois há mais vendedores", "Uma média móvel", "Um tipo de vela"], correct: 1, explain: "Resistência é onde a pressão vendedora historicamente supera a compradora." },
      { question: "Um rompimento de resistência com vela forte geralmente sugere:", options: ["Reversão imediata para baixo", "Continuação do movimento para cima", "Que o gráfico travou", "Redução do payout"], correct: 1, explain: "Rompimentos com força tendem a indicar continuação na direção do rompimento." },
      { question: "A LTA (Linha de Tendência de Alta) conecta:", options: ["Topos descendentes", "Fundos ascendentes", "Apenas o fechamento diário", "Zonas de payout"], correct: 1, explain: "A LTA conecta mínimas cada vez mais altas." },
      { question: "A LTB funciona como uma:", options: ["Resistência dinâmica", "Suporte dinâmico", "Média móvel", "Zona de payout"], correct: 0, explain: "A LTB conecta máximas cada vez mais baixas, agindo como resistência dinâmica." },
      { question: "Em um canal de alta, a banda inferior funciona como:", options: ["Resistência dinâmica", "Suporte dinâmico", "Linha de payout", "Ponto de saída obrigatório"], correct: 1, explain: "A banda inferior do canal atua como suporte dinâmico." },
      { question: "Quanto mais vezes uma zona de suporte é testada e respeitada, ela fica:", options: ["Mais fraca", "Irrelevante", "Mais forte", "Automaticamente um canal"], correct: 2, explain: "Regiões testadas e respeitadas repetidamente ganham relevância técnica." },
    ],
  },
  3: {
    title: "Prova Final · Módulo 3: Candlestick",
    passScore: 0.7,
    questions: [
      { question: "Martelo e Enforcado têm o mesmo formato de vela. O que muda o nome e o sinal?", options: ["A cor da vela", "A tendência anterior a ela", "O tamanho da tela", "O payout do ativo"], correct: 1, explain: "Depois de baixa = Martelo (alta). Depois de alta = Enforcado (baixa)." },
      { question: "No Engolfo de Alta, o corpo da vela verde precisa:", options: ["Ser menor que o corpo anterior", "Engolir totalmente o corpo da vela vermelha anterior", "Ter o mesmo tamanho da anterior", "Ter pavios maiores que o corpo"], correct: 1, explain: "O corpo verde precisa cobrir totalmente o corpo vermelho anterior." },
      { question: "Um Doji sozinho, sem confirmação, deve ser interpretado como:", options: ["Sinal garantido de reversão", "Sinal garantido de continuação", "Indecisão — aguardar confirmação", "Um erro no gráfico"], correct: 2, explain: "O Doji mostra apenas equilíbrio momentâneo entre compradores e vendedores." },
      { question: "O Pinbar se caracteriza por ter:", options: ["Corpo grande e sem pavios", "Corpo pequeno e um pavio bem longo de um dos lados", "Duas cores no mesmo corpo", "Sempre a mesma cor do Doji"], correct: 1, explain: "O 'nariz' do Pinbar é o pavio longo que dá nome ao padrão." },
      { question: "Um Martelo aparece depois de qual tipo de tendência para ser sinal de alta?", options: ["Tendência de alta", "Tendência de baixa", "Mercado lateral obrigatório", "Não importa a tendência"], correct: 1, explain: "O Martelo precisa vir após uma tendência de baixa para sinalizar reversão para cima." },
      { question: "Um Enforcado aparece depois de qual tipo de tendência?", options: ["Tendência de alta", "Tendência de baixa", "Mercado fechado", "Payout alto"], correct: 0, explain: "O Enforcado precisa vir após uma tendência de alta para sinalizar reversão para baixo." },
    ],
  },
  4: {
    title: "Prova Final · Módulo 4: Indicadores",
    passScore: 0.7,
    questions: [
      { question: "RSI acima de 70 normalmente indica que o ativo está:", options: ["Sobrevendido", "Sobrecomprado", "Em payout máximo", "Fora do horário de negociação"], correct: 1, explain: "RSI acima de 70 mostra um movimento de alta esticado." },
      { question: "RSI abaixo de 30 normalmente indica que o ativo está:", options: ["Sobrecomprado", "Sobrevendido", "Em tendência lateral obrigatória", "Com payout reduzido"], correct: 1, explain: "RSI abaixo de 30 mostra um movimento de baixa esticado." },
      { question: "As Bandas de Bollinger se alargam quando:", options: ["A volatilidade aumenta", "O payout diminui", "O RSI está em 50", "A corretora está fechada"], correct: 0, explain: "As bandas se movem com base no desvio-padrão do preço." },
      { question: "Quando o preço cruza ACIMA da média móvel, o viés sugerido é de:", options: ["Alta", "Baixa", "Sobrecompra automática", "Reversão garantida"], correct: 0, explain: "Cruzamento para cima da média reforça um viés comprador de curto prazo." },
      { question: "Tocar a banda SUPERIOR de Bollinger geralmente sugere:", options: ["Que o preço vai subir infinitamente", "Um movimento esticado, com possível recuo", "Que o payout vai aumentar", "Que a corretora vai fechar"], correct: 1, explain: "Tocar a banda superior mostra um preço estatisticamente esticado para cima." },
      { question: "A melhor forma de usar indicadores como RSI, Bollinger e Médias Móveis é:", options: ["Sempre sozinhos, sem olhar o gráfico", "Combinados com suporte, resistência e candlestick", "Apenas em horário de almoço", "Somente em gráficos de linha"], correct: 1, explain: "Indicadores funcionam melhor como confirmação, combinados com a leitura de preço." },
    ],
  },
  5: {
    title: "Prova de Certificação Final · BinaryMaster",
    passScore: 0.7,
    questions: [
      { question: "Qual o percentual recomendado de risco por entrada, segundo o gerenciamento de banca?", options: ["10% a 20%", "1% a 3%", "50%", "Não há um limite recomendado"], correct: 1, explain: "Arriscar apenas 1-3% da banca por entrada protege o capital em sequências de perdas." },
      { question: "O que é o 'stop diário' (limite de perda do dia)?", options: ["O horário em que a corretora fecha", "Um valor máximo de perda que, ao ser atingido, você para de operar naquele dia", "O momento de dobrar as entradas", "Uma taxa cobrada pela corretora"], correct: 1, explain: "O stop diário protege sua banca das suas próprias emoções depois de um dia ruim." },
      { question: "No Soros, você reinveste na próxima entrada:", options: ["Só o lucro obtido", "O valor original + o lucro obtido", "O dobro do valor perdido", "Um valor fixo definido pela corretora"], correct: 1, explain: "No Soros, o valor original somado ao lucro é reinvestido na próxima entrada." },
      { question: "Qual o principal risco da estratégia Soros?", options: ["Ela reduz o payout", "Se a entrada com Soros for perdida, a perda é maior que uma entrada normal", "Ela é proibida nas corretoras", "Ela exige banca infinita"], correct: 1, explain: "Como o valor reinvestido é maior, um erro no ciclo custa mais caro." },
      { question: "No Martingale, o valor da próxima entrada após uma perda:", options: ["Permanece igual", "Dobra", "Reduz pela metade", "Some ao lucro anterior"], correct: 1, explain: "No Martingale, o valor dobra a cada perda, na tentativa de recuperar tudo de uma vez." },
      { question: "Por que o Martingale é considerado uma estratégia de altíssimo risco?", options: ["Porque as corretoras o proíbem", "Porque o valor cresce exponencialmente e pode quebrar a banca em poucas perdas seguidas", "Porque reduz o payout a cada entrada", "Porque só funciona em gráficos de linha"], correct: 1, explain: "O crescimento exponencial do valor apostado torna o Martingale extremamente arriscado." },
      { question: "O que é 'revenge trading' (operar por vingança)?", options: ["Uma estratégia avançada de reversão", "Aumentar valores ou entrar sem análise logo após uma perda, tentando recuperar rápido", "Um tipo de gráfico de velas", "Um bônus da corretora"], correct: 1, explain: "Revenge trading é a tentativa emocional de 'se vingar' do mercado depois de uma perda." },
      { question: "Qual a ordem de prioridade mais saudável para um trader iniciante?", options: ["Estratégia > Gerenciamento > Psicologia", "Psicologia > Gerenciamento > Estratégia", "Só a estratégia importa", "Só o payout importa"], correct: 1, explain: "Sem controle emocional e gerenciamento de banca, nenhuma estratégia sobrevive a uma sequência de perdas." },
    ],
  },
};

/* ============================== LOGIN / CADASTRO ============================== */
function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);

  async function handleSubmit() {
    setError("");
    if (!email.trim() || !password) { setError("Preencha e-mail e senha."); return; }
    if (password.length < 6) { setError("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (mode === "signup" && password !== confirmPassword) { setError("As senhas não coincidem."); return; }

    setLoading(true);
    try {
      if (mode === "signup") {
        const data = await supabaseSignUp(email.trim(), password);
        if (data.access_token && data.user) {
          onAuthenticated({ access_token: data.access_token, refresh_token: data.refresh_token, user: data.user });
        } else {
          setSignupSuccess(true);
        }
      } else {
        const data = await supabaseSignIn(email.trim(), password);
        onAuthenticated({ access_token: data.access_token, refresh_token: data.refresh_token, user: data.user });
      }
    } catch (err) {
      setError(err && err.message ? err.message : "Algo deu errado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const fontImport = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
    `}</style>
  );

  if (signupSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ backgroundColor: T.bg, fontFamily: "Inter, sans-serif" }}>
        {fontImport}
        <PipMascot mood="trophy" className="w-24 h-24 mb-4" />
        <h2 className="text-xl font-black mb-2" style={{ color: T.textPrimary, fontFamily: "Sora, sans-serif" }}>Conta criada!</h2>
        <p className="text-sm mb-8 max-w-xs" style={{ color: T.textMuted }}>Confira seu e-mail para confirmar a conta antes de entrar.</p>
        <Pressable onClick={() => { setSignupSuccess(false); setMode("login"); }} bg={T.gold} shadow={T.goldShadow} className="w-full max-w-xs py-3.5 rounded-2xl font-black">
          <span style={{ color: "#241900", fontFamily: "Sora, sans-serif" }}>IR PARA O LOGIN</span>
        </Pressable>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: T.bg, fontFamily: "Inter, sans-serif" }}>
      {fontImport}
      <PipMascot mood="neutral" className="w-20 h-20 mb-4" />
      <p className="font-black text-2xl mb-1" style={{ fontFamily: "Sora, sans-serif", color: T.textPrimary }}>
        Binary<span style={{ color: T.gold }}>Master</span>
      </p>
      <p className="text-sm mb-8" style={{ color: T.textMuted }}>{mode === "login" ? "Entre para continuar seus estudos" : "Crie sua conta gratuita"}</p>

      <div className="w-full max-w-sm space-y-3">
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" autoCapitalize="none"
          className="w-full px-4 py-3 rounded-xl outline-none text-sm"
          style={{ backgroundColor: T.surface, color: T.textPrimary, border: `1px solid ${T.border}` }}
        />
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha"
          className="w-full px-4 py-3 rounded-xl outline-none text-sm"
          style={{ backgroundColor: T.surface, color: T.textPrimary, border: `1px solid ${T.border}` }}
        />
        {mode === "signup" && (
          <input
            type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar senha"
            className="w-full px-4 py-3 rounded-xl outline-none text-sm"
            style={{ backgroundColor: T.surface, color: T.textPrimary, border: `1px solid ${T.border}` }}
          />
        )}
        {error && <p className="text-xs font-semibold" style={{ color: T.put }}>{error}</p>}
        <Pressable onClick={handleSubmit} disabled={loading} bg={T.gold} shadow={T.goldShadow} className="w-full py-3.5 rounded-2xl font-black text-sm">
          <span style={{ color: "#241900", fontFamily: "Sora, sans-serif" }}>{loading ? "Aguarde..." : mode === "login" ? "ENTRAR" : "CRIAR CONTA"}</span>
        </Pressable>
      </div>

      <button
        onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
        className="mt-6 text-sm font-semibold"
        style={{ color: T.gold }}
      >
        {mode === "login" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
      </button>
    </div>
  );
}

function findNextLesson(completed, examPassed) {
  for (let mi = 0; mi < MODULES_META.length; mi++) {
    const mod = MODULES_META[mi];
    const moduleUnlocked = mi === 0 || !!examPassed[MODULES_META[mi - 1].id];
    if (!moduleUnlocked) break;
    const titles = LESSON_TITLES_BY_MODULE[mod.id];
    for (let li = 0; li < titles.length; li++) {
      const key = `${mod.id}-${li}`;
      if (!LESSONS[key]) continue;
      const prevDone = li === 0 || completed[`${mod.id}-${li - 1}`];
      if (prevDone && !completed[key]) return { moduleId: mod.id, lessonIdx: li };
    }
  }
  return null;
}

function findNextExam(completed, examPassed) {
  for (let mi = 0; mi < MODULES_META.length; mi++) {
    const mod = MODULES_META[mi];
    const moduleUnlocked = mi === 0 || !!examPassed[MODULES_META[mi - 1].id];
    if (!moduleUnlocked) break;
    const titles = LESSON_TITLES_BY_MODULE[mod.id];
    const allDone = titles.every((_, li) => !!completed[`${mod.id}-${li}`]);
    if (allDone && !examPassed[mod.id]) return mod.id;
  }
  return null;
}

const SHELL_SCREENS = ["home", "profile", "achievements", "progress", "plus", "settings"];


export default function App() {
  const [screen, setScreen] = useState("home");
  const [stats, setStats] = useState({ hearts: 5, gems: 50, xp: 0, streak: 3, totalCorrect: 0, totalAnswered: 0 });
  const [completed, setCompleted] = useState({});
  const [activeLesson, setActiveLesson] = useState(null);
  const [activeExamModule, setActiveExamModule] = useState(null);
  const [lastResult, setLastResult] = useState({ correct: 0, total: 0, courseComplete: false });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [examPassed, setExamPassed] = useState({});
  const [displayName, setDisplayName] = useState("Trader BinaryMaster");
  // saveStatus: "idle" | "saving" | "saved" | "error" — visível na UI, para nunca mais
  // falhar silenciosamente sem o usuário perceber.
  const [saveStatus, setSaveStatus] = useState("idle");

  // session: null enquanto deslogado. { access_token, refresh_token, user } depois do login.
  // Como artifacts não podem usar localStorage, a sessão fica só em memória — isso significa
  // que é preciso logar de novo a cada vez que o app é reaberto, mas o PROGRESSO em si fica
  // salvo de verdade no banco do Supabase, associado à conta.
  const [session, setSession] = useState(null);
  const [progressLoaded, setProgressLoaded] = useState(false);

  function updateSessionTokens(refreshed) {
    setSession((s) => (s ? { ...s, access_token: refreshed.access_token, refresh_token: refreshed.refresh_token || s.refresh_token } : s));
  }

  // Busca o progresso salvo no Supabase assim que o login acontece.
  useEffect(() => {
    if (!session || progressLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchProgress(session, updateSessionTokens);
        if (!cancelled && row) {
          if (row.completed) setCompleted(row.completed);
          if (row.stats) setStats((s) => ({ ...s, ...row.stats }));
          if (row.exam_passed) setExamPassed(row.exam_passed);
          if (typeof row.is_dark_mode === "boolean") setIsDarkMode(row.is_dark_mode);
          if (row.display_name) setDisplayName(row.display_name);
        }
      } catch (err) {
        console.error("Falha ao carregar progresso do Supabase:", err);
      } finally {
        if (!cancelled) setProgressLoaded(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, progressLoaded]);

  // Salva progresso no Supabase sempre que algo relevante mudar, com um pequeno atraso
  // (debounce) para não disparar uma requisição a cada clique.
  useEffect(() => {
    if (!session || !progressLoaded) return;
    setSaveStatus("saving");
    const t = setTimeout(() => {
      (async () => {
        try {
          await saveProgressToSupabase(
            session,
            { display_name: displayName, completed, stats, exam_passed: examPassed, is_dark_mode: isDarkMode },
            updateSessionTokens
          );
          setSaveStatus("saved");
        } catch (err) {
          console.error("Falha ao salvar progresso no Supabase:", err);
          setSaveStatus("error");
        }
      })();
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, stats, examPassed, isDarkMode, displayName, session, progressLoaded]);

  // Esconde o indicador "Progresso salvo" depois de alguns segundos, sem apagar erros/avisos.
  useEffect(() => {
    if (saveStatus !== "saved") return;
    const t = setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2500);
    return () => clearTimeout(t);
  }, [saveStatus]);

  function openLesson(moduleId, lessonIdx) {
    setActiveLesson({ moduleId, lessonIdx });
    setScreen("lesson");
  }

  function openExam(moduleId) {
    setActiveExamModule(moduleId);
    setScreen("exam");
  }

  function handleAnswerResult(correct) {
    let heartsLeft = stats.hearts;
    setStats((s) => {
      heartsLeft = correct ? s.hearts : Math.max(0, s.hearts - 1);
      return {
        ...s,
        hearts: heartsLeft,
        totalAnswered: s.totalAnswered + 1,
        totalCorrect: s.totalCorrect + (correct ? 1 : 0),
      };
    });
    return heartsLeft;
  }

  function handleFinish(correctCount) {
    const key = `${activeLesson.moduleId}-${activeLesson.lessonIdx}`;
    const total = LESSONS[key].steps.filter((s) => s.type !== "info" && s.type !== "chart-info").length;
    // A celebração de "curso completo" acontece só ao passar na Prova de Certificação do Módulo 5,
    // não apenas ao terminar a última lição — a prova é o verdadeiro portão final.
    setLastResult({ correct: correctCount, total, courseComplete: false });
    setStats((s) => ({ ...s, xp: s.xp + 50, gems: s.gems + 10 }));
    setCompleted((c) => ({ ...c, [key]: true }));
    setScreen("complete");
  }

  function handleExamFinish(passed, correctCount, total) {
    const moduleId = activeExamModule;
    if (passed) {
      setExamPassed((p) => ({ ...p, [moduleId]: true }));
      setStats((s) => ({ ...s, xp: s.xp + 100, gems: s.gems + 30 }));
      if (moduleId === 5) {
        setLastResult({ correct: correctCount, total, courseComplete: true });
        setScreen("complete");
        return;
      }
    }
    setScreen("home");
  }

  function handleMenuNavigate(key) {
    setIsMenuOpen(false);
    if (key === "practice") {
      const next = findNextLesson(completed, examPassed);
      if (next) { openLesson(next.moduleId, next.lessonIdx); return; }
      const examMod = findNextExam(completed, examPassed);
      if (examMod) { openExam(examMod); return; }
      setScreen("home");
      return;
    }
    setScreen(key);
  }

  function handleLogout() {
    setIsMenuOpen(false);
    setSession(null);
    setProgressLoaded(false);
    setScreen("home");
    // Reseta o estado local — ao logar de novo (mesma conta ou outra), o progresso
    // correto é buscado do Supabase de novo.
    setCompleted({});
    setStats({ hearts: 5, gems: 50, xp: 0, streak: 3, totalCorrect: 0, totalAnswered: 0 });
    setExamPassed({});
    setDisplayName("Trader BinaryMaster");
    setSaveStatus("idle");
  }

  function handleResetProgress() {
    setStats({ hearts: 5, gems: 50, xp: 0, streak: 3, totalCorrect: 0, totalAnswered: 0 });
    setCompleted({});
    setExamPassed({});
    setScreen("home");
  }

  function handleImportProgress(data) {
    if (data.completed) setCompleted(data.completed);
    if (data.stats) setStats((s) => ({ ...s, ...data.stats }));
    if (data.examPassed) setExamPassed(data.examPassed);
    if (typeof data.isDarkMode === "boolean") setIsDarkMode(data.isDarkMode);
    if (typeof data.displayName === "string" && data.displayName.trim()) setDisplayName(data.displayName);
  }

  const progressSnapshot = { completed, stats, examPassed, isDarkMode, displayName };

  const lessonKey = activeLesson ? `${activeLesson.moduleId}-${activeLesson.lessonIdx}` : null;
  const lessonData = lessonKey ? LESSONS[lessonKey] : null;
  const moduleColor = activeLesson ? MODULES_META.find((m) => m.id === activeLesson.moduleId).color : T.gold;
  const examModuleColor = activeExamModule ? MODULES_META.find((m) => m.id === activeExamModule).color : T.gold;
  const showShell = SHELL_SCREENS.includes(screen);

  if (!session) {
    return <AuthScreen onAuthenticated={(s) => setSession(s)} />;
  }

  if (!progressLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: T.bg, fontFamily: "Inter, sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        `}</style>
        <PipMascot mood="neutral" className="w-20 h-20 mb-4" />
        <p className="text-sm font-bold animate-pulse" style={{ color: T.textMuted }}>Carregando seu progresso...</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
      `}</style>

      {screen === "home" && <HomeScreen stats={stats} completed={completed} examPassed={examPassed} onOpenLesson={openLesson} onOpenExam={openExam} saveStatus={saveStatus} />}
      {screen === "profile" && <ProfileScreen stats={stats} completed={completed} isDarkMode={isDarkMode} saveStatus={saveStatus} displayName={displayName} onUpdateName={setDisplayName} />}
      {screen === "achievements" && <AchievementsScreen stats={stats} completed={completed} examPassed={examPassed} isDarkMode={isDarkMode} saveStatus={saveStatus} />}
      {screen === "progress" && <ProgressScreen stats={stats} completed={completed} examPassed={examPassed} isDarkMode={isDarkMode} saveStatus={saveStatus} />}
      {screen === "plus" && <PlusScreen stats={stats} isDarkMode={isDarkMode} saveStatus={saveStatus} />}
      {screen === "settings" && (
        <SettingsScreen
          stats={stats}
          isDarkMode={isDarkMode}
          onToggleDark={() => setIsDarkMode((d) => !d)}
          onLogout={handleLogout}
          onResetProgress={handleResetProgress}
          saveStatus={saveStatus}
          progressSnapshot={progressSnapshot}
          onImportProgress={handleImportProgress}
          userEmail={session && session.user ? session.user.email : ""}
        />
      )}

      {screen === "lesson" && lessonData && (
        <LessonScreen
          title={lessonData.title}
          moduleColor={moduleColor}
          steps={lessonData.steps}
          hearts={stats.hearts}
          onAnswerResult={handleAnswerResult}
          onExit={() => setScreen("home")}
          onFinish={handleFinish}
        />
      )}

      {screen === "exam" && activeExamModule && (
        <ExamScreen
          exam={MODULE_EXAMS[activeExamModule]}
          moduleColor={examModuleColor}
          onExit={() => setScreen("home")}
          onFinish={handleExamFinish}
        />
      )}

      {screen === "complete" && (
        <CompleteScreen correctCount={lastResult.correct} total={lastResult.total} courseComplete={lastResult.courseComplete} onContinue={() => setScreen("home")} />
      )}

      {showShell && (
        <BottomNav active={screen} onNavigate={(key) => setScreen(key)} onOpenMenu={() => setIsMenuOpen(true)} menuOpen={isMenuOpen} />
      )}

      {isMenuOpen && (
        <MenuPopup
          onNavigate={handleMenuNavigate}
          onClose={() => setIsMenuOpen(false)}
          isDarkMode={isDarkMode}
          onToggleDark={() => setIsDarkMode((d) => !d)}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
