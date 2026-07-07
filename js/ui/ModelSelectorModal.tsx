import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// SVGs das Logos
const GEMINI_LOGO = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="url(#geminiGradientModal)" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px', flexShrink: 0 }}>
    <defs>
      <linearGradient id="geminiGradientModal" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4e82ee" />
        <stop offset="50%" stopColor="#a75df4" />
        <stop offset="100%" stopColor="#e0638b" />
      </linearGradient>
    </defs>
    <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/>
  </svg>
);

const OPENAI_LOGO = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ color: '#10a37f', marginRight: '8px', flexShrink: 0 }}>
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
  </svg>
);

const GROQ_LOGO = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="url(#groqGradientModal)" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px', flexShrink: 0 }}>
    <defs>
      <linearGradient id="groqGradientModal" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f97316" />
        <stop offset="100%" stopColor="#dc2626" />
      </linearGradient>
    </defs>
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10c5.523 0 10-4.477 10-10H12v3h6.582c-.895 2.387-3.178 4-5.915 4-3.59 0-6.5-2.91-6.5-6.5s2.91-6.5 6.5-6.5c1.795 0 3.418.727 4.595 1.905l2.122-2.122C17.585 3.978 14.935 2 12 2z"/>
  </svg>
);

// SVGs para Avaliação
const BULB_SVG = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ display: 'inline-block' }}>
    <path d="M12 2C7.58 2 4 5.58 4 10c0 2.58 1.22 4.88 3.1 6.36.42.32.9.72.9 1.64V20c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2c0-.92.48-1.32.9-1.64C18.78 14.88 20 12.58 20 10c0-4.42-3.58-8-8-8z"/>
  </svg>
);

const BOLT_SVG = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ display: 'inline-block' }}>
    <path d="M11 21h-1l1.5-6.5h-5.5l7-11.5h1l-1.5 6.5h5.5z"/>
  </svg>
);

// Lista de modelos e classificações
export const IA_MODELS = [
  // Google Gemini
  {
    id: "models/gemini-3.5-flash",
    title: "Gemini 3.5 Flash",
    desc: "Equilíbrio perfeito de velocidade e inteligência para tarefas diárias",
    category: "Google Gemini",
    logo: GEMINI_LOGO,
    reasoning: 4,
    speed: 5,
    reasoningText: "Muito Alto",
    speedText: "Muito Rápido"
  },
  {
    id: "models/gemini-3-flash-preview",
    title: "Gemini 3 Flash (Preview)",
    desc: "Modelo ágil para prototipagem rápida e experimentação",
    category: "Google Gemini",
    logo: GEMINI_LOGO,
    reasoning: 3,
    speed: 4,
    reasoningText: "Médio",
    speedText: "Rápido"
  },
  {
    id: "models/gemini-3.1-flash-lite",
    title: "Gemini 3.1 Flash Lite",
    desc: "Excelente eficiência e velocidade extrema para respostas curtas",
    category: "Google Gemini",
    logo: GEMINI_LOGO,
    reasoning: 2,
    speed: 5,
    reasoningText: "Básico",
    speedText: "Muito Rápido"
  },
  {
    id: "models/gemini-2.5-flash",
    title: "Gemini 2.5 Flash",
    desc: "Modelo estável de uso geral",
    category: "Google Gemini",
    logo: GEMINI_LOGO,
    reasoning: 3,
    speed: 4,
    reasoningText: "Médio",
    speedText: "Rápido"
  },
  {
    id: "models/gemini-2.5-flash-lite",
    title: "Gemini 2.5 Flash Lite",
    desc: "Leve, dinâmico e otimizado para tarefas simples",
    category: "Google Gemini",
    logo: GEMINI_LOGO,
    reasoning: 2,
    speed: 5,
    reasoningText: "Básico",
    speedText: "Muito Rápido"
  },
  {
    id: "models/gemma-4-31b-it",
    title: "Gemma 4 31B IT",
    desc: "Modelo aberto de grande porte para raciocínio lógico e preciso",
    category: "Google Gemini",
    logo: GEMINI_LOGO,
    reasoning: 4,
    speed: 3,
    reasoningText: "Alto",
    speedText: "Médio"
  },
  {
    id: "models/gemma-4-26b-a4b-it",
    title: "Gemma 4 26B a4b IT",
    desc: "Arquitetura otimizada para processamento rápido e conversas fluídas",
    category: "Google Gemini",
    logo: GEMINI_LOGO,
    reasoning: 3,
    speed: 4,
    reasoningText: "Médio",
    speedText: "Rápido"
  },
  // OpenAI (GitHub Models)
  {
    id: "github/gpt-5",
    title: "OpenAI GPT-5",
    desc: "Modelo topo de linha da OpenAI com máxima capacidade cognitiva",
    category: "OpenAI (GitHub Models)",
    logo: OPENAI_LOGO,
    reasoning: 5,
    speed: 3,
    reasoningText: "Muito Alto",
    speedText: "Médio"
  },
  {
    id: "github/gpt-5-chat",
    title: "OpenAI GPT-5 Chat (Preview)",
    desc: "Modelo otimizado para interações em chat com alta inteligência",
    category: "OpenAI (GitHub Models)",
    logo: OPENAI_LOGO,
    reasoning: 5,
    speed: 3,
    reasoningText: "Muito Alto",
    speedText: "Médio"
  },
  {
    id: "github/gpt-5-mini",
    title: "OpenAI GPT-5-mini",
    desc: "Modelo otimizado que une velocidade e alta capacidade analítica",
    category: "OpenAI (GitHub Models)",
    logo: OPENAI_LOGO,
    reasoning: 4,
    speed: 4,
    reasoningText: "Alto",
    speedText: "Rápido"
  },
  {
    id: "github/gpt-4.1",
    title: "OpenAI GPT-4.1",
    desc: "Evolução direta da linha GPT-4 em raciocínio, visão e precisão",
    category: "OpenAI (GitHub Models)",
    logo: OPENAI_LOGO,
    reasoning: 4,
    speed: 4,
    reasoningText: "Alto",
    speedText: "Rápido"
  },
  {
    id: "github/gpt-4.1-mini",
    title: "OpenAI GPT-4.1-mini",
    desc: "Modelo ágil e inteligente de excelente custo-benefício",
    category: "OpenAI (GitHub Models)",
    logo: OPENAI_LOGO,
    reasoning: 3,
    speed: 5,
    reasoningText: "Médio",
    speedText: "Muito Rápido"
  },
  {
    id: "github/gpt-4o",
    title: "OpenAI GPT-4o",
    desc: "Modelo inteligente multimodal de uso geral e alta precisão",
    category: "OpenAI (GitHub Models)",
    logo: OPENAI_LOGO,
    reasoning: 4,
    speed: 4,
    reasoningText: "Alto",
    speedText: "Rápido"
  },
  {
    id: "github/gpt-4o-mini",
    title: "OpenAI GPT-4o-mini",
    desc: "Altamente veloz e eficiente para tarefas cotidianas",
    category: "OpenAI (GitHub Models)",
    logo: OPENAI_LOGO,
    reasoning: 3,
    speed: 5,
    reasoningText: "Médio",
    speedText: "Muito Rápido"
  },
  {
    id: "github/o1",
    title: "OpenAI o1",
    desc: "Raciocínio lógico e matemático profundo para problemas complexos",
    category: "OpenAI (GitHub Models)",
    logo: OPENAI_LOGO,
    reasoning: 5,
    speed: 2,
    reasoningText: "Muito Alto",
    speedText: "Lento"
  },
  {
    id: "github/o3",
    title: "OpenAI o3",
    desc: "Referência em raciocínio analítico profundo de nova geração",
    category: "OpenAI (GitHub Models)",
    logo: OPENAI_LOGO,
    reasoning: 5,
    speed: 3,
    reasoningText: "Muito Alto",
    speedText: "Médio"
  },
  {
    id: "github/o3-mini",
    title: "OpenAI o3-mini",
    desc: "Raciocínio analítico avançado em formato ágil e otimizado",
    category: "OpenAI (GitHub Models)",
    logo: OPENAI_LOGO,
    reasoning: 4,
    speed: 4,
    reasoningText: "Alto",
    speedText: "Rápido"
  },
  {
    id: "github/o4-mini",
    title: "OpenAI o4-mini",
    desc: "Modelo compacto especializado em raciocínio analítico rápido",
    category: "OpenAI (GitHub Models)",
    logo: OPENAI_LOGO,
    reasoning: 4,
    speed: 5,
    reasoningText: "Alto",
    speedText: "Muito Rápido"
  },
  // Groq Models
  {
    id: "groq/gpt-oss-120b",
    title: "GPT-OSS 120B",
    desc: "Modelo de raciocínio de alta performance em Groq LPU",
    category: "Groq",
    logo: GROQ_LOGO,
    reasoning: 5,
    speed: 5,
    reasoningText: "Muito Alto",
    speedText: "Muito Rápido"
  }
];

type TabId = 'chat' | 'router' | 'memory' | 'search' | 'corrector' | 'scaffolding' |
             'scanner_detect' | 'scanner_audit' | 'scanner_correct' |
             'extractor_ocr' | 'extractor_search' | 'extractor_gabarito' | 'extractor_image_detect';

interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
  title: string;
  desc: string;
}

const STAGES_CONFIG: TabConfig[] = [
  {
    id: 'chat',
    label: 'Resposta no Chat',
    icon: '💬',
    title: '💬 Resposta no Chat',
    desc: 'Configure o modelo principal que escreve a resposta final para o usuário.'
  },
  {
    id: 'router',
    label: 'Roteamento (Router)',
    icon: '🎯',
    title: '🎯 Classificação e Roteamento',
    desc: 'Define qual cérebro será responsável por classificar a complexidade da pergunta e selecionar a metodologia pedagógica.'
  },
  {
    id: 'memory',
    label: 'Memórias da IA',
    icon: '🧠',
    title: '🧠 Memória Contextual',
    desc: 'Modelo encarregado de resumir as interações recentes, extrair fatos importantes e consolidar o histórico de aprendizado.'
  },
  {
    id: 'search',
    label: 'Pesquisa profunda',
    icon: '🔍',
    title: '🔍 Pesquisa e Grounding',
    desc: 'Modelo auxiliar para formatar e estruturar fontes e resoluções externas validadas na Web.'
  },
  {
    id: 'corrector',
    label: 'Corretor de Atividades',
    icon: '📝',
    title: '📝 Correção de Atividades',
    desc: 'Modelo utilizado para analisar detalhadamente as respostas das atividades enviadas pelos alunos e gerar feedbacks didáticos e notas.'
  },
  {
    id: 'scaffolding',
    label: 'Scaffolding (Passos)',
    icon: '🧩',
    title: '🧩 Geração de Passos (Scaffolding)',
    desc: 'Modelo responsável por gerar os passos pedagógicos do Scaffolding (Verdadeiro ou Falso) além do primeiro, guiando o aluno progressivamente.'
  }
];

const EXTRACTOR_STAGES_CONFIG: TabConfig[] = [
  {
    id: 'scanner_detect',
    label: '1. Detecção (Scan)',
    icon: '🔍',
    title: '🔍 Detecção de Caixas (Scanner)',
    desc: 'Modelo de visão computacional para identificar e mapear as coordenadas das questões na página inteira.'
  },
  {
    id: 'scanner_audit',
    label: '2. Auditoria (Audit)',
    icon: '🛡️',
    title: '🛡️ Auditoria de Caixas (Auditor)',
    desc: 'Modelo rigoroso encarregado de verificar se as caixas encontradas estão cortadas, incompletas ou perfeitas.'
  },
  {
    id: 'scanner_correct',
    label: '3. Correção (Correct)',
    icon: '⚙️',
    title: '⚙️ Correção de Caixas (Corretor)',
    desc: 'Modelo que ajusta e corrige as coordenadas das caixas que foram reprovadas pelo auditor.'
  },
  {
    id: 'extractor_ocr',
    label: '4. Estrutura (OCR)',
    icon: '📝',
    title: '📝 Estruturação e OCR da Questão',
    desc: 'Modelo que transcreve e organiza o texto, fórmulas em LaTeX, tabelas e descreve imagens do recorte da questão.'
  },
  {
    id: 'extractor_search',
    label: '5. Pesquisador (Gabarito)',
    icon: '🌐',
    title: '🌐 Pesquisa Web (Gemini / Gemma 4)',
    desc: 'Modelo encarregado de realizar buscas na Web para encontrar gabaritos e resoluções originais.'
  },
  {
    id: 'extractor_gabarito',
    label: '6. Resolução (Gabarito)',
    icon: '✍️',
    title: '✍️ Geração de Gabarito e Resolução',
    desc: 'Modelo que escreve a explicação detalhada passo a passo, define a alternativa correta e checa coerência.'
  },
  {
    id: 'extractor_image_detect',
    label: '7. Sub-imagens (Crop)',
    icon: '📸',
    title: '📸 Detecção de Imagens no Crop',
    desc: 'Modelo especializado em detectar imagens e figuras isoladas dentro do recorte da questão.'
  }
];

const DEFAULT_MODELS: Record<TabId, string> = {
  chat: 'models/gemini-3.5-flash',
  router: 'models/gemma-4-31b-it',
  memory: 'models/gemma-4-31b-it',
  search: 'models/gemini-3.5-flash',
  corrector: 'models/gemini-3.5-flash',
  scaffolding: 'models/gemini-3-flash-preview',
  scanner_detect: 'models/gemini-3.5-flash',
  scanner_audit: 'models/gemini-3.5-flash',
  scanner_correct: 'models/gemini-3.5-flash',
  extractor_ocr: 'models/gemini-3.5-flash',
  extractor_search: 'models/gemini-3.5-flash',
  extractor_gabarito: 'models/gemini-3.5-flash',
  extractor_image_detect: 'models/gemini-3.5-flash'
};

interface ModelSelectorProps {
  onClose: () => void;
  currentSelected: string;
  onSelect: (modelId: string) => void;
  mode?: 'chat' | 'extractor' | 'corrector';
}

const ModelSelectorComponent: React.FC<ModelSelectorProps> = ({ onClose, currentSelected, onSelect, mode = 'chat' }) => {
  const [activeTab, setActiveTab] = useState<TabId>(
    mode === 'extractor' ? 'scanner_detect' : (mode === 'corrector' ? 'corrector' : 'chat')
  );
  const isMaiaActive = typeof window !== 'undefined' && (window as any).useMaiaArchitecture !== false;

  useEffect(() => {
    if (mode === 'chat' && !isMaiaActive && activeTab !== 'chat') {
      setActiveTab('chat');
    }
  }, [isMaiaActive, activeTab, mode]);

  // Model states
  const [selections, setSelections] = useState<Record<TabId, string>>({
    chat: '', router: '', memory: '', search: '', corrector: '', scaffolding: '',
    scanner_detect: '', scanner_audit: '', scanner_correct: '',
    extractor_ocr: '', extractor_search: '', extractor_gabarito: '',
    extractor_image_detect: ''
  });

  // Initial load
  useEffect(() => {
    const getVal = (key: string, def: string): string => {
      if (typeof window !== 'undefined') {
        const winVal = (window as any)[key];
        if (winVal) return winVal;
      }
      return localStorage.getItem(key) || def;
    };

    setSelections({
      chat: getVal('selectedModelChat', DEFAULT_MODELS.chat),
      router: getVal('selectedModelRouter', DEFAULT_MODELS.router),
      memory: getVal('selectedModelMemory', DEFAULT_MODELS.memory),
      search: getVal('selectedModelSearch', DEFAULT_MODELS.search),
      corrector: getVal('selectedModelCorrector', DEFAULT_MODELS.corrector),
      scaffolding: getVal('selectedModelScaffolding', DEFAULT_MODELS.scaffolding),
      scanner_detect: getVal('selectedModelScannerDetect', DEFAULT_MODELS.scanner_detect),
      scanner_audit: getVal('selectedModelScannerAudit', DEFAULT_MODELS.scanner_audit),
      scanner_correct: getVal('selectedModelScannerCorrect', DEFAULT_MODELS.scanner_correct),
      extractor_ocr: getVal('selectedModelExtractorOcr', DEFAULT_MODELS.extractor_ocr),
      extractor_search: getVal('selectedModelExtractorSearch', DEFAULT_MODELS.extractor_search),
      extractor_gabarito: getVal('selectedModelExtractorGabarito', DEFAULT_MODELS.extractor_gabarito),
      extractor_image_detect: getVal('selectedModelExtractorImageDetect', DEFAULT_MODELS.extractor_image_detect)
    });
  }, []);

  const getSelectedIdForTab = (tab: TabId) => {
    return selections[tab];
  };

  const handleSelectModel = (modelId: string) => {
    setSelections(prev => ({
      ...prev,
      [activeTab]: modelId
    }));
  };

  const handleResetAll = () => {
    if (mode === 'extractor') {
      setSelections(prev => ({
        ...prev,
        scanner_detect: DEFAULT_MODELS.scanner_detect,
        scanner_audit: DEFAULT_MODELS.scanner_audit,
        scanner_correct: DEFAULT_MODELS.scanner_correct,
        extractor_ocr: DEFAULT_MODELS.extractor_ocr,
        extractor_search: DEFAULT_MODELS.extractor_search,
        extractor_gabarito: DEFAULT_MODELS.extractor_gabarito,
        extractor_image_detect: DEFAULT_MODELS.extractor_image_detect
      }));
    } else {
      setSelections(prev => ({
        ...prev,
        chat: DEFAULT_MODELS.chat,
        router: DEFAULT_MODELS.router,
        memory: DEFAULT_MODELS.memory,
        search: DEFAULT_MODELS.search,
        corrector: DEFAULT_MODELS.corrector,
        scaffolding: DEFAULT_MODELS.scaffolding
      }));
    }
  };

  const handleSaveAndClose = () => {
    if (typeof window !== 'undefined') {
      if (mode === 'extractor') {
        (window as any).selectedModelScannerDetect = selections.scanner_detect;
        (window as any).selectedModelScannerAudit = selections.scanner_audit;
        (window as any).selectedModelScannerCorrect = selections.scanner_correct;
        (window as any).selectedModelExtractorOcr = selections.extractor_ocr;
        (window as any).selectedModelExtractorSearch = selections.extractor_search;
        (window as any).selectedModelExtractorGabarito = selections.extractor_gabarito;
        (window as any).selectedModelExtractorImageDetect = selections.extractor_image_detect;
      } else {
        (window as any).selectedModelChat = selections.chat;
        (window as any).selectedModelRouter = selections.router;
        (window as any).selectedModelMemory = selections.memory;
        (window as any).selectedModelSearch = selections.search;
        (window as any).selectedModelCorrector = selections.corrector;
        (window as any).selectedModelScaffolding = selections.scaffolding;
        (window as any).selectedSpecificModel = selections.chat; // keep legacy selectedSpecificModel updated
      }
    }
    
    if (mode === 'extractor') {
      localStorage.setItem('selectedModelScannerDetect', selections.scanner_detect);
      localStorage.setItem('selectedModelScannerAudit', selections.scanner_audit);
      localStorage.setItem('selectedModelScannerCorrect', selections.scanner_correct);
      localStorage.setItem('selectedModelExtractorOcr', selections.extractor_ocr);
      localStorage.setItem('selectedModelExtractorSearch', selections.extractor_search);
      localStorage.setItem('selectedModelExtractorGabarito', selections.extractor_gabarito);
      localStorage.setItem('selectedModelExtractorImageDetect', selections.extractor_image_detect);
      onSelect(selections.scanner_detect);
    } else {
      localStorage.setItem('selectedModelChat', selections.chat);
      localStorage.setItem('selectedModelRouter', selections.router);
      localStorage.setItem('selectedModelMemory', selections.memory);
      localStorage.setItem('selectedModelSearch', selections.search);
      localStorage.setItem('selectedModelCorrector', selections.corrector);
      localStorage.setItem('selectedModelScaffolding', selections.scaffolding);
      onSelect(mode === 'corrector' ? selections.corrector : selections.chat);
    }
    onClose();
  };

  // Group models by category, filtering for search if active
  const categories: { [key: string]: typeof IA_MODELS } = {};
  IA_MODELS.forEach((model) => {
    // Se a aba ativa for 'search' ou 'extractor_search' (Pesquisa), permite apenas modelos Gemini e Gemma 4 31B IT
    const isSearchActiveTab = activeTab === 'search' || activeTab === 'extractor_search';
    if (isSearchActiveTab && !model.id.startsWith('models/gemini-') && model.id !== 'models/gemma-4-31b-it') {
      return;
    }
    if (!categories[model.category]) {
      categories[model.category] = [];
    }
    categories[model.category].push(model);
  });

  const renderStars = (count: number, svgIcon: React.ReactElement, activeColor: string) => {
    return Array.from({ length: 5 }).map((_, idx) => {
      const isActive = idx < count;
      return (
        <span
          key={idx}
          style={{
            color: isActive ? activeColor : 'rgba(255, 255, 255, 0.12)',
            marginRight: '2px',
            display: 'inline-flex',
            alignItems: 'center'
          }}
        >
          {svgIcon}
        </span>
      );
    });
  };

  const isShowSidebar = mode !== 'corrector' && (mode === 'extractor' || isMaiaActive);
  const filteredStages = mode === 'extractor' 
    ? EXTRACTOR_STAGES_CONFIG 
    : (mode === 'corrector' 
        ? STAGES_CONFIG.filter(s => s.id === 'corrector') 
        : (isMaiaActive ? STAGES_CONFIG : STAGES_CONFIG.filter(s => s.id === 'chat')));
  const currentActiveStage = filteredStages.find(s => s.id === activeTab);
  const currentSelectedId = getSelectedIdForTab(activeTab);

  return (
    <div id="modelSelectorModal" className="modal-overlay" style={{ display: 'flex', animation: 'fadeIn 0.2s ease', zIndex: 9999 }}>
      {/* CSS Injetado diretamente para estilos premium das tabs */}
      <style>{`
        .premium-model-modal {
          display: flex;
          flex-direction: row;
          height: 60vh;
          gap: 20px;
          min-height: 480px;
        }
        .modal-sidebar {
          width: 250px;
          border-right: 1px solid var(--color-border);
          padding-right: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
          flex-shrink: 0;
        }
        .tab-button {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: none;
          color: var(--color-text-secondary);
          font-size: 0.88rem;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
          width: 100%;
        }
        .tab-button:hover {
          background: var(--color-bg-2);
          color: var(--color-text);
        }
        .tab-button.active {
          background: rgba(139, 92, 246, 0.12);
          border-color: rgba(139, 92, 246, 0.3);
          color: #a78bfa;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.05);
        }
        .main-stage-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          padding-right: 4px;
        }
        @media (max-width: 768px) {
          .premium-model-modal {
            flex-direction: column;
            height: auto;
            max-height: 60vh;
            min-height: auto;
          }
          .modal-sidebar {
            width: 100%;
            border-right: none;
            border-bottom: 1px solid var(--color-border);
            padding-bottom: 12px;
            margin-bottom: 12px;
            flex-direction: row;
            overflow-x: auto;
            white-space: nowrap;
            padding-right: 0;
          }
          .tab-button {
            width: auto;
            display: inline-flex;
          }
        }
      `}</style>

      <div className="modal-content" style={{ width: '92%', maxWidth: '1000px', padding: '24px', borderRadius: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {mode === 'extractor' ? "🤖 Configuração de Modelos do Extrator de Questões" : (mode === 'corrector' ? "🤖 Modelo de Correção Dissertativa" : (isMaiaActive ? "🤖 Configuração Granular de Modelos de IA" : "🤖 Seleção de Modelo de IA"))}
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
              {mode === 'extractor' 
                ? "Escolha os modelos de IA ideais para cada etapa do processo de escaneamento e extração."
                : (mode === 'corrector'
                    ? "Configure o modelo utilizado para analisar detalhadamente as respostas dissertativas enviadas."
                    : (isMaiaActive 
                        ? "Configure individualmente os modelos para cada etapa vital da inteligência." 
                        : "Selecione o modelo de IA padrão para responder suas perguntas."))}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {(mode === 'extractor' || (isMaiaActive && mode !== 'corrector')) && (
              <button 
                onClick={handleResetAll}
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                className="restore-default-btn"
              >
                Definir Todos como Padrão
              </button>
            )}
            <button 
              onClick={onClose} 
              style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: '1.5rem', cursor: 'pointer', padding: '4px', lineHeight: 1 }}
              title="Fechar"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Tabbed Layout Container */}
        <div className="premium-model-modal">
          
          {/* Sidebar Tabs */}
          {isShowSidebar && (
            <div className="modal-sidebar">
              {filteredStages.map((stage) => {
                const isActive = activeTab === stage.id;
                // Pegar o label curto do modelo selecionado para mostrar abaixo do nome da tab
                const selectedModelId = getSelectedIdForTab(stage.id);
                const selectedModel = IA_MODELS.find(m => m.id === selectedModelId);
                const selectedModelName = selectedModel ? selectedModel.title : 'Não definido';

                return (
                  <button
                    key={stage.id}
                    onClick={() => setActiveTab(stage.id)}
                    className={`tab-button ${isActive ? 'active' : ''}`}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{stage.icon}</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{stage.label}</span>
                      <span style={{ fontSize: '0.68rem', color: isActive ? 'var(--color-primary-light)' : 'var(--color-text-secondary)', opacity: 0.8, marginTop: '2px' }}>
                        {selectedModelName}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Main Stage Panel */}
          <div className="main-stage-content">
            {currentActiveStage && (
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 600 }}>{currentActiveStage.title}</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{currentActiveStage.desc}</p>
              </div>
            )}

            {/* Grid Scroll Area */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
              {Object.entries(categories).map(([categoryName, models]) => {
                if (models.length === 0) return null;
                return (
                  <div key={categoryName} style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', paddingLeft: '4px', fontWeight: 600 }}>
                      {categoryName}
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {models.map((model) => {
                      const isSelected = currentSelectedId === model.id;
                      return (
                        <div
                          key={model.id}
                          onClick={() => handleSelectModel(model.id)}
                          style={{
                            padding: '14px',
                            borderRadius: '12px',
                            background: isSelected ? 'rgba(139, 92, 246, 0.06)' : 'var(--color-bg-2)',
                            border: isSelected ? '2px solid #8b5cf6' : '1px solid var(--color-border)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '10px',
                            position: 'relative'
                          }}
                          className="model-modal-card"
                        >
                          {/* Checkmark Top Right */}
                          {isSelected && (
                            <div style={{ position: 'absolute', top: '12px', right: '12px', color: '#8b5cf6' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                          )}

                          {/* Info (Logo + Title + Description) */}
                          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                            {model.logo}
                            <div style={{ paddingRight: isSelected ? '18px' : '0px' }}>
                              <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{model.title}</h5>
                              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>{model.desc}</p>
                            </div>
                          </div>

                          {/* Ratings */}
                          {model.reasoning > 0 && (
                            <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.04)', paddingTop: '8px' }}>
                              <div>
                                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Raciocínio</div>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  {renderStars(model.reasoning, BULB_SVG, '#fbbf24')}
                                  <span style={{ fontSize: '0.65rem', marginLeft: '4px', color: '#fbbf24', fontWeight: 500 }}>{model.reasoningText}</span>
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Velocidade</div>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  {renderStars(model.speed, BOLT_SVG, '#60a5fa')}
                                  <span style={{ fontSize: '0.65rem', marginLeft: '4px', color: '#60a5fa', fontWeight: 500 }}>{model.speedText}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

        {/* Modal Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginTop: '16px', gap: '12px' }}>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn--ghost" 
            style={{ padding: '10px 20px', fontSize: '0.85rem' }}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            onClick={handleSaveAndClose} 
            className="btn btn--primary" 
            style={{ padding: '10px 24px', fontSize: '0.85rem', fontWeight: 600 }}
          >
            Confirmar e Salvar
          </button>
        </div>

      </div>
    </div>
  );
};

export function mountModelSelectorModal(
  currentSelected: string,
  onSelect: (modelId: string) => void,
  mode: 'chat' | 'extractor' | 'corrector' = 'chat'
) {
  const rootId = 'react-model-selector-modal-root';
  const existing = document.getElementById(rootId);
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = rootId;
  document.body.appendChild(container);

  const root = createRoot(container);

  const handleClose = () => {
    root.unmount();
    container.remove();
  };

  root.render(
    <ModelSelectorComponent
      onClose={handleClose}
      currentSelected={currentSelected}
      onSelect={onSelect}
      mode={mode}
    />
  );
}
