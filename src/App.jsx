import React, { useState, useEffect } from "react";
import {
  Heart, Gem, Flame, Lock, Check, X,
  TrendingUp, TrendingDown, Trophy, BookOpen, BarChart3,
  Sparkles, Award, Play, LayoutGrid, Brain, Crown, Settings as SettingsIcon,
  Sun, Moon, LogOut, MoreHorizontal, User, CheckCircle2, Edit3, RotateCcw, Target
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
  { id: 6, title: "Leitura de Gráficos", subtitle: "Pegadinhas, gatilhos e simulados", color: "#F97316", shadow: "#C2410C", icon: Target },
];

const LESSON_TITLES_BY_MODULE = {
  1: ["O que são Opções Binárias?", "Payout e Corretoras", "Linha vs Vela", "Revisão do Módulo", "Prática: Cenários Reais", "Aprofundando: Payout na Prática I", "Aprofundando: Payout na Prática II", "Aprofundando: Marubozu e Spinning Top", "Aprofundando: Corretoras na Prática", "Aprofundando: Revisão Avançada", "Cenários de Payout Avançados I", "Cenários de Payout Avançados II", "Erros Comuns de Iniciante", "Vela de Abertura do Dia", "Revisão Avançada II", "Risco de Ruína I", "Risco de Ruína II", "Regulamentação na Prática", "Simulando um Mês de Operações", "Revisão Avançada III", "Simulando Sequências de Perdas", "Comparando Estratégias na Prática", "Preparando-se para a Prova Final", "Cenário Integrado I", "Revisão Final do Módulo 1"],
  2: ["Suporte e Resistência", "LTA e LTB", "Canais de Alta e Baixa", "Revisão do Módulo", "Prática: Leitura de Zonas", "Aprofundando: Rompimento vs. Pullback I", "Aprofundando: Rompimento vs. Pullback II", "Aprofundando: Canais Mistos", "Aprofundando: Zonas Múltiplas", "Aprofundando: Revisão Avançada", "Zonas Psicológicas", "Tendência de Curto vs. Longo Prazo", "Rompimento com Retest I", "Rompimento com Retest II", "Revisão Avançada II", "Suporte e Resistência em Múltiplos Toques", "Linhas de Tendência de Longo Prazo", "Canais e Gerenciamento de Expectativa", "Identificando o Fim de uma Tendência", "Revisão Avançada III", "Suporte/Resistência em Ativos Diferentes", "Zonas de Congestão", "Comparando Timeframes na Análise Gráfica", "Cenário Integrado de Análise Gráfica", "Revisão Avançada IV"],
  3: ["Martelo e Enforcado", "Padrão de Engolfo", "Doji", "Pinbar & Revisão", "Prática: Reconhecimento de Padrões", "Aprofundando: Combinação de Padrões I", "Aprofundando: Combinação de Padrões II", "Aprofundando: Padrões em Contextos Diferentes I", "Aprofundando: Padrões em Contextos Diferentes II", "Aprofundando: Revisão Avançada", "Estrela da Manhã", "Estrela da Noite", "Três Soldados e Três Corvos", "Padrão Harami", "Revisão Avançada II", "Reconhecendo Padrões em Velocidade", "Padrões que Falham: Estudo de Caso", "Estrela da Manhã e da Noite na Prática", "Padrões e Gerenciamento Juntos", "Revisão Avançada III", "Combinando 3 ou Mais Sinais", "Padrões em Ativos Voláteis", "Simulado de Reconhecimento", "Preparando-se para a Prova Final", "Revisão Final do Módulo 3"],
  4: ["Índice de Força (RSI)", "Bandas de Bollinger", "Médias Móveis", "Revisão do Módulo", "Prática: Sinais Combinados", "Aprofundando: Divergências no RSI I", "Aprofundando: Divergências no RSI II", "Aprofundando: Confluência entre Indicadores I", "Aprofundando: Confluência entre Indicadores II", "Aprofundando: Revisão Avançada", "Introdução ao MACD", "Bollinger Squeeze", "Escolhendo o Indicador Certo", "Timeframe e Indicadores", "Revisão Avançada II", "Combinando MACD e RSI", "Falsos Sinais de Indicadores", "Indicadores e Notícias de Mercado", "Simulado de Indicadores Combinados", "Revisão Avançada III", "Indicadores em Diferentes Ativos", "O Erro de Usar Indicador Demais", "Simulado Final de Indicadores", "Preparando-se para a Prova Final", "Revisão Final do Módulo 4"],
  5: ["Gerenciamento de Banca", "Estratégia Soros", "Martingale: risco real", "Psicologia do Trader", "Prática: Decisões sob Pressão", "Aprofundando: Matemática da Banca I", "Aprofundando: Matemática da Banca II", "Aprofundando: Matemática do Martingale", "Aprofundando: Matemática do Soros", "Aprofundando: Revisão Avançada", "Definindo Metas Realistas", "Diversificação de Ativos", "Sinais de Burnout do Trader", "Montando seu Diário de Operações", "Revisão Avançada II", "Recuperação Emocional após Perdas", "Gestão de Expectativa com Iniciantes", "Comparando Soros e Martingale na Prática", "Simulado de Gestão Emocional", "Revisão Avançada III", "Construindo sua Rotina de Trader", "Erros de Gerenciamento Mais Comuns", "Simulado Final de Gestão", "Preparando-se para a Prova de Certificação", "Revisão Final do Módulo 5"],
  6: ["Leitura de Tendência Pura I", "Leitura de Tendência Pura II", "Estrutura de Topos e Fundos", "Identificando Lateralização", "Revisão: Leitura Estrutural", "Pegadinha: Falso Rompimento I", "Pegadinha: Falso Rompimento II", "Pegadinha: Quase-Padrão", "Pegadinha: Pavio de Notícia", "Revisão: Pegadinhas Clássicas", "Gatilho: Esperar o Fechamento", "Gatilho: Confluência Mínima", "Gatilho: Retest como Confirmação", "Gatilho: Força da Vela (Tamanho do Corpo)", "Revisão: Gatilhos de Entrada", "Simulado: Cenário Completo I", "Simulado: Cenário Completo II", "Simulado: Identificando a Armadilha", "Simulado: Decisão sob Múltiplos Sinais", "Revisão: Simulados de Mercado", "Simulado: Múltiplos Timeframes", "Simulado: Gerenciando o Erro", "Simulado Final: Cenário Misto", "Preparando-se para a Prova Final", "Revisão Final do Módulo 6"],
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


  /* ---------- LIÇÕES AVANÇADAS (LOTE 1) ---------- */
  "1-5": {
  "title": "Aprofundando: Payout na Prática I",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Payout em Cenários Reais",
      "body": "Payout não é um número fixo — ele varia por ativo, horário e volatilidade. Vamos praticar o cálculo em cenários diferentes para você nunca fazer conta errada na hora de decidir uma entrada.",
      "pipTip": "Prática é onde a teoria vira instinto. Vamos treinar juntos!"
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Você investe R$90,00 numa entrada com payout de 90% e acerta a direção. Qual o LUCRO dessa operação (sem contar a devolução do valor investido)?",
      "options": [
        "R$67,50",
        "R$90,00",
        "R$81,00",
        "R$181,00"
      ],
      "correct": 2,
      "explain": "90% de R$90,00 = R$81,00 de lucro. O valor investido também é devolvido, mas o lucro puro é esse."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Você investe R$90,00 numa entrada com payout de 85% e acerta a direção. Qual o LUCRO dessa operação (sem contar a devolução do valor investido)?",
      "options": [
        "R$76,50",
        "R$90,00",
        "R$176,50",
        "R$63,00"
      ],
      "correct": 0,
      "explain": "85% de R$90,00 = R$76,50 de lucro. O valor investido também é devolvido, mas o lucro puro é esse."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Ativos OTC (disponíveis fora do horário normal de mercado, como fins de semana) costumam ter payout:",
      "options": [
        "Sempre maior que ativos normais",
        "Geralmente menor ou mais instável, por terem menos liquidez",
        "Sempre exatamente igual",
        "Proibido por lei em qualquer corretora"
      ],
      "correct": 1,
      "explain": "Menos liquidez costuma significar payout mais baixo ou mais instável nos ativos OTC."
    }
  ]
},
  "1-6": {
  "title": "Aprofundando: Payout na Prática II",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Payout que Muda de Repente",
      "body": "Se o payout de um ativo cai de forma repentina, isso quase sempre reflete mudança de volatilidade ou liquidez naquele momento — não é erro do aplicativo.",
      "pipTip": "Como um camaleão, o mercado muda de cor o tempo todo — fique de olho."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Você investe R$60,00 numa entrada com payout de 85% e acerta a direção. Qual o LUCRO dessa operação (sem contar a devolução do valor investido)?",
      "options": [
        "R$60,00",
        "R$116,00",
        "R$51,00",
        "R$42,00"
      ],
      "correct": 2,
      "explain": "85% de R$60,00 = R$51,00 de lucro. O valor investido também é devolvido, mas o lucro puro é esse."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Você investe R$250,00 numa entrada com payout de 85% e acerta a direção. Qual o LUCRO dessa operação (sem contar a devolução do valor investido)?",
      "options": [
        "R$250,00",
        "R$212,50",
        "R$175,00",
        "R$467,50"
      ],
      "correct": 1,
      "explain": "85% de R$250,00 = R$212,50 de lucro. O valor investido também é devolvido, mas o lucro puro é esse."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Se o payout de um ativo cai de 90% para 75% de repente, isso geralmente indica:",
      "options": [
        "Erro do aplicativo",
        "Mudança na volatilidade ou liquidez daquele ativo naquele momento",
        "Que você foi banido da corretora",
        "Que o gráfico virou candlestick"
      ],
      "correct": 1,
      "explain": "Payout reflete condições de mercado em tempo real, não é um valor fixo e imutável."
    }
  ]
},
  "1-7": {
  "title": "Aprofundando: Marubozu e Spinning Top",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Variações Avançadas da Vela",
      "body": "Marubozu é uma vela sem nenhum pavio, corpo grande do início ao fim — indica domínio total de um lado (comprador ou vendedor). Spinning Top é um corpo pequeno com pavios parecidos dos dois lados, mas maior que um Doji — indica indecisão, porém menos extrema.",
      "pipTip": "Cada formato de vela conta uma parte diferente da história do mercado."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma vela sem nenhum pavio, com corpo grande do início ao fim, é chamada de:",
      "options": [
        "Marubozu",
        "Doji",
        "Pinbar",
        "Enforcado"
      ],
      "correct": 0,
      "explain": "Marubozu é a vela sem pavios, corpo dominante do início ao fim do período."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "O que uma vela Marubozu geralmente indica?",
      "options": [
        "Indecisão total do mercado",
        "Domínio total de um lado (comprador ou vendedor) durante todo o período",
        "Um erro no gráfico",
        "Fim do horário de mercado"
      ],
      "correct": 1,
      "explain": "Sem pavios, a vela mostra que um lado dominou do início ao fim, sem nenhuma rejeição."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um 'Spinning Top' (corpo pequeno com pavios parecidos dos dois lados, maior que um Doji) indica:",
      "options": [
        "Certeza de reversão imediata",
        "Indecisão, mas com menos equilíbrio extremo que um Doji",
        "Tendência forte de alta",
        "Tendência forte de baixa"
      ],
      "correct": 1,
      "explain": "O Spinning Top mostra disputa entre compradores e vendedores, sem o equilíbrio quase perfeito do Doji."
    }
  ]
},
  "1-8": {
  "title": "Aprofundando: Corretoras na Prática",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Avaliando uma Corretora de Verdade",
      "body": "Além de regulamentação e histórico de saques, vale avaliar: tempo médio de processamento de saque, suporte ao cliente responsivo, e transparência nas regras de payout.",
      "pipTip": "Escolher onde operar é como escolher onde viver — pesquise antes de se mudar."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma corretora que demora semanas para processar saques, mesmo pequenos, é um sinal de:",
      "options": [
        "Alerta — pode indicar problema de liquidez ou má-fé",
        "Normalidade total no mercado",
        "Que o payout vai aumentar",
        "Que você deve depositar mais"
      ],
      "correct": 0,
      "explain": "Demora excessiva e inconsistente em saques é um dos principais sinais de alerta sobre uma corretora."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Por que a transparência nas regras de payout é importante?",
      "options": [
        "Não é importante, payout é sempre igual",
        "Permite ao trader saber exatamente quanto pode ganhar antes de arriscar o capital",
        "Só importa para corretoras internacionais",
        "Serve apenas para fins de marketing"
      ],
      "correct": 1,
      "explain": "Saber a regra de payout antes de operar é essencial para o cálculo de risco e gerenciamento de banca."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Você investe R$180,00 numa entrada com payout de 88% e acerta a direção. Qual o LUCRO dessa operação (sem contar a devolução do valor investido)?",
      "options": [
        "R$343,40",
        "R$180,00",
        "R$131,40",
        "R$158,40"
      ],
      "correct": 3,
      "explain": "88% de R$180,00 = R$158,40 de lucro. O valor investido também é devolvido, mas o lucro puro é esse."
    }
  ]
},
  "1-9": {
  "title": "Aprofundando: Revisão Avançada de Fundamentos",
  "steps": [
    {
      "level": "Revisão · Módulo 1 Avançado",
      "type": "info",
      "title": "Consolidando o Avançado",
      "body": "Vamos revisar os pontos mais avançados de payout, corretoras e anatomia de vela antes de seguir adiante.",
      "pipTip": "Revisar é reforçar — repita até virar instinto."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Você investe R$120,00 numa entrada com payout de 82% e acerta a direção. Qual o LUCRO dessa operação (sem contar a devolução do valor investido)?",
      "options": [
        "R$98,40",
        "R$80,40",
        "R$223,40",
        "R$120,00"
      ],
      "correct": 0,
      "explain": "82% de R$120,00 = R$98,40 de lucro. O valor investido também é devolvido, mas o lucro puro é esse."
    },
    {
      "level": "Revisão · Módulo 1 Avançado",
      "type": "mcq",
      "question": "Uma vela Marubozu de alta, sem nenhum pavio, indica:",
      "options": [
        "Indecisão do mercado",
        "Domínio comprador do início ao fim do período",
        "Erro de gráfico",
        "Reversão automática"
      ],
      "correct": 1,
      "explain": "Marubozu sem pavios é sinal de força total de um lado durante todo o período."
    },
    {
      "level": "Revisão · Módulo 1 Avançado",
      "type": "mcq",
      "question": "O critério mais importante para confiar numa corretora é:",
      "options": [
        "O design do aplicativo",
        "Regulamentação e histórico consistente de saques",
        "Ter o maior número de ativos",
        "Aparecer em anúncios"
      ],
      "correct": 1,
      "explain": "Regulamentação e histórico de saques são a base da confiança numa corretora."
    }
  ]
},
  "2-5": {
  "title": "Aprofundando: Rompimento vs. Pullback I",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Pullback Não é Reversão",
      "body": "Um pullback normal dentro de uma tendência de alta faz o preço recuar temporariamente sem quebrar a estrutura de fundos ascendentes. Isso é diferente de uma reversão de verdade, que quebra essa estrutura.",
      "pipTip": "Um recuo temporário não é o fim da jornada — é só uma pausa para respirar."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um pullback normal dentro de uma tendência de alta faz o preço:",
      "options": [
        "Romper definitivamente a tendência",
        "Recuar temporariamente sem quebrar a estrutura de fundos ascendentes",
        "Virar lateral para sempre",
        "Reduzir o payout automaticamente"
      ],
      "correct": 1,
      "explain": "O pullback é um recuo saudável que respeita a estrutura da tendência."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Depois do recuo (pullback), o preço retoma a direção anterior sem quebrar a estrutura de fundos/topos. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 52,
            "c": 68,
            "h": 72,
            "l": 50
          },
          {
            "o": 68,
            "c": 80,
            "h": 84,
            "l": 67
          },
          {
            "o": 80,
            "c": 71,
            "h": 82,
            "l": 69
          },
          {
            "o": 71,
            "c": 80,
            "h": 85,
            "l": 68
          },
          {
            "o": 80,
            "c": 92,
            "h": 94,
            "l": 76
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Esse é um pullback saudável dentro da tendência — a estrutura de fundos/topos não foi quebrada, então a tendência tende a continuar."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Qual a principal diferença entre um pullback e uma reversão de tendência de verdade?",
      "options": [
        "Não há diferença nenhuma",
        "O pullback respeita a estrutura anterior (ex: fundo mais alto); a reversão quebra essa estrutura",
        "A reversão é sempre mais lenta que o pullback",
        "O pullback sempre vira Martingale"
      ],
      "correct": 1,
      "explain": "A estrutura de fundos/topos é o que diferencia um recuo saudável de uma reversão real."
    }
  ]
},
  "2-6": {
  "title": "Aprofundando: Rompimento vs. Pullback II",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Reconhecendo o Pullback em Tendência de Baixa",
      "body": "O mesmo conceito vale para tendências de baixa: um pullback (repique) que não rompe a estrutura de topos descendentes tende a ser seguido de continuação da queda.",
      "pipTip": "Em queda ou em alta, o princípio é o mesmo: respeite a estrutura antes de reagir."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Depois do recuo (pullback), o preço retoma a direção anterior sem quebrar a estrutura de fundos/topos. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 60,
            "c": 48,
            "h": 64,
            "l": 45
          },
          {
            "o": 48,
            "c": 32,
            "h": 50,
            "l": 28
          },
          {
            "o": 32,
            "c": 41,
            "h": 44,
            "l": 29
          },
          {
            "o": 41,
            "c": 32,
            "h": 46,
            "l": 30
          },
          {
            "o": 32,
            "c": 19,
            "h": 36,
            "l": 15
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "Esse é um pullback saudável dentro da tendência — a estrutura de fundos/topos não foi quebrada, então a tendência tende a continuar."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um pullback (repique) dentro de uma tendência de baixa, que não rompe a estrutura de topos descendentes, tende a ser seguido de:",
      "options": [
        "Reversão garantida para cima",
        "Continuação da tendência de baixa",
        "Aumento automático do payout",
        "Fim do gráfico"
      ],
      "correct": 1,
      "explain": "Se a estrutura de topos descendentes não é quebrada, a tendência de baixa tende a continuar."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "O que caracteriza uma quebra REAL de estrutura, diferente de um pullback comum?",
      "options": [
        "Um fundo mais alto numa tendência de alta",
        "Um fundo mais baixo que o anterior, quebrando a sequência ascendente",
        "Uma vela de qualquer cor",
        "Aumento do payout"
      ],
      "correct": 1,
      "explain": "Quando um novo fundo fica mais baixo que o anterior numa tendência de alta, a estrutura foi quebrada — isso é diferente de um pullback normal."
    }
  ]
},
  "2-7": {
  "title": "Aprofundando: Canais Mistos",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Quando o Canal Muda",
      "body": "Às vezes o preço rompe com força uma das bandas de um canal e não volta — isso sinaliza que o cenário mudou e as linhas antigas do canal já não valem mais.",
      "pipTip": "Insistir num canal antigo depois que o preço já seguiu outro caminho é um erro comum."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Se o preço rompe com força a banda inferior de um canal de alta e não retorna, o que o trader deve fazer?",
      "options": [
        "Insistir que ainda está no canal antigo",
        "Reconhecer que o cenário mudou e reavaliar suporte, resistência e tendência",
        "Dobrar a entrada imediatamente",
        "Ignorar o rompimento e continuar com as mesmas linhas"
      ],
      "correct": 1,
      "explain": "Quando a estrutura do canal é quebrada de verdade, é preciso reavaliar o gráfico do zero."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um canal pode ser considerado 'misto' quando:",
      "options": [
        "As duas bandas deixam de ser paralelas de forma consistente, sinalizando mudança de inclinação",
        "O payout muda de repente",
        "A vela vira um Doji",
        "O gráfico troca de cor"
      ],
      "correct": 0,
      "explain": "Quando as bandas perdem o paralelismo, o canal está se transformando — é hora de reavaliar."
    },
    {
      "level": "Nível 3 · Disciplina",
      "type": "mcq",
      "question": "Depois de um rompimento de canal confirmado (fechamento fora da banda, sem retorno), a atitude mais correta é:",
      "options": [
        "Forçar as mesmas linhas do canal antigo",
        "Traçar novos suportes e resistências considerando o novo comportamento do preço",
        "Parar de operar aquele ativo para sempre",
        "Aumentar o valor de todas as entradas seguintes"
      ],
      "correct": 1,
      "explain": "Reavaliar o gráfico com dados atuais é sempre melhor do que insistir numa estrutura que já não existe mais."
    }
  ]
},
  "2-8": {
  "title": "Aprofundando: Zonas Múltiplas",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Quando Várias Zonas se Encontram",
      "body": "Às vezes uma zona de suporte antiga coincide com uma LTA — quando isso acontece, a região fica ainda mais relevante, pois dois tipos de análise apontam para o mesmo lugar.",
      "pipTip": "Quando dois mapas apontam para o mesmo destino, a confiança na rota aumenta."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Quando uma zona de suporte horizontal coincide com uma LTA no mesmo ponto do gráfico, isso é chamado de:",
      "options": [
        "Coincidência sem valor nenhum",
        "Confluência entre dois tipos de análise, reforçando a força da região",
        "Um erro de leitura do gráfico",
        "Sinal de que o payout vai cair"
      ],
      "correct": 1,
      "explain": "Confluência entre diferentes ferramentas de análise técnica aumenta a confiabilidade da zona."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma zona de suporte que já foi testada 5 vezes E coincide com uma LTA é, na prática:",
      "options": [
        "Uma zona mais fraca que uma zona testada só 1 vez",
        "Uma zona particularmente forte, por acumular dois fatores de confirmação",
        "Irrelevante para a análise",
        "Só válida em gráficos de linha"
      ],
      "correct": 1,
      "explain": "Quantos mais fatores técnicos reforçam uma zona, mais peso ela tem na análise."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Depois do recuo (pullback), o preço retoma a direção anterior sem quebrar a estrutura de fundos/topos. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 55,
            "c": 68,
            "h": 69,
            "l": 53
          },
          {
            "o": 68,
            "c": 78,
            "h": 79,
            "l": 64
          },
          {
            "o": 78,
            "c": 70,
            "h": 79,
            "l": 69
          },
          {
            "o": 70,
            "c": 82,
            "h": 84,
            "l": 69
          },
          {
            "o": 82,
            "c": 96,
            "h": 98,
            "l": 80
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Esse é um pullback saudável dentro da tendência — a estrutura de fundos/topos não foi quebrada, então a tendência tende a continuar."
    }
  ]
},
  "2-9": {
  "title": "Aprofundando: Revisão Avançada de Análise Gráfica",
  "steps": [
    {
      "level": "Revisão · Módulo 2 Avançado",
      "type": "info",
      "title": "Consolidando o Avançado",
      "body": "Vamos revisar pullback, canais mistos e confluência de zonas antes de seguir para Candlestick avançado.",
      "pipTip": "Quanto mais você revisa, mais rápida fica a leitura do gráfico no dia a dia."
    },
    {
      "level": "Revisão · Módulo 2 Avançado",
      "type": "mcq",
      "question": "Um pullback saudável dentro de uma tendência:",
      "options": [
        "Sempre quebra a estrutura de fundos/topos",
        "Não quebra a estrutura de fundos/topos da tendência",
        "Reduz o payout",
        "Só acontece em gráficos de linha"
      ],
      "correct": 1,
      "explain": "O pullback, por definição, não quebra a estrutura da tendência vigente."
    },
    {
      "level": "Revisão · Módulo 2 Avançado",
      "type": "mcq",
      "question": "Confluência entre suporte horizontal e LTA no mesmo ponto:",
      "options": [
        "Enfraquece a análise",
        "Reforça a relevância técnica daquela região",
        "É sempre um erro de gráfico",
        "Não tem nenhum efeito prático"
      ],
      "correct": 1,
      "explain": "Confluência entre diferentes ferramentas técnicas sempre reforça a análise."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Depois do recuo (pullback), o preço retoma a direção anterior sem quebrar a estrutura de fundos/topos. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 60,
            "c": 48,
            "h": 64,
            "l": 46
          },
          {
            "o": 48,
            "c": 35,
            "h": 51,
            "l": 33
          },
          {
            "o": 35,
            "c": 43,
            "h": 45,
            "l": 33
          },
          {
            "o": 43,
            "c": 27,
            "h": 45,
            "l": 24
          },
          {
            "o": 27,
            "c": 18,
            "h": 32,
            "l": 16
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "Esse é um pullback saudável dentro da tendência — a estrutura de fundos/topos não foi quebrada, então a tendência tende a continuar."
    }
  ]
},
  "3-5": {
  "title": "Aprofundando: Combinação de Padrões I",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Quando Dois Padrões se Somam",
      "body": "Às vezes um Doji aparece seguido imediatamente por um Engolfo na mesma direção da reversão esperada — essa combinação reforça a confiabilidade do sinal, mais do que os dois padrões separados.",
      "pipTip": "Dois sinais concordando valem mais que um sinal isolado."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um Doji seguido imediatamente por uma vela de Engolfo na mesma direção da reversão esperada é:",
      "options": [
        "Um sinal mais fraco que os dois separados",
        "Uma combinação que reforça a confiabilidade do sinal de reversão",
        "Algo impossível de acontecer no mercado real",
        "Sinal de continuação, nunca de reversão"
      ],
      "correct": 1,
      "explain": "Padrões que se combinam na mesma direção aumentam a confiança da leitura."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Depois de uma tendência de alta, surge um Doji perto do topo e, na sequência, uma vela de Engolfo de Baixa forte. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 36,
            "c": 48,
            "h": 50,
            "l": 35
          },
          {
            "o": 48,
            "c": 61,
            "h": 66,
            "l": 43
          },
          {
            "o": 61,
            "c": 76,
            "h": 78,
            "l": 57
          },
          {
            "o": 76,
            "c": 77,
            "h": 88,
            "l": 62
          },
          {
            "o": 78,
            "c": 69,
            "h": 81,
            "l": 67
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "O Doji já sinalizava indecisão, e o Engolfo de Baixa confirma com força a reversão — a combinação reforça o sinal de PUT."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um Martelo formado exatamente numa zona de suporte já testada antes é um exemplo de:",
      "options": [
        "Coincidência sem valor técnico",
        "Confluência entre padrão de candle e zona de preço",
        "Erro de leitura do gráfico",
        "Sinal de continuação de baixa"
      ],
      "correct": 1,
      "explain": "Padrão de candle + zona de preço reforçando a mesma direção é uma confluência clássica."
    }
  ]
},
  "3-6": {
  "title": "Aprofundando: Combinação de Padrões II",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "A Mesma Lógica, Direção Oposta",
      "body": "O mesmo princípio de combinação de padrões vale para reversões de baixa para alta: Doji perto do fundo seguido de Engolfo de Alta forte reforça o sinal de compra.",
      "pipTip": "A lógica se repete nos dois sentidos do mercado — treine reconhecer nos dois lados."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Depois de uma tendência de baixa, surge um Doji perto do fundo e, na sequência, uma vela de Engolfo de Alta forte. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 39,
            "c": 23,
            "h": 42,
            "l": 22
          },
          {
            "o": 23,
            "c": 8,
            "h": 26,
            "l": 7
          },
          {
            "o": 8,
            "c": -4,
            "h": 10,
            "l": -7
          },
          {
            "o": -4,
            "c": -5,
            "h": 8,
            "l": -18
          },
          {
            "o": -8,
            "c": 3,
            "h": 6,
            "l": -9
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "O Doji sinalizou indecisão no fundo, e o Engolfo de Alta confirma a reversão para cima com força."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Por que a combinação de dois padrões reforça mais a decisão do que um padrão isolado?",
      "options": [
        "Porque aumenta o payout automaticamente",
        "Porque múltiplos sinais concordando reduzem a chance de um falso sinal isolado",
        "Não reforça nada, é só coincidência",
        "Porque garante 100% de acerto"
      ],
      "correct": 1,
      "explain": "Múltiplos sinais concordando reduzem — mas não eliminam — a chance de um sinal ser falso."
    }
  ]
},
  "3-7": {
  "title": "Aprofundando: Padrões em Contextos Diferentes I",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "O Mesmo Padrão, Pesos Diferentes",
      "body": "Um Martelo que aparece no MEIO de uma tendência de alta forte (sem tendência de baixa prévia) carrega menos peso do que um Martelo depois de uma queda longa e esticada.",
      "pipTip": "O contexto muda o significado — até para o mesmo padrão de sempre."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um Martelo que aparece no MEIO de uma tendência de alta forte (sem tendência de baixa anterior) tem:",
      "options": [
        "O mesmo peso que um Martelo após uma queda longa",
        "Menos relevância, pois o contexto de reversão de baixa não está presente",
        "Payout maior automaticamente",
        "Nenhum Martelo pode aparecer nesse contexto"
      ],
      "correct": 1,
      "explain": "Sem uma tendência de baixa prévia, o Martelo perde parte do seu significado de reversão."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um Engolfo de Baixa depois de uma tendência de alta MUITO longa e esticada tende a ser:",
      "options": [
        "Irrelevante para a análise",
        "Mais significativo, pois surge após um movimento exagerado propenso à correção",
        "Sempre um sinal falso",
        "Só válido em gráfico de linha"
      ],
      "correct": 1,
      "explain": "Movimentos muito esticados tendem a reagir com mais força a sinais de reversão."
    }
  ]
},
  "3-8": {
  "title": "Aprofundando: Padrões em Contextos Diferentes II",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Sempre Considere o Cenário Completo",
      "body": "A leitura de padrões de candlestick nunca deve ser feita isoladamente — o contexto de tendência e a localização (zona de preço) onde o padrão aparece mudam completamente seu peso.",
      "pipTip": "Um padrão sem contexto é só uma forma bonita no gráfico — o contexto é o que dá significado."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "A leitura de padrões de candlestick deve sempre considerar:",
      "options": [
        "Só a cor da vela",
        "O contexto de tendência e a localização (zona de preço) onde o padrão aparece",
        "Só o horário do dia",
        "Só o nome do ativo"
      ],
      "correct": 1,
      "explain": "Contexto de tendência e localização são fundamentais para interpretar corretamente qualquer padrão."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Um Pinbar de baixa (pavio superior longo) se forma exatamente numa resistência forte, depois de uma tendência de alta esticada. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 35,
            "c": 50,
            "h": 51,
            "l": 32
          },
          {
            "o": 50,
            "c": 62,
            "h": 64,
            "l": 49
          },
          {
            "o": 62,
            "c": 77,
            "h": 78,
            "l": 61
          },
          {
            "o": 77,
            "c": 91,
            "h": 93,
            "l": 75
          },
          {
            "o": 93,
            "c": 90,
            "h": 123,
            "l": 87
          }
        ],
        "lines": [
          {
            "label": "Resistência",
            "color": "#EA3943",
            "points": [
              {
                "xFrac": 0,
                "value": 121
              },
              {
                "xFrac": 1,
                "value": 121
              }
            ]
          }
        ]
      },
      "correct": "PUT",
      "explain": "Pinbar de baixa numa resistência, após tendência esticada, é um dos setups mais fortes de reversão — combinação de padrão + zona + contexto."
    }
  ]
},
  "3-9": {
  "title": "Aprofundando: Revisão Avançada de Candlestick",
  "steps": [
    {
      "level": "Revisão · Módulo 3 Avançado",
      "type": "info",
      "title": "Consolidando o Avançado",
      "body": "Vamos revisar combinações de padrões e o peso do contexto antes de seguir para Indicadores avançado.",
      "pipTip": "Padrão + contexto + zona: essa é a tríade que você deve sempre observar."
    },
    {
      "level": "Revisão · Módulo 3 Avançado",
      "type": "mcq",
      "question": "Um Doji seguido de um Engolfo na mesma direção:",
      "options": [
        "Enfraquece o sinal",
        "Reforça a confiabilidade da reversão",
        "Não tem nenhum efeito",
        "Só vale em gráfico de linha"
      ],
      "correct": 1,
      "explain": "A combinação de padrões concordando reforça a confiabilidade do sinal."
    },
    {
      "level": "Revisão · Módulo 3 Avançado",
      "type": "mcq",
      "question": "Um padrão de candlestick deve ser lido:",
      "options": [
        "Isoladamente, sem olhar o resto do gráfico",
        "Sempre considerando o contexto de tendência e a zona de preço",
        "Só pelo nome do padrão",
        "Só pela cor da vela"
      ],
      "correct": 1,
      "explain": "Contexto e zona de preço são essenciais para interpretar corretamente qualquer padrão de candlestick."
    }
  ]
},
  "4-5": {
  "title": "Aprofundando: Divergências no RSI I",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "O que é Divergência",
      "body": "Divergência de baixa: o preço faz uma máxima mais alta, mas o RSI faz uma máxima mais baixa — sinal de enfraquecimento da força compradora, mesmo com o preço subindo.",
      "pipTip": "Quando o preço e o momentum discordam, vale a pena prestar atenção."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "O que é uma divergência de baixa no RSI?",
      "options": [
        "Preço e RSI sempre concordam perfeitamente",
        "O preço faz uma máxima mais alta, mas o RSI faz uma máxima mais baixa",
        "O RSI sobe sempre junto com o preço",
        "Um erro de cálculo do indicador"
      ],
      "correct": 1,
      "explain": "A divergência de baixa mostra um descompasso entre o novo topo de preço e o enfraquecimento do RSI."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "O preço faz uma nova máxima, esticado, mas o RSI mostra sinais de enfraquecimento (78, perto do limite de sobrecompra). Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 42,
            "c": 57,
            "h": 58,
            "l": 37
          },
          {
            "o": 57,
            "c": 67,
            "h": 72,
            "l": 56
          },
          {
            "o": 67,
            "c": 81,
            "h": 83,
            "l": 63
          },
          {
            "o": 81,
            "c": 91,
            "h": 92,
            "l": 77
          },
          {
            "o": 92,
            "c": 90,
            "h": 114,
            "l": 87
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "RSI perto da sobrecompra num novo topo de preço reforça a chance de correção — entrada em PUT.",
      "rsi": 78
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Por que a divergência é considerada um sinal relativamente forte?",
      "options": [
        "Porque é fácil de calcular",
        "Porque mostra um descompasso entre o movimento de preço e o momentum real, sugerindo enfraquecimento",
        "Porque garante 100% de acerto",
        "Porque aumenta o payout automaticamente"
      ],
      "correct": 1,
      "explain": "A divergência revela que o movimento de preço não está mais sendo acompanhado pela força real do momentum."
    }
  ]
},
  "4-6": {
  "title": "Aprofundando: Divergências no RSI II",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Divergência de Alta",
      "body": "Divergência de alta: o preço faz uma mínima mais baixa, mas o RSI faz uma mínima mais alta — sinal de enfraquecimento da força vendedora, mesmo com o preço ainda caindo.",
      "pipTip": "O mesmo princípio vale nos dois sentidos do mercado."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma divergência de alta (bullish) no RSI acontece quando:",
      "options": [
        "O preço faz uma mínima mais baixa, mas o RSI faz uma mínima mais alta",
        "O preço e o RSI caem juntos sempre",
        "Isso nunca acontece na prática",
        "É o mesmo que sobrecompra"
      ],
      "correct": 0,
      "explain": "A divergência de alta mostra enfraquecimento da força vendedora mesmo com preço em novo fundo."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "O preço faz uma nova mínima, esticado, mas o RSI mostra sinais de enfraquecimento vendedor (22, perto da sobrevenda). Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 78,
            "c": 67,
            "h": 80,
            "l": 65
          },
          {
            "o": 67,
            "c": 56,
            "h": 70,
            "l": 52
          },
          {
            "o": 56,
            "c": 43,
            "h": 61,
            "l": 42
          },
          {
            "o": 43,
            "c": 30,
            "h": 46,
            "l": 25
          },
          {
            "o": 27,
            "c": 30,
            "h": 31,
            "l": 6
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "RSI perto da sobrevenda num novo fundo de preço reforça a chance de repique — entrada em CALL.",
      "rsi": 22
    }
  ]
},
  "4-7": {
  "title": "Aprofundando: Confluência entre Indicadores I",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Somando Indicadores",
      "body": "Combinar RSI + Bollinger + Média Móvel dá mais confiabilidade que usar qualquer um sozinho. Ex: RSI sobrevendido + preço na banda inferior + vela de rejeição = forte confluência de alta.",
      "pipTip": "Um indicador é uma opinião. Três indicadores concordando são um coro."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "RSI em 25, preço tocando a banda inferior de Bollinger, e uma vela de rejeição no mesmo ponto. Isso é um exemplo de:",
      "options": [
        "Sinais contraditórios que se anulam",
        "Forte confluência entre indicador, banda e padrão de candle, apontando para possível alta",
        "Um erro de gráfico",
        "Necessidade de usar Martingale"
      ],
      "correct": 1,
      "explain": "Três sinais independentes concordando é uma confluência forte, aumentando a probabilidade da análise."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Se o RSI está em zona neutra (50) mas o preço toca a banda inferior de Bollinger, a leitura correta é:",
      "options": [
        "Confluência perfeita, entrar com confiança máxima",
        "Sinal parcial — falta a confirmação do RSI para reforçar a entrada",
        "Ignorar completamente a banda de Bollinger",
        "Payout automaticamente maior"
      ],
      "correct": 1,
      "explain": "Sem a confirmação do RSI, o sinal fica mais fraco — é prudente esperar mais confluência."
    }
  ]
},
  "4-8": {
  "title": "Aprofundando: Confluência entre Indicadores II",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Por que Combinar Vale a Pena",
      "body": "Usar múltiplos indicadores reduz — mas não elimina — a chance de falsos sinais, pois exige que várias ferramentas diferentes concordem antes de você entrar.",
      "pipTip": "Confluência não é sobre certeza absoluta — é sobre aumentar as chances a seu favor."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Qual a vantagem de combinar RSI, Bollinger e Médias Móveis em vez de usar só um?",
      "options": [
        "Não há vantagem real",
        "Reduz a chance de falsos sinais, já que múltiplos indicadores concordando aumenta a probabilidade",
        "Sempre garante lucro",
        "Deixa o gráfico mais bonito"
      ],
      "correct": 1,
      "explain": "Múltiplos indicadores concordando aumentam a probabilidade da análise estar correta."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "RSI em 76 (quase sobrecompra), preço tocando a banda superior de Bollinger, e um Pinbar de baixa se formando. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 43,
            "c": 53,
            "h": 57,
            "l": 39
          },
          {
            "o": 53,
            "c": 68,
            "h": 73,
            "l": 51
          },
          {
            "o": 68,
            "c": 83,
            "h": 84,
            "l": 63
          },
          {
            "o": 83,
            "c": 95,
            "h": 98,
            "l": 82
          },
          {
            "o": 98,
            "c": 94,
            "h": 123,
            "l": 91
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "Três sinais reforçando reversão para baixo ao mesmo tempo: RSI alto, banda superior e Pinbar de baixa — forte confluência de PUT.",
      "rsi": 76
    }
  ]
},
  "4-9": {
  "title": "Aprofundando: Revisão Avançada de Indicadores",
  "steps": [
    {
      "level": "Revisão · Módulo 4 Avançado",
      "type": "info",
      "title": "Consolidando o Avançado",
      "body": "Vamos revisar divergência e confluência de indicadores antes de seguir para Gestão avançada.",
      "pipTip": "Indicadores são apoio — a decisão final sempre vem da leitura completa do cenário."
    },
    {
      "level": "Revisão · Módulo 4 Avançado",
      "type": "mcq",
      "question": "Uma divergência de baixa no RSI acontece quando:",
      "options": [
        "Preço e RSI sobem sempre juntos",
        "O preço faz máxima mais alta, mas o RSI faz máxima mais baixa",
        "O RSI está sempre em 50",
        "É a mesma coisa que sobrevenda"
      ],
      "correct": 1,
      "explain": "Divergência de baixa é o descompasso entre novo topo de preço e enfraquecimento do RSI."
    },
    {
      "level": "Revisão · Módulo 4 Avançado",
      "type": "mcq",
      "question": "A maior vantagem de combinar vários indicadores é:",
      "options": [
        "Deixar o gráfico mais bonito",
        "Aumentar a probabilidade da análise ao exigir concordância entre ferramentas diferentes",
        "Garantir 100% de acerto",
        "Reduzir o payout"
      ],
      "correct": 1,
      "explain": "Confluência entre indicadores aumenta — mas nunca garante — a probabilidade de acerto."
    }
  ]
},
  "5-5": {
  "title": "Aprofundando: Matemática da Banca I",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Praticando os Números do Gerenciamento",
      "body": "Gerenciamento de banca não é teoria abstrata — é matemática simples aplicada com disciplina. Vamos praticar os cálculos que você vai usar toda vez que for decidir o valor de uma entrada.",
      "pipTip": "Quem não calcula o risco, está apenas apostando, não operando."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Sua banca é de R$800,00 e você segue a regra de 2% por entrada. Qual o valor máximo recomendado de cada entrada?",
      "options": [
        "R$16,00",
        "R$800,00",
        "R$32,00",
        "R$8,00"
      ],
      "correct": 0,
      "explain": "2% de R$800,00 = R$16,00. Esse é o valor máximo recomendado por entrada nesse cenário."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Sua banca é de R$3.000,00 e você segue a regra de 2.5% por entrada. Qual o valor máximo recomendado de cada entrada?",
      "options": [
        "R$75,00",
        "R$150,00",
        "R$3.000,00",
        "R$37,50"
      ],
      "correct": 0,
      "explain": "2.5% de R$3.000,00 = R$75,00. Esse é o valor máximo recomendado por entrada nesse cenário."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Se você arrisca 10% da banca por entrada em vez de 2%, o risco de 'quebrar' a banca numa sequência ruim de perdas é:",
      "options": [
        "O mesmo de sempre",
        "Muito maior, pois cada perda consome uma fatia bem maior do capital",
        "Menor, pois a entrada é mais decisiva",
        "Não muda nada na prática"
      ],
      "correct": 1,
      "explain": "Quanto maior o percentual arriscado por entrada, mais rápido uma sequência de perdas pode esgotar a banca."
    }
  ]
},
  "5-6": {
  "title": "Aprofundando: Matemática da Banca II",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Recalculando com a Banca Nova",
      "body": "Depois de uma sequência de vitórias que aumentou sua banca, o valor de entrada (em reais) deve ser recalculado com base no NOVO tamanho da banca, sempre mantendo o mesmo percentual de risco.",
      "pipTip": "A régua muda de tamanho — os princípios continuam os mesmos."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Sua banca é de R$500,00 e você segue a regra de 2.5% por entrada. Qual o valor máximo recomendado de cada entrada?",
      "options": [
        "R$25,00",
        "R$12,50",
        "R$6,25",
        "R$500,00"
      ],
      "correct": 1,
      "explain": "2.5% de R$500,00 = R$12,50. Esse é o valor máximo recomendado por entrada nesse cenário."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Depois de uma sequência de vitórias que dobrou sua banca, a atitude mais prudente é:",
      "options": [
        "Recalcular o valor de entrada com base no novo tamanho da banca, mantendo o mesmo % de risco",
        "Manter o valor de entrada fixo em reais para sempre",
        "Arriscar tudo de uma vez para acelerar ainda mais",
        "Parar de usar gerenciamento, já que está ganhando"
      ],
      "correct": 0,
      "explain": "O percentual de risco deve ser mantido constante, mas o valor em reais precisa ser recalculado conforme a banca cresce (ou diminui)."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Sua banca é de R$3.000,00 e você segue a regra de 2% por entrada. Qual o valor máximo recomendado de cada entrada?",
      "options": [
        "R$120,00",
        "R$30,00",
        "R$60,00",
        "R$3.000,00"
      ],
      "correct": 2,
      "explain": "2% de R$3.000,00 = R$60,00. Esse é o valor máximo recomendado por entrada nesse cenário."
    }
  ]
},
  "5-7": {
  "title": "Aprofundando: Matemática do Martingale",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Vendo o Crescimento na Prática",
      "body": "Fazer as contas do Martingale na prática é a melhor forma de entender por que ele é tão perigoso — o crescimento exponencial surpreende até quem já ouviu falar da estratégia antes.",
      "pipTip": "Números não mentem — faça a conta antes de confiar na estratégia."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Partindo de R$10,00 e dobrando a cada perda (R$10,00, R$20,00, R$40,00, R$80,00...), depois de 4 perdas seguidas, qual o valor da entrada seguinte?",
      "options": [
        "R$80,00",
        "R$320,00",
        "R$160,00",
        "R$40,00"
      ],
      "correct": 2,
      "explain": "A sequência dobra a cada perda. Depois de 4 perdas a partir de R$10,00, a próxima entrada exige R$160,00 — crescimento exponencial."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Partindo de R$10,00 e dobrando a cada perda (R$10,00, R$20,00, R$40,00, R$80,00...), depois de 4 perdas seguidas, qual o valor da entrada seguinte?",
      "options": [
        "R$80,00",
        "R$160,00",
        "R$320,00",
        "R$40,00"
      ],
      "correct": 1,
      "explain": "A sequência dobra a cada perda. Depois de 4 perdas a partir de R$10,00, a próxima entrada exige R$160,00 — crescimento exponencial."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Por que o crescimento do Martingale é chamado de 'exponencial'?",
      "options": [
        "Porque cresce devagar e de forma linear",
        "Porque o valor dobra a cada perda, crescendo cada vez mais rápido",
        "Porque o payout aumenta a cada rodada",
        "Porque a banca dobra automaticamente"
      ],
      "correct": 1,
      "explain": "Crescimento exponencial significa que o valor dobra repetidamente, acelerando de forma extrema em poucas rodadas."
    }
  ]
},
  "5-8": {
  "title": "Aprofundando: Matemática do Soros",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Calculando o Reinvestimento",
      "body": "Fazer a conta do Soros corretamente evita erros na hora de decidir quanto reinvestir — o valor certo é sempre o original somado ao lucro da rodada anterior.",
      "pipTip": "Reinvestir o valor errado pode transformar uma boa estratégia num problema."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Você entra com R$50,00, payout de 88%, e acerta. No Soros nível 1, qual valor você reinveste na próxima entrada?",
      "options": [
        "R$104,00",
        "R$44,00",
        "R$94,00",
        "R$50,00"
      ],
      "correct": 2,
      "explain": "No Soros, reinveste-se o valor original + o lucro: R$50,00 + R$44,00 = R$94,00."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Você entra com R$30,00, payout de 92%, e acerta. No Soros nível 1, qual valor você reinveste na próxima entrada?",
      "options": [
        "R$57,60",
        "R$27,60",
        "R$30,00",
        "R$62,60"
      ],
      "correct": 0,
      "explain": "No Soros, reinveste-se o valor original + o lucro: R$30,00 + R$27,60 = R$57,60."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Se você erra a conta do Soros e reinveste menos do que deveria, o que acontece?",
      "options": [
        "Nada, o resultado é sempre o mesmo",
        "Você simplesmente cresce mais devagar do que o ciclo de Soros planejado, mas sem risco extra",
        "A corretora bloqueia sua conta",
        "O payout aumenta automaticamente"
      ],
      "correct": 1,
      "explain": "Reinvestir menos que o correto não é perigoso — só reduz o ritmo de crescimento do ciclo de Soros."
    }
  ]
},
  "5-9": {
  "title": "Aprofundando: Revisão Avançada de Gestão",
  "steps": [
    {
      "level": "Revisão · Módulo 5 Avançado",
      "type": "info",
      "title": "Consolidando o Avançado",
      "body": "Vamos revisar a matemática de banca, Martingale e Soros antes de seguir para o módulo de leitura de gráficos.",
      "pipTip": "Números claros na cabeça evitam decisões erradas no calor do momento."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Sua banca é de R$1.500,00 e você segue a regra de 2% por entrada. Qual o valor máximo recomendado de cada entrada?",
      "options": [
        "R$60,00",
        "R$1.500,00",
        "R$30,00",
        "R$15,00"
      ],
      "correct": 2,
      "explain": "2% de R$1.500,00 = R$30,00. Esse é o valor máximo recomendado por entrada nesse cenário."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Partindo de R$15,00 e dobrando a cada perda (R$15,00, R$30,00, R$60,00, R$120,00, R$240,00...), depois de 5 perdas seguidas, qual o valor da entrada seguinte?",
      "options": [
        "R$960,00",
        "R$480,00",
        "R$240,00",
        "R$75,00"
      ],
      "correct": 1,
      "explain": "A sequência dobra a cada perda. Depois de 5 perdas a partir de R$15,00, a próxima entrada exige R$480,00 — crescimento exponencial."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Você entra com R$40,00, payout de 92%, e acerta. No Soros nível 1, qual valor você reinveste na próxima entrada?",
      "options": [
        "R$86,80",
        "R$40,00",
        "R$36,80",
        "R$76,80"
      ],
      "correct": 3,
      "explain": "No Soros, reinveste-se o valor original + o lucro: R$40,00 + R$36,80 = R$76,80."
    }
  ]
},
  "6-0": {
  "title": "Leitura de Tendência Pura I",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Lendo Tendência sem Indicadores",
      "body": "Antes de qualquer indicador, o gráfico já conta a história: uma sequência de fundos cada vez mais altos é tendência de alta; topos cada vez mais baixos é tendência de baixa. Vamos treinar só essa leitura estrutural, sem nenhum apoio visual extra.",
      "pipTip": "A estrutura do preço é a linguagem mais antiga do mercado — antes de qualquer indicador existir."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma sequência de topos e fundos cada vez mais altos, sem nenhum indicador no gráfico, caracteriza uma tendência de:",
      "options": [
        "Baixa",
        "Alta",
        "Lateral obrigatória",
        "Reversão automática"
      ],
      "correct": 1,
      "explain": "Fundos e topos ascendentes é a definição estrutural de uma tendência de alta."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Observando só a estrutura de preço, sem nenhum indicador, qual a entrada mais alinhada com essa tendência?",
      "chart": {
        "candles": [
          {
            "o": 36,
            "c": 50,
            "h": 54,
            "l": 33
          },
          {
            "o": 50,
            "c": 61,
            "h": 65,
            "l": 46
          },
          {
            "o": 61,
            "c": 52,
            "h": 62,
            "l": 49
          },
          {
            "o": 52,
            "c": 63,
            "h": 66,
            "l": 51
          },
          {
            "o": 63,
            "c": 77,
            "h": 81,
            "l": 60
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "A estrutura de fundos ascendentes, respeitada até aqui, favorece a continuação da tendência de alta — entrada em CALL."
    }
  ]
},
  "6-1": {
  "title": "Leitura de Tendência Pura II",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "A Mesma Leitura, Sentido Oposto",
      "body": "O mesmo princípio vale para quedas: uma sequência de topos e fundos cada vez mais baixos, sem nenhum indicador, já é suficiente para reconhecer uma tendência de baixa.",
      "pipTip": "Treinar os dois sentidos da estrutura é o que te deixa rápido na hora de decidir."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Observando só a estrutura de preço, sem nenhum indicador, qual a entrada mais alinhada com essa tendência?",
      "chart": {
        "candles": [
          {
            "o": 38,
            "c": 23,
            "h": 39,
            "l": 19
          },
          {
            "o": 23,
            "c": 13,
            "h": 27,
            "l": 11
          },
          {
            "o": 13,
            "c": 23,
            "h": 24,
            "l": 10
          },
          {
            "o": 23,
            "c": 11,
            "h": 25,
            "l": 7
          },
          {
            "o": 11,
            "c": -4,
            "h": 16,
            "l": -7
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "A estrutura de topos descendentes, respeitada até aqui, favorece a continuação da tendência de baixa — entrada em PUT."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Se o gráfico não mostra nem topos/fundos ascendentes nem descendentes de forma clara, o mercado provavelmente está:",
      "options": [
        "Em tendência de alta forte",
        "Lateral, sem tendência definida",
        "Sempre em tendência de baixa",
        "Prestes a dobrar o payout"
      ],
      "correct": 1,
      "explain": "Sem uma sequência clara de topos/fundos numa direção, o mercado costuma estar em lateralização."
    }
  ]
},
  "6-2": {
  "title": "Estrutura de Topos e Fundos",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "O Alfabeto da Análise Gráfica",
      "body": "Cada fundo mais alto que o anterior é uma 'letra' confirmando a tendência de alta. Quando essa sequência para de se repetir, é o primeiro aviso de que algo pode estar mudando.",
      "pipTip": "Ler topos e fundos é o primeiro alfabeto que todo trader deveria dominar."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "O primeiro aviso de que uma tendência de alta pode estar enfraquecendo é:",
      "options": [
        "Um novo topo mais alto que o anterior",
        "Um novo fundo mais baixo que o anterior, quebrando a sequência ascendente",
        "O payout aumentar",
        "A vela ficar verde"
      ],
      "correct": 1,
      "explain": "Quando um fundo fica mais baixo que o anterior, a sequência estrutural da tendência de alta é quebrada."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "A estrutura de fundos ascendentes segue intacta e o preço acabou de formar mais um fundo mais alto que o anterior. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 39,
            "c": 54,
            "h": 59,
            "l": 38
          },
          {
            "o": 54,
            "c": 64,
            "h": 66,
            "l": 49
          },
          {
            "o": 64,
            "c": 55,
            "h": 65,
            "l": 53
          },
          {
            "o": 55,
            "c": 69,
            "h": 70,
            "l": 52
          },
          {
            "o": 69,
            "c": 79,
            "h": 80,
            "l": 66
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Fundo mais alto respeitando a estrutura reforça a continuidade da tendência de alta — entrada em CALL."
    }
  ]
},
  "6-3": {
  "title": "Identificando Lateralização",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Quando o Mercado Não Decide",
      "body": "Mercado lateral é quando o preço oscila dentro de uma faixa, sem formar fundos ou topos claramente ascendentes ou descendentes. Operar tendência dentro de uma lateralização costuma gerar mais sinais falsos.",
      "pipTip": "Quando o mercado não decide, o trader disciplinado também espera."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Operar como se houvesse tendência, dentro de um mercado lateral, tende a:",
      "options": [
        "Aumentar a taxa de acerto",
        "Gerar mais sinais falsos, pois não há uma direção estrutural clara",
        "Não fazer diferença nenhuma",
        "Ser sempre mais seguro que operar tendência real"
      ],
      "correct": 1,
      "explain": "Sem uma direção estrutural clara, tentar operar como se houvesse tendência aumenta o risco de sinais falsos."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "A estrutura de topos descendentes segue intacta e o preço acabou de formar mais um topo mais baixo que o anterior. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 44,
            "c": 32,
            "h": 47,
            "l": 29
          },
          {
            "o": 32,
            "c": 20,
            "h": 36,
            "l": 18
          },
          {
            "o": 20,
            "c": 28,
            "h": 29,
            "l": 17
          },
          {
            "o": 28,
            "c": 12,
            "h": 33,
            "l": 8
          },
          {
            "o": 12,
            "c": 3,
            "h": 13,
            "l": 2
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "Topo mais baixo respeitando a estrutura reforça a continuidade da tendência de baixa — entrada em PUT."
    }
  ]
},
  "6-4": {
  "title": "Revisão: Leitura Estrutural",
  "steps": [
    {
      "level": "Revisão · Módulo 6",
      "type": "info",
      "title": "Consolidando a Leitura Estrutural",
      "body": "Antes de avançar para as pegadinhas clássicas do mercado, vamos revisar os conceitos de estrutura de tendência que você acabou de aprender.",
      "pipTip": "Uma boa base estrutural é o que sustenta todas as próximas lições deste módulo."
    },
    {
      "level": "Revisão · Módulo 6",
      "type": "mcq",
      "question": "Uma tendência de alta se caracteriza estruturalmente por:",
      "options": [
        "Topos e fundos cada vez mais baixos",
        "Topos e fundos cada vez mais altos",
        "Ausência total de padrão",
        "Payout sempre crescente"
      ],
      "correct": 1,
      "explain": "Topos e fundos ascendentes definem estruturalmente uma tendência de alta."
    },
    {
      "level": "Revisão · Módulo 6",
      "type": "mcq",
      "question": "Um mercado lateral se caracteriza por:",
      "options": [
        "Fundos e topos claramente ascendentes",
        "Fundos e topos claramente descendentes",
        "Preço oscilando numa faixa, sem tendência estrutural clara",
        "Vela sempre verde"
      ],
      "correct": 2,
      "explain": "A lateralização acontece quando o preço não forma uma sequência clara de topos/fundos numa direção."
    },
    {
      "level": "Revisão · Módulo 6",
      "type": "mcq",
      "question": "O primeiro sinal de enfraquecimento de uma tendência de baixa é:",
      "options": [
        "Um novo topo mais baixo que o anterior",
        "Um novo topo mais alto que o anterior, quebrando a sequência descendente",
        "O RSI ficar em 50",
        "A vela virar Doji sempre"
      ],
      "correct": 1,
      "explain": "Quando um topo fica mais alto que o anterior, a sequência estrutural da tendência de baixa é quebrada."
    }
  ]
},


  /* ---------- LIÇÕES AVANÇADAS (LOTE 2) ---------- */
  "1-10": {
  "title": "Cenários de Payout Avançados I",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Comparando Corretoras na Prática",
      "body": "Nem sempre a corretora com o payout mais alto é a melhor escolha — mas entender a diferença em reais ajuda a pesar isso contra regulamentação e histórico de saques.",
      "pipTip": "Números claros ajudam a decidir com a cabeça, não só com a emoção."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Corretora A paga 80% e Corretora B paga 95% sobre uma entrada de R$80,00. Qual a diferença de lucro entre elas, em caso de acerto?",
      "options": [
        "R$12,00",
        "R$76,00",
        "R$24,00",
        "R$64,00"
      ],
      "correct": 0,
      "explain": "Lucro na A: R$64,00. Lucro na B: R$76,00. Diferença: R$12,00."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Corretora A paga 78% e Corretora B paga 88% sobre uma entrada de R$200,00. Qual a diferença de lucro entre elas, em caso de acerto?",
      "options": [
        "R$156,00",
        "R$20,00",
        "R$176,00",
        "R$40,00"
      ],
      "correct": 1,
      "explain": "Lucro na A: R$156,00. Lucro na B: R$176,00. Diferença: R$20,00."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Se a diferença de payout entre duas corretoras é pequena, mas uma tem histórico de saque muito melhor, a escolha mais sensata é:",
      "options": [
        "Sempre a de maior payout, sem exceção",
        "Considerar o conjunto: payout, regulamentação e saques — não só um número isolado",
        "Abrir conta nas duas e nunca sacar",
        "Ignorar completamente o payout"
      ],
      "correct": 1,
      "explain": "A decisão deve considerar o conjunto de fatores, não apenas o payout isolado."
    }
  ]
},
  "1-11": {
  "title": "Cenários de Payout Avançados II",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Tipos de Expiração",
      "body": "Operações de expiração muito curta (ex: 1 minuto) sofrem mais com ruído de curto prazo. Expirações um pouco mais longas tendem a filtrar parte desse ruído, dando mais tempo para o sinal se confirmar.",
      "pipTip": "Tempo demais pode fazer você perder a entrada; tempo de menos pode te deixar refém do ruído."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Corretora A paga 82% e Corretora B paga 97% sobre uma entrada de R$80,00. Qual a diferença de lucro entre elas, em caso de acerto?",
      "options": [
        "R$12,00",
        "R$65,60",
        "R$77,60",
        "R$24,00"
      ],
      "correct": 0,
      "explain": "Lucro na A: R$65,60. Lucro na B: R$77,60. Diferença: R$12,00."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Operações de expiração muito curta (ex: 1 minuto) tendem a sofrer mais com:",
      "options": [
        "Ruído de curto prazo, tornando os sinais menos confiáveis",
        "Nada, o tempo de expiração não importa",
        "Payout automaticamente maior",
        "Ausência total de risco"
      ],
      "correct": 0,
      "explain": "Quanto mais curto o tempo, mais o preço fica sujeito a ruído aleatório de curtíssimo prazo."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Escolher uma expiração maior costuma ajudar a:",
      "options": [
        "Aumentar o ruído da análise",
        "Dar mais tempo para o sinal técnico se confirmar, filtrando parte do ruído",
        "Reduzir o payout automaticamente",
        "Garantir 100% de acerto"
      ],
      "correct": 1,
      "explain": "Expirações maiores costumam dar mais tempo para a estrutura do gráfico se desenvolver, reduzindo o peso do ruído."
    }
  ]
},
  "1-12": {
  "title": "Erros Comuns de Iniciante",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Aprendendo com os Erros dos Outros",
      "body": "A maioria dos erros de iniciante não é sobre estratégia — é sobre disciplina: entrar sem plano, aumentar valores por impulso, ou ignorar a pesquisa sobre a corretora.",
      "pipTip": "Errar faz parte, mas repetir o mesmo erro sem aprender é o que realmente custa caro."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Qual desses é um erro clássico de trader iniciante?",
      "options": [
        "Pesquisar a corretora antes de depositar",
        "Entrar em operações sem nenhum critério técnico, só por impulso",
        "Seguir um percentual fixo de risco por entrada",
        "Manter um diário de operações"
      ],
      "correct": 1,
      "explain": "Entrar sem critério técnico, apenas por impulso, é um dos erros mais comuns e custosos entre iniciantes."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Por que 'testar' uma corretora desconhecida com valores altos é arriscado?",
      "options": [
        "Não é arriscado, é o jeito certo de testar",
        "Porque expõe capital significativo antes de confirmar a confiabilidade da plataforma",
        "Porque aumenta o payout",
        "Porque reduz o risco automaticamente"
      ],
      "correct": 1,
      "explain": "É mais seguro testar com valores pequenos antes de confiar capital significativo a uma corretora nova."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Ignorar completamente o gerenciamento de banca nos primeiros meses de operação costuma levar a:",
      "options": [
        "Resultados mais consistentes",
        "Perdas rápidas e desproporcionais ao capital disponível",
        "Payout automaticamente maior",
        "Nenhuma consequência relevante"
      ],
      "correct": 1,
      "explain": "Sem gerenciamento, mesmo uma boa estratégia pode quebrar a banca rapidamente em sequências normais de perdas."
    }
  ]
},
  "1-13": {
  "title": "Vela de Abertura do Dia",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "O Peso da Primeira Vela",
      "body": "A vela de abertura do dia (ou da sessão) costuma carregar informação sobre o sentimento inicial do mercado — mas, sozinha, não deve ser usada como sinal de entrada sem mais contexto.",
      "pipTip": "A primeira vela é uma pista, não uma sentença."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "A vela de abertura do dia, sozinha, deve ser usada como:",
      "options": [
        "Sinal garantido de entrada",
        "Apenas uma referência inicial, que precisa de mais contexto para virar decisão",
        "Sempre ignorada completamente",
        "O único fator relevante do dia"
      ],
      "correct": 1,
      "explain": "A vela de abertura é uma referência útil, mas não substitui uma análise completa do contexto."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um gap (abertura bem distante do fechamento anterior) pode indicar:",
      "options": [
        "Um evento relevante fora do horário normal de negociação",
        "Um erro de gráfico sempre",
        "Redução automática do payout",
        "Nada, gaps não existem em opções binárias"
      ],
      "correct": 0,
      "explain": "Gaps costumam refletir notícias ou eventos que aconteceram fora do pregão, impactando o preço na reabertura."
    }
  ]
},
  "1-14": {
  "title": "Revisão Avançada II",
  "steps": [
    {
      "level": "Revisão · Módulo 1 Avançado II",
      "type": "info",
      "title": "Consolidando Mais um Pouco",
      "body": "Vamos revisar comparação de corretoras, expiração e erros comuns antes de seguir adiante.",
      "pipTip": "Cada revisão fortalece a base para os módulos seguintes."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Corretora A paga 78% e Corretora B paga 90% sobre uma entrada de R$150,00. Qual a diferença de lucro entre elas, em caso de acerto?",
      "options": [
        "R$135,00",
        "R$117,00",
        "R$18,00",
        "R$36,00"
      ],
      "correct": 2,
      "explain": "Lucro na A: R$117,00. Lucro na B: R$135,00. Diferença: R$18,00."
    },
    {
      "level": "Revisão · Módulo 1 Avançado II",
      "type": "mcq",
      "question": "Expirações muito curtas tendem a sofrer mais com:",
      "options": [
        "Ruído de curto prazo",
        "Payout automaticamente maior",
        "Ausência de risco",
        "Nada relevante"
      ],
      "correct": 0,
      "explain": "Quanto menor o tempo, maior a influência do ruído aleatório de curto prazo."
    },
    {
      "level": "Revisão · Módulo 1 Avançado II",
      "type": "mcq",
      "question": "Um dos erros mais comuns entre iniciantes é:",
      "options": [
        "Seguir um plano de risco fixo",
        "Entrar por impulso, sem critério técnico",
        "Pesquisar a corretora antes de depositar",
        "Manter um diário de operações"
      ],
      "correct": 1,
      "explain": "Entradas por impulso, sem critério técnico, são um dos erros mais recorrentes entre iniciantes."
    }
  ]
},
  "2-10": {
  "title": "Zonas Psicológicas",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Números Redondos Importam",
      "body": "Preços em números redondos (ex: 1.3000, 100.00) costumam atrair mais atenção e reações do mercado, funcionando quase como suporte/resistência psicológica, mesmo sem terem sido testados tecnicamente antes.",
      "pipTip": "Às vezes a psicologia coletiva cria zonas tão fortes quanto qualquer linha traçada."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Por que números redondos (ex: 1.3000) costumam funcionar como zonas relevantes?",
      "options": [
        "Porque a corretora define isso por regra",
        "Porque atraem mais atenção e reações psicológicas coletivas dos participantes do mercado",
        "Porque o payout muda nesses níveis",
        "Eles não têm nenhuma relevância real"
      ],
      "correct": 1,
      "explain": "Números redondos concentram atenção psicológica coletiva, funcionando como zonas relevantes mesmo sem histórico técnico prévio."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma zona psicológica (número redondo) que coincide com uma resistência técnica já testada antes é:",
      "options": [
        "Uma coincidência irrelevante",
        "Uma confluência que reforça a força da região",
        "Sempre um erro de leitura",
        "Só válida em gráficos de linha"
      ],
      "correct": 1,
      "explain": "Quando o nível psicológico coincide com uma zona técnica, a confluência reforça a relevância da região."
    }
  ]
},
  "2-11": {
  "title": "Tendência de Curto vs. Longo Prazo",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Tendências em Camadas",
      "body": "É possível estar em tendência de alta no longo prazo, mas em pullback (baixa temporária) no curto prazo, ao mesmo tempo. Reconhecer em qual 'camada' você está operando evita confusão na leitura.",
      "pipTip": "O mercado tem várias camadas de tempo ao mesmo tempo — saiba em qual você está lendo."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "É possível que o mercado esteja em tendência de alta no longo prazo e em pullback no curto prazo ao mesmo tempo?",
      "options": [
        "Não, isso é impossível",
        "Sim — diferentes períodos de tempo podem mostrar movimentos distintos simultaneamente",
        "Só acontece em gráficos de linha",
        "Só acontece às sextas-feiras"
      ],
      "correct": 1,
      "explain": "Tendências de diferentes prazos podem coexistir; um pullback de curto prazo não anula a tendência maior de longo prazo."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Confundir um pullback de curto prazo com uma reversão de longo prazo pode levar a:",
      "options": [
        "Decisões mais precisas",
        "Entradas contra a tendência principal, aumentando o risco",
        "Payout automaticamente maior",
        "Nenhuma consequência relevante"
      ],
      "correct": 1,
      "explain": "Confundir as camadas de tempo é um erro comum que leva a entradas contra a tendência dominante."
    }
  ]
},
  "2-12": {
  "title": "Rompimento com Retest I",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "O Retorno que Confirma",
      "body": "Depois de um rompimento de resistência, é comum o preço voltar para 'retestar' aquele nível, agora como suporte. Se ele respeita esse retest e volta a subir, é uma confirmação forte do rompimento.",
      "pipTip": "O retest é o mercado voltando para confirmar que o novo território é seu."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "O que é um 'retest' depois de um rompimento de resistência?",
      "options": [
        "O preço nunca mais volta perto daquele nível",
        "O preço volta a tocar o nível rompido, agora funcionando como suporte",
        "Um erro de gráfico",
        "Uma nova resistência automática"
      ],
      "correct": 1,
      "explain": "O retest é quando o preço retorna à zona rompida, testando se ela agora funciona como suporte."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Depois do rompimento de resistência, o preço volta e testa aquele nível (agora suporte) e é respeitado, retomando a subida. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 43,
            "c": 55,
            "h": 58,
            "l": 40
          },
          {
            "o": 55,
            "c": 64,
            "h": 65,
            "l": 51
          },
          {
            "o": 64,
            "c": 76,
            "h": 80,
            "l": 60
          },
          {
            "o": 76,
            "c": 82,
            "h": 83,
            "l": 75
          },
          {
            "o": 82,
            "c": 76,
            "h": 84,
            "l": 70
          }
        ],
        "lines": [
          {
            "label": "Resistência rompida (agora suporte)",
            "color": "#16C784",
            "points": [
              {
                "xFrac": 0,
                "value": 71
              },
              {
                "xFrac": 1,
                "value": 71
              }
            ]
          }
        ]
      },
      "correct": "CALL",
      "explain": "O retest respeitado confirma o rompimento — o antigo teto virou piso, reforçando a continuação da alta."
    }
  ]
},
  "2-13": {
  "title": "Rompimento com Retest II",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "O Mesmo Princípio, ao Contrário",
      "body": "Depois de um rompimento de suporte, o preço costuma retestar aquele nível, agora como resistência. Se ele respeita esse retest e volta a cair, o rompimento fica confirmado.",
      "pipTip": "Suporte rompido vira resistência — esse é um dos princípios mais úteis da análise técnica."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Depois do rompimento de suporte, o preço volta e testa aquele nível (agora resistência) e é respeitado, retomando a queda. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 86,
            "c": 74,
            "h": 89,
            "l": 72
          },
          {
            "o": 74,
            "c": 60,
            "h": 78,
            "l": 56
          },
          {
            "o": 60,
            "c": 48,
            "h": 62,
            "l": 47
          },
          {
            "o": 48,
            "c": 36,
            "h": 49,
            "l": 35
          },
          {
            "o": 36,
            "c": 46,
            "h": 54,
            "l": 33
          }
        ],
        "lines": [
          {
            "label": "Suporte rompido (agora resistência)",
            "color": "#EA3943",
            "points": [
              {
                "xFrac": 0,
                "value": 52
              },
              {
                "xFrac": 1,
                "value": 52
              }
            ]
          }
        ]
      },
      "correct": "PUT",
      "explain": "O retest respeitado confirma o rompimento — o antigo piso virou teto, reforçando a continuação da queda."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Se o preço rompe o suporte, mas no retest volta a subir com força ACIMA do antigo suporte, isso sugere:",
      "options": [
        "Confirmação total do rompimento",
        "Possível falso rompimento — o nível pode ainda estar valendo",
        "Payout automaticamente maior",
        "Erro de gráfico"
      ],
      "correct": 1,
      "explain": "Se o preço reconquista o nível rompido no retest, o rompimento pode não ser confiável — sinal de possível armadilha."
    }
  ]
},
  "2-14": {
  "title": "Revisão Avançada II",
  "steps": [
    {
      "level": "Revisão · Módulo 2 Avançado II",
      "type": "info",
      "title": "Consolidando Mais um Pouco",
      "body": "Vamos revisar zonas psicológicas, tendência em camadas e retest antes de seguir para Candlestick avançado.",
      "pipTip": "Cada camada de conhecimento se soma às anteriores."
    },
    {
      "level": "Revisão · Módulo 2 Avançado II",
      "type": "mcq",
      "question": "Números redondos funcionam como zonas relevantes principalmente porque:",
      "options": [
        "A corretora define por regra",
        "Atraem atenção psicológica coletiva do mercado",
        "Mudam o payout",
        "Não têm relevância real"
      ],
      "correct": 1,
      "explain": "A psicologia coletiva em torno de números redondos cria zonas de reação relevantes."
    },
    {
      "level": "Revisão · Módulo 2 Avançado II",
      "type": "mcq",
      "question": "Um retest respeitado depois de um rompimento:",
      "options": [
        "Enfraquece o rompimento",
        "Reforça e confirma o rompimento",
        "Não tem nenhum efeito",
        "Só vale em gráfico de linha"
      ],
      "correct": 1,
      "explain": "O retest respeitado é uma das confirmações mais fortes de um rompimento válido."
    }
  ]
},
  "3-10": {
  "title": "Estrela da Manhã",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Padrão de 3 Velas: Estrela da Manhã",
      "body": "A Estrela da Manhã (Morning Star) é um padrão de reversão de 3 velas: uma vela vermelha forte, uma vela pequena de indecisão, e uma vela verde forte fechando bem dentro do corpo da primeira vela — sinal clássico de reversão para cima após uma queda.",
      "pipTip": "Três velas contando uma história de virada — vale aprender a reconhecer o enredo completo."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "A Estrela da Manhã é formada por quantas velas?",
      "options": [
        "1",
        "2",
        "3",
        "5"
      ],
      "correct": 2,
      "explain": "É um padrão de 3 velas: uma de queda forte, uma pequena de indecisão, e uma de alta forte."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "O gráfico mostra uma Estrela da Manhã completa ao final de uma tendência de baixa. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 87,
            "c": 73,
            "h": 90,
            "l": 71
          },
          {
            "o": 73,
            "c": 58,
            "h": 74,
            "l": 55
          },
          {
            "o": 58,
            "c": 40,
            "h": 61,
            "l": 38
          },
          {
            "o": 38,
            "c": 39,
            "h": 40,
            "l": 36
          },
          {
            "o": 39,
            "c": 64,
            "h": 65,
            "l": 37
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "A Estrela da Manhã é um padrão de reversão de alta — a terceira vela verde fechando dentro do corpo da primeira reforça a mudança de controle para os compradores."
    }
  ]
},
  "3-11": {
  "title": "Estrela da Noite",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Padrão de 3 Velas: Estrela da Noite",
      "body": "A Estrela da Noite (Evening Star) é o espelho da Estrela da Manhã: vela verde forte, vela pequena de indecisão, e vela vermelha forte fechando bem dentro do corpo da primeira — sinal de reversão para baixo após uma alta.",
      "pipTip": "O mesmo enredo, contado ao contrário — no topo em vez do fundo."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "O gráfico mostra uma Estrela da Noite completa ao final de uma tendência de alta. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 37,
            "c": 51,
            "h": 52,
            "l": 34
          },
          {
            "o": 51,
            "c": 66,
            "h": 70,
            "l": 46
          },
          {
            "o": 66,
            "c": 86,
            "h": 88,
            "l": 63
          },
          {
            "o": 88,
            "c": 87,
            "h": 90,
            "l": 84
          },
          {
            "o": 87,
            "c": 62,
            "h": 89,
            "l": 61
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "A Estrela da Noite é um padrão de reversão de baixa — a terceira vela vermelha fechando dentro do corpo da primeira reforça a mudança de controle para os vendedores."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Na Estrela da Noite, a vela do meio (pequena) representa:",
      "options": [
        "Certeza de continuação da alta",
        "Um momento de indecisão entre o movimento anterior e a reversão",
        "Erro de gráfico",
        "Aumento do payout"
      ],
      "correct": 1,
      "explain": "A vela pequena do meio representa a pausa/indecisão que antecede a reversão confirmada pela terceira vela."
    }
  ]
},
  "3-12": {
  "title": "Três Soldados e Três Corvos",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Força em Sequência",
      "body": "Três Soldados Brancos: três velas verdes fortes e consecutivas, cada uma fechando mais alta que a anterior — forte sinal de continuidade/início de alta. Três Corvos Negros é o espelho, com três velas vermelhas fortes seguidas — sinal de força vendedora.",
      "pipTip": "Quando o mesmo lado vence três rodadas seguidas, a mensagem fica difícil de ignorar."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "O padrão 'Três Soldados Brancos' é composto por:",
      "options": [
        "Três velas vermelhas fracas",
        "Três velas verdes fortes e consecutivas, cada uma fechando mais alta",
        "Uma vela grande e duas pequenas",
        "Três Dojis seguidos"
      ],
      "correct": 1,
      "explain": "Três velas verdes fortes e consecutivas caracterizam o padrão de força compradora contínua."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "O gráfico mostra três velas verdes fortes e consecutivas, cada uma fechando mais alta que a anterior. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 41,
            "c": 51,
            "h": 54,
            "l": 38
          },
          {
            "o": 51,
            "c": 62,
            "h": 63,
            "l": 50
          },
          {
            "o": 63,
            "c": 74,
            "h": 77,
            "l": 61
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Três Soldados Brancos mostram força compradora contínua — favorece a continuação da alta."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "O gráfico mostra três velas vermelhas fortes e consecutivas, cada uma fechando mais baixa que a anterior. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 78,
            "c": 68,
            "h": 79,
            "l": 67
          },
          {
            "o": 67,
            "c": 55,
            "h": 69,
            "l": 52
          },
          {
            "o": 54,
            "c": 41,
            "h": 56,
            "l": 40
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "Três Corvos Negros mostram força vendedora contínua — favorece a continuação da baixa."
    }
  ]
},
  "3-13": {
  "title": "Padrão Harami",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Quando o Corpo Encolhe",
      "body": "O Harami é quase o oposto do Engolfo: uma vela grande seguida de uma vela pequena cujo corpo fica totalmente contido dentro do corpo da vela anterior — sinal de possível pausa ou enfraquecimento da força até então dominante.",
      "pipTip": "Quando o ímpeto encolhe de repente, vale prestar atenção."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "No padrão Harami, o corpo da segunda vela fica:",
      "options": [
        "Maior que o corpo da vela anterior",
        "Totalmente contido dentro do corpo da vela anterior",
        "Igual ao corpo da vela anterior",
        "Sem nenhuma relação com a vela anterior"
      ],
      "correct": 1,
      "explain": "O Harami se caracteriza pelo corpo pequeno da segunda vela, contido dentro do corpo grande da primeira."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "O Harami de alta (após tendência de baixa) sugere:",
      "options": [
        "Continuação forte da baixa",
        "Possível enfraquecimento da pressão vendedora, com atenção para confirmação",
        "Payout automaticamente maior",
        "Erro de gráfico"
      ],
      "correct": 1,
      "explain": "O encolhimento do corpo sugere que a força dominante está perdendo fôlego, mas ainda pede confirmação."
    }
  ]
},
  "3-14": {
  "title": "Revisão Avançada II",
  "steps": [
    {
      "level": "Revisão · Módulo 3 Avançado II",
      "type": "info",
      "title": "Consolidando os Padrões de 3 Velas",
      "body": "Vamos revisar Estrela da Manhã/Noite, Três Soldados/Corvos e Harami antes de seguir para Indicadores avançado.",
      "pipTip": "Padrões de múltiplas velas contam histórias mais completas que uma vela isolada."
    },
    {
      "level": "Revisão · Módulo 3 Avançado II",
      "type": "mcq",
      "question": "A Estrela da Manhã é um padrão de:",
      "options": [
        "Continuação de baixa",
        "Reversão de baixa para alta",
        "Reversão de alta para baixa",
        "Indecisão permanente"
      ],
      "correct": 1,
      "explain": "A Estrela da Manhã sinaliza reversão de uma tendência de baixa para alta."
    },
    {
      "level": "Revisão · Módulo 3 Avançado II",
      "type": "mcq",
      "question": "Três Corvos Negros indicam:",
      "options": [
        "Força compradora contínua",
        "Força vendedora contínua",
        "Indecisão total",
        "Aumento do payout"
      ],
      "correct": 1,
      "explain": "Três velas vermelhas fortes consecutivas mostram domínio vendedor contínuo."
    }
  ]
},
  "4-10": {
  "title": "Introdução ao MACD",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "MACD: Convergência e Divergência de Médias",
      "body": "O MACD (Moving Average Convergence Divergence) mostra a relação entre duas médias móveis de velocidades diferentes. Quando a linha rápida cruza para cima da linha lenta, é um sinal de força compradora; quando cruza para baixo, força vendedora.",
      "pipTip": "MACD é, na prática, uma forma mais refinada de olhar cruzamentos de médias."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "O MACD é baseado principalmente em:",
      "options": [
        "Volume de negociação",
        "Relação entre duas médias móveis de velocidades diferentes",
        "Payout do ativo",
        "Cor da vela"
      ],
      "correct": 1,
      "explain": "O MACD mede a relação (convergência/divergência) entre uma média rápida e uma média lenta."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Quando a linha rápida do MACD cruza para CIMA da linha lenta, isso é lido como sinal de:",
      "options": [
        "Força vendedora",
        "Força compradora",
        "Payout reduzido",
        "Mercado fechado"
      ],
      "correct": 1,
      "explain": "O cruzamento da linha rápida para cima da lenta é interpretado como sinal de força compradora."
    }
  ]
},
  "4-11": {
  "title": "Bollinger Squeeze",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Compressão de Volatilidade",
      "body": "Quando as Bandas de Bollinger ficam muito estreitas (squeeze), isso indica baixa volatilidade — e costuma anteceder um movimento forte, para cima ou para baixo, quando a volatilidade retorna.",
      "pipTip": "A calmaria antes da tempestade também existe nos gráficos."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "O que é o 'Bollinger Squeeze' (compressão das bandas)?",
      "options": [
        "Quando as bandas se afastam muito",
        "Quando as bandas ficam muito próximas, indicando baixa volatilidade",
        "Um erro do indicador",
        "Um tipo de payout"
      ],
      "correct": 1,
      "explain": "O squeeze é a compressão das bandas, sinalizando baixa volatilidade momentânea."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Depois de um squeeze prolongado, o mercado tende a:",
      "options": [
        "Permanecer parado para sempre",
        "Ter um movimento mais forte quando a volatilidade retorna",
        "Reduzir o payout automaticamente",
        "Nada muda"
      ],
      "correct": 1,
      "explain": "Períodos de baixa volatilidade tendem a ser seguidos por expansão de volatilidade e movimentos mais fortes."
    }
  ]
},
  "4-12": {
  "title": "Escolhendo o Indicador Certo",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Nem Todo Indicador Serve Sempre",
      "body": "RSI funciona melhor em mercados com oscilação clara; Bollinger é útil para medir volatilidade; Médias Móveis ajudam a identificar direção. Escolher o indicador certo depende do que você está tentando responder no gráfico.",
      "pipTip": "Cada ferramenta tem seu momento — usar a errada no cenário errado gera confusão."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Para medir se o mercado está em período de alta ou baixa volatilidade, o indicador mais direto é:",
      "options": [
        "RSI",
        "Bandas de Bollinger",
        "Nenhum indicador mede isso",
        "Payout"
      ],
      "correct": 1,
      "explain": "As Bandas de Bollinger, pela largura entre as bandas, são a ferramenta mais direta para medir volatilidade."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Para identificar a direção geral da tendência de forma suavizada, o indicador mais indicado é:",
      "options": [
        "RSI isolado",
        "Médias Móveis",
        "Payout do ativo",
        "Nenhum, é impossível saber a direção"
      ],
      "correct": 1,
      "explain": "Médias Móveis suavizam o preço e ajudam a visualizar a direção geral da tendência."
    }
  ]
},
  "4-13": {
  "title": "Timeframe e Indicadores",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "O Mesmo Indicador, Timeframes Diferentes",
      "body": "Um RSI em 75 no gráfico de 1 minuto tem peso diferente de um RSI em 75 no gráfico de 1 hora — timeframes maiores costumam gerar sinais mais confiáveis, com menos ruído.",
      "pipTip": "O relógio que você usa para olhar o gráfico muda o peso do que você vê."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Sinais de indicadores em timeframes maiores (ex: 1 hora) costumam ser:",
      "options": [
        "Sempre menos confiáveis que timeframes curtos",
        "Geralmente mais confiáveis, com menos ruído de curto prazo",
        "Idênticos aos de timeframes curtos",
        "Irrelevantes"
      ],
      "correct": 1,
      "explain": "Timeframes maiores tendem a filtrar parte do ruído presente em timeframes muito curtos."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Usar o mesmo sinal de indicador em múltiplos timeframes concordando é um exemplo de:",
      "options": [
        "Erro de análise",
        "Confluência entre diferentes períodos de tempo, reforçando o sinal",
        "Redução automática do payout",
        "Perda de tempo"
      ],
      "correct": 1,
      "explain": "Quando vários timeframes concordam, a confiabilidade do sinal aumenta — é uma forma de confluência multi-timeframe."
    }
  ]
},
  "4-14": {
  "title": "Revisão Avançada II",
  "steps": [
    {
      "level": "Revisão · Módulo 4 Avançado II",
      "type": "info",
      "title": "Consolidando Mais um Pouco",
      "body": "Vamos revisar MACD, Bollinger Squeeze e a escolha certa de indicador por cenário antes de seguir para Gestão avançada.",
      "pipTip": "Ferramenta certa, no momento certo — essa é a essência de usar indicadores bem."
    },
    {
      "level": "Revisão · Módulo 4 Avançado II",
      "type": "mcq",
      "question": "O MACD mede principalmente:",
      "options": [
        "Volume de negociação",
        "A relação entre duas médias móveis de velocidades diferentes",
        "O payout do ativo",
        "A cor da vela"
      ],
      "correct": 1,
      "explain": "O MACD é baseado na relação entre médias móveis rápidas e lentas."
    },
    {
      "level": "Revisão · Módulo 4 Avançado II",
      "type": "mcq",
      "question": "Um squeeze nas Bandas de Bollinger geralmente antecede:",
      "options": [
        "Nada relevante",
        "Um movimento mais forte quando a volatilidade retorna",
        "Redução do payout",
        "Fechamento do mercado"
      ],
      "correct": 1,
      "explain": "Compressão de volatilidade tende a ser seguida de expansão e movimentos mais fortes."
    }
  ]
},
  "5-10": {
  "title": "Definindo Metas Realistas",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Metas Pequenas, Resultados Sustentáveis",
      "body": "Metas diárias muito agressivas (ex: dobrar a banca todo dia) empurram o trader para decisões arriscadas demais. Metas pequenas e consistentes (1-3% ao dia) são mais realistas e sustentáveis no longo prazo.",
      "pipTip": "Crescimento devagar e constante bate crescimento rápido e instável quase sempre."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Sua banca é R$1.000,00 e sua meta diária é de 2% sobre a banca. Qual o valor da meta em reais?",
      "options": [
        "R$10,00",
        "R$1.000,00",
        "R$20,00",
        "R$60,00"
      ],
      "correct": 2,
      "explain": "2% de R$1.000,00 = R$20,00. Metas pequenas e realistas são mais sustentáveis no longo prazo."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Por que metas diárias muito agressivas (ex: dobrar a banca) são perigosas?",
      "options": [
        "Não são perigosas, são apenas ambiciosas",
        "Empurram o trader para decisões de risco desproporcional para tentar alcançá-las",
        "Aumentam o payout automaticamente",
        "Garantem resultados melhores"
      ],
      "correct": 1,
      "explain": "Metas agressivas demais tendem a forçar decisões de risco elevado, contrárias ao bom gerenciamento."
    }
  ]
},
  "5-11": {
  "title": "Diversificação de Ativos",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Não Coloque Tudo num Só Ativo",
      "body": "Operar sempre o mesmo ativo, no mesmo horário, pode expor você a condições específicas daquele mercado. Diversificar (dentro do gerenciamento de banca) ajuda a não depender de um único cenário.",
      "pipTip": "Um só caminho pode fechar; vários caminhos dão mais opções."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Qual a principal vantagem de diversificar entre diferentes ativos, respeitando o gerenciamento de banca?",
      "options": [
        "Garantir lucro constante",
        "Reduzir a dependência das condições específicas de um único ativo",
        "Aumentar o payout automaticamente",
        "Evitar completamente qualquer perda"
      ],
      "correct": 1,
      "explain": "Diversificação reduz a dependência do comportamento específico de um único ativo ou mercado."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Diversificar ativos SEM respeitar o gerenciamento de banca (ex: dobrando o risco total) é:",
      "options": [
        "Uma boa prática recomendada",
        "Um erro, pois aumenta o risco total mesmo distribuído entre ativos diferentes",
        "Irrelevante para o risco",
        "Garantia de mais lucro"
      ],
      "correct": 1,
      "explain": "Diversificar não significa aumentar o risco total — o gerenciamento de banca deve continuar valendo para o conjunto."
    }
  ]
},
  "5-12": {
  "title": "Sinais de Burnout do Trader",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Reconhecendo o Cansaço Mental",
      "body": "Sinais de burnout incluem: irritação excessiva com perdas normais, dificuldade de seguir o próprio plano, e vontade constante de 'checar' o gráfico fora do horário de operação. Reconhecer isso cedo evita decisões piores.",
      "pipTip": "Cuidar da mente é parte do gerenciamento de risco, não é luxo."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Qual desses é um sinal de possível burnout do trader?",
      "options": [
        "Seguir o plano com tranquilidade",
        "Irritação excessiva mesmo com perdas normais e esperadas",
        "Ter um dia neutro de resultados",
        "Respeitar o stop diário"
      ],
      "correct": 1,
      "explain": "Reações emocionais desproporcionais a perdas normais são um sinal de alerta para burnout."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Diante de sinais de burnout, a atitude mais recomendada é:",
      "options": [
        "Aumentar o número de operações para 'compensar'",
        "Fazer uma pausa das operações até recuperar o equilíbrio emocional",
        "Ignorar e continuar normalmente",
        "Trocar de corretora imediatamente"
      ],
      "correct": 1,
      "explain": "Pausar para recuperar o equilíbrio emocional é a atitude mais saudável diante de sinais de burnout."
    }
  ]
},
  "5-13": {
  "title": "Montando seu Diário de Operações",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Registrar para Aprender",
      "body": "Um diário de operações simples deve registrar: data/hora, ativo, motivo da entrada, resultado e como você se sentiu emocionalmente. Isso revela padrões que a memória sozinha não capta.",
      "pipTip": "O que não é registrado, tende a ser esquecido — e os erros se repetem."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Além do resultado (ganhou/perdeu), o que mais é importante registrar num diário de operações?",
      "options": [
        "Apenas o valor investido",
        "O motivo técnico da entrada e como você se sentiu emocionalmente",
        "Só a hora do dia",
        "Nada mais é necessário"
      ],
      "correct": 1,
      "explain": "Registrar o motivo técnico e o estado emocional revela padrões de erro e acerto ao longo do tempo."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Revisar o diário de operações semanalmente ajuda principalmente a:",
      "options": [
        "Aumentar o payout",
        "Identificar padrões recorrentes de erro e acerto para ajustar o plano",
        "Substituir o gerenciamento de banca",
        "Garantir mais vitórias automaticamente"
      ],
      "correct": 1,
      "explain": "A revisão periódica do diário revela padrões que ajudam a ajustar o plano de trading com base em dados reais."
    }
  ]
},
  "5-14": {
  "title": "Revisão Avançada II",
  "steps": [
    {
      "level": "Revisão · Módulo 5 Avançado II",
      "type": "info",
      "title": "Consolidando Mais um Pouco",
      "body": "Vamos revisar metas realistas, diversificação, burnout e diário de operações antes de seguir para o Módulo 6.",
      "pipTip": "Disciplina e autoconhecimento caminham juntos na jornada do trader."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Sua banca é R$1.000,00 e sua meta diária é de 2% sobre a banca. Qual o valor da meta em reais?",
      "options": [
        "R$1.000,00",
        "R$60,00",
        "R$20,00",
        "R$10,00"
      ],
      "correct": 2,
      "explain": "2% de R$1.000,00 = R$20,00. Metas pequenas e realistas são mais sustentáveis no longo prazo."
    },
    {
      "level": "Revisão · Módulo 5 Avançado II",
      "type": "mcq",
      "question": "Um sinal de burnout do trader é:",
      "options": [
        "Seguir o plano com calma",
        "Irritação desproporcional com perdas normais",
        "Registrar operações no diário",
        "Respeitar o gerenciamento de banca"
      ],
      "correct": 1,
      "explain": "Reações emocionais desproporcionais são um sinal claro de desgaste mental (burnout)."
    },
    {
      "level": "Revisão · Módulo 5 Avançado II",
      "type": "mcq",
      "question": "Diversificar ativos, respeitando o gerenciamento de banca, ajuda a:",
      "options": [
        "Garantir lucro certo",
        "Reduzir a dependência de um único cenário de mercado",
        "Aumentar o payout automaticamente",
        "Eliminar todo o risco"
      ],
      "correct": 1,
      "explain": "Diversificação reduz a dependência de um único ativo ou condição de mercado, sem eliminar o risco por completo."
    }
  ]
},
  "6-5": {
  "title": "Pegadinha: Falso Rompimento I",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "A Armadilha de Alta (Bull Trap)",
      "body": "Uma armadilha de alta acontece quando o preço rompe uma resistência, parece confirmar o rompimento, mas reverte rapidamente e fecha de volta abaixo da linha rompida — enganando quem entrou comprado no rompimento.",
      "pipTip": "Nem todo rompimento é de verdade — algumas 'portas abertas' se fecham na sua cara."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "O que caracteriza uma armadilha de alta (bull trap)?",
      "options": [
        "Um rompimento que continua com força na mesma direção",
        "Um rompimento de resistência seguido de reversão rápida para dentro da zona anterior",
        "Uma vela verde qualquer",
        "Um aumento de payout"
      ],
      "correct": 1,
      "explain": "A armadilha de alta rompe a resistência e reverte rapidamente, enganando quem comprou no rompimento."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "O preço rompeu a resistência, mas a vela seguinte reverteu com força e fechou de volta abaixo da linha rompida. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 49,
            "c": 64,
            "h": 68,
            "l": 46
          },
          {
            "o": 64,
            "c": 73,
            "h": 78,
            "l": 59
          },
          {
            "o": 73,
            "c": 76,
            "h": 88,
            "l": 72
          },
          {
            "o": 76,
            "c": 101,
            "h": 102,
            "l": 74
          },
          {
            "o": 101,
            "c": 80,
            "h": 103,
            "l": 78
          }
        ],
        "lines": [
          {
            "label": "Resistência",
            "color": "#EA3943",
            "points": [
              {
                "xFrac": 0,
                "value": 89
              },
              {
                "xFrac": 1,
                "value": 89
              }
            ]
          }
        ]
      },
      "correct": "PUT",
      "explain": "A reversão rápida de volta para dentro da zona anterior é a marca registrada da armadilha de alta — entrada em PUT."
    }
  ]
},
  "6-6": {
  "title": "Pegadinha: Falso Rompimento II",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "A Armadilha de Baixa (Bear Trap)",
      "body": "A armadilha de baixa é o espelho: o preço rompe um suporte, parece confirmar a queda, mas reverte rapidamente e fecha de volta acima da linha rompida — enganando quem vendeu no rompimento.",
      "pipTip": "As armadilhas existem nos dois sentidos do mercado — fique atento aos dois lados."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "O preço rompeu o suporte, mas a vela seguinte reverteu com força e fechou de volta acima da linha rompida. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 70,
            "c": 60,
            "h": 73,
            "l": 59
          },
          {
            "o": 60,
            "c": 47,
            "h": 62,
            "l": 45
          },
          {
            "o": 47,
            "c": 42,
            "h": 49,
            "l": 38
          },
          {
            "o": 42,
            "c": 27,
            "h": 44,
            "l": 24
          },
          {
            "o": 27,
            "c": 43,
            "h": 46,
            "l": 26
          }
        ],
        "lines": [
          {
            "label": "Suporte",
            "color": "#16C784",
            "points": [
              {
                "xFrac": 0,
                "value": 35
              },
              {
                "xFrac": 1,
                "value": 35
              }
            ]
          }
        ]
      },
      "correct": "CALL",
      "explain": "A reversão rápida de volta para dentro da zona anterior é a marca registrada da armadilha de baixa — entrada em CALL."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Qual a principal diferença entre um rompimento válido e uma armadilha (falso rompimento)?",
      "options": [
        "A cor da vela de rompimento",
        "O rompimento válido tende a ser seguido por velas que respeitam o novo nível; a armadilha reverte rapidamente",
        "O payout muda",
        "Armadilhas só acontecem à noite"
      ],
      "correct": 1,
      "explain": "O comportamento das velas seguintes é o que diferencia um rompimento real de uma armadilha."
    }
  ]
},
  "6-7": {
  "title": "Pegadinha: Quase-Padrão",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Quando o Padrão Não Está Completo",
      "body": "Nem toda vela parecida com um Martelo é um Martelo de verdade. A proporção importa: o pavio precisa ser pelo menos 2x o corpo. Um Engolfo também só é válido se o corpo cobrir 100% do corpo anterior — cobrir 80% não conta.",
      "pipTip": "Um padrão quase certo ainda é, tecnicamente, errado — e o mercado não dá desconto por 'quase'."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma vela tem corpo pequeno e um pavio inferior só um pouco maior que o corpo (não o dobro). Isso conta como Martelo confiável?",
      "options": [
        "Sim, qualquer pavio inferior já conta",
        "Não — o pavio precisa ser pelo menos o dobro do corpo para ser um Martelo confiável",
        "Sim, desde que a vela seja verde",
        "Não, Martelo não existe de verdade"
      ],
      "correct": 1,
      "explain": "A proporção mínima de ~2x o corpo é o que dá confiabilidade estatística ao padrão de Martelo."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma vela verde cobre 80% do corpo da vela vermelha anterior, mas não 100%. Isso é um Engolfo de Alta válido?",
      "options": [
        "Sim, 80% já é suficiente",
        "Não — o corpo precisa cobrir totalmente (100%) o corpo anterior para ser um Engolfo válido",
        "Sim, se o payout for alto",
        "Depende da cor do pavio"
      ],
      "correct": 1,
      "explain": "O Engolfo exige cobertura total do corpo anterior — cobertura parcial não conta como padrão válido."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Por que confundir um 'quase-padrão' com o padrão de verdade é arriscado?",
      "options": [
        "Não é arriscado, todo padrão parecido funciona igual",
        "Porque o padrão incompleto tem histórico de confiabilidade menor e mais imprevisível",
        "Porque reduz o payout automaticamente",
        "Porque a corretora bloqueia a operação"
      ],
      "correct": 1,
      "explain": "Padrões incompletos não carregam a mesma estatística de confiabilidade dos padrões formados corretamente."
    }
  ]
},
  "6-8": {
  "title": "Pegadinha: Pavio de Notícia",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Quando o Pavio é Só Ruído",
      "body": "Um pavio muito longo, isolado, causado por uma notícia repentina (spike), não tem o mesmo significado técnico de um pavio de rejeição formado dentro de um contexto de tendência e zona. Tratar os dois da mesma forma é um erro comum.",
      "pipTip": "Nem todo pavio conta uma história técnica — às vezes é só um susto passageiro."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um pavio muito longo e isolado, sem contexto de zona ou tendência, causado por uma notícia repentina, deve ser interpretado como:",
      "options": [
        "Sempre um sinal técnico forte e confiável",
        "Um movimento de ruído, com menos valor técnico que um pavio formado em contexto",
        "Garantia de reversão",
        "Motivo para dobrar a entrada"
      ],
      "correct": 1,
      "explain": "Pavios causados por spikes de notícia, sem contexto técnico, carregam menos peso analítico."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Qual a diferença entre um pavio de rejeição técnico e um pavio de spike de notícia?",
      "options": [
        "Não existe diferença nenhuma",
        "O pavio técnico aparece dentro de um contexto de zona/tendência; o de notícia é isolado e sem esse contexto",
        "O pavio de notícia é sempre maior",
        "O pavio técnico só acontece de manhã"
      ],
      "correct": 1,
      "explain": "O contexto (zona, tendência) é o que dá peso técnico a um pavio — sem ele, é apenas ruído de curto prazo."
    }
  ]
},
  "6-9": {
  "title": "Revisão: Pegadinhas Clássicas",
  "steps": [
    {
      "level": "Revisão · Módulo 6",
      "type": "info",
      "title": "Consolidando as Pegadinhas",
      "body": "Antes de seguir para os gatilhos de entrada, vamos revisar as armadilhas de alta/baixa, os quase-padrões e os pavios de notícia.",
      "pipTip": "Reconhecer uma armadilha antes de cair nela é meio caminho andado."
    },
    {
      "level": "Revisão · Módulo 6",
      "type": "mcq",
      "question": "Uma armadilha de alta (bull trap) se caracteriza por:",
      "options": [
        "Rompimento seguido de continuação forte",
        "Rompimento seguido de reversão rápida de volta para dentro da zona anterior",
        "Uma vela verde qualquer",
        "Aumento do payout"
      ],
      "correct": 1,
      "explain": "A reversão rápida após o rompimento é a marca da armadilha de alta."
    },
    {
      "level": "Revisão · Módulo 6",
      "type": "mcq",
      "question": "Um Engolfo cujo corpo cobre apenas 80% da vela anterior:",
      "options": [
        "É um Engolfo válido",
        "Não é um Engolfo válido — falta cobertura total do corpo anterior",
        "É sempre mais confiável que um Engolfo completo",
        "Depende do payout"
      ],
      "correct": 1,
      "explain": "Sem cobertura total do corpo anterior, o padrão não é considerado um Engolfo válido."
    },
    {
      "level": "Revisão · Módulo 6",
      "type": "mcq",
      "question": "Um pavio isolado causado por uma notícia repentina, sem contexto técnico, deve ser tratado com:",
      "options": [
        "A mesma confiança de um pavio de rejeição em zona testada",
        "Mais cautela, pois carrega menos peso técnico",
        "Confiança máxima automática",
        "Ignorado completamente sempre, sem exceção"
      ],
      "correct": 1,
      "explain": "Pavios de notícia sem contexto técnico merecem mais cautela do que pavios formados dentro de uma estrutura de zona/tendência."
    }
  ]
},


  /* ---------- LIÇÕES AVANÇADAS (LOTE 3) ---------- */
  "6-10": {
  "title": "Gatilho: Esperar o Fechamento",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "A Vela Só Vale Depois de Fechar",
      "body": "Entrar no meio da formação de uma vela é um dos erros mais comuns — a vela pode reverter completamente antes de fechar, mudando todo o sinal. A disciplina de esperar o fechamento é um dos gatilhos mais importantes de entrada.",
      "pipTip": "Paciência de alguns segundos pode ser a diferença entre uma boa e uma má decisão."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma vela está se formando fortemente para cima, mas ainda não fechou. Qual a atitude mais disciplinada?",
      "options": [
        "Entrar imediatamente aproveitando o movimento",
        "Esperar o fechamento da vela antes de decidir a entrada",
        "Entrar com o dobro do valor por estar confiante",
        "Ignorar essa vela e não olhar o gráfico de novo"
      ],
      "correct": 1,
      "explain": "A decisão de entrada deve vir só depois que o sinal está confirmado pelo fechamento da vela."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Por que entrar no meio da formação de uma vela é arriscado?",
      "options": [
        "Não é arriscado, é uma vantagem",
        "A vela pode reverter completamente antes de fechar, mudando todo o sinal",
        "Porque a corretora cobra mais caro nesse horário",
        "Porque só é possível entrar após o fechamento tecnicamente"
      ],
      "correct": 1,
      "explain": "Antes do fechamento, o formato da vela ainda pode mudar completamente — o sinal não está confirmado."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "A vela abaixo já fechou completamente, confirmando o Martelo após uma queda. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 67,
            "c": 51,
            "h": 71,
            "l": 48
          },
          {
            "o": 51,
            "c": 38,
            "h": 54,
            "l": 33
          },
          {
            "o": 38,
            "c": 29,
            "h": 42,
            "l": 24
          },
          {
            "o": 26,
            "c": 31,
            "h": 33,
            "l": -3
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "A decisão só foi tomada depois do fechamento confirmado do Martelo — disciplina de gatilho aplicada corretamente."
    }
  ]
},
  "6-11": {
  "title": "Gatilho: Confluência Mínima",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Nunca Entre com Só Um Sinal",
      "body": "Um sinal isolado — como um pavio de rejeição fora de qualquer zona conhecida — não é confluência suficiente. A disciplina de exigir pelo menos 2 sinais concordando antes de entrar reduz bastante o número de entradas ruins.",
      "pipTip": "Um sinal é uma suspeita. Dois sinais concordando começam a virar evidência."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Você vê apenas um pavio de rejeição isolado, fora de qualquer zona de suporte/resistência conhecida, sem confirmação de indicador. Isso é confluência suficiente para uma entrada disciplinada?",
      "options": [
        "Sim, um pavio já é suficiente",
        "Não — é apenas um sinal isolado e fraco, sem confluência",
        "Sim, se a vela for grande o bastante",
        "Não, pavios nunca devem ser considerados"
      ],
      "correct": 1,
      "explain": "Um sinal isolado, sem outros fatores concordando, não é confluência — é apenas um indício fraco."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "O preço está numa zona de suporte já testada antes E forma um Martelo bem definido — dois sinais na mesma direção. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 73,
            "c": 63,
            "h": 74,
            "l": 60
          },
          {
            "o": 63,
            "c": 53,
            "h": 64,
            "l": 48
          },
          {
            "o": 53,
            "c": 39,
            "h": 56,
            "l": 34
          },
          {
            "o": 36,
            "c": 39,
            "h": 42,
            "l": 28
          }
        ],
        "lines": [
          {
            "label": "Suporte",
            "color": "#16C784",
            "points": [
              {
                "xFrac": 0,
                "value": 30
              },
              {
                "xFrac": 1,
                "value": 30
              }
            ]
          }
        ]
      },
      "correct": "CALL",
      "explain": "Confluência entre zona de suporte já testada e padrão de candle reforça a entrada — dois sinais concordando."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Qual das opções abaixo representa a MELHOR confluência para uma entrada?",
      "options": [
        "Só o RSI sozinho",
        "Zona de suporte/resistência + padrão de candle + indicador concordando",
        "Só a cor da vela",
        "Só o horário do dia"
      ],
      "correct": 1,
      "explain": "Quanto mais fatores independentes concordam, mais forte é a confluência da entrada."
    }
  ]
},
  "6-12": {
  "title": "Gatilho: Retest como Confirmação",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Esperar o Retorno Antes de Agir",
      "body": "Além de esperar o fechamento da vela, um gatilho ainda mais rigoroso é esperar o retest do nível rompido — só entrando se o preço respeitar esse retorno. Isso reduz bastante o risco de cair numa armadilha.",
      "pipTip": "Quem espera o retest, quase nunca cai numa armadilha de rompimento."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Depois do rompimento de resistência, o preço volta, testa o nível (agora suporte) e é respeitado. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 39,
            "c": 54,
            "h": 59,
            "l": 38
          },
          {
            "o": 54,
            "c": 68,
            "h": 73,
            "l": 52
          },
          {
            "o": 68,
            "c": 78,
            "h": 83,
            "l": 63
          },
          {
            "o": 78,
            "c": 93,
            "h": 94,
            "l": 75
          },
          {
            "o": 93,
            "c": 79,
            "h": 94,
            "l": 73
          }
        ],
        "lines": [
          {
            "label": "Nível rompido",
            "color": "#16C784",
            "points": [
              {
                "xFrac": 0,
                "value": 74
              },
              {
                "xFrac": 1,
                "value": 74
              }
            ]
          }
        ]
      },
      "correct": "CALL",
      "explain": "Esperar e confirmar o retest antes de entrar é um gatilho mais rigoroso que reduz o risco de armadilha."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Por que esperar o retest é considerado um gatilho mais seguro que entrar direto no rompimento?",
      "options": [
        "Não é mais seguro, é só mais lento",
        "Porque reduz a exposição a armadilhas de rompimento (falsos rompimentos)",
        "Porque aumenta o payout",
        "Porque garante 100% de acerto"
      ],
      "correct": 1,
      "explain": "Esperar a confirmação do retest filtra boa parte dos falsos rompimentos (armadilhas)."
    }
  ]
},
  "6-13": {
  "title": "Gatilho: Força da Vela (Tamanho do Corpo)",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Corpo Grande, Convicção Maior",
      "body": "Velas com corpo grande em relação às vizinhas mostram mais convicção de um lado do mercado. Velas com corpo pequeno mostram indecisão ou falta de força — um gatilho útil é dar mais peso a sinais que vêm acompanhados de corpo grande.",
      "pipTip": "O tamanho do corpo é, na prática, uma leitura indireta da força do movimento."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma vela com corpo bem maior que as vizinhas costuma indicar:",
      "options": [
        "Indecisão total do mercado",
        "Maior convicção de um lado (comprador ou vendedor) naquele período",
        "Erro de gráfico",
        "Redução do payout"
      ],
      "correct": 1,
      "explain": "Corpo grande em relação às vizinhas é sinal de força e convicção maior de um lado do mercado."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um sinal de reversão acompanhado de uma vela de corpo pequeno tem, em geral:",
      "options": [
        "Mais força que um sinal com corpo grande",
        "Menos força/convicção que um sinal confirmado por uma vela de corpo grande",
        "A mesma força sempre",
        "Nenhuma relação com a força do sinal"
      ],
      "correct": 1,
      "explain": "Corpo pequeno sugere menos convicção — o sinal tende a ser mais fraco que um confirmado por corpo grande."
    }
  ]
},
  "6-14": {
  "title": "Revisão: Gatilhos de Entrada",
  "steps": [
    {
      "level": "Revisão · Módulo 6",
      "type": "info",
      "title": "Consolidando os Gatilhos",
      "body": "Antes de seguir para os simulados finais, vamos revisar fechamento, confluência mínima, retest e força da vela.",
      "pipTip": "Gatilhos de entrada são a diferença entre reagir por impulso e agir com disciplina."
    },
    {
      "level": "Revisão · Módulo 6",
      "type": "mcq",
      "question": "O primeiro gatilho de disciplina, antes de qualquer outro, é:",
      "options": [
        "Entrar assim que ver um sinal se formando",
        "Esperar o fechamento da vela antes de decidir",
        "Dobrar o valor da entrada",
        "Ignorar o gráfico"
      ],
      "correct": 1,
      "explain": "Esperar o fechamento da vela é a base de qualquer disciplina de entrada."
    },
    {
      "level": "Revisão · Módulo 6",
      "type": "mcq",
      "question": "Confluência mínima significa:",
      "options": [
        "Um único sinal isolado já é suficiente",
        "Exigir pelo menos 2 sinais concordando antes de entrar",
        "Ignorar todos os sinais",
        "Sempre usar Martingale"
      ],
      "correct": 1,
      "explain": "A confluência mínima reduz entradas baseadas em sinais fracos e isolados."
    },
    {
      "level": "Revisão · Módulo 6",
      "type": "mcq",
      "question": "Esperar o retest de um nível rompido antes de entrar ajuda a:",
      "options": [
        "Aumentar o risco de armadilha",
        "Reduzir o risco de cair numa armadilha de rompimento",
        "Garantir 100% de acerto",
        "Nada, é só perda de tempo"
      ],
      "correct": 1,
      "explain": "O retest é uma confirmação extra que reduz — mas não elimina — o risco de armadilhas de rompimento."
    }
  ]
},


  /* ---------- LIÇÕES AVANÇADAS (LOTE FINAL) ---------- */
  "1-15": {
  "title": "Risco de Ruína I",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "O Conceito de Risco de Ruína",
      "body": "Risco de ruína é a probabilidade de zerar a banca por completo, dado o percentual de risco por entrada e a taxa de acerto histórica. Quanto maior o percentual arriscado, exponencialmente maior o risco de ruína — mesmo com boa taxa de acerto.",
      "pipTip": "Entender o risco de ruína é entender por que gerenciamento não é opcional."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "O 'risco de ruína' é:",
      "options": [
        "A chance de dobrar a banca rapidamente",
        "A probabilidade de zerar completamente a banca, dado o risco por entrada",
        "Um tipo de payout",
        "Uma taxa cobrada pela corretora"
      ],
      "correct": 1,
      "explain": "Risco de ruína mede a chance estatística de zerar a banca com o padrão de risco atual."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Entrada de R$220,00 com payout de 76%. Qual o lucro em caso de acerto?",
      "options": [
        "R$220,00",
        "R$387,20",
        "R$167,20",
        "R$140,80"
      ],
      "correct": 2,
      "explain": "76% de R$220,00 = R$167,20 de lucro."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Dobrar o percentual de risco por entrada (de 2% para 4%, por exemplo) tende a:",
      "options": [
        "Reduzir o risco de ruína",
        "Aumentar significativamente o risco de ruína",
        "Não alterar nada",
        "Aumentar o payout automaticamente"
      ],
      "correct": 1,
      "explain": "Mais risco por entrada aumenta de forma desproporcional a chance de zerar a banca em sequências de perdas."
    }
  ]
},
  "1-16": {
  "title": "Risco de Ruína II",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Taxa de Acerto e Gerenciamento Juntos",
      "body": "Mesmo uma boa taxa de acerto (ex: 60%) não protege contra um gerenciamento ruim. É a combinação dos dois — taxa de acerto E percentual de risco — que define a sobrevivência da banca a longo prazo.",
      "pipTip": "Boa estratégia sem bom gerenciamento é como um carro rápido sem freio."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Entrada de R$220,00 com payout de 79%. Qual o lucro em caso de acerto?",
      "options": [
        "R$173,80",
        "R$147,40",
        "R$220,00",
        "R$393,80"
      ],
      "correct": 0,
      "explain": "79% de R$220,00 = R$173,80 de lucro."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma taxa de acerto de 60% com risco de 20% por entrada é:",
      "options": [
        "Sempre segura, pois a taxa de acerto é boa",
        "Ainda arriscada, pois o percentual de risco por entrada é alto demais",
        "Impossível de calcular",
        "Garantia de lucro"
      ],
      "correct": 1,
      "explain": "Mesmo com boa taxa de acerto, um risco por entrada muito alto pode levar à ruína em sequências normais de perdas."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Qual combinação tende a ser mais sustentável no longo prazo?",
      "options": [
        "Alta taxa de acerto com risco de 20% por entrada",
        "Taxa de acerto moderada com risco de 1-3% por entrada",
        "Baixa taxa de acerto com risco de 50% por entrada",
        "Não importa a combinação"
      ],
      "correct": 1,
      "explain": "Risco pequeno e constante, mesmo com taxa de acerto moderada, tende a ser mais sustentável que apostar tudo em alta taxa de acerto com risco elevado."
    }
  ]
},
  "1-17": {
  "title": "Regulamentação na Prática",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Sinais de Alerta Regulatório",
      "body": "Corretoras sem nenhuma licença visível, sem CNPJ claro ou sem termos de uso acessíveis são sinais de alerta. Regulamentação não garante lucro, mas reduz o risco de fraude.",
      "pipTip": "Regulamentação é sobre proteção do seu capital, não sobre garantia de lucro."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Qual desses é um sinal de alerta sobre uma corretora?",
      "options": [
        "Termos de uso claros e acessíveis",
        "Ausência total de CNPJ, licença ou termos de uso visíveis",
        "Suporte ao cliente responsivo",
        "Histórico de saques rápidos"
      ],
      "correct": 1,
      "explain": "A ausência de informações básicas de regulamentação é um forte sinal de alerta."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Entrada de R$130,00 com payout de 91%. Qual o lucro em caso de acerto?",
      "options": [
        "R$102,70",
        "R$118,30",
        "R$130,00",
        "R$248,30"
      ],
      "correct": 1,
      "explain": "91% de R$130,00 = R$118,30 de lucro."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Regulamentação garante lucro nas operações?",
      "options": [
        "Sim, sempre",
        "Não — ela reduz o risco de fraude, mas não garante resultado nas operações",
        "Sim, mas só em corretoras internacionais",
        "Não tem relação nenhuma com o assunto"
      ],
      "correct": 1,
      "explain": "Regulamentação protege o capital contra fraude, mas não interfere no resultado técnico das operações."
    }
  ]
},
  "1-18": {
  "title": "Simulando um Mês de Operações",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Pensando em Ciclos, não em Entradas Isoladas",
      "body": "Um trader profissional avalia seu desempenho em ciclos (semanas, meses) — não em uma única entrada. Um mês com 55% de acerto e gerenciamento correto pode ser lucrativo, mesmo com dias ruins no meio do caminho.",
      "pipTip": "Julgue seu progresso pelo ciclo completo, não pela última entrada."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Por que é mais útil avaliar o desempenho em ciclos (semanas/meses) do que entrada por entrada?",
      "options": [
        "Não é mais útil, cada entrada deve ser julgada isoladamente",
        "Porque reduz a influência da variação normal de curto prazo na avaliação de resultado",
        "Porque aumenta o payout",
        "Porque garante mais vitórias"
      ],
      "correct": 1,
      "explain": "Ciclos maiores suavizam a variação natural de curto prazo, dando uma visão mais real da performance."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Entrada de R$130,00 com payout de 76%. Qual o lucro em caso de acerto?",
      "options": [
        "R$228,80",
        "R$83,20",
        "R$130,00",
        "R$98,80"
      ],
      "correct": 3,
      "explain": "76% de R$130,00 = R$98,80 de lucro."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um mês com 55% de acerto e bom gerenciamento de banca pode ser:",
      "options": [
        "Sempre um mês de prejuízo",
        "Lucrativo, dependendo do payout médio e do gerenciamento aplicado",
        "Irrelevante para avaliação",
        "Impossível matematicamente"
      ],
      "correct": 1,
      "explain": "Com payout adequado e boa gestão, uma taxa de acerto moderada (ex: 55%) já pode gerar resultado positivo no ciclo."
    }
  ]
},
  "1-19": {
  "title": "Revisão Avançada III",
  "steps": [
    {
      "level": "Revisão · Módulo 1 Avançado III",
      "type": "info",
      "title": "Consolidando o Avançado III",
      "body": "Vamos revisar risco de ruína, regulamentação e avaliação por ciclos antes de seguir adiante.",
      "pipTip": "Cada revisão te deixa mais preparado para a Prova Final."
    },
    {
      "level": "Revisão · Módulo 1 Avançado III",
      "type": "mcq",
      "question": "Risco de ruína aumenta principalmente quando:",
      "options": [
        "O percentual de risco por entrada é reduzido",
        "O percentual de risco por entrada é elevado demais",
        "O payout aumenta",
        "A corretora é regulamentada"
      ],
      "correct": 1,
      "explain": "Quanto maior o risco por entrada, exponencialmente maior o risco de ruína."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Entrada de R$170,00 com payout de 91%. Qual o lucro em caso de acerto?",
      "options": [
        "R$324,70",
        "R$154,70",
        "R$170,00",
        "R$134,30"
      ],
      "correct": 1,
      "explain": "91% de R$170,00 = R$154,70 de lucro."
    },
    {
      "level": "Revisão · Módulo 1 Avançado III",
      "type": "mcq",
      "question": "Avaliar o desempenho por ciclos (em vez de entrada por entrada) ajuda a:",
      "options": [
        "Aumentar o payout",
        "Reduzir a influência da variação normal de curto prazo na avaliação",
        "Garantir mais vitórias",
        "Nada relevante"
      ],
      "correct": 1,
      "explain": "Ciclos maiores dão uma visão mais real da performance, suavizando a variação natural de curto prazo."
    }
  ]
},
  "1-20": {
  "title": "Simulando Sequências de Perdas",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Perdas Fazem Parte do Jogo",
      "body": "Mesmo estratégias com boa taxa de acerto passam por sequências de 3, 4, 5 perdas seguidas — isso é estatisticamente normal, não um sinal de que algo está errado.",
      "pipTip": "Sequência de perdas não é fracasso, é estatística acontecendo."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Entrada de R$65,00 com payout de 80%. Qual o lucro em caso de acerto?",
      "options": [
        "R$45,50",
        "R$52,00",
        "R$117,00",
        "R$65,00"
      ],
      "correct": 1,
      "explain": "80% de R$65,00 = R$52,00."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma sequência de 4 perdas seguidas, numa estratégia com 60% de acerto histórico, é:",
      "options": [
        "Impossível de acontecer",
        "Estatisticamente normal e esperada de vez em quando",
        "Sinal de que a estratégia parou de funcionar",
        "Motivo para dobrar o valor imediatamente"
      ],
      "correct": 1,
      "explain": "Sequências de perdas acontecem mesmo em estratégias boas — fazem parte da variação estatística normal."
    },
    {
      "level": "Nível 3 · Disciplina",
      "type": "mcq",
      "question": "Diante de uma sequência de perdas esperada estatisticamente, a atitude correta é:",
      "options": [
        "Abandonar a estratégia imediatamente",
        "Manter o gerenciamento de banca e seguir o plano",
        "Dobrar o valor para recuperar rápido",
        "Parar de operar para sempre"
      ],
      "correct": 1,
      "explain": "Seguir o plano e o gerenciamento é o que permite atravessar sequências normais de perdas sem quebrar a banca."
    }
  ]
},
  "1-21": {
  "title": "Comparando Estratégias na Prática",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Nem Toda Estratégia Serve para Você",
      "body": "Duas estratégias podem ter a mesma taxa de acerto teórica, mas exigir perfis de disciplina muito diferentes — uma pode pedir dezenas de entradas por dia, outra só 2 ou 3 bem selecionadas.",
      "pipTip": "A melhor estratégia é a que você consegue seguir com disciplina de verdade."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Entrada de R$95,00 com payout de 86%. Qual o lucro em caso de acerto?",
      "options": [
        "R$72,20",
        "R$176,70",
        "R$95,00",
        "R$81,70"
      ],
      "correct": 3,
      "explain": "86% de R$95,00 = R$81,70."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Duas estratégias com a mesma taxa de acerto teórica podem ainda assim:",
      "options": [
        "Ser idênticas em tudo",
        "Exigir perfis de disciplina e rotina muito diferentes",
        "Ter sempre o mesmo payout",
        "Não ter nenhuma diferença prática"
      ],
      "correct": 1,
      "explain": "Frequência de entradas, tempo de tela e perfil emocional exigido variam bastante entre estratégias, mesmo com taxa de acerto parecida."
    }
  ]
},
  "1-22": {
  "title": "Preparando-se para a Prova Final",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Revisão Focada",
      "body": "Antes da Prova Final do Módulo 1, vale revisar os pontos centrais: payout, corretoras confiáveis, anatomia da vela e disciplina básica de gerenciamento.",
      "pipTip": "Uma boa revisão vale por várias horas de estudo disperso."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Entrada de R$45,00 com payout de 89%. Qual o lucro em caso de acerto?",
      "options": [
        "R$35,55",
        "R$40,05",
        "R$85,05",
        "R$45,00"
      ],
      "correct": 1,
      "explain": "89% de R$45,00 = R$40,05."
    },
    {
      "level": "Revisão · Módulo 1",
      "type": "mcq",
      "question": "O critério mais importante para confiar numa corretora continua sendo:",
      "options": [
        "Design do aplicativo",
        "Regulamentação e histórico de saques",
        "Número de ativos disponíveis",
        "Propaganda em redes sociais"
      ],
      "correct": 1,
      "explain": "Regulamentação e histórico de saques seguem sendo os critérios centrais de confiança."
    },
    {
      "level": "Revisão · Módulo 1",
      "type": "mcq",
      "question": "Vela verde significa que:",
      "options": [
        "Fechamento abaixo da abertura",
        "Fechamento acima da abertura",
        "Não houve negociação",
        "Payout reduzido"
      ],
      "correct": 1,
      "explain": "Vela verde fecha acima de onde abriu — compradores no controle do período."
    }
  ]
},
  "1-23": {
  "title": "Cenário Integrado I",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Juntando Payout, Corretora e Disciplina",
      "body": "Vamos praticar um cenário que combina escolha de corretora, cálculo de payout e disciplina de gerenciamento ao mesmo tempo — como na vida real.",
      "pipTip": "No mercado real, os conceitos nunca aparecem isolados — praticar juntos ajuda."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Entrada de R$115,00 com payout de 80%. Qual o lucro em caso de acerto?",
      "options": [
        "R$115,00",
        "R$92,00",
        "R$207,00",
        "R$80,50"
      ],
      "correct": 1,
      "explain": "80% de R$115,00 = R$92,00."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Você tem duas corretoras regulamentadas: uma paga 80% e tem saque em 24h; outra paga 90% e tem saque em 5 dias úteis. Para operações frequentes, qual tende a ser mais prática?",
      "options": [
        "A de 90% com saque em 5 dias, sempre",
        "Depende do seu perfil — saque rápido pode valer mais que payout um pouco maior, dependendo da frequência de operação",
        "A de 80% é sempre pior",
        "Payout não importa nunca"
      ],
      "correct": 1,
      "explain": "A escolha depende do perfil do trader — quem saca com frequência pode preferir agilidade a alguns pontos percentuais de payout."
    }
  ]
},
  "1-24": {
  "title": "Revisão Final do Módulo 1",
  "steps": [
    {
      "level": "Revisão Final · Módulo 1",
      "type": "info",
      "title": "Você está quase lá!",
      "body": "Essa é a última lição antes da Prova Final do Módulo 1. Vamos revisar os pontos-chave de tudo que você aprendeu sobre Fundamentos.",
      "pipTip": "Você já percorreu um caminho e tanto — hora de consolidar tudo."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Entrada de R$95,00 com payout de 86%. Qual o lucro em caso de acerto?",
      "options": [
        "R$81,70",
        "R$176,70",
        "R$72,20",
        "R$95,00"
      ],
      "correct": 0,
      "explain": "86% de R$95,00 = R$81,70."
    },
    {
      "level": "Revisão Final · Módulo 1",
      "type": "mcq",
      "question": "O que acontece se sua previsão de direção estiver ERRADA na expiração?",
      "options": [
        "Recebe metade do payout",
        "Perde o valor investido na operação",
        "A corretora devolve o dinheiro",
        "A operação se prorroga"
      ],
      "correct": 1,
      "explain": "Se a direção prevista estiver errada, o valor investido é perdido."
    },
    {
      "level": "Revisão Final · Módulo 1",
      "type": "mcq",
      "question": "Risco de ruína aumenta quando:",
      "options": [
        "O percentual de risco por entrada é reduzido",
        "O percentual de risco por entrada é elevado demais",
        "O payout aumenta",
        "A corretora é regulamentada"
      ],
      "correct": 1,
      "explain": "Quanto maior o risco por entrada, exponencialmente maior o risco de ruína."
    },
    {
      "level": "Revisão Final · Módulo 1",
      "type": "mcq",
      "question": "Um pavio longo em uma vela normalmente indica:",
      "options": [
        "Erro no gráfico",
        "Rejeição de preço naquela região",
        "Mercado fechado",
        "Aumento do payout"
      ],
      "correct": 1,
      "explain": "Pavio longo mostra que o preço foi rejeitado e recuou naquela região."
    }
  ]
},
  "2-15": {
  "title": "Suporte e Resistência em Múltiplos Toques",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Zonas Testadas Repetidas Vezes",
      "body": "Uma zona testada 5, 6, 7 vezes sem romper acumula ainda mais relevância técnica — mas atenção: quanto mais testada, também mais perto pode estar de finalmente romper.",
      "pipTip": "Quanto mais uma zona resiste, maior o respeito — mas nada dura para sempre."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma zona testada 6 vezes sem romper é, ao mesmo tempo:",
      "options": [
        "Irrelevante para análise",
        "Uma zona forte, mas também mais próxima estatisticamente de um eventual rompimento",
        "Sempre imune a qualquer rompimento",
        "Só válida em gráfico de linha"
      ],
      "correct": 1,
      "explain": "Zonas muito testadas são fortes, mas cada novo teste também aumenta a chance estatística de romperem eventualmente."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "O preço respeita a estrutura de fundos ascendentes e retoma a alta. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 41,
            "c": 54,
            "h": 55,
            "l": 39
          },
          {
            "o": 54,
            "c": 67,
            "h": 68,
            "l": 52
          },
          {
            "o": 67,
            "c": 77,
            "h": 78,
            "l": 64
          },
          {
            "o": 77,
            "c": 92,
            "h": 95,
            "l": 76
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Estrutura respeitada reforça a continuidade da tendência de alta."
    }
  ]
},
  "2-16": {
  "title": "Linhas de Tendência de Longo Prazo",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "LTAs e LTBs que Duram Meses",
      "body": "Linhas de tendência traçadas em gráficos de longo prazo (semanal, mensal) tendem a ser mais respeitadas que linhas de curtíssimo prazo, por refletirem um comportamento mais consolidado do mercado.",
      "pipTip": "Linhas antigas e testadas carregam mais peso que linhas recém-traçadas."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma LTA traçada num gráfico semanal, testada várias vezes ao longo de meses, tende a ser:",
      "options": [
        "Menos confiável que uma LTA de 5 minutos",
        "Mais respeitada, por refletir um comportamento consolidado de longo prazo",
        "Irrelevante para operações de curto prazo",
        "Sempre rompida no primeiro teste"
      ],
      "correct": 1,
      "explain": "Linhas de tendência de longo prazo, testadas repetidamente, tendem a ser mais respeitadas tecnicamente."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "O preço respeita a estrutura de topos descendentes e retoma a queda. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 87,
            "c": 75,
            "h": 90,
            "l": 74
          },
          {
            "o": 75,
            "c": 61,
            "h": 80,
            "l": 58
          },
          {
            "o": 61,
            "c": 45,
            "h": 62,
            "l": 44
          },
          {
            "o": 45,
            "c": 35,
            "h": 50,
            "l": 33
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "Estrutura respeitada reforça a continuidade da tendência de baixa."
    }
  ]
},
  "2-17": {
  "title": "Canais e Gerenciamento de Expectativa",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Operando Dentro de um Canal com Realismo",
      "body": "Operar dentro de um canal exige realismo: nem toda entrada na banda vai funcionar, e o canal pode se romper a qualquer momento. Gerenciamento de banca continua essencial mesmo dentro de um cenário aparentemente 'previsível'.",
      "pipTip": "Um canal bem desenhado não é uma garantia — é só um mapa provável."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Operar dentro de um canal elimina a necessidade de gerenciamento de banca?",
      "options": [
        "Sim, canais são 100% confiáveis",
        "Não — o canal pode romper a qualquer momento, e o gerenciamento continua essencial",
        "Sim, mas só em canais de alta",
        "Não, mas só em canais de baixa"
      ],
      "correct": 1,
      "explain": "Nenhuma estrutura gráfica, por mais consistente que pareça, elimina a necessidade de gerenciamento de risco."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um canal que já foi respeitado 5 vezes seguidas tem chance de romper na 6ª tentativa?",
      "options": [
        "Não, nunca rompe depois de 5 respeitos",
        "Sim — nenhuma estrutura garante repetição infinita",
        "Só rompe se o payout mudar",
        "É impossível saber, mas nunca deve ser considerado"
      ],
      "correct": 1,
      "explain": "Mesmo estruturas muito respeitadas podem romper — reconhecer esse risco faz parte da disciplina."
    }
  ]
},
  "2-18": {
  "title": "Identificando o Fim de uma Tendência",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Sinais de Exaustão",
      "body": "Velas cada vez menores, pavios de rejeição mais frequentes e dificuldade de formar novos topos/fundos na mesma velocidade são sinais de que uma tendência pode estar perdendo força.",
      "pipTip": "Toda tendência, cedo ou tarde, mostra sinais de cansaço antes de mudar."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Velas cada vez menores dentro de uma tendência forte podem sinalizar:",
      "options": [
        "Continuação garantida com a mesma força",
        "Possível exaustão do movimento, pedindo mais atenção",
        "Aumento do payout",
        "Erro de gráfico"
      ],
      "correct": 1,
      "explain": "Redução do tamanho das velas é um sinal clássico de enfraquecimento de um movimento."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Dificuldade crescente de formar novos topos numa tendência de alta sugere:",
      "options": [
        "Força total mantida",
        "Possível perda de força compradora",
        "Aumento automático do payout",
        "Nada relevante"
      ],
      "correct": 1,
      "explain": "Quando fica mais difícil formar novos topos, isso é um sinal de possível perda de força da tendência."
    }
  ]
},
  "2-19": {
  "title": "Revisão Avançada III",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Consolidando Mais um Pouco",
      "body": "Vamos revisar zonas múltiplas testadas, linhas de longo prazo, canais e sinais de exaustão de tendência.",
      "pipTip": "Mais uma camada de conhecimento consolidada."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma zona muito testada é, ao mesmo tempo, forte e:",
      "options": [
        "Impossível de romper",
        "Estatisticamente mais próxima de um eventual rompimento",
        "Sempre respeitada para sempre",
        "Irrelevante"
      ],
      "correct": 1,
      "explain": "Zonas muito testadas são fortes, mas cada teste aproxima estatisticamente de um eventual rompimento."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Sinais de exaustão de tendência incluem:",
      "options": [
        "Velas cada vez maiores e mais fortes",
        "Velas cada vez menores e mais pavios de rejeição",
        "Aumento do payout",
        "Nenhum sinal visível"
      ],
      "correct": 1,
      "explain": "Velas menores e mais pavios de rejeição são sinais clássicos de exaustão de um movimento."
    }
  ]
},
  "2-20": {
  "title": "Suporte/Resistência em Ativos Diferentes",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Cada Ativo, Seu Comportamento",
      "body": "Ativos diferentes reagem de formas distintas às mesmas técnicas de suporte/resistência — moedas costumam ser mais 'educadas' com zonas técnicas do que criptomoedas, por exemplo, que têm mais volatilidade.",
      "pipTip": "Conhecer o 'temperamento' do ativo que você opera é parte da análise."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Ativos com volatilidade muito alta (ex: algumas criptomoedas) tendem a:",
      "options": [
        "Respeitar zonas técnicas com mais precisão que ativos menos voláteis",
        "Respeitar zonas técnicas de forma menos previsível, exigindo mais cautela",
        "Não ter nenhuma zona técnica válida",
        "Ter payout sempre menor"
      ],
      "correct": 1,
      "explain": "Ativos muito voláteis tendem a ter reações menos previsíveis em zonas técnicas, exigindo mais cautela na análise."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Estrutura de fundos ascendentes respeitada, retomando a alta. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 51,
            "c": 61,
            "h": 62,
            "l": 49
          },
          {
            "o": 61,
            "c": 77,
            "h": 79,
            "l": 58
          },
          {
            "o": 77,
            "c": 92,
            "h": 94,
            "l": 74
          },
          {
            "o": 92,
            "c": 104,
            "h": 106,
            "l": 90
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Estrutura respeitada reforça continuidade da alta."
    }
  ]
},
  "2-21": {
  "title": "Zonas de Congestão",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Onde o Preço 'Trava'",
      "body": "Uma zona de congestão é uma faixa de preço onde o mercado fica 'preso' por um tempo, sem tendência clara, formando várias velas pequenas na mesma região — geralmente antecede um movimento mais forte quando rompe.",
      "pipTip": "Congestão é o mercado tomando fôlego antes do próximo movimento."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma zona de congestão se caracteriza por:",
      "options": [
        "Velas grandes e direcionais",
        "Várias velas pequenas na mesma região, sem tendência clara",
        "Payout automaticamente maior",
        "Ausência total de velas"
      ],
      "correct": 1,
      "explain": "A congestão é marcada por velas pequenas e sem direção clara concentradas numa faixa de preço."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "O rompimento de uma zona de congestão prolongada tende a gerar:",
      "options": [
        "Um movimento mais fraco que o normal",
        "Um movimento potencialmente mais forte, pela energia acumulada",
        "Nenhum efeito relevante",
        "Redução do payout"
      ],
      "correct": 1,
      "explain": "Períodos de congestão acumulam 'energia' que costuma ser liberada com força no rompimento."
    }
  ]
},
  "2-22": {
  "title": "Comparando Timeframes na Análise Gráfica",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Zoom In, Zoom Out",
      "body": "Analisar o mesmo ativo em timeframes diferentes (ex: 15 minutos e 1 hora) ajuda a confirmar se uma zona ou tendência é relevante em múltiplas escalas de tempo, aumentando a confiança da análise.",
      "pipTip": "Ver o mesmo cenário de longe e de perto revela coisas que uma visão única não mostra."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma zona de suporte que aparece tanto no gráfico de 15 minutos quanto no de 1 hora é:",
      "options": [
        "Menos confiável que uma zona vista em um só timeframe",
        "Mais confiável, por ser confirmada em múltiplas escalas de tempo",
        "Irrelevante",
        "Só válida no timeframe menor"
      ],
      "correct": 1,
      "explain": "Confirmação em múltiplos timeframes é uma forma de confluência que reforça a relevância da zona."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Estrutura de topos descendentes respeitada, retomando a queda. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 81,
            "c": 65,
            "h": 84,
            "l": 61
          },
          {
            "o": 65,
            "c": 51,
            "h": 67,
            "l": 48
          },
          {
            "o": 51,
            "c": 37,
            "h": 53,
            "l": 35
          },
          {
            "o": 37,
            "c": 28,
            "h": 42,
            "l": 26
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "Estrutura respeitada reforça continuidade da baixa."
    }
  ]
},
  "2-23": {
  "title": "Cenário Integrado de Análise Gráfica",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Juntando Tudo que Você Aprendeu",
      "body": "Vamos praticar um cenário que combina zona, tendência e contexto de timeframe ao mesmo tempo, simulando uma decisão real de entrada.",
      "pipTip": "No mercado real, você nunca olha só uma coisa de cada vez — pratique juntar as peças."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Ao analisar suporte, tendência de fundo e confirmação em múltiplos timeframes ao mesmo tempo, você está aplicando:",
      "options": [
        "Uma única ferramenta isolada",
        "Uma análise combinada, aumentando a robustez da decisão",
        "Um erro de sobreposição de informações",
        "Redução do payout"
      ],
      "correct": 1,
      "explain": "Combinar várias ferramentas técnicas ao mesmo tempo é o que caracteriza uma análise robusta e completa."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Suporte respeitado dentro de uma tendência de alta confirmada em múltiplos timeframes. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 50,
            "c": 65,
            "h": 69,
            "l": 45
          },
          {
            "o": 65,
            "c": 77,
            "h": 78,
            "l": 64
          },
          {
            "o": 77,
            "c": 87,
            "h": 91,
            "l": 74
          },
          {
            "o": 87,
            "c": 98,
            "h": 102,
            "l": 82
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Confluência entre zona, tendência e múltiplos timeframes reforça fortemente a entrada em CALL."
    }
  ]
},
  "2-24": {
  "title": "Revisão Avançada IV",
  "steps": [
    {
      "level": "Revisão · Módulo 2 Avançado IV",
      "type": "info",
      "title": "Consolidando Antes da Prova",
      "body": "Última revisão antes da Prova Final do Módulo 2 — vamos repassar zonas, congestão, timeframes e análise combinada.",
      "pipTip": "Você está pronto para a Prova Final — essa revisão fecha o ciclo."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma zona de congestão antecede geralmente:",
      "options": [
        "Um movimento mais fraco",
        "Um possível movimento mais forte no rompimento",
        "Nenhum efeito",
        "Redução do payout"
      ],
      "correct": 1,
      "explain": "Períodos de congestão acumulam energia liberada com força no rompimento."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Confirmar uma zona em múltiplos timeframes:",
      "options": [
        "Reduz a confiabilidade",
        "Aumenta a confiabilidade da análise",
        "Não tem efeito",
        "Só vale para criptomoedas"
      ],
      "correct": 1,
      "explain": "Confirmação multi-timeframe é uma forma de confluência que reforça a análise."
    }
  ]
},
  "3-15": {
  "title": "Reconhecendo Padrões em Velocidade",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Treino de Reflexo Visual",
      "body": "Reconhecer um padrão rapidamente, sem precisar analisar corpo e pavio devagar, é uma habilidade que se desenvolve com repetição — vamos treinar reconhecimento rápido.",
      "pipTip": "Quanto mais você pratica, mais o reconhecimento vira automático."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Identifique o padrão: Martelo formado após queda. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 80,
            "c": 66,
            "h": 85,
            "l": 61
          },
          {
            "o": 66,
            "c": 50,
            "h": 67,
            "l": 48
          },
          {
            "o": 50,
            "c": 39,
            "h": 55,
            "l": 37
          },
          {
            "o": 37,
            "c": 39,
            "h": 42,
            "l": 8
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Martelo após queda é sinal clássico de reversão para cima."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Identifique o padrão: Pinbar de baixa formado após alta. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 30,
            "c": 46,
            "h": 47,
            "l": 25
          },
          {
            "o": 46,
            "c": 57,
            "h": 58,
            "l": 43
          },
          {
            "o": 57,
            "c": 73,
            "h": 74,
            "l": 54
          },
          {
            "o": 75,
            "c": 71,
            "h": 99,
            "l": 70
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "Pinbar de baixa após alta é sinal clássico de reversão para baixo."
    }
  ]
},
  "3-16": {
  "title": "Padrões que Falham: Estudo de Caso",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Nem Todo Padrão Confirma",
      "body": "Mesmo um padrão bem formado pode falhar — o mercado não garante 100%. Entender que padrões são probabilidade, não certeza, é essencial para gerenciar expectativa.",
      "pipTip": "Um padrão aumenta a probabilidade, nunca garante o resultado."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um padrão de candlestick bem formado garante 100% de acerto?",
      "options": [
        "Sim, sempre",
        "Não — padrões aumentam a probabilidade, mas não garantem o resultado",
        "Só garante se o payout for alto",
        "Depende da cor da vela"
      ],
      "correct": 1,
      "explain": "Nenhum padrão técnico garante 100% de acerto — eles indicam probabilidade, não certeza."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Se um padrão falha ocasionalmente, isso significa que ele é inútil?",
      "options": [
        "Sim, deve ser abandonado",
        "Não — mesmo padrões com boa taxa de acerto falham parte das vezes, é estatisticamente esperado",
        "Sim, mas só em gráfico de linha",
        "Não tem relação com estatística"
      ],
      "correct": 1,
      "explain": "Falhas ocasionais são esperadas estatisticamente e não invalidam o valor de um padrão com boa taxa histórica."
    }
  ]
},
  "3-17": {
  "title": "Estrela da Manhã e da Noite na Prática",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Revendo os Padrões de 3 Velas",
      "body": "Vamos revisar na prática a Estrela da Manhã e da Noite com novos exemplos, reforçando o reconhecimento visual do padrão completo.",
      "pipTip": "Repetição espaçada é o segredo para fixar reconhecimento visual."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Padrão de 3 velas ao final de uma queda: Estrela da Manhã. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 71,
            "c": 61,
            "h": 76,
            "l": 57
          },
          {
            "o": 61,
            "c": 46,
            "h": 65,
            "l": 42
          },
          {
            "o": 46,
            "c": 32,
            "h": 49,
            "l": 31
          },
          {
            "o": 30,
            "c": 31,
            "h": 32,
            "l": 27
          },
          {
            "o": 31,
            "c": 53,
            "h": 54,
            "l": 30
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Estrela da Manhã confirma reversão para cima após queda."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Padrão de 3 velas ao final de uma alta: Estrela da Noite. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 38,
            "c": 51,
            "h": 54,
            "l": 36
          },
          {
            "o": 51,
            "c": 65,
            "h": 69,
            "l": 46
          },
          {
            "o": 65,
            "c": 83,
            "h": 86,
            "l": 62
          },
          {
            "o": 84,
            "c": 85,
            "h": 86,
            "l": 81
          },
          {
            "o": 85,
            "c": 63,
            "h": 88,
            "l": 60
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "Estrela da Noite confirma reversão para baixo após alta."
    }
  ]
},
  "3-18": {
  "title": "Padrões e Gerenciamento Juntos",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Reconhecer Não Basta",
      "body": "Reconhecer um padrão perfeitamente não adianta se a entrada não respeitar o gerenciamento de banca. Padrão e gestão de risco caminham sempre juntos.",
      "pipTip": "De que adianta acertar o padrão se o valor arriscado quebra a banca no primeiro erro?"
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Reconhecer um padrão de candlestick perfeitamente substitui a necessidade de gerenciamento de banca?",
      "options": [
        "Sim, padrão bem reconhecido dispensa gerenciamento",
        "Não — gerenciamento de banca é necessário independente da qualidade do padrão",
        "Só dispensa em Martelo",
        "Só dispensa em Doji"
      ],
      "correct": 1,
      "explain": "Nenhum padrão, por mais confiável, substitui a necessidade de um bom gerenciamento de risco."
    }
  ]
},
  "3-19": {
  "title": "Revisão Avançada III",
  "steps": [
    {
      "level": "Revisão · Módulo 3 Avançado III",
      "type": "info",
      "title": "Consolidando Mais um Pouco",
      "body": "Vamos revisar reconhecimento rápido, padrões que falham e a relação entre padrão e gerenciamento.",
      "pipTip": "Mais uma camada de prática consolidada."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Padrões de candlestick, tecnicamente, representam:",
      "options": [
        "Certeza absoluta de resultado",
        "Probabilidade, não garantia de resultado",
        "Um tipo de payout",
        "Um erro de gráfico"
      ],
      "correct": 1,
      "explain": "Padrões indicam probabilidade — nunca certeza absoluta do resultado."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Martelo formado após queda longa. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 68,
            "c": 59,
            "h": 73,
            "l": 58
          },
          {
            "o": 59,
            "c": 50,
            "h": 63,
            "l": 49
          },
          {
            "o": 50,
            "c": 38,
            "h": 51,
            "l": 33
          },
          {
            "o": 36,
            "c": 38,
            "h": 40,
            "l": 13
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Martelo após queda longa reforça o sinal de reversão para cima."
    }
  ]
},
  "3-20": {
  "title": "Combinando 3 ou Mais Sinais",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "O Setup Ideal",
      "body": "O setup mais robusto combina: estrutura de tendência + zona de preço + padrão de candlestick, todos apontando na mesma direção ao mesmo tempo.",
      "pipTip": "Três sinais concordando é o cenário dos sonhos de qualquer trader disciplinado."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Tendência de alta + suporte respeitado + Martelo formado ao mesmo tempo. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 82,
            "c": 70,
            "h": 87,
            "l": 68
          },
          {
            "o": 70,
            "c": 55,
            "h": 73,
            "l": 50
          },
          {
            "o": 55,
            "c": 39,
            "h": 57,
            "l": 34
          },
          {
            "o": 36,
            "c": 38,
            "h": 39,
            "l": 5
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Três sinais concordando (tendência, zona e padrão) formam um setup de alta probabilidade."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um setup com 3 sinais técnicos concordando é, em geral:",
      "options": [
        "Mais fraco que um setup com 1 sinal isolado",
        "Mais robusto que um setup com poucos sinais concordando",
        "Sempre garantido",
        "Irrelevante"
      ],
      "correct": 1,
      "explain": "Quanto mais sinais independentes concordam, mais robusto tende a ser o setup."
    }
  ]
},
  "3-21": {
  "title": "Padrões em Ativos Voláteis",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Cuidado com o Exagero",
      "body": "Em ativos muito voláteis, os padrões de candlestick podem aparecer de forma exagerada e menos confiável — vale ter mais cautela e talvez esperar confirmação extra.",
      "pipTip": "Volatilidade extrema pode distorcer até os padrões mais clássicos."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Em ativos muito voláteis, os padrões de candlestick tendem a ser:",
      "options": [
        "Sempre mais confiáveis",
        "Potencialmente menos confiáveis, exigindo mais cautela",
        "Impossíveis de existir",
        "Sempre iguais aos ativos normais"
      ],
      "correct": 1,
      "explain": "Alta volatilidade pode distorcer a formação de padrões, exigindo mais cautela na interpretação."
    }
  ]
},
  "3-22": {
  "title": "Simulado de Reconhecimento",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Praticando sob Pressão",
      "body": "Vamos simular uma sequência de decisões rápidas de reconhecimento de padrão, como aconteceria numa sessão real de operações.",
      "pipTip": "Praticar sob um pouco de pressão prepara você para o cenário real."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Reconheça rapidamente: Pinbar de alta formado no suporte. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 66,
            "c": 52,
            "h": 71,
            "l": 51
          },
          {
            "o": 52,
            "c": 36,
            "h": 54,
            "l": 32
          },
          {
            "o": 36,
            "c": 27,
            "h": 38,
            "l": 23
          },
          {
            "o": 24,
            "c": 28,
            "h": 29,
            "l": 2
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Pinbar de alta no suporte reforça sinal de reversão para cima."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Reconheça rapidamente: Estrela da Noite formada no topo. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 53,
            "c": 62,
            "h": 65,
            "l": 51
          },
          {
            "o": 62,
            "c": 77,
            "h": 81,
            "l": 57
          },
          {
            "o": 77,
            "c": 93,
            "h": 94,
            "l": 75
          },
          {
            "o": 94,
            "c": 96,
            "h": 98,
            "l": 93
          },
          {
            "o": 96,
            "c": 69,
            "h": 97,
            "l": 68
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "Estrela da Noite no topo reforça sinal de reversão para baixo."
    }
  ]
},
  "3-23": {
  "title": "Preparando-se para a Prova Final",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Revisão Focada",
      "body": "Antes da Prova Final do Módulo 3, revise mentalmente: Martelo/Enforcado, Engolfo, Doji, Pinbar, Estrelas, 3 Soldados/Corvos e Harami.",
      "pipTip": "Uma boa revisão final vale por horas de estudo disperso."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "O Harami se caracteriza por:",
      "options": [
        "Corpo maior que o anterior",
        "Corpo pequeno contido dentro do corpo da vela anterior",
        "Ausência de corpo",
        "Sempre a mesma cor do Doji"
      ],
      "correct": 1,
      "explain": "O Harami tem o corpo da segunda vela totalmente contido no corpo da vela anterior."
    }
  ]
},
  "3-24": {
  "title": "Revisão Final do Módulo 3",
  "steps": [
    {
      "level": "Revisão Final · Módulo 3",
      "type": "info",
      "title": "Você está quase lá!",
      "body": "Última lição antes da Prova Final do Módulo 3 — vamos consolidar tudo sobre padrões de candlestick.",
      "pipTip": "Você já domina um conjunto robusto de padrões — hora de provar isso na prática."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um Engolfo de Alta válido precisa:",
      "options": [
        "Cobrir parcialmente o corpo anterior",
        "Cobrir totalmente o corpo da vela anterior",
        "Ter a mesma cor da vela anterior",
        "Ter pavios maiores que o corpo"
      ],
      "correct": 1,
      "explain": "O Engolfo exige cobertura total do corpo da vela anterior."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Três Soldados Brancos formados em sequência. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 47,
            "c": 61,
            "h": 64,
            "l": 45
          },
          {
            "o": 63,
            "c": 73,
            "h": 76,
            "l": 60
          },
          {
            "o": 73,
            "c": 87,
            "h": 88,
            "l": 72
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Três Soldados Brancos mostram força compradora contínua."
    }
  ]
},
  "4-15": {
  "title": "Combinando MACD e RSI",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Duas Ferramentas, Uma Decisão",
      "body": "MACD cruzando para cima junto com RSI saindo da sobrevenda formam uma confluência interessante — dois indicadores diferentes, medindo coisas diferentes, concordando na mesma direção.",
      "pipTip": "Indicadores diferentes que concordam contam uma história mais confiável."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "MACD cruzando para cima e RSI saindo da zona de sobrevenda ao mesmo tempo é um exemplo de:",
      "options": [
        "Sinais contraditórios",
        "Confluência entre dois indicadores diferentes, reforçando o sinal de alta",
        "Erro de gráfico",
        "Payout automaticamente maior"
      ],
      "correct": 1,
      "explain": "Dois indicadores diferentes concordando na mesma direção reforçam a confiabilidade do sinal."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "RSI em 24 (sobrevenda) e preço formando fundo, com MACD começando a cruzar para cima. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 71,
            "c": 56,
            "h": 76,
            "l": 53
          },
          {
            "o": 56,
            "c": 47,
            "h": 57,
            "l": 44
          },
          {
            "o": 47,
            "c": 31,
            "h": 52,
            "l": 28
          },
          {
            "o": 31,
            "c": 21,
            "h": 32,
            "l": 19
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Confluência entre RSI saindo da sobrevenda e MACD cruzando para cima reforça a entrada em CALL.",
      "rsi": 24
    }
  ]
},
  "4-16": {
  "title": "Falsos Sinais de Indicadores",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Nem Todo Sinal é Confiável",
      "body": "Indicadores também podem dar sinais falsos, especialmente em mercados muito voláteis ou lateralizados. Reconhecer isso evita confiança cega em qualquer ferramenta isolada.",
      "pipTip": "Nenhuma ferramenta é infalível — nem os indicadores mais usados do mercado."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Indicadores técnicos podem dar sinais falsos?",
      "options": [
        "Não, indicadores nunca erram",
        "Sim — especialmente em mercados voláteis ou lateralizados",
        "Só o RSI erra, os outros não",
        "Só acontece de madrugada"
      ],
      "correct": 1,
      "explain": "Todo indicador técnico está sujeito a sinais falsos, principalmente em condições de mercado adversas."
    }
  ]
},
  "4-17": {
  "title": "Indicadores e Notícias de Mercado",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Quando o Fundamental Interfere",
      "body": "Notícias importantes podem invalidar temporariamente sinais técnicos de indicadores — um RSI em sobrevenda pode continuar caindo se uma notícia negativa forte aparecer.",
      "pipTip": "O contexto fundamental às vezes fala mais alto que qualquer indicador técnico."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma notícia de mercado muito forte pode:",
      "options": [
        "Nunca afetar sinais técnicos de indicadores",
        "Invalidar temporariamente sinais técnicos, mesmo bem formados",
        "Aumentar automaticamente o payout",
        "Só afetar gráficos de linha"
      ],
      "correct": 1,
      "explain": "Eventos fundamentais fortes podem sobrepor temporariamente qualquer leitura técnica de indicador."
    }
  ]
},
  "4-18": {
  "title": "Simulado de Indicadores Combinados",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Praticando a Leitura Completa",
      "body": "Vamos praticar cenários combinando RSI, Bollinger e Médias Móveis ao mesmo tempo, como aconteceria numa análise real.",
      "pipTip": "A prática de combinar múltiplos indicadores é o que separa análise superficial de análise robusta."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "RSI em 79 (sobrecompra), preço na banda superior de Bollinger, e cruzamento de médias para baixo. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 50,
            "c": 64,
            "h": 69,
            "l": 48
          },
          {
            "o": 64,
            "c": 76,
            "h": 77,
            "l": 59
          },
          {
            "o": 76,
            "c": 89,
            "h": 92,
            "l": 75
          },
          {
            "o": 89,
            "c": 99,
            "h": 104,
            "l": 84
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "Três sinais de indicadores diferentes concordando reforçam fortemente a entrada em PUT.",
      "rsi": 79
    }
  ]
},
  "4-19": {
  "title": "Revisão Avançada III",
  "steps": [
    {
      "level": "Revisão · Módulo 4 Avançado III",
      "type": "info",
      "title": "Consolidando Mais um Pouco",
      "body": "Vamos revisar confluência entre MACD e RSI, falsos sinais e o impacto de notícias antes da Prova Final.",
      "pipTip": "Mais uma camada de conhecimento consolidada sobre indicadores."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Combinar MACD e RSI concordando é um exemplo de:",
      "options": [
        "Sinal isolado fraco",
        "Confluência entre indicadores diferentes",
        "Erro de análise",
        "Redução do payout"
      ],
      "correct": 1,
      "explain": "Múltiplos indicadores concordando formam uma confluência que reforça a confiabilidade do sinal."
    }
  ]
},
  "4-20": {
  "title": "Indicadores em Diferentes Ativos",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Ajustando a Sensibilidade",
      "body": "Ativos diferentes podem exigir ajustes finos nos parâmetros dos indicadores (ex: período do RSI) para refletir melhor seu comportamento típico de volatilidade.",
      "pipTip": "Um indicador 'padrão' nem sempre é o ideal para todo ativo."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Ajustar o período de um indicador (ex: RSI de 14 para 21) pode ajudar a:",
      "options": [
        "Nunca muda nada na prática",
        "Adequar melhor o indicador ao comportamento típico daquele ativo específico",
        "Aumentar o payout automaticamente",
        "Eliminar todo o risco"
      ],
      "correct": 1,
      "explain": "Ajustar parâmetros pode adequar melhor o indicador ao comportamento de volatilidade específico de um ativo."
    }
  ]
},
  "4-21": {
  "title": "O Erro de Usar Indicador Demais",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Excesso de Informação",
      "body": "Usar 6 ou 7 indicadores ao mesmo tempo, todos na mesma tela, tende a gerar mais confusão do que clareza — menos costuma ser mais quando se trata de indicadores.",
      "pipTip": "Excesso de ferramentas pode ofuscar em vez de esclarecer."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Usar muitos indicadores ao mesmo tempo (6, 7 ou mais) tende a:",
      "options": [
        "Sempre melhorar a clareza da análise",
        "Gerar mais confusão do que clareza, dificultando a decisão",
        "Ser sempre recomendado",
        "Aumentar o payout"
      ],
      "correct": 1,
      "explain": "Excesso de indicadores simultâneos tende a confundir mais do que ajudar na tomada de decisão."
    }
  ]
},
  "4-22": {
  "title": "Simulado Final de Indicadores",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Última Prática antes da Prova",
      "body": "Vamos praticar mais um cenário completo, combinando indicadores e price action, para fechar o módulo com confiança.",
      "pipTip": "Essa é a sua última prática antes de encarar a Prova Final do Módulo 4."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "RSI em 27 (sobrevenda), preço tocando a banda inferior de Bollinger, com Martelo formado. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 60,
            "c": 46,
            "h": 64,
            "l": 43
          },
          {
            "o": 46,
            "c": 35,
            "h": 49,
            "l": 33
          },
          {
            "o": 35,
            "c": 24,
            "h": 40,
            "l": 19
          },
          {
            "o": 24,
            "c": 9,
            "h": 27,
            "l": 7
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Três sinais concordando (RSI, banda e padrão) formam uma confluência forte de CALL.",
      "rsi": 27
    }
  ]
},
  "4-23": {
  "title": "Preparando-se para a Prova Final",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Revisão Focada",
      "body": "Revise mentalmente: RSI, Bollinger, Médias Móveis, MACD, divergência e confluência antes da Prova Final do Módulo 4.",
      "pipTip": "Uma boa revisão final consolida tudo o que você já sabe."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "RSI acima de 70 indica:",
      "options": [
        "Sobrevenda",
        "Sobrecompra",
        "Payout alto",
        "Mercado lateral obrigatório"
      ],
      "correct": 1,
      "explain": "RSI acima de 70 indica sobrecompra — movimento de alta esticado."
    }
  ]
},
  "4-24": {
  "title": "Revisão Final do Módulo 4",
  "steps": [
    {
      "level": "Revisão Final · Módulo 4",
      "type": "info",
      "title": "Você está quase lá!",
      "body": "Última lição antes da Prova Final do Módulo 4 — vamos consolidar tudo sobre indicadores técnicos.",
      "pipTip": "Você já domina um conjunto robusto de indicadores — hora de provar isso na prática."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "A melhor forma de usar indicadores é:",
      "options": [
        "Sempre sozinhos",
        "Combinados entre si e com a leitura de preço",
        "Apenas de madrugada",
        "Somente em linha"
      ],
      "correct": 1,
      "explain": "Indicadores funcionam melhor combinados entre si e com a leitura de price action."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "RSI em 75, banda superior tocada, cruzamento de médias para baixo. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 50,
            "c": 59,
            "h": 63,
            "l": 47
          },
          {
            "o": 59,
            "c": 73,
            "h": 75,
            "l": 57
          },
          {
            "o": 73,
            "c": 86,
            "h": 91,
            "l": 71
          },
          {
            "o": 86,
            "c": 97,
            "h": 99,
            "l": 83
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "Confluência de três sinais reforça fortemente a entrada em PUT.",
      "rsi": 75
    }
  ]
},
  "5-15": {
  "title": "Recuperação Emocional após Perdas",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Voltar ao Jogo com a Cabeça no Lugar",
      "body": "Depois de uma perda significativa, dar um tempo antes de voltar a operar ajuda a evitar decisões tomadas sob efeito de frustração ou ansiedade.",
      "pipTip": "Voltar cedo demais, com a cabeça quente, é como dirigir bêbado — parece controlável, mas não é."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Depois de uma perda significativa, a atitude mais recomendada antes de voltar a operar é:",
      "options": [
        "Voltar imediatamente para 'recuperar'",
        "Dar um tempo para recuperar o equilíbrio emocional antes de voltar",
        "Aumentar o valor da próxima entrada",
        "Trocar de corretora imediatamente"
      ],
      "correct": 1,
      "explain": "Um intervalo para recuperar o equilíbrio emocional evita decisões tomadas sob frustração."
    }
  ]
},
  "5-16": {
  "title": "Gestão de Expectativa com Iniciantes",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Nem Todo Mês é Igual",
      "body": "É normal que traders iniciantes tenham meses de resultado neutro ou levemente negativo enquanto ainda estão desenvolvendo disciplina — isso não significa fracasso, é parte do processo de aprendizado.",
      "pipTip": "O aprendizado tem seu próprio ritmo — respeite o processo."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um mês de resultado neutro para um trader iniciante, ainda em desenvolvimento, é:",
      "options": [
        "Sempre sinal de fracasso definitivo",
        "Parte normal do processo de aprendizado e desenvolvimento de disciplina",
        "Motivo para desistir imediatamente",
        "Impossível de acontecer"
      ],
      "correct": 1,
      "explain": "Meses neutros ou levemente negativos fazem parte do processo natural de aprendizado."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Banca de R$4.000,00, risco de 1% por entrada. Qual o valor máximo da entrada?",
      "options": [
        "R$80,00",
        "R$20,00",
        "R$4.000,00",
        "R$40,00"
      ],
      "correct": 3,
      "explain": "1% de R$4.000,00 = R$40,00."
    }
  ]
},
  "5-17": {
  "title": "Comparando Soros e Martingale na Prática",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Duas Filosofias Opostas",
      "body": "Soros reinveste lucro (aumenta na vitória); Martingale dobra na perda (aumenta na derrota). São filosofias opostas de gerenciamento de risco progressivo — uma cresce com o sucesso, a outra tenta 'consertar' o fracasso.",
      "pipTip": "Uma estratégia te recompensa quando acerta; a outra te pune mais quando erra."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Qual a principal diferença filosófica entre Soros e Martingale?",
      "options": [
        "Não há diferença nenhuma",
        "Soros aumenta o valor após vitórias; Martingale aumenta o valor após derrotas",
        "Os dois sempre dobram o valor",
        "Os dois são a mesma estratégia com nomes diferentes"
      ],
      "correct": 1,
      "explain": "Soros reinveste o lucro das vitórias; Martingale dobra o valor após as derrotas — filosofias opostas."
    }
  ]
},
  "5-18": {
  "title": "Simulado de Gestão Emocional",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Praticando Cenários Reais",
      "body": "Vamos praticar mais um cenário de decisão emocional, simulando a pressão real de uma sequência de resultados.",
      "pipTip": "Praticar mentalmente esses cenários prepara você para agir bem quando acontecerem de verdade."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Banca de R$600,00, risco de 3% por entrada. Qual o valor máximo da entrada?",
      "options": [
        "R$600,00",
        "R$9,00",
        "R$18,00",
        "R$36,00"
      ],
      "correct": 2,
      "explain": "3% de R$600,00 = R$18,00."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Você está com resultado neutro no mês e sente vontade de aumentar o risco para 'garantir' lucro antes do fim do mês. Isso é:",
      "options": [
        "Uma boa estratégia",
        "Um sinal de decisão emocional, contrária à disciplina de gerenciamento",
        "Sempre recomendado",
        "Irrelevante para o resultado"
      ],
      "correct": 1,
      "explain": "A pressão para 'fechar o mês no lucro' é um gatilho emocional clássico que deve ser resistido com disciplina."
    }
  ]
},
  "5-19": {
  "title": "Revisão Avançada III",
  "steps": [
    {
      "level": "Revisão · Módulo 5 Avançado III",
      "type": "info",
      "title": "Consolidando Mais um Pouco",
      "body": "Vamos revisar recuperação emocional, expectativa de iniciante e a comparação entre Soros e Martingale antes da Prova Final.",
      "pipTip": "Mais uma camada de disciplina mental consolidada."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Banca de R$900,00, risco de 2.5% por entrada. Qual o valor máximo da entrada?",
      "options": [
        "R$11,25",
        "R$45,00",
        "R$22,50",
        "R$900,00"
      ],
      "correct": 2,
      "explain": "2.5% de R$900,00 = R$22,50."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Soros e Martingale são filosofias:",
      "options": [
        "Idênticas",
        "Opostas — uma recompensa vitórias, a outra reage a derrotas",
        "Proibidas em qualquer corretora",
        "Sem nenhuma relação com risco"
      ],
      "correct": 1,
      "explain": "Soros e Martingale representam abordagens opostas de ajuste progressivo do valor de entrada."
    }
  ]
},
  "5-20": {
  "title": "Construindo sua Rotina de Trader",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Disciplina Fora do Gráfico Também",
      "body": "Uma boa rotina inclui: horário fixo de operação, revisão do diário antes de começar, e um limite claro de tempo de tela por dia — disciplina fora do gráfico sustenta a disciplina dentro dele.",
      "pipTip": "A rotina que você constrói fora do gráfico sustenta as decisões que você toma dentro dele."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Ter um horário fixo de operação e um limite de tempo de tela ajuda principalmente a:",
      "options": [
        "Aumentar o payout",
        "Manter disciplina e evitar decisões por cansaço ou impulso",
        "Garantir mais vitórias",
        "Nada relevante"
      ],
      "correct": 1,
      "explain": "Rotina e limites claros ajudam a sustentar a disciplina emocional necessária para operar bem."
    }
  ]
},
  "5-21": {
  "title": "Erros de Gerenciamento Mais Comuns",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Aprendendo com os Erros Alheios",
      "body": "Os erros mais comuns de gerenciamento incluem: aumentar valor após perdas, ignorar o stop diário, e não recalcular o risco conforme a banca muda de tamanho.",
      "pipTip": "Conhecer os erros comuns é o primeiro passo para não repeti-los."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Banca de R$1.800,00, risco de 1% por entrada. Qual o valor máximo da entrada?",
      "options": [
        "R$9,00",
        "R$36,00",
        "R$1.800,00",
        "R$18,00"
      ],
      "correct": 3,
      "explain": "1% de R$1.800,00 = R$18,00."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Qual desses é um erro comum de gerenciamento de banca?",
      "options": [
        "Recalcular o risco quando a banca muda",
        "Ignorar o stop diário depois de uma sequência de perdas",
        "Manter o percentual de risco constante",
        "Registrar operações no diário"
      ],
      "correct": 1,
      "explain": "Ignorar o stop diário após perdas é um dos erros mais comuns e perigosos de gerenciamento."
    }
  ]
},
  "5-22": {
  "title": "Simulado Final de Gestão",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Última Prática antes da Prova",
      "body": "Vamos praticar mais um cenário completo de gestão de banca e disciplina emocional antes da Prova Final do Módulo 5.",
      "pipTip": "Essa é sua última prática antes de encarar a Prova de Certificação Final."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Banca de R$4.000,00, risco de 3% por entrada. Qual o valor máximo da entrada?",
      "options": [
        "R$240,00",
        "R$4.000,00",
        "R$60,00",
        "R$120,00"
      ],
      "correct": 3,
      "explain": "3% de R$4.000,00 = R$120,00."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Depois de uma sequência de vitórias, a atitude mais disciplinada é:",
      "options": [
        "Manter o risco proporcional recalculado, sem exagerar por excesso de confiança",
        "Dobrar o risco imediatamente",
        "Abandonar o gerenciamento",
        "Parar de operar para sempre"
      ],
      "correct": 1,
      "explain": "Mesmo após vitórias, o gerenciamento disciplinado deve continuar sendo respeitado."
    }
  ]
},
  "5-23": {
  "title": "Preparando-se para a Prova de Certificação",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Revisão Focada",
      "body": "Revise mentalmente: gerenciamento de banca, Soros, Martingale, psicologia e disciplina antes da Prova de Certificação Final do BinaryMaster.",
      "pipTip": "Essa é a reta final — uma boa revisão consolida toda a jornada."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Qual o percentual recomendado de risco por entrada?",
      "options": [
        "10% a 20%",
        "1% a 3%",
        "50%",
        "Não há limite recomendado"
      ],
      "correct": 1,
      "explain": "1% a 3% da banca por entrada é a faixa recomendada para preservar o capital."
    }
  ]
},
  "5-24": {
  "title": "Revisão Final do Módulo 5",
  "steps": [
    {
      "level": "Revisão Final · Módulo 5",
      "type": "info",
      "title": "Você está pronto!",
      "body": "Última lição antes da Prova de Certificação Final — vamos consolidar tudo sobre Gestão e Mentalidade.",
      "pipTip": "Essa é a lição que fecha sua preparação para a certificação completa do BinaryMaster."
    },
    {
      "level": "Nível 2 · Aplicação",
      "type": "mcq",
      "question": "Banca de R$1.200,00, risco de 1% por entrada. Qual o valor máximo da entrada?",
      "options": [
        "R$12,00",
        "R$6,00",
        "R$1.200,00",
        "R$24,00"
      ],
      "correct": 0,
      "explain": "1% de R$1.200,00 = R$12,00."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "A ordem de prioridade mais saudável para um trader iniciante é:",
      "options": [
        "Estratégia > Gerenciamento > Psicologia",
        "Psicologia > Gerenciamento > Estratégia",
        "Só a estratégia importa",
        "Só o payout importa"
      ],
      "correct": 1,
      "explain": "Psicologia e gerenciamento vêm antes da estratégia — sem eles, nenhuma técnica sobrevive a uma sequência de perdas."
    }
  ]
},
  "6-15": {
  "title": "Simulado: Cenário Completo I",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Aplicando Tudo de Uma Vez",
      "body": "Vamos simular um cenário longo, combinando estrutura de tendência, zona de preço e padrão de candlestick, exatamente como aconteceria numa decisão real.",
      "pipTip": "Esse é o tipo de decisão que você vai tomar centenas de vezes na vida real — treine com calma."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Tendência de baixa esticada, tocando suporte com Martelo bem formado. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 81,
            "c": 71,
            "h": 83,
            "l": 68
          },
          {
            "o": 71,
            "c": 55,
            "h": 72,
            "l": 54
          },
          {
            "o": 55,
            "c": 43,
            "h": 56,
            "l": 42
          },
          {
            "o": 43,
            "c": 32,
            "h": 45,
            "l": 29
          },
          {
            "o": 30,
            "c": 32,
            "h": 33,
            "l": 9
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Confluência entre tendência esticada, suporte e Martelo reforça fortemente a entrada em CALL."
    }
  ]
},
  "6-16": {
  "title": "Simulado: Cenário Completo II",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "O Espelho do Cenário Anterior",
      "body": "Agora o cenário espelhado: tendência de alta esticada, tocando resistência com Pinbar de baixa bem formado.",
      "pipTip": "Pratique reconhecer os dois lados do mercado com a mesma confiança."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Tendência de alta esticada, tocando resistência com Pinbar de baixa bem formado. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 34,
            "c": 46,
            "h": 51,
            "l": 30
          },
          {
            "o": 46,
            "c": 62,
            "h": 65,
            "l": 44
          },
          {
            "o": 62,
            "c": 73,
            "h": 76,
            "l": 58
          },
          {
            "o": 73,
            "c": 84,
            "h": 87,
            "l": 72
          },
          {
            "o": 85,
            "c": 80,
            "h": 114,
            "l": 79
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "Confluência entre tendência esticada, resistência e Pinbar de baixa reforça fortemente a entrada em PUT."
    }
  ]
},
  "6-17": {
  "title": "Simulado: Identificando a Armadilha",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Cuidado com o Que Parece Óbvio",
      "body": "Nem todo cenário 'óbvio' é confiável — vamos praticar identificar quando um sinal aparentemente forte pode, na verdade, ser uma armadilha.",
      "pipTip": "O sinal mais convincente às vezes é o mais perigoso."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Um rompimento de resistência com uma vela grande, mas SEM nenhuma consolidação prévia perto do nível, deve ser tratado com:",
      "options": [
        "Confiança total imediata",
        "Mais cautela — rompimentos sem consolidação prévia têm mais chance de serem armadilhas",
        "Sempre ignorado",
        "Redução automática do payout"
      ],
      "correct": 1,
      "explain": "Rompimentos sem consolidação prévia (movimento súbito e isolado) merecem mais cautela, pois têm maior chance de serem armadilhas."
    }
  ]
},
  "6-18": {
  "title": "Simulado: Decisão sob Múltiplos Sinais",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Quando os Sinais Não Concordam",
      "body": "Às vezes os sinais não concordam entre si — RSI neutro, mas padrão de candle forte. Nessas situações, a decisão mais prudente costuma ser esperar mais confirmação.",
      "pipTip": "Quando os sinais discordam, o mercado está pedindo paciência, não pressa."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Se o RSI está neutro (50) mas um padrão de candlestick forte aparece na zona, a atitude mais prudente é:",
      "options": [
        "Entrar com confiança total, ignorando o RSI",
        "Considerar esperar mais confirmação, já que falta um sinal concordando",
        "Dobrar o valor da entrada",
        "Ignorar completamente o padrão de candle"
      ],
      "correct": 1,
      "explain": "Quando nem todos os sinais concordam, esperar mais confirmação é a atitude mais disciplinada."
    }
  ]
},
  "6-19": {
  "title": "Revisão: Simulados de Mercado",
  "steps": [
    {
      "level": "Revisão · Módulo 6",
      "type": "info",
      "title": "Consolidando os Simulados",
      "body": "Vamos revisar os principais aprendizados dos simulados antes da revisão final do módulo.",
      "pipTip": "Cada simulado te aproxima mais da leitura real e fluida do mercado."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Tendência de baixa esticada, suporte respeitado com Martelo. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 95,
            "c": 83,
            "h": 98,
            "l": 80
          },
          {
            "o": 83,
            "c": 74,
            "h": 88,
            "l": 69
          },
          {
            "o": 74,
            "c": 61,
            "h": 78,
            "l": 58
          },
          {
            "o": 61,
            "c": 52,
            "h": 63,
            "l": 48
          },
          {
            "o": 51,
            "c": 55,
            "h": 58,
            "l": 22
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Confluência entre tendência, suporte e padrão reforça a entrada em CALL."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Rompimentos sem consolidação prévia merecem:",
      "options": [
        "Confiança total imediata",
        "Mais cautela, por maior chance de armadilha",
        "Nenhuma atenção especial",
        "Redução do payout"
      ],
      "correct": 1,
      "explain": "A ausência de consolidação prévia é um sinal de alerta para possível armadilha."
    }
  ]
},
  "6-20": {
  "title": "Simulado: Múltiplos Timeframes",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Confirmando em Duas Escalas",
      "body": "Vamos simular uma decisão confirmada em dois timeframes diferentes ao mesmo tempo, reforçando a confiança da entrada.",
      "pipTip": "Confirmação em múltiplas escalas de tempo é uma das formas mais robustas de confluência."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Suporte respeitado tanto no timeframe curto quanto no longo, com Martelo formado. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 92,
            "c": 83,
            "h": 95,
            "l": 79
          },
          {
            "o": 83,
            "c": 67,
            "h": 84,
            "l": 64
          },
          {
            "o": 67,
            "c": 51,
            "h": 69,
            "l": 47
          },
          {
            "o": 51,
            "c": 35,
            "h": 52,
            "l": 30
          },
          {
            "o": 34,
            "c": 38,
            "h": 40,
            "l": 3
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Confirmação em múltiplos timeframes, junto ao padrão, reforça fortemente a entrada em CALL."
    }
  ]
},
  "6-21": {
  "title": "Simulado: Gerenciando o Erro",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Quando a Leitura Falha",
      "body": "Mesmo com boa leitura técnica, entradas erradas acontecem. Vamos praticar a reação correta diante de um erro dentro de um simulado.",
      "pipTip": "Errar faz parte — a reação ao erro é o que define o trader disciplinado."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Depois de uma entrada errada bem fundamentada tecnicamente, a atitude correta é:",
      "options": [
        "Duvidar de toda a análise técnica aprendida",
        "Aceitar que faz parte da probabilidade e seguir o plano de gerenciamento",
        "Abandonar o gerenciamento de banca",
        "Dobrar a próxima entrada para compensar"
      ],
      "correct": 1,
      "explain": "Entradas bem fundamentadas podem falhar por probabilidade — a resposta correta é seguir o gerenciamento, não abandoná-lo."
    }
  ]
},
  "6-22": {
  "title": "Simulado Final: Cenário Misto",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "O Grande Teste",
      "body": "Esse é o simulado mais completo do módulo, combinando tendência, zona, padrão e disciplina de gatilho ao mesmo tempo.",
      "pipTip": "Esse cenário resume tudo que você aprendeu no Módulo 6."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Tendência de alta esticada, resistência respeitada, Pinbar de baixa confirmado após fechamento completo da vela. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 40,
            "c": 49,
            "h": 52,
            "l": 39
          },
          {
            "o": 49,
            "c": 62,
            "h": 64,
            "l": 48
          },
          {
            "o": 62,
            "c": 73,
            "h": 77,
            "l": 59
          },
          {
            "o": 73,
            "c": 89,
            "h": 92,
            "l": 71
          },
          {
            "o": 90,
            "c": 85,
            "h": 120,
            "l": 83
          }
        ],
        "lines": []
      },
      "correct": "PUT",
      "explain": "Todos os gatilhos de disciplina aplicados corretamente reforçam a entrada em PUT com alta confiança."
    }
  ]
},
  "6-23": {
  "title": "Preparando-se para a Prova Final",
  "steps": [
    {
      "level": "Nível 1 · Introdução",
      "type": "info",
      "title": "Revisão Focada",
      "body": "Revise mentalmente: leitura estrutural, pegadinhas clássicas, gatilhos de entrada e simulados antes da Prova Final do Módulo 6.",
      "pipTip": "Essa revisão fecha o módulo mais prático de todo o curso."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "O primeiro gatilho de disciplina antes de qualquer entrada é:",
      "options": [
        "Entrar assim que ver um sinal se formando",
        "Esperar o fechamento da vela antes de decidir",
        "Dobrar o valor imediatamente",
        "Ignorar o gráfico"
      ],
      "correct": 1,
      "explain": "Esperar o fechamento da vela é a base de qualquer disciplina de entrada."
    }
  ]
},
  "6-24": {
  "title": "Revisão Final do Módulo 6",
  "steps": [
    {
      "level": "Revisão Final · Módulo 6",
      "type": "info",
      "title": "Você completou a Leitura de Gráficos!",
      "body": "Última lição antes da Prova Final do Módulo 6 — parabéns por chegar até aqui na parte mais prática do curso.",
      "pipTip": "Você já treinou leitura estrutural, pegadinhas, gatilhos e simulados — está pronto para a prova."
    },
    {
      "level": "Nível 2 · Identificação",
      "type": "mcq",
      "question": "Uma armadilha de alta (bull trap) se caracteriza por:",
      "options": [
        "Rompimento seguido de continuação forte",
        "Rompimento seguido de reversão rápida de volta para dentro da zona anterior",
        "Uma vela verde qualquer",
        "Aumento do payout"
      ],
      "correct": 1,
      "explain": "A reversão rápida após o rompimento é a marca da armadilha de alta."
    },
    {
      "level": "Nível 3 · Decisão CALL/PUT",
      "type": "chart",
      "question": "Suporte respeitado, Martelo confirmado após fechamento. Qual a sua entrada?",
      "chart": {
        "candles": [
          {
            "o": 80,
            "c": 64,
            "h": 84,
            "l": 62
          },
          {
            "o": 64,
            "c": 54,
            "h": 67,
            "l": 51
          },
          {
            "o": 54,
            "c": 39,
            "h": 57,
            "l": 35
          },
          {
            "o": 39,
            "c": 23,
            "h": 42,
            "l": 20
          },
          {
            "o": 20,
            "c": 25,
            "h": 27,
            "l": 0
          }
        ],
        "lines": []
      },
      "correct": "CALL",
      "explain": "Confluência entre zona, padrão e disciplina de fechamento reforça a entrada em CALL."
    }
  ]
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
  6: {
  "title": "Prova Final · Módulo 6: Leitura de Gráficos",
  "passScore": 0.7,
  "questions": [
    {
      "question": "Uma sequência de fundos cada vez mais altos, sem indicadores, caracteriza uma tendência de:",
      "options": [
        "Baixa",
        "Alta",
        "Lateral obrigatória",
        "Reversão automática"
      ],
      "correct": 1,
      "explain": "Fundos ascendentes é a marca estrutural de uma tendência de alta."
    },
    {
      "question": "O que caracteriza um mercado lateral?",
      "options": [
        "Fundos e topos claramente ascendentes",
        "Preço oscilando numa faixa, sem sequência clara de topos/fundos numa direção",
        "Sempre velas verdes",
        "Payout sempre igual"
      ],
      "correct": 1,
      "explain": "A lateralização é a ausência de uma direção estrutural clara nos topos e fundos."
    },
    {
      "question": "O primeiro sinal de que uma tendência de alta pode estar enfraquecendo é:",
      "options": [
        "Um novo topo mais alto",
        "Um novo fundo mais baixo que o anterior, quebrando a sequência ascendente",
        "O payout cair",
        "A vela ficar vermelha uma única vez"
      ],
      "correct": 1,
      "explain": "Quando um fundo fica mais baixo que o anterior, a estrutura de alta é quebrada."
    },
    {
      "question": "Operar como se houvesse tendência, dentro de um mercado lateral, tende a:",
      "options": [
        "Reduzir sinais falsos",
        "Aumentar sinais falsos, pela ausência de direção estrutural clara",
        "Não fazer diferença",
        "Ser sempre mais seguro"
      ],
      "correct": 1,
      "explain": "Sem direção estrutural clara, a chance de sinais falsos aumenta."
    },
    {
      "question": "Qual estrutura caracteriza uma tendência de baixa pura, sem indicadores?",
      "options": [
        "Topos e fundos cada vez mais altos",
        "Topos e fundos cada vez mais baixos",
        "Ausência de qualquer padrão",
        "Velas sempre do mesmo tamanho"
      ],
      "correct": 1,
      "explain": "Topos e fundos descendentes definem estruturalmente uma tendência de baixa."
    },
    {
      "question": "Por que a leitura estrutural (sem indicadores) é uma habilidade fundamental?",
      "options": [
        "Porque substitui todo o resto do curso",
        "Porque é a base sobre a qual padrões e indicadores são interpretados depois",
        "Porque garante 100% de acerto",
        "Porque é a única forma válida de analisar o mercado"
      ],
      "correct": 1,
      "explain": "A leitura estrutural é a base sobre a qual todas as outras ferramentas (padrões, indicadores) são interpretadas."
    },
    {
      "question": "Um novo topo mais alto que o anterior, numa sequência de topos descendentes, sinaliza:",
      "options": [
        "Continuação garantida da baixa",
        "Possível quebra da estrutura de tendência de baixa",
        "Aumento do payout",
        "Nada relevante"
      ],
      "correct": 1,
      "explain": "Quebrar a sequência de topos descendentes é o primeiro aviso de possível mudança na tendência de baixa."
    }
  ]
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
