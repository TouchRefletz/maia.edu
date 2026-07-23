import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
// @ts-ignore
import { ref, get, set } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';
import { db, auth } from '../main.js';
import { customAlert } from './GlobalAlertsLogic';
import { gerarTelaInicial } from '../app/telas.js';
import { openAddQuestionsModal } from './add-questions-modal.js';
import { verificarSeAdmin } from './admin-panel.js';
import { AuditItem, runFullTextAudit, applyAuditFix } from '../services/text-audit-service.js';
import { construirDadosParaEnvio, gerarIdentificadoresEnvio } from '../ia/envio-textos.js';
import { processarEmbeddingSemantico, indexarNoPinecone } from '../ia/embedding-e-pinecone.js';
import { prepararPayloadComImagens } from '../ia/payload-imagens.js';
import { DataNormalizer } from '../normalizer/data-normalizer.js';
import { IA_MODELS } from './ModelSelectorModal';
import { criarCardTecnico } from '../banco/card-template.js';
import { renderLatexIn } from '../libs/loader';

export function iniciarModoVerificacaoQuestoes() {
  const user = auth.currentUser;
  if (!user) {
    customAlert("⚠️ Faça login primeiro.");
    gerarTelaInicial();
    return;
  }

  // Loading inicial
  document.body.innerHTML = `
    <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background:#0f172a; color:#f8fafc; font-family: system-ui, sans-serif;">
      <div class="admin-spinner" style="width: 40px; height: 40px; border-width: 4px;"></div>
      <p style="margin-top:15px; font-weight:500;">Verificando permissões de administrador...</p>
    </div>
  `;

  verificarSeAdmin(user.uid).then((isAdmin) => {
    if (!isAdmin) {
      customAlert("⛔ Acesso negado: Você não possui privilégios de administrador.");
      gerarTelaInicial();
      return;
    }

    // Renderiza container raiz com scroll ativado
    document.body.innerHTML = `<div id="verificarQuestoesReactRoot" style="height:100vh; overflow-y:auto; background:#0f172a;"></div>`;
    const rootEl = document.getElementById('verificarQuestoesReactRoot');
    if (rootEl) {
      const root = createRoot(rootEl);
      root.render(<VerificarQuestoesApp />);
    }
  });
}

/**
 * Função utilitária para destacar visualmente trechos auditados (pendentes/aceitos) diretamente dentro do DOM do Card da Questão
 */
function highlightAuditItemsInCard(containerEl: HTMLElement, items: AuditItem[]) {
  if (!containerEl || !items || items.length === 0) return;

  const activeItems = items.filter(i => i.status === 'pending' || i.status === 'accepted');
  if (activeItems.length === 0) return;

  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  activeItems.forEach(item => {
    const isAccepted = item.status === 'accepted';
    const targetSnippet = isAccepted ? item.suggestedText : item.originalText;
    if (!targetSnippet || targetSnippet.length < 2) return;

    // Procura nós de texto dentro do elemento card
    const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT, null);
    const nodesToReplace: Array<{ textNode: Node; parentNode: Node; text: string }> = [];

    let currentNode = walker.nextNode();
    while (currentNode) {
      const val = currentNode.nodeValue || '';
      if (val.includes(targetSnippet)) {
        const pNode = currentNode.parentNode as HTMLElement | null;
        if (pNode && pNode.nodeName !== 'MARK' && pNode.nodeName !== 'SCRIPT' && pNode.nodeName !== 'STYLE') {
          nodesToReplace.push({ textNode: currentNode, parentNode: pNode, text: val });
        }
      }
      currentNode = walker.nextNode();
    }

    nodesToReplace.forEach(({ textNode, parentNode, text }) => {
      const bg = isAccepted ? '#22c55e' : '#f59e0b';
      const color = isAccepted ? '#ffffff' : '#000000';
      const icon = isAccepted ? '✓' : '⚠️';

      const span = document.createElement('span');
      const escaped = escapeRegExp(targetSnippet);
      const highlightedHtml = text.replace(
        new RegExp(escaped, 'g'),
        `<mark style="background:${bg}; color:${color}; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:inherit; font-family:inherit;" title="${item.reason}">${targetSnippet} ${icon}</mark>`
      );
      span.innerHTML = highlightedHtml;
      parentNode.replaceChild(span, textNode);
    });
  });
}

const VerificarQuestoesApp: React.FC = () => {
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [currentQ, setCurrentQ] = useState<any>(null);
  const [currentG, setCurrentG] = useState<any>(null);
  const [chaveProva, setChaveProva] = useState<string>('');
  const [idQuestao, setIdQuestao] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');

  const [useLanguageTool, setUseLanguageTool] = useState(true);
  const [useAI, setUseAI] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [isAuditing, setIsAuditing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [items, setItems] = useState<AuditItem[]>([]);
  const [selectedModel, setSelectedModel] = useState('models/gemini-3.5-flash');
  const [checkInconsistencies, setCheckInconsistencies] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);

  // Escuta colar foto (Ctrl+V) em qualquer lugar da tela
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            const mime = file.type || 'image/jpeg';
            setImageMimeType(mime);
            const reader = new FileReader();
            reader.onload = (event) => {
              const result = event.target?.result as string;
              setImageSrc(result);
              const base64Data = result.includes(',') ? result.split(',')[1] : result;
              setImageBase64(base64Data);
              customAlert('📋 Imagem da prova colada da área de transferência com sucesso!', 2000);
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Escuta seleção de questão pelo modal do Apêndice B
  useEffect(() => {
    const handleQuestionsSelected = (e: any) => {
      const questions = e.detail?.questions;
      if (questions && questions.length > 0) {
        const item = questions[0];
        carregarQuestaoCompleta(item);
      }
    };

    window.addEventListener('questions-selected', handleQuestionsSelected);
    return () => {
      window.removeEventListener('questions-selected', handleQuestionsSelected);
    };
  }, []);

  // Renderiza o Card Técnico de Alta Fidelidade no container do React e aplica os Destaques (Highlights)
  useEffect(() => {
    if (cardRef.current && currentQ) {
      cardRef.current.innerHTML = '';
      try {
        const metaPayload = {
          material_origem: chaveProva || 'ORIGEM',
          source_url: sourceUrl || undefined
        };

        const cardEl = criarCardTecnico(idQuestao || 'QUESTAO_ID', {
          dados_questao: currentQ,
          dados_gabarito: currentG || {},
          meta: metaPayload
        });

        cardRef.current.appendChild(cardEl);

        if (typeof renderLatexIn === 'function') {
          renderLatexIn(cardEl);
        }

        // Aplica o destaque dos trechos alterados diretamente no DOM do card
        highlightAuditItemsInCard(cardEl, items);
      } catch (err) {
        console.error('Erro ao renderizar Card Técnico:', err);
      }
    }
  }, [currentQ, currentG, idQuestao, chaveProva, items, sourceUrl]);

  // Carrega os dados completos da questão buscando no Firebase
  const carregarQuestaoCompleta = async (selected: any) => {
    setIsLoadingQuestion(true);
    setSelectedQuestion(selected);

    const prova = selected.prova || selected.chaveProva || 'PROVA_GERAL';
    const id = selected.id || selected.idQuestaoUnico || selected.identificacao || 'QUESTAO_ID';

    setChaveProva(prova);
    setIdQuestao(id);
    setItems([]);

    try {
      let qObj = selected.fullData?.dados_questao || selected.dados_questao || selected.questao;
      let gObj = selected.fullData?.dados_gabarito || selected.dados_gabarito || selected.gabarito;
      let metaObj = selected.fullData?.meta || selected.meta || {};

      // Se faltar dados estruturados, faz fetch no nó do Firebase para ter 100% das informações
      if (!qObj || !qObj.enunciado || !qObj.estrutura || !qObj.identificacao) {
        const questionRef = ref(db, `questoes/${prova}/${id}`);
        const snap = await get(questionRef);
        if (snap.exists()) {
          const val = snap.val();
          qObj = val.dados_questao || val;
          gObj = val.dados_gabarito || val;
          metaObj = val.meta || metaObj;
        }
      }

      if (!qObj) {
        qObj = selected;
      }

      const snapshotQ = JSON.parse(JSON.stringify(qObj));
      const snapshotG = JSON.parse(JSON.stringify(gObj || {}));
      originalSnapshotRef.current = { q: snapshotQ, g: snapshotG };

      setCurrentQ(snapshotQ);
      setCurrentG(snapshotG);

      const urlFound = metaObj.source_url ||
                       metaObj.source_url_prova ||
                       qObj?.source_url ||
                       qObj?.source_url_prova ||
                       (window as any).__pdfOriginalUrl ||
                       '';
      setSourceUrl(urlFound);

      const extractImgUrl = (img: any): string | null => {
        if (!img) return null;
        if (typeof img === 'string') return img;
        if (typeof img === 'object') return img.src || img.url || img.base64 || img.data || null;
        return null;
      };

      if (Array.isArray(qObj.fotos_originais) && qObj.fotos_originais.length > 0) {
        const imgStr = extractImgUrl(qObj.fotos_originais[0]);
        if (imgStr && typeof imgStr === 'string' && (imgStr.startsWith('http') || imgStr.startsWith('data:'))) {
          setImageSrc(imgStr);
          if (imgStr.startsWith('data:')) {
            const parts = imgStr.split(',');
            if (parts.length > 1) {
              setImageBase64(parts[1]);
              const mimeMatch = parts[0].match(/data:(.*?);/);
              if (mimeMatch) setImageMimeType(mimeMatch[1]);
            }
          }
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados completos da questão:', err);
      customAlert('⚠️ Erro ao carregar dados do Firebase.');
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  // Upload da foto original da prova via arquivo
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const mime = file.type || 'image/jpeg';
    setImageMimeType(mime);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageSrc(result);
      const base64Data = result.includes(',') ? result.split(',')[1] : result;
      setImageBase64(base64Data);
    };
    reader.readAsDataURL(file);
  };

  // Drag and Drop de foto
  const handleDropImage = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const mime = file.type || 'image/jpeg';
    setImageMimeType(mime);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageSrc(result);
      const base64Data = result.includes(',') ? result.split(',')[1] : result;
      setImageBase64(base64Data);
      customAlert('🖼️ Foto da prova arrastada e anexada!', 2000);
    };
    reader.readAsDataURL(file);
  };

  const handleCancelAudit = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAuditing(false);
    setStatusText('Análise cancelada pelo usuário.');
  };

  // Executa auditoria incluindo opções selecionadas (IA, LanguageTool ou Ambos)
  const handleRunAudit = async () => {
    if (!currentQ) {
      customAlert('⚠️ Por favor, selecione primeiro uma questão do banco.');
      return;
    }

    if (!useLanguageTool && !useAI) {
      customAlert('⚠️ Selecione pelo menos uma opção de auditoria (LanguageTool ou IA).');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsAuditing(true);
    setStatusText('Iniciando auditoria...');

    try {
      const auditResults = await runFullTextAudit(currentQ, currentG, {
        chaveProva,
        idQuestao,
        identificacao: currentQ?.identificacao || idQuestao,
        meta: currentQ?.meta || currentG?.meta || { material_origem: chaveProva, source_url: sourceUrl },
        useLanguageTool,
        useAI,
        modelId: selectedModel,
        imageBase64: imageBase64 || undefined,
        imageMimeType,
        checkInconsistencies,
        onStatusUpdate: (msg) => setStatusText(msg),
        signal: abortControllerRef.current.signal
      });

      setItems(auditResults);
    } catch (err: any) {
      if (err?.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        console.log('Auditoria cancelada pelo usuário.');
        setStatusText('Análise cancelada.');
      } else {
        console.error('Erro na auditoria:', err);
        customAlert('❌ Erro durante a auditoria: ' + (err.message || err));
      }
    } finally {
      setIsAuditing(false);
    }
  };

  const handleAcceptItem = (item: AuditItem) => {
    const { updatedQ, updatedG } = applyAuditFix(currentQ, currentG, item);
    setCurrentQ(updatedQ);
    setCurrentG(updatedG);

    window.__ultimaQuestaoExtraida = updatedQ;
    window.__ultimoGabaritoExtraido = updatedG;

    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'accepted' } : i));
  };

  const handleRejectItem = (item: AuditItem) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'rejected' } : i));
  };

  const handleAcceptAll = () => {
    let workingQ = currentQ;
    let workingG = currentG;

    const pendingItems = items.filter(i => i.status === 'pending');
    pendingItems.forEach(item => {
      const { updatedQ, updatedG } = applyAuditFix(workingQ, workingG, item);
      workingQ = updatedQ;
      workingG = updatedG;
    });

    setCurrentQ(workingQ);
    setCurrentG(workingG);

    window.__ultimaQuestaoExtraida = workingQ;
    window.__ultimoGabaritoExtraido = workingG;

    setItems(prev => prev.map(i => i.status === 'pending' ? { ...i, status: 'accepted' } : i));
  };

  const handleRejectAll = () => {
    setItems(prev => prev.map(i => i.status === 'pending' ? { ...i, status: 'rejected' } : i));
  };

  const originalSnapshotRef = useRef<{ q: any; g: any }>({ q: null, g: null });

  // Helper para download de arquivo JSON no computador do usuário
  const downloadJsonFile = (filename: string, data: any) => {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Erro ao baixar arquivo JSON de backup:', e);
    }
  };

  // PERSISTÊNCIA REAL NO FIREBASE E PINECONE
  const handleSaveToFirebase = async () => {
    if (!currentQ || !chaveProva || !idQuestao) {
      customAlert('❌ Nenhuma questão selecionada para salvar.');
      return;
    }

    setIsSaving(true);
    try {
      const { questaoFinal, gabaritoLimpo } = construirDadosParaEnvio(currentQ, currentG);
      const { idPinecone } = gerarIdentificadoresEnvio(chaveProva, currentQ);

      const metaOriginal = originalSnapshotRef.current?.q?.meta ||
                           originalSnapshotRef.current?.q?.dados_questao?.meta ||
                           currentQ?.meta ||
                           {};

      const finalSourceUrl = sourceUrl.trim() ||
                             metaOriginal.source_url ||
                             metaOriginal.source_url_prova ||
                             (window as any).__pdfOriginalUrl ||
                             null;

      const payloadParaSalvar = await prepararPayloadComImagens(null, questaoFinal, gabaritoLimpo, {
        ...metaOriginal,
        source_url: finalSourceUrl || undefined
      });

      if (!(payloadParaSalvar as any).meta) {
        (payloadParaSalvar as any).meta = {};
      }
      if (finalSourceUrl) {
        (payloadParaSalvar as any).meta.source_url = finalSourceUrl;
      }

      // Preserva fotos_originais apenas se forem URLs HTTP/HTTPS reais (nunca salva base64)
      const existingFotos = originalSnapshotRef.current?.q?.fotos_originais || currentQ?.fotos_originais || [];
      if (Array.isArray(existingFotos) && existingFotos.length > 0) {
        const cleanFotos = existingFotos.filter((f: any) => typeof f === 'string' && f.startsWith('http'));
        if (cleanFotos.length > 0) {
          (payloadParaSalvar as any).fotos_originais = cleanFotos;
        }
      }

      // 1. SALVA ARQUIVOS DE BACKUP NO PC DO USUÁRIO ([ANTE-CORRECAO] E [POS-CORRECAO])
      const safeId = idQuestao.replace(/[/\\?%*:|"<>]/g, '_');
      const safeProva = chaveProva.replace(/[/\\?%*:|"<>]/g, '_');

      const anteData = {
        chaveProva,
        idQuestao,
        data_download: new Date().toISOString(),
        tipo: "ANTE_CORRECAO_ORIGINAL",
        dados_questao_original: originalSnapshotRef.current.q || currentQ,
        dados_gabarito_original: originalSnapshotRef.current.g || currentG
      };

      downloadJsonFile(`[ANTE-CORRECAO]_${safeProva}_${safeId}.json`, anteData);
      downloadJsonFile(`[POS-CORRECAO]_${safeProva}_${safeId}.json`, payloadParaSalvar);

      // 2. ENVIA PARA O FIREBASE
      const caminhoFinal = `questoes/${chaveProva}/${idQuestao}`;
      const novaQuestaoRef = ref(db, caminhoFinal);
      await set(novaQuestaoRef, payloadParaSalvar);

      console.log('✅ Salvo no Firebase com sucesso:', caminhoFinal);

      try {
        const { vetorEmbedding, textoParaVetorizar } = await processarEmbeddingSemantico(null, questaoFinal, gabaritoLimpo);
        await indexarNoPinecone(null, vetorEmbedding, idPinecone, chaveProva, textoParaVetorizar, payloadParaSalvar);
        await DataNormalizer.flush();
      } catch (pineconeErr) {
        console.warn('Aviso: Erro no Pinecone, mas o Firebase foi atualizado:', pineconeErr);
      }

      customAlert('🎉 Correções salvas no Firebase! 2 arquivos de backup ([ANTE-CORRECAO] e [POS-CORRECAO]) foram baixados no seu PC.');
    } catch (err: any) {
      console.error('Erro ao salvar no Firebase:', err);
      customAlert('❌ Falha ao salvar alterações: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const acceptedCount = items.filter(i => i.status === 'accepted').length;

  return (
    <div style={{
      background: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '24px',
      fontFamily: 'system-ui, -apple-system, sans-serif', boxSizing: 'border-box'
    }}>
      {/* HEADER */}
      <div style={{
        maxWidth: '1500px', margin: '0 auto 24px auto', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155',
        paddingBottom: '16px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '12px', color: '#38bdf8' }}>
            🔍 Verificar Questões & Auditoria Pós-Envio
          </h1>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>
            Selecione uma questão do Firebase, anexe a foto da prova original (Ctrl+V ou Upload) e corrija inconsistências com IA.
          </div>
        </div>

        <button
          onClick={() => gerarTelaInicial()}
          style={{
            background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155',
            borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600
          }}
        >
          ← Voltar para Tela Inicial
        </button>
      </div>

      {/* MAIN LAYOUT */}
      <div style={{ maxWidth: '1500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* BARRA DE SELEÇÃO E CLIPBOARD */}
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px',
          display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => openAddQuestionsModal()}
              style={{
                background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px',
                padding: '10px 18px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              ➕ Selecionar Questão do Banco (Firebase)
            </button>

            {selectedQuestion && (
              <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '6px 14px', fontSize: '0.88rem' }}>
                Selecionada: <strong style={{ color: '#38bdf8' }}>{chaveProva} / {idQuestao}</strong>
              </div>
            )}

            {isLoadingQuestion && <span style={{ color: '#fbbf24', fontSize: '0.85rem' }}>⏳ Carregando dados do Firebase...</span>}
          </div>

          {/* PASTE / UPLOAD FOTO */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>💡 Dica: Pressione <strong>Ctrl+V</strong> em qualquer lugar para colar a foto</span>
            <label style={{ fontSize: '0.88rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#334155', padding: '8px 14px', borderRadius: '6px' }}>
              <span>📷 Anexar Foto da Prova</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </label>
          </div>

          {/* CAMPO EDITÁVEL: LINK DA PROVA ORIGINAL (PDF/FONTE) */}
          {currentQ && (
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '12px', borderTop: '1px solid #334155', marginTop: '6px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#38bdf8', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🔗 Link da Prova Original (Fonte / PDF):
              </span>
              <input
                type="url"
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                placeholder="Cole o link oficial HTTP/HTTPS da prova original em PDF (Ex: https://exemplo.com/prova.pdf)"
                style={{
                  flex: 1, background: '#0f172a', color: '#f8fafc', border: '1px solid #475569',
                  borderRadius: '6px', padding: '8px 12px', fontSize: '0.88rem'
                }}
              />
              {sourceUrl ? (
                <button
                  type="button"
                  onClick={() => window.open(sourceUrl, '_blank')}
                  style={{
                    background: '#1e293b', color: '#38bdf8', border: '1px solid #38bdf8',
                    borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600
                  }}
                  title="Testar link abrindo em nova aba"
                >
                  🌐 Testar Link
                </button>
              ) : null}
            </div>
          )}
        </div>

        {/* CONTROLES DA IA E AUDITORIA */}
        {currentQ && (
          <div style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px 20px',
            display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useLanguageTool}
                  onChange={e => setUseLanguageTool(e.target.checked)}
                />
                <span>LanguageTool (Sem IA)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useAI}
                  onChange={e => setUseAI(e.target.checked)}
                />
                <span>Auditoria com IA</span>
              </label>

              {useAI && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Modelo IA:</span>
                    <select
                      value={selectedModel}
                      onChange={e => setSelectedModel(e.target.value)}
                      style={{ background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', padding: '6px 10px', fontSize: '0.85rem' }}
                    >
                      {IA_MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.title}</option>
                      ))}
                    </select>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={checkInconsistencies}
                      onChange={e => setCheckInconsistencies(e.target.checked)}
                    />
                    <span>Verificar Incoerências Lógicas e Pedagógicas</span>
                  </label>
                </>
              )}
            </div>

            {isAuditing ? (
              <button
                onClick={handleCancelAudit}
                style={{
                  background: '#ef4444', color: '#fff', border: 'none',
                  borderRadius: '6px', padding: '10px 20px', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                ⛔ Cancelar Análise
              </button>
            ) : (
              <button
                onClick={handleRunAudit}
                style={{
                  background: '#8b5cf6', color: '#fff', border: 'none',
                  borderRadius: '6px', padding: '10px 20px', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                🔍 Executar Verificação
              </button>
            )}
          </div>
        )}

        {/* STATUS DA AUDITORIA */}
        {isAuditing && (
          <div style={{ padding: '20px', textAlign: 'center', background: '#1e293b', borderRadius: '8px', border: '1px solid #3b82f6', color: '#60a5fa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '1.5rem' }}>⏳</div>
            <div style={{ fontWeight: 600 }}>{statusText}</div>
            <button
              onClick={handleCancelAudit}
              style={{
                background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px',
                padding: '8px 18px', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer'
              }}
            >
              ⛔ Cancelar Análise da IA
            </button>
          </div>
        )}

        {/* PAINEL DUAL: FOTO ORIGINAL vs CARD DA QUESTÃO COMPLETA */}
        {currentQ && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', minHeight: '600px' }}>
            
            {/* ESQUERDA: FOTO ORIGINAL / DROPZONE / PASTEZONE */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDropImage}
              style={{
                background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px',
                display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '600px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📸</span> Foto Original da Prova
                </h3>
                {imageSrc && (
                  <button
                    onClick={() => { setImageSrc(null); setImageBase64(null); }}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.82rem' }}
                  >
                    ✕ Remover Foto
                  </button>
                )}
              </div>

              {imageSrc ? (
                <div style={{ flex: 1, overflow: 'auto', background: '#0f172a', borderRadius: '8px', padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <img src={imageSrc} alt="Foto da prova original" style={{ maxWidth: '100%', maxHeight: '650px', objectFit: 'contain', borderRadius: '4px' }} />
                </div>
              ) : (
                <div
                  style={{
                    flex: 1, border: '2px dashed #475569', borderRadius: '8px', display: 'flex',
                    flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px',
                    color: '#64748b', background: '#0f172a'
                  }}
                >
                  <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📋</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#94a3b8' }}>Cole a foto da prova (Ctrl+V)</div>
                  <div style={{ fontSize: '0.85rem', marginTop: '6px', color: '#64748b' }}>ou Arraste o arquivo de imagem aqui</div>
                </div>
              )}
            </div>

            {/* DIREITA: CARD DA QUESTÃO TÉCNICO (LIVE RENDER) COM DESTAQUES VISUAIS */}
            <div style={{
              background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px',
              display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '800px', overflowY: 'auto'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🎴</span> Card da Questão (Renderização Completa com Destaques)
              </h3>

              {/* CARD TÉCNICO DO MAIA.EDU COM HIGHLIGHTS DOM APLICADOS */}
              <div ref={cardRef} style={{ background: '#0f172a', borderRadius: '8px', padding: '10px' }}></div>
            </div>
          </div>
        )}

        {/* SUGESTÕES DA IA COM DIFF CARDS */}
        {items.length > 0 && (
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f59e0b' }}>
                🚨 Alterações Sugeridas ({items.length} problemas encontrados)
              </h3>

              {pendingCount > 0 && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleAcceptAll}
                    style={{ background: '#166534', color: '#4ade80', border: '1px solid #22c55e', borderRadius: '6px', padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    ✅ Aceitar Todos Pendentes
                  </button>
                  <button
                    onClick={handleRejectAll}
                    style={{ background: '#334155', color: '#cbd5e1', border: '1px solid #475569', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}
                  >
                    ❌ Recusar Todos
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {items.map((item) => {
                const isAccepted = item.status === 'accepted';
                const isRejected = item.status === 'rejected';

                return (
                  <div key={item.id} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '16px', opacity: isRejected ? 0.45 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                      <span style={{ background: '#3b82f6', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                        {item.fieldPath}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#fbbf24', fontStyle: 'italic' }}>
                        {item.reason}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontFamily: 'monospace', fontSize: '0.88rem' }}>
                      <div style={{ background: 'rgba(239, 68, 68, 0.12)', borderLeft: '4px solid #ef4444', padding: '10px', borderRadius: '4px', color: '#fca5a5' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', marginBottom: '4px' }}>- ORIGINAL NO BANCO:</div>
                        <div>{item.originalText}</div>
                      </div>
                      <div style={{ background: 'rgba(34, 197, 94, 0.12)', borderLeft: '4px solid #22c55e', padding: '10px', borderRadius: '4px', color: '#86efac' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#22c55e', marginBottom: '4px' }}>+ CORREÇÃO SUGERIDA:</div>
                        <div>{item.suggestedText}</div>
                      </div>
                    </div>

                    <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      {isAccepted ? (
                        <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.85rem' }}>✓ Correção Aplicada ao Objeto</span>
                      ) : isRejected ? (
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>✕ Sugestão Recusada</span>
                      ) : (
                        <>
                          <button onClick={() => handleRejectItem(item)} style={{ background: '#334155', color: '#cbd5e1', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' }}>
                            ❌ Recusar
                          </button>
                          <button onClick={() => handleAcceptItem(item)} style={{ background: '#15803d', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                            ✅ Aceitar Correção
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* GRAVAÇÃO FINAL NO FIREBASE & PINECONE */}
        {currentQ && (
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
              {acceptedCount > 0 ? `✨ ${acceptedCount} alteração(ões) aceita(s) pronta(s) para gravação.` : 'Nenhuma alteração pendente.'}
            </div>

            <button
              onClick={handleSaveToFirebase}
              disabled={isSaving}
              style={{
                background: isSaving ? '#475569' : '#22c55e', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '12px 28px', fontSize: '1rem', fontWeight: 700,
                cursor: isSaving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)'
              }}
            >
              {isSaving ? '⏳ Salvando no Firebase & Pinecone...' : '💾 Salvar Correções no Banco de Dados'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
