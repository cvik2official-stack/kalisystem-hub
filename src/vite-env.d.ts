interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_TELEGRAM_BOT_TOKEN: string
  readonly VITE_KALI_UNIFY_CHAT_ID: string
  readonly VITE_KALI_ZAP_CHAT_ID: string
  readonly VITE_TELEGRAM_BOT_USERNAME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
