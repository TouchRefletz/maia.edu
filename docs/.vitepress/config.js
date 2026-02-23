import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "pt-BR",
  title: "Maia.edu",
  description: "Ecossistema educacional inteligente e adaptativo.",
  base: "/docs/",

  // Customização de Head Tags (Favicon)
  head: [["link", { rel: "icon", href: "/logo.png" }]],

  themeConfig: {
    // Configurações do Logo e Título
    logo: "/logo.png",
    siteTitle: "Maia.edu",

    // Links do Cabeçalho Superior
    nav: [
      { text: "Home", link: "/" },
      { text: "Guia de Início", link: "/guia/introducao" },
    ],

    // Barra Lateral de Navegação
    sidebar: [
      {
        text: "🚀 Documentação",
        collapsed: false,
        items: [{ text: "Introdução", link: "/guia/introducao" }],
      },
    ],

    // Configurações de Busca Nativa (Opcional)
    search: {
      provider: "local",
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: "Pesquisar",
                buttonAriaLabel: "Pesquisar",
              },
              modal: {
                noResultsText: "Nenhum resultado encontrado para",
                resetButtonTitle: "Limpar pesquisa",
                footer: {
                  selectText: "para selecionar",
                  navigateText: "para navegar",
                  closeText: "para fechar",
                },
              },
            },
          },
        },
      },
    },

    // Traduções adicionais do tema padrão
    outline: {
      label: "Nesta página",
    },
    docFooter: {
      prev: "Página anterior",
      next: "Próxima página",
    },
    returnToTopLabel: "Voltar ao topo",
    sidebarMenuLabel: "Menu",
    darkModeSwitchLabel: "Aparência",
    lightModeSwitchTitle: "Mudar para modo claro",
    darkModeSwitchTitle: "Mudar para modo escuro",

    // Footer da Documentação
    footer: {
      message: "Lançado sob a licença AGPL-3.0.",
      copyright: "Copyright © 2026-presente TouchRefletz & Comunidade Maia",
    },

    // Links Sociais
    socialLinks: [
      { icon: "github", link: "https://github.com/TouchRefletz/maia.edu" },
    ],
  },
});
