/**
 * Custom VitePress Theme
 * Extends the default theme to inject:
 * - AI disclaimer banner on all documentation pages
 * - Error reporting system via GitHub Issues
 */
import DefaultTheme from "vitepress/theme";
import DocReportBanner from "./DocReportBanner.vue";
import "./custom.css";
import { h } from "vue";

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "doc-before": () => h(DocReportBanner),
    });
  },
  enhanceApp({ app }) {
    // register your custom global components
  },
};
