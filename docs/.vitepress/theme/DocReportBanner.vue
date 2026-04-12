<template>
  <div class="doc-report-banner">
    <div class="banner-content">
      <span class="banner-icon">🤖</span>
      <p class="banner-text">
        <strong>Aviso:</strong> Esta documentação foi gerada por inteligência artificial com base no código-fonte do repositório.
        Embora tenhamos nos esforçado para garantir a precisão, <strong>imprecisões técnicas podem existir</strong>.
        Sempre consulte o código-fonte para confirmação.
      </p>
      <a
        :href="reportUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="banner-report-btn"
        title="Reportar um erro nesta página"
      >
        📋 Reportar Erro
      </a>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()

const reportUrl = computed(() => {
  const pageTitle = encodeURIComponent(route.path)
  const body = encodeURIComponent(
    `## Página com Erro\n\n` +
    `**URL:** ${route.path}\n\n` +
    `## Descrição do Erro\n\n` +
    `<!-- Descreva o erro encontrado na documentação -->\n\n` +
    `## Correção Sugerida\n\n` +
    `<!-- Se possível, indique a correção correta -->\n\n` +
    `---\n` +
    `*Este report foi gerado automaticamente pelo sistema de documentação.*`
  )
  return `https://github.com/maia-edu/maia.api/issues/new?title=[Docs] Erro em ${pageTitle}&body=${body}&labels=documentation,ai-generated`
})
</script>

<style scoped>
.doc-report-banner {
  margin: 0 0 24px 0;
  padding: 16px 20px;
  border-radius: 8px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid #e2b340;
  border-left: 4px solid #e2b340;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.banner-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.banner-text {
  flex: 1;
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #c9d1d9;
  min-width: 200px;
}

.banner-report-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #e2b340;
  color: #1a1a2e;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.banner-report-btn:hover {
  background: #f0c850;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(226, 179, 64, 0.3);
}

/* Light mode adjustments */
:root:not(.dark) .doc-report-banner {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border-color: #d97706;
}

:root:not(.dark) .banner-text {
  color: #44403c;
}
</style>
