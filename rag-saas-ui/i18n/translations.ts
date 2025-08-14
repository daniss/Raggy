export const fr = {
  nav: {
    dashboard: "Tableau de bord",
    documents: "Documents",
    assistant: "Assistant",
    conversations: "Conversations",
    usage: "Utilisation",
    team: "Équipe",
    settings: "Paramètres",
    connectors: "Connecteurs",
    environment: "Environnement",
    support: "Support",
  },
  onboarding: {
    title: "Bienvenue dans votre assistant IA privé",
    step_upload: "Importer un document",
    step_ask: "Poser une question",
    step_citation: "Voir une citation",
    step_purge: "Générer une preuve de purge",
  },
  empty: {
    documents_title: "Aucun document encore",
    documents_sub: "Importez des fichiers pour poser vos premières questions.",
  },
  actions: {
    import: "Importer des documents",
    newConversation: "Nouvelle conversation",
  },
  upgrade: {
    banner_docs: "Vous approchez de votre limite de documents",
    banner_tokens: "Vous approchez de votre limite de tokens",
    modal_title_conversations: "Historique des conversations (Pro)",
    modal_title_usage: "Tableaux d'utilisation (Pro)",
  },
  summary: {
    docs_ready: "Documents prêts",
    processing: "En cours",
    storage: "Stockage",
  },
}

export const en = {
  nav: {
    dashboard: "Dashboard",
    documents: "Documents",
    assistant: "Assistant",
    conversations: "Conversations",
    usage: "Usage",
    team: "Team",
    settings: "Settings",
    connectors: "Connectors",
    environment: "Environment",
    support: "Support",
  },
  // ... other translations
}

export type LocaleDict = typeof fr

export function useI18n() {
  // For now, fixed to French
  return fr
}
