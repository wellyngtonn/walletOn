# WalletON

Aplicação web responsiva para controle de receitas, despesas e investimentos. A versão 0.1 usa Next.js App Router, React, TypeScript, Tailwind CSS, Firebase e Recharts, com suporte a instalação como PWA.

## Recursos

- Login com Google ou e-mail e senha, cadastro, recuperação de senha e logout
- Dashboard com saldo, totais, percentuais e gráficos
- CRUD de lançamentos com atualização em tempo real
- Filtro por mês e ano
- Tema claro/escuro e quatro cores de destaque
- Regras do Firestore e Storage isoladas por usuário
- Interface responsiva para computador e celular

## Como executar no VS Code

1. Extraia o ZIP e abra a pasta `wallet-on` no Visual Studio Code.
2. Instale o Node.js 20 ou superior.
3. No terminal, execute `npm install`.
4. Copie `.env.example` para `.env.local` e preencha as variáveis do seu projeto Firebase.
5. Execute `npm run dev` e abra `http://127.0.0.1:3001` ou use a configuraÃ§Ã£o "WalletON: abrir no navegador" do VS Code.

## Configuração do Firebase

No [Console do Firebase](https://console.firebase.google.com/):

1. Em **Authentication > Sign-in method**, habilite **E-mail/senha** e **Google**. Adicione o domínio de produção em **Authorized domains**.
2. Crie o **Cloud Firestore**.
3. Ative o **Storage**.
4. Configure a autenticação do Firebase CLI com `firebase login`.
5. Execute `npm run firebase:deploy` para publicar todos os recursos declarados: Hosting, regras e índices do Firestore e regras do Storage.
5. Preencha `.env.local` com as chaves do aplicativo Web encontradas em **Configurações do projeto > Seus aplicativos**.

As chaves públicas do Firebase identificam o projeto, mas a segurança dos dados depende das regras incluídas neste repositório. Nunca use chaves administrativas no navegador.

## Estrutura

O código está em `src/app`, `src/components`, `src/features`, `src/hooks`, `src/lib/firebase`, `src/services`, `src/types` e `src/utils`. As regras ficam em `firestore.rules` e `storage.rules`.

## Validação e produção

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

Para publicar o ambiente completo no Firebase:

```bash
npm run firebase:deploy
```

Esse comando publica o Hosting, as regras e os índices do Firestore e as regras do Storage. Ele usa OAuth e ignora o `FIREBASE_TOKEN` legado. Para publicar apenas os índices, use `npm run firebase:deploy:indexes`.

Para uma PWA totalmente offline, evolua o service worker conforme as estratégias de cache e atualização exigidas pelo ambiente de produção. A versão atual instala o app e oferece fallback para os recursos básicos já visitados.
