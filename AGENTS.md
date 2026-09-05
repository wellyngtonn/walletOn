# AGENTS.md

## Publicação (deploy)

O app é publicado em dois destinos e **qualquer alteração deve ir para ambos**:

1. **Firebase Hosting** (frontend PWA em `setenta.web.app`) + regras do Firestore/Storage.
2. **Vercel** (`wallet-on.vercel.app`) — Functions `api/*` (barcode, pierre, financial-assistant) e o mesmo frontend.

Comando único, sempre que for publicar:

```
npm run deploy:all
```

Equivale a:

```
npm run firebase:deploy     # build + Hosting setenta.web.app + regras/índices
npx vercel --prod --yes     # frontend + Functions na Vercel
```

Não publique apenas um destino a menos que o usuário peça explicitamente. Ao
publicar a Vercel pelo CLI, a sessão local (`vercel` global) precisa estar
logada; ao publicar o Firebase, a CLI `firebase` usa OAuth.

Variáveis de produção (segredos, só na Vercel): `FIREBASE_WEB_API_KEY`,
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`,
`OPENAI_API_KEY`, `OPENAI_MODEL`, `ALLOWED_ORIGIN`, `COSMOS_API_TOKEN`,
`COSMOS_USER_AGENT`. Nunca commitar segredos nem usar prefixo `NEXT_PUBLIC_`
nas credenciais de servidor.
