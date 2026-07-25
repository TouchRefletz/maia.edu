/**
 * Speech-to-Text Service
 * Wrapper da Web Speech API para reconhecimento de voz
 */

// Verifica suporte à Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let isListening = false;

/**
 * Verifica se o navegador suporta Speech Recognition
 */
export function isSupported() {
  return !!SpeechRecognition;
}

/**
 * Inicia o reconhecimento de voz
 * @param {Object} callbacks - Callbacks para eventos
 * @param {Function} callbacks.onResult - Chamado com texto transcrito (interim ou final)
 * @param {Function} callbacks.onEnd - Chamado quando a gravação termina
 * @param {Function} callbacks.onError - Chamado em caso de erro
 * @returns {boolean} - True se iniciou com sucesso
 */
export function startListening(callbacks = {}) {
  if (!isSupported()) {
    callbacks.onError?.('Seu navegador não suporta reconhecimento de voz. Use o Chrome ou Edge.');
    return false;
  }

  if (isListening) {
    stopListening();
    return false;
  }

  recognition = new SpeechRecognition();

  // Configurações
  // Sem definir lang para auto-detectar idioma (português, inglês, etc.)
  recognition.continuous = true; // Continua ouvindo até parar manualmente
  recognition.interimResults = true; // Mostra resultados parciais (ao vivo)
  recognition.maxAlternatives = 1;

  // Evento: resultado de transcrição
  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    // Envia resultado final ou parcial
    if (finalTranscript) {
      callbacks.onResult?.(finalTranscript, true);
    } else if (interimTranscript) {
      callbacks.onResult?.(interimTranscript, false);
    }
  };

  // Evento: fim da gravação
  recognition.onend = () => {
    isListening = false;
    callbacks.onEnd?.();
  };

  // Evento: erro
  recognition.onerror = (event) => {
    isListening = false;

    let errorMessage = 'Erro no reconhecimento de voz.';

    switch (event.error) {
      case 'not-allowed':
        errorMessage =
          'Permissão de microfone negada. Clique no ícone de cadeado na barra de endereço para permitir.';
        break;
      case 'no-speech':
        errorMessage = 'Nenhuma fala detectada. Tente novamente.';
        break;
      case 'network':
        errorMessage = 'Erro de rede. Verifique sua conexão.';
        break;
      case 'aborted':
        errorMessage = ''; // Silencioso - foi cancelado intencionalmente
        break;
    }

    if (errorMessage) {
      callbacks.onError?.(errorMessage);
    }
  };

  // Inicia gravação
  try {
    recognition.start();
    isListening = true;
    return true;
  } catch (e) {
    callbacks.onError?.('Erro ao iniciar o microfone: ' + e.message);
    return false;
  }
}

/**
 * Para o reconhecimento de voz
 */
export function stopListening() {
  if (recognition && isListening) {
    recognition.stop();
    isListening = false;
  }
}

/**
 * Retorna se está ouvindo atualmente
 */
export function getIsListening() {
  return isListening;
}
