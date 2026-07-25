/**
 * Manager de Sugestões Dinâmicas
 * Gerencia a rotação periódica dos chips e placeholder
 */

// Estado do manager - inicialização explícita para evitar TDZ (Temporal Dead Zone)
var rotationInterval = null;
var placeholderInterval = null;
var isRunning = false;
var isTyping = false;

// Configurações
const ROTATION_INTERVAL_MS = 10000; // 10 segundos para os chips
const PLACEHOLDER_INTERVAL_MS = 7500; // 7.5 segundos para o placeholder
const FADE_DURATION_MS = 300;
const TYPE_SPEED_MS = 40; // Velocidade de digitação
const ERASE_SPEED_MS = 25; // Velocidade de apagar (mais rápido)

// Armazena o texto alvo do placeholder para evitar race conditions
let targetPlaceholder = '';

/**
 * Inicia a rotação automática das sugestões
 */
export async function startSuggestionRotation() {
  if (isRunning) return;

  isRunning = true;
  console.log('[DynamicSuggestions] Iniciando rotação...');

  // Import dinâmico para evitar erros de módulo
  const { generateSuggestions, generatePlaceholder } = await import(
    '../services/suggestion-generator.js'
  );

  // Primeira atualização imediata
  updateSuggestionsUI(generateSuggestions);

  // Inicializa o placeholder alvo
  const input = document.querySelector('.chat-input-field');
  if (input) {
    targetPlaceholder = input.placeholder;
  }

  // Rotação periódica dos chips
  rotationInterval = setInterval(() => {
    updateSuggestionsUI(generateSuggestions);
  }, ROTATION_INTERVAL_MS);

  // Rotação do placeholder com efeito typewriter
  placeholderInterval = setInterval(() => {
    typewriterPlaceholder(generatePlaceholder);
  }, PLACEHOLDER_INTERVAL_MS);
}

/**
 * Para a rotação (quando sair da tela inicial)
 */
export function stopSuggestionRotation() {
  if (!isRunning) return;

  isRunning = false;

  if (rotationInterval) {
    clearInterval(rotationInterval);
    rotationInterval = null;
  }

  if (placeholderInterval) {
    clearInterval(placeholderInterval);
    placeholderInterval = null;
  }

  console.log('[DynamicSuggestions] Rotação parada.');
}

/**
 * Atualiza os chips de sugestão com animação fade
 */
async function updateSuggestionsUI(generateSuggestions) {
  const chips = document.querySelectorAll('.suggestion-chip');
  if (chips.length === 0) return;

  // Gera novas sugestões
  const newSuggestions = generateSuggestions();

  // Fade out
  chips.forEach((chip) => {
    chip.style.opacity = '0';
    chip.style.transform = 'translateY(5px)';
  });

  // Espera a animação
  await sleep(FADE_DURATION_MS);

  // Atualiza texto
  chips.forEach((chip, index) => {
    if (newSuggestions[index]) {
      chip.textContent = newSuggestions[index];
    }
  });

  // Fade in
  chips.forEach((chip) => {
    chip.style.opacity = '1';
    chip.style.transform = 'translateY(0)';
  });
}

/**
 * Efeito typewriter no placeholder - apaga e escreve letra por letra
 */
async function typewriterPlaceholder(generatePlaceholderFn) {
  const input = document.querySelector('.chat-input-field');
  if (!input) return;

  // Só atualiza se o input estiver vazio e não estiver animando
  if (input.value.trim() !== '' || isTyping) return;

  isTyping = true;

  // Usa o targetPlaceholder como base (evita race condition com hover)
  const currentText = targetPlaceholder || input.placeholder;

  // Gera novo placeholder
  const newText = generatePlaceholderFn();

  // Não anima se for o mesmo texto
  if (currentText === newText) {
    isTyping = false;
    return;
  }

  // Atualiza o alvo ANTES de começar a animação
  targetPlaceholder = newText;

  try {
    // Fase 1: Apagar o texto atual (letra por letra)
    for (let i = currentText.length; i >= 0; i--) {
      if (!isRunning) return; // Retorna imediatamente se parou
      input.placeholder = currentText.substring(0, i) + '│'; // Cursor piscante
      await sleep(ERASE_SPEED_MS);
    }

    // Pequena pausa entre apagar e escrever
    await sleep(200);

    // Fase 2: Escrever o novo texto (letra por letra)
    for (let i = 0; i <= newText.length; i++) {
      if (!isRunning) return; // Retorna imediatamente se parou
      input.placeholder = newText.substring(0, i) + '│';
      await sleep(TYPE_SPEED_MS);
    }

    if (!isRunning) return; // Verificação extra antes de finalizar

    // Remove o cursor no final - usa o targetPlaceholder (mais recente)
    input.placeholder = targetPlaceholder;
  } finally {
    isTyping = false;
  }
}

/**
 * Configura os chips para preencher o textarea ao clicar
 */
export function setupChipClickHandlers() {
  const chips = document.querySelectorAll('.suggestion-chip');
  const textarea = document.querySelector('.chat-input-field');

  if (!textarea) return;

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      textarea.value = chip.textContent;
      textarea.focus();

      // Dispara evento input para ajustar altura
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
}

/**
 * Helper para sleep
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
