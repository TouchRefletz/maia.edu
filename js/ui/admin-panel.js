import { ref, remove, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { db, auth } from "../main.js";
import { clearAllPineconeVectors } from "../api/worker.js";
import { customAlert } from "./GlobalAlertsLogic.tsx";
import { gerarTelaInicial } from "../app/telas.js";

/**
 * Verifica se o usuário logado possui a role admin no banco de dados.
 */
export async function verificarSeAdmin(uid) {
  if (!uid) return false;
  try {
    const adminRef = ref(db, `admins/${uid}`);
    const snapshot = await get(adminRef);
    return snapshot.exists() && snapshot.val() === true;
  } catch (error) {
    console.error("Erro ao verificar role admin:", error);
    return false;
  }
}

/**
 * Inicializa a tela do Painel do Administrador.
 */
export async function iniciarModoAdmin() {
  const user = auth.currentUser;
  if (!user) {
    customAlert("⚠️ Faça login primeiro.");
    gerarTelaInicial();
    return;
  }

  // Feedback de carregamento
  document.body.innerHTML = `
    <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background:var(--color-bg); color:var(--color-text);">
      <div class="admin-spinner" style="width: 40px; height: 40px; border-width: 4px;"></div>
      <p style="margin-top:15px; font-weight:500;">Verificando permissões de administrador...</p>
    </div>
  `;

  const isAdmin = await verificarSeAdmin(user.uid);
  if (!isAdmin) {
    customAlert("⛔ Acesso negado: Você não possui privilégios de administrador.");
    gerarTelaInicial();
    return;
  }

  // Renderiza layout do Painel do Administrador
  document.body.innerHTML = `
    <div class="admin-layout-wrapper">
      <div class="admin-panel">
        <div class="admin-header">
          <h1>🛠️ Painel do Administrador</h1>
          <button class="btn btn--sm btn--outline js-voltar-inicio">← Voltar</button>
        </div>

        <div class="admin-section">
          <h2>🔍 Auditoria Pós-Envio & Correção de Questões</h2>
          <p class="admin-desc">Selecione uma questão do Firebase, anexe a foto da prova original, audite incoerências com IA e grave as correções permanentemente no banco.</p>
          <div class="admin-actions">
            <button id="btnAbrirVerificacao" class="btn btn--primary" style="background:#38bdf8; color:#0f172a; border:none; font-weight:bold;">🔍 Abrir Verificar Questões</button>
          </div>
        </div>

        <div class="admin-section">
          <h2>📦 Banco de Questões (Firebase)</h2>
          <p class="admin-desc">Exclua permanentemente os nós de questões do Firebase Realtime Database. As questões não aparecerão mais nas listas do site.</p>
          <div class="admin-actions">
            <button id="btnLimparQuestoes" class="btn btn--secondary btn--outline">Limpar Questões (Firebase)</button>
          </div>
        </div>

        <div class="admin-section">
          <h2>📝 Histórico de Revisões (Firebase)</h2>
          <p class="admin-desc">Exclua permanentemente o progresso e estatísticas de todas as revisões feitas por usuários.</p>
          <div class="admin-actions">
            <button id="btnLimparRevisoes" class="btn btn--secondary btn--outline">Limpar Revisões (Firebase)</button>
          </div>
        </div>

        <div class="admin-section">
          <h2>🌲 Busca Semântica (Pinecone)</h2>
          <p class="admin-desc">Limpa todos os vetores indexados no banco de vetores Pinecone. Isso evita que buscas retornem links fantasmas para questões deletadas.</p>
          <div class="admin-actions">
            <button id="btnLimparPinecone" class="btn btn--secondary btn--outline">Limpar Vetores (Pinecone)</button>
          </div>
        </div>

        <div class="admin-section admin-danger-zone">
          <h2>🚨 Zona de Perigo: Reset Geral Conjunto</h2>
          <p class="admin-desc">Executa todas as limpezas (Questões + Revisões no Firebase + Vetores no Pinecone) de uma única vez em paralelo. Esta operação é irreversível.</p>
          
          <div style="margin-bottom: 15px;">
            <label style="display:block; margin-bottom:8px; font-weight:bold; font-size:0.9rem;">Para confirmar, digite exatamente "DELETAR TUDO":</label>
            <input type="text" id="confirmInput" class="admin-input-confirm" placeholder="Escreva aqui..." autocomplete="off">
          </div>

          <div class="admin-actions">
            <button id="btnResetGeral" class="btn btn--danger" style="background:var(--color-error, #ff4444); color:white; border:none;" disabled>Excluir Tudo Permanentemente</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Configura Listeners
  setupListeners();
}

function setupListeners() {
  // Voltar
  const btnVoltar = document.querySelector(".js-voltar-inicio");
  if (btnVoltar) {
    btnVoltar.addEventListener("click", () => {
      gerarTelaInicial();
    });
  }

  // Abrir Verificar Questões
  const btnAbrirVerificacao = document.getElementById("btnAbrirVerificacao");
  if (btnAbrirVerificacao) {
    btnAbrirVerificacao.addEventListener("click", () => {
      import("./verificar-questoes-screen.tsx").then(({ iniciarModoVerificacaoQuestoes }) => {
        iniciarModoVerificacaoQuestoes();
      });
    });
  }

  // Inputs e Botões
  const confirmInput = document.getElementById("confirmInput");
  const btnResetGeral = document.getElementById("btnResetGeral");
  const btnLimparQuestoes = document.getElementById("btnLimparQuestoes");
  const btnLimparRevisoes = document.getElementById("btnLimparRevisoes");
  const btnLimparPinecone = document.getElementById("btnLimparPinecone");

  if (confirmInput && btnResetGeral) {
    confirmInput.addEventListener("input", (e) => {
      btnResetGeral.disabled = e.target.value !== "DELETAR TUDO";
    });
  }

  // Ações Individuais
  btnLimparQuestoes.addEventListener("click", async () => {
    if (!confirm("Tem certeza que deseja apagar TODAS as questões no Firebase?")) return;
    setLoadingState(btnLimparQuestoes, true, "Excluindo...");
    try {
      await remove(ref(db, "questoes"));
      customAlert("✅ Questões limpas no Firebase com sucesso!");
    } catch (e) {
      console.error(e);
      customAlert("❌ Erro ao limpar questões: " + e.message);
    } finally {
      setLoadingState(btnLimparQuestoes, false, "Limpar Questões (Firebase)");
    }
  });

  btnLimparRevisoes.addEventListener("click", async () => {
    if (!confirm("Tem certeza que deseja apagar TODAS as revisões no Firebase?")) return;
    setLoadingState(btnLimparRevisoes, true, "Excluindo...");
    try {
      await remove(ref(db, "revisoes"));
      customAlert("✅ Revisões limpas no Firebase com sucesso!");
    } catch (e) {
      console.error(e);
      customAlert("❌ Erro ao limpar revisões: " + e.message);
    } finally {
      setLoadingState(btnLimparRevisoes, false, "Limpar Revisões (Firebase)");
    }
  });

  btnLimparPinecone.addEventListener("click", async () => {
    if (!confirm("Tem certeza que deseja apagar TODOS os vetores no Pinecone?")) return;
    setLoadingState(btnLimparPinecone, true, "Limpando Pinecone...");
    try {
      await clearAllPineconeVectors("default");
      customAlert("✅ Vetores limpos no Pinecone com sucesso!");
    } catch (e) {
      console.error(e);
      customAlert("❌ Erro ao limpar Pinecone: " + e.message);
    } finally {
      setLoadingState(btnLimparPinecone, false, "Limpar Vetores (Pinecone)");
    }
  });

  // Reset Geral Conjunto
  btnResetGeral.addEventListener("click", async () => {
    if (confirmInput.value !== "DELETAR TUDO") return;
    if (!confirm("ATENÇÃO MÁXIMA: Você vai apagar permanentemente as Questões, Revisões E Vetores de Busca. Confirmar?")) return;

    setLoadingState(btnResetGeral, true, "Resetando Geral...");
    disableOtherButtons(true);

    try {
      // Executa as chamadas em paralelo
      await Promise.all([
        remove(ref(db, "questoes")),
        remove(ref(db, "revisoes")),
        clearAllPineconeVectors("default")
      ]);

      customAlert("💥 Reset Geral Concluído! Tudo foi excluído.");
      confirmInput.value = "";
      btnResetGeral.disabled = true;
    } catch (e) {
      console.error(e);
      customAlert("❌ Ocorreu um erro no Reset Geral: " + e.message);
    } finally {
      setLoadingState(btnResetGeral, false, "Excluir Tudo Permanentemente");
      disableOtherButtons(false);
    }
  });

  function setLoadingState(button, isLoading, text) {
    if (!button) return;
    button.disabled = isLoading;
    if (isLoading) {
      button.innerHTML = `<span class="admin-spinner"></span> ${text}`;
    } else {
      button.innerHTML = text;
    }
  }

  function disableOtherButtons(disabled) {
    btnLimparQuestoes.disabled = disabled;
    btnLimparRevisoes.disabled = disabled;
    btnLimparPinecone.disabled = disabled;
    confirmInput.disabled = disabled;
  }
}
