/**
 * Módulo de Busca Reversa de Vestibulares (Modo Detetive)
 * Maia.edu - Identifica questões originais de vestibular a partir de fotos ou recortes de provas
 */

import { gerarConteudoEmJSONComImagemStream, gerarEmbedding, queryPineconeWorker } from '../api/worker.js';
import { bancoState } from '../main.js';
import { customAlert } from '../ui/GlobalAlertsLogic.tsx';
import { mountModelSelectorModal } from '../ui/ModelSelectorModal.tsx';
import { criarCardTecnico } from './card-template.js';

function formatModelName(modelId, defaultName = 'Gemini 3.5 Flash') {
  if (!modelId) return defaultName;
  const cleaned = modelId
    .replace(/^models\//, '')
    .replace(/^vertex\//, '')
    .replace(/^puter\//, '');
  return cleaned.length > 20 ? `${cleaned.substring(0, 18)}...` : cleaned;
}

/**
 * Normaliza textos para busca de fallback
 */
function normalizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Renderiza a interface do Modo Detetive
 */
export function renderDetectiveSearchUI(container) {
  if (!container) return;

  const currentVisionModel =
    window.selectedModelDetectiveVision ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('selectedModelDetectiveVision') : null) ||
    'models/gemini-3.5-flash';

  const currentJudgeModel =
    window.selectedModelDetectiveJudge ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('selectedModelDetectiveJudge') : null) ||
    'models/gemini-3.5-flash';

  container.innerHTML = `
    <div class="detective-panel fade-in" style="max-width: 950px; margin: 0 auto; padding: 20px 10px;">
      <!-- Header do Detetive -->
      <div class="detective-header" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.05)); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 16px; padding: 22px 26px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div style="flex: 1 1 480px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <span style="font-size: 1.6rem;">🕵️</span>
            <h2 style="margin: 0; font-size: 1.35rem; font-weight: 700; color: var(--color-text); letter-spacing: -0.3px;">Achar Vestibular de Origem</h2>
            <span style="background: rgba(139, 92, 246, 0.2); color: #c4b5fd; font-size: 0.72rem; padding: 3px 8px; border-radius: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Modo Detetive</span>
          </div>
          <p style="margin: 0; font-size: 0.86rem; color: var(--color-text-secondary); line-height: 1.45;">
            Tire uma foto ou cole o texto da questão da sua prova. A IA faz a engenharia reversa para encontrar o vestibular original e indicar o que o professor adaptou.
          </p>
        </div>

        <div style="display: flex; align-items: center;">
          <button type="button" class="js-config-detective-models" style="background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(139, 92, 246, 0.35); border-radius: 12px; padding: 8px 14px; display: inline-flex; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" onmouseover="this.style.background='rgba(139, 92, 246, 0.22)'; this.style.borderColor='rgba(139, 92, 246, 0.5)'" onmouseout="this.style.background='rgba(139, 92, 246, 0.12)'; this.style.borderColor='rgba(139, 92, 246, 0.35)'">
            <span style="background: rgba(139, 92, 246, 0.3); color: #ddd6fe; font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">IA</span>
            <div style="display: flex; flex-direction: column; align-items: flex-start; text-align: left;">
              <span style="font-size: 0.78rem; font-weight: 600; color: #f1f5f9;">👁️ ${formatModelName(currentVisionModel)} · ⚖️ ${formatModelName(currentJudgeModel)}</span>
              <span style="font-size: 0.68rem; color: #a78bfa;">Clique para trocar de modelo</span>
            </div>
            <span style="font-size: 0.9rem; margin-left: 2px;">⚙️</span>
          </button>
        </div>
      </div>

      <!-- Input Área Multimodal (Dropzone + Texto) -->
      <div class="detective-input-card" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; padding: 22px; margin-bottom: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
        <!-- Dropzone de Imagem -->
        <div id="detectiveDropzone" class="detective-dropzone" style="border: 2px dashed rgba(139, 92, 246, 0.4); border-radius: 12px; padding: 24px 16px; text-align: center; background: rgba(139, 92, 246, 0.03); cursor: pointer; transition: all 0.2s ease; margin-bottom: 16px;">
          <input type="file" id="detectiveFileInput" accept="image/*" style="display: none;" />
          
          <div id="detectiveDropzoneContent">
            <div style="font-size: 2rem; margin-bottom: 8px;">📸</div>
            <div style="font-weight: 600; font-size: 0.95rem; color: var(--color-text); margin-bottom: 4px;">
              Arraste a foto da prova ou clique para enviar
            </div>
            <div style="font-size: 0.8rem; color: var(--color-text-secondary);">
              Suporta fotos da prova física, prints, recortes e digitalizações (JPEG, PNG, WEBP)
            </div>
          </div>

          <!-- Preview da Imagem Selecionada -->
          <div id="detectivePreviewContainer" style="display: none; position: relative; align-items: center; justify-content: center; gap: 14px;">
            <img id="detectiveImagePreview" src="" alt="Preview da Prova" style="max-height: 180px; max-width: 100%; border-radius: 8px; border: 1px solid var(--color-border); object-fit: contain;" />
            <button id="btnRemoveDetectiveImage" type="button" style="position: absolute; top: -8px; right: -8px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 26px; height: 26px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3);" title="Remover imagem">&times;</button>
          </div>
        </div>

        <!-- Entrada de Texto / Complemento -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 6px; text-transform: uppercase;">
            Ou cole trechos do enunciado / observações
          </label>
          <textarea 
            id="detectiveTextInput" 
            rows="3" 
            placeholder="Ex: 'Um móvel parte do repouso e descreve uma trajetória retilínea... (ou cole o enunciado completo)'"
            style="width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg-2); color: var(--color-text); font-size: 0.88rem; resize: vertical; outline: none; font-family: inherit;"
          ></textarea>
        </div>

        <!-- Botão de Ação -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div style="font-size: 0.78rem; color: var(--color-text-secondary);">
            💡 <em>Dica: Você pode combinar a foto da prova com palavras-chave para máxima precisão.</em>
          </div>
          <button id="btnExecutarDetetive" class="btn btn--primary" style="padding: 10px 24px; font-weight: 600; display: flex; align-items: center; gap: 8px; border-radius: 10px; font-size: 0.9rem;">
            <span>🔍</span> Identificar Questão Original
          </button>
        </div>
      </div>

      <!-- Status / Loader -->
      <div id="detectiveStatusArea" style="display: none; margin-bottom: 24px;"></div>

      <!-- Área de Resultados do Detetive -->
      <div id="detectiveResultsArea" style="display: none;"></div>
    </div>
  `;

  bindDetectiveEvents(container);
}

/**
 * Configura os ouvintes de eventos da tela do Detetive
 */
function bindDetectiveEvents(container) {
  const dropzone = container.querySelector('#detectiveDropzone');
  const fileInput = container.querySelector('#detectiveFileInput');
  const previewContainer = container.querySelector('#detectivePreviewContainer');
  const dropzoneContent = container.querySelector('#detectiveDropzoneContent');
  const imgPreview = container.querySelector('#detectiveImagePreview');
  const btnRemove = container.querySelector('#btnRemoveDetectiveImage');
  const btnExecutar = container.querySelector('#btnExecutarDetetive');
  const configBtn = container.querySelector('.js-config-detective-models');

  let selectedImageBase64 = null;

  // Seletor de Modelos de IA
  if (configBtn) {
    configBtn.onclick = () => {
      const cur =
        window.selectedModelDetectiveVision ||
        localStorage.getItem('selectedModelDetectiveVision') ||
        'models/gemini-3.5-flash';

      mountModelSelectorModal(
        cur,
        () => {
          renderDetectiveSearchUI(container);
          customAlert('✅ Modelos do Modo Detetive atualizados!', 2000);
        },
        'detective',
      );
    };
  }

  // Upload e Drag & Drop
  if (dropzone && fileInput) {
    dropzone.onclick = (e) => {
      if (e.target.id === 'btnRemoveDetectiveImage' || e.target.closest('#btnRemoveDetectiveImage')) return;
      fileInput.click();
    };

    dropzone.ondragover = (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#8b5cf6';
      dropzone.style.background = 'rgba(139, 92, 246, 0.08)';
    };

    dropzone.ondragleave = () => {
      dropzone.style.borderColor = 'rgba(139, 92, 246, 0.4)';
      dropzone.style.background = 'rgba(139, 92, 246, 0.03)';
    };

    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'rgba(139, 92, 246, 0.4)';
      dropzone.style.background = 'rgba(139, 92, 246, 0.03)';

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processarArquivoImagem(e.dataTransfer.files[0]);
      }
    };

    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        processarArquivoImagem(e.target.files[0]);
      }
    };
  }

  function processarArquivoImagem(file) {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      selectedImageBase64 = dataUrl.split(',')[1];
      if (imgPreview) imgPreview.src = dataUrl;
      if (previewContainer) previewContainer.style.display = 'flex';
      if (dropzoneContent) dropzoneContent.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  if (btnRemove) {
    btnRemove.onclick = (e) => {
      e.stopPropagation();
      selectedImageBase64 = null;
      if (fileInput) fileInput.value = '';
      if (previewContainer) previewContainer.style.display = 'none';
      if (dropzoneContent) dropzoneContent.style.display = 'block';
    };
  }

  // Executar Busca Reversa
  if (btnExecutar) {
    btnExecutar.onclick = async () => {
      const textVal = (container.querySelector('#detectiveTextInput')?.value || '').trim();

      if (!selectedImageBase64 && !textVal) {
        alert('Por favor, envie uma foto da prova ou digite um trecho da questão para iniciar a busca.');
        return;
      }

      await executarBuscaDetetive({
        imageBase64: selectedImageBase64,
        texto: textVal,
        container,
      });
    };
  }
}

/**
 * Orquestra o Pipeline Completo da Busca Reversa
 */
async function executarBuscaDetetive({ imageBase64, texto, container }) {
  const statusArea = container.querySelector('#detectiveStatusArea');
  const resultsArea = container.querySelector('#detectiveResultsArea');

  if (resultsArea) resultsArea.style.display = 'none';
  if (statusArea) {
    statusArea.style.display = 'block';
    statusArea.innerHTML = `
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px; text-align: center;">
        <div class="spinner" style="margin: 0 auto 12px auto;"></div>
        <div id="detectiveStatusMessage" style="font-weight: 600; color: var(--color-primary); margin-bottom: 6px;">
          👁️ Analisando imagem e transcrevendo questão com IA...
        </div>
        <div style="font-size: 0.8rem; color: var(--color-text-secondary);">
          Etapa 1 de 3: Extração visual e termos estruturais
        </div>
      </div>
    `;
  }

  const visionModel =
    window.selectedModelDetectiveVision ||
    localStorage.getItem('selectedModelDetectiveVision') ||
    'models/gemini-3.5-flash';

  const judgeModel =
    window.selectedModelDetectiveJudge ||
    localStorage.getItem('selectedModelDetectiveJudge') ||
    'models/gemini-3.5-flash';

  try {
    // --- ETAPA 1: Visão & Transcrição Estruturada ---
    const extractionSchema = {
      type: 'OBJECT',
      properties: {
        enunciado_transcrito: {
          type: 'STRING',
          description: 'Texto completo e fiel do enunciado da questão, com equações em LaTeX.',
        },
        materia_provavel: {
          type: 'STRING',
          description: 'Matéria principal (Física, Matemática, Química, Biologia, Português, História, etc.).',
        },
        tema: {
          type: 'STRING',
          description: 'Tópico ou conceito central da questão.',
        },
        termos_chave_unicos: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Termos raros, nomes de variáveis, personagens ou frases características.',
        },
        elementos_visuais: {
          type: 'STRING',
          description: 'Descrição de gráficos, tabelas, charges ou tirinhas presentes na questão.',
        },
        comando_questao: {
          type: 'STRING',
          description: 'O que a questão pede explicitamente para calcular ou assinalar.',
        },
      },
      required: ['enunciado_transcrito', 'materia_provavel', 'tema', 'termos_chave_unicos'],
    };

    const promptExtracao = `Você é o Perito Forense em Questões de Vestibular da Maia.edu.
Analise detalhadamente a imagem ou texto da prova fornecida. Transcreva com fidelidade absoluta o enunciado, identifique fórmulas em LaTeX, elementos visuais (gráficos, esquemas, tabelas) e extraia palavras-chave exclusivas e o comando central do problema.
Texto complementar fornecido pelo aluno: "${texto || 'Nenhum'}"`;

    const attachments = imageBase64 ? [imageBase64] : [];
    const analise = await gerarConteudoEmJSONComImagemStream(
      promptExtracao,
      extractionSchema,
      attachments,
      'image/jpeg',
      {
        onStatus: (msg) => {
          const msgEl = document.getElementById('detectiveStatusMessage');
          if (msgEl && typeof msg === 'string') msgEl.textContent = `👁️ ${msg}`;
        },
      },
      {
        model: visionModel,
      },
    );

    // --- ETAPA 2: Recuperação de Candidatos no Banco / Pinecone ---
    if (statusArea) {
      statusArea.innerHTML = `
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px; text-align: center;">
          <div class="spinner" style="margin: 0 auto 12px auto;"></div>
          <div style="font-weight: 600; color: var(--color-primary); margin-bottom: 6px;">
            🔍 Buscando candidatos de vestibular no banco de dados (Pinecone)...
          </div>
          <div style="font-size: 0.8rem; color: var(--color-text-secondary);">
            Etapa 2 de 3: Cruzamento semântico e filtragem estrutural
          </div>
        </div>
      `;
    }

    const pool = bancoState.todasQuestoesCache || [];
    const candidatos = await recuperarCandidatosVestibular(analise, pool);

    if (!candidatos || candidatos.length === 0) {
      if (statusArea) statusArea.style.display = 'none';
      if (resultsArea) {
        resultsArea.style.display = 'block';
        resultsArea.innerHTML = `
          <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 24px; text-align: center; color: #f87171;">
            <div style="font-size: 2rem; margin-bottom: 8px;">🕵️‍♂️❌</div>
            <h3 style="margin: 0 0 6px 0;">Nenhuma questão correspondente encontrada</h3>
            <p style="margin: 0; font-size: 0.88rem; color: var(--color-text-secondary);">
              Não encontramos uma questão compatível em nosso banco atual com esses critérios. Tente fornecer uma imagem mais nítida ou mais termos do enunciado.
            </p>
          </div>
        `;
      }
      return;
    }

    // --- ETAPA 3: Juiz de Correspondência (Prompt 2 - Reranker/Judge) ---
    if (statusArea) {
      statusArea.innerHTML = `
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px; text-align: center;">
          <div class="spinner" style="margin: 0 auto 12px auto;"></div>
          <div style="font-weight: 600; color: var(--color-primary); margin-bottom: 6px;">
            ⚖️ Juiz de Vestibulares comparando os candidatos e detectando adaptações...
          </div>
          <div style="font-size: 0.8rem; color: var(--color-text-secondary);">
            Etapa 3 de 3: Identificação de mudanças feitas pelo professor
          </div>
        </div>
      `;
    }

    const judgeSchema = {
      type: 'OBJECT',
      properties: {
        match_found: {
          type: 'BOOLEAN',
          description: 'True se houver uma questão mãe no vestibular com alta probabilidade de correspondência.',
        },
        confidence: {
          type: 'INTEGER',
          description: 'Grau de certeza de 0 a 100% de que esta é a questão original.',
        },
        vestibular_origem: {
          type: 'STRING',
          description: 'Nome da banca e ano original (ex: ENEM 2021, FUVEST 2019, UNICAMP 2020).',
        },
        tipo_adaptacao: {
          type: 'STRING',
          enum: [
            'identica',
            'valores_alterados',
            'contexto_adaptado',
            'isomorfica_mesmo_modelo',
            'nenhuma_correspondente',
          ],
          description: 'Classificação da alteração feita pelo professor em relação ao vestibular original.',
        },
        explicacao_diferencas: {
          type: 'STRING',
          description: 'Explicação didática das alterações (ex: O professor trocou a massa de 2 kg para 5 kg e simplificou as alternativas).',
        },
        best_candidate_index: {
          type: 'INTEGER',
          description: 'Índice (0 a N-1) do melhor candidato na lista enviada.',
        },
      },
      required: ['match_found', 'confidence', 'vestibular_origem', 'tipo_adaptacao', 'explicacao_diferencas', 'best_candidate_index'],
    };

    const candidatosJsonRaw = JSON.stringify(
      candidatos.map((c, idx) => ({
        candidato_index: idx,
        id: c.id,
        prova_origem: c.fullData?.meta?.material_origem || c.fullData?.prova || 'Vestibular',
        questao_completa: c.fullData || c,
      })),
      null,
      2,
    );

    const promptJuiz = `Você é o Juiz Especialista em Engenharia Reversa e Genealogia de Questões de Vestibular da Maia.edu.
Compare a questão da prova do estudante (transcrita a partir de foto/texto) com a lista de CANDIDATOS REAIS DO BANCO DE DADOS (fornecidos em JSON integral abaixo, com todos os campos estruturais, descrições de imagens, blocos de texto, alternativas e gabaritos).

=== QUESTÃO DA PROVA DO ALUNO ===
- Enunciado Transcrito da Foto: ${analise.enunciado_transcrito}
- Matéria Provável: ${analise.materia_provavel}
- Tema / Tópico: ${analise.tema}
- Elementos Visuais e Gráficos da Foto: ${analise.elementos_visuais || 'Nenhum'}
- Termos Chave: ${(analise.termos_chave_unicos || []).join(', ')}
- Comando da Questão: ${analise.comando_questao || 'Geral'}

=== CANDIDATOS DO BANCO (JSON INTEGRAL SEM CORTES) ===
\`\`\`json
${candidatosJsonRaw}
\`\`\`

=== INSTRUÇÕES PARA O JULGAMENTO ===
1. Analise minuciosamente o JSON de cada candidato, inspecionando "dados_questao", "estrutura" (inclusive "descricao_imagem", "transcricao" ou elementos visuais), "alternativas", "dados_gabarito" e "meta".
2. Identifique qual candidato (pelo "candidato_index") é a QUESTÃO ORIGINAL da qual a prova do aluno foi tirada ou adaptada.
3. Se o professor alterou números, encurtou o enunciado ou mudou o formato das alternativas, aponte detalhadamente em "explicacao_diferencas" e classifique em "tipo_adaptacao".
4. Retorne a resposta rigorosamente no schema JSON exigido.`;

    const veredito = await gerarConteudoEmJSONComImagemStream(
      promptJuiz,
      judgeSchema,
      [],
      'image/jpeg',
      {},
      {
        model: judgeModel,
      },
    );

    if (statusArea) statusArea.style.display = 'none';

    // Renderizar Veredito e Card Completo
    const bestCand = candidatos[veredito.best_candidate_index] || candidatos[0];
    exibirResultadoDetetive(resultsArea, analise, veredito, bestCand);

  } catch (error) {
    console.error('[Detective Search Error]', error);
    if (statusArea) statusArea.style.display = 'none';
    if (resultsArea) {
      resultsArea.style.display = 'block';
      resultsArea.innerHTML = `
        <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 20px; color: #f87171; text-align: center;">
          <div style="font-size: 1.8rem; margin-bottom: 6px;">⚠️</div>
          <strong>Erro ao processar a busca do detetive:</strong>
          <div style="font-size: 0.85rem; margin-top: 4px;">${error.message || 'Falha na comunicação com o cérebro de IA.'}</div>
        </div>
      `;
    }
  }
}

import { renderLatexIn } from '../libs/loader.tsx';
import { buscarQuestoesPaginadasWorker } from './paginacao-e-carregamento.js';

/**
 * Decodifica Base64URL para string original (Reverso de sanitizarID do Pinecone)
 */
function desanitizarID(encoded) {
  if (!encoded) return '';
  try {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return decodeURIComponent(escape(atob(base64)));
  } catch (e) {
    return encoded;
  }
}

/**
 * Busca candidatos no Pinecone, no Worker e no Firebase em tempo real
 */
async function recuperarCandidatosVestibular(analise, pool = []) {
  const queryStr = `${analise.enunciado_transcrito || ''} ${(analise.termos_chave_unicos || []).join(' ')} ${analise.tema || ''} ${analise.elementos_visuais || ''}`.substring(0, 800);

  const candidates = [];
  const usedIds = new Set();

  // 1. BUSCA VETORIAL / SEMÂNTICA NO PINECONE
  let pineconeResults = [];
  try {
    const vector = await gerarEmbedding(queryStr);
    if (vector) {
      const resp = await queryPineconeWorker(vector, 12, {}, 'default');
      if (resp && Array.isArray(resp.matches)) {
        pineconeResults = resp.matches;
      }
    }
  } catch (e) {
    console.warn('[Detective Search] Pinecone indisponível, recorrendo ao Worker/local:', e);
  }

  // Import dinâmico do Firebase para buscar documentos completos
  let dbGet = null;
  let dbRef = null;
  let firebaseDb = null;
  try {
    const fbDb = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js');
    const mainMod = await import('../main.js');
    dbGet = fbDb.get;
    dbRef = fbDb.ref;
    firebaseDb = mainMod.db;
  } catch (e) {
    console.warn('[Detective Search] Firebase client indisponível:', e);
  }

  // 2. PROCESSA MATCHES DO PINECONE E BUSCA NO FIREBASE SE NECESSÁRIO
  for (const match of pineconeResults) {
    const rawId = match.id || '';
    if (!rawId) continue;

    let provaKey = '';
    let questaoKey = '';

    if (rawId.includes('--')) {
      const parts = rawId.split('--');
      provaKey = desanitizarID(parts[0]);
      questaoKey = desanitizarID(parts[1]);
    } else {
      questaoKey = rawId;
    }

    const cleanId = questaoKey || rawId;
    if (usedIds.has(cleanId)) continue;

    // Tenta achar no pool local
    let questionData = pool.find((item) => item.key === cleanId || item.id === cleanId || item.key?.endsWith(`___${cleanId}`));

    // Se tiver full_json no metadata do Pinecone, carrega instantaneamente
    if (!questionData && match.metadata?.full_json) {
      try {
        const full = typeof match.metadata.full_json === 'string'
          ? JSON.parse(match.metadata.full_json)
          : match.metadata.full_json;
        if (full) {
          questionData = {
            key: `${match.metadata.prova || provaKey || 'prova'}___${cleanId}`,
            id: cleanId,
            prova: match.metadata.prova || provaKey || 'prova',
            domId: `${match.metadata.prova || provaKey || 'prova'}___${cleanId}`,
            ...full,
            meta: { material_origem: (match.metadata.prova || provaKey || '').replace(/_/g, ' '), ...(full.meta || {}) },
          };
        }
      } catch (errJson) {
        console.warn('[Detective Search] Erro ao parsear metadata.full_json:', errJson);
      }
    }

    // Se não achou no pool local nem no Pinecone metadata, busca direto no Firebase
    if (!questionData && dbGet && dbRef && firebaseDb && provaKey && questaoKey) {
      try {
        const snap = await dbGet(dbRef(firebaseDb, `questoes/${provaKey}/${questaoKey}`));
        if (snap.exists()) {
          const val = snap.val();
          questionData = {
            key: `${provaKey}___${questaoKey}`,
            id: questaoKey,
            prova: provaKey,
            domId: `${provaKey}___${questaoKey}`,
            ...val,
            meta: { material_origem: provaKey.replace(/_/g, ' '), ...(val.meta || {}) },
          };
        }
      } catch (errSnap) {
        console.warn('[Detective Search] Erro ao carregar questão do Firebase:', errSnap);
      }
    }

    if (questionData) {
      usedIds.add(cleanId);
      candidates.push({
        id: cleanId,
        fullData: questionData,
        score: match.score || 0.95,
      });
    }
  }

  // 3. BUSCA TEXTUAL VIA WORKER COM AS PALAVRAS-CHAVE EXTRAÍDAS
  const searchKeywords = [
    ...(analise.termos_chave_unicos || []),
    analise.tema,
  ]
    .map((k) => (k || '').replace(/["'()]/g, '').trim())
    .filter((k) => k.length > 2);

  for (const keyword of searchKeywords.slice(0, 4)) {
    try {
      const workerRes = await buscarQuestoesPaginadasWorker(1, 10, '', keyword);
      if (workerRes && Array.isArray(workerRes.questoes)) {
        for (const item of workerRes.questoes) {
          const qId = item.id || item.key;
          if (qId && !usedIds.has(qId)) {
            usedIds.add(qId);
            candidates.push({
              id: qId,
              fullData: item,
              score: 0.88,
            });
          }
        }
      }
    } catch (errWorker) {
      console.warn('[Detective Search] Erro na busca via Worker:', errWorker);
    }
  }

  // 4. FALLBACK LÉXICO / ESTRUTURAL NO POOL LOCAL
  if (candidates.length < 5 && pool.length > 0) {
    const terms = (analise.termos_chave_unicos || []).map((t) => normalizeText(t)).filter((t) => t.length > 2);
    const materiaNorm = normalizeText(analise.materia_provavel || '');

    const scoredLocal = pool
      .filter((item) => !usedIds.has(item.key || item.id))
      .map((item) => {
        let sc = 0;
        const q = item.dados_questao || {};
        const enun = normalizeText(q.enunciado || '');
        const mat = (q.materias_possiveis || []).map((m) => normalizeText(m));

        if (materiaNorm && mat.some((m) => m.includes(materiaNorm))) sc += 30;
        terms.forEach((t) => {
          if (enun.includes(t)) sc += 20;
        });

        return {
          id: item.key || item.id,
          fullData: item,
          score: sc / 100,
        };
      })
      .filter((c) => c.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    candidates.push(...scoredLocal);
  }

  return candidates;
}

/**
 * Renderiza o painel final com o Veredito do Detetive e o Card Oficial
 */
function exibirResultadoDetetive(resultsArea, analise, veredito, candidate) {
  if (!resultsArea) return;

  const conf = veredito.confidence || 90;
  const confColor = conf >= 85 ? '#10b981' : conf >= 65 ? '#f59e0b' : '#3b82f6';

  let tagAdaptacao = '✨ Questão Idêntica';
  if (veredito.tipo_adaptacao === 'valores_alterados') tagAdaptacao = '🔄 Valores / Números Alterados';
  else if (veredito.tipo_adaptacao === 'contexto_adaptado') tagAdaptacao = '📝 Contexto Adaptado pelo Professor';
  else if (veredito.tipo_adaptacao === 'isomorfica_mesmo_modelo') tagAdaptacao = '🧬 Questão Isomórfica (Mesmo Modelo)';

  resultsArea.style.display = 'block';
  resultsArea.innerHTML = `
    <!-- Card de Veredito Forense -->
    <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(139, 92, 246, 0.12)); border: 1px solid ${confColor}; border-radius: 16px; padding: 22px 24px; margin-bottom: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.4rem;">🎯</span>
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--color-text);">
              ${veredito.vestibular_origem || 'Vestibular Identificado'}
            </h3>
            <span style="background: ${confColor}; color: #000; font-weight: 700; font-size: 0.75rem; padding: 3px 8px; border-radius: 6px;">
              ${conf}% de Correspondência
            </span>
          </div>
          <div style="margin-top: 6px; font-size: 0.85rem; color: #a78bfa; font-weight: 600;">
            ${tagAdaptacao}
          </div>
        </div>
      </div>

      <div style="background: rgba(0,0,0,0.25); border-radius: 10px; padding: 14px 16px; margin-top: 10px; font-size: 0.88rem; line-height: 1.5; color: var(--color-text);">
        <strong>🔍 Análise do Professor:</strong> ${veredito.explicacao_diferencas}
      </div>
    </div>

    <!-- Título do Card Oficial -->
    <div style="margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
      <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600; color: var(--color-text);">
        📖 Questão Oficial com Resolução e Gabarito
      </h3>
      <span style="font-size: 0.8rem; color: var(--color-text-secondary);">
        ID: <code>${candidate.id}</code>
      </span>
    </div>

    <!-- Container do Card Renderizado -->
    <div id="detectiveCardContainer"></div>
  `;

  // Cria e anexa o card oficial
  const cardContainer = resultsArea.querySelector('#detectiveCardContainer');
  if (cardContainer && candidate && candidate.fullData) {
    const cardEl = criarCardTecnico(candidate.id, candidate.fullData);
    cardContainer.appendChild(cardEl);
    if (typeof renderLatexIn === 'function') {
      renderLatexIn(cardEl);
    }
  }
}
