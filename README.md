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

## Importação bancária com Vercel

A importação usa as Functions `api/pluggy.ts` (Open Finance, recomendado),
`api/pluggy-webhook.ts` (notificações do Pluggy) e `api/pierre.ts` (fallback
legado). O Firebase continua responsável apenas por autenticação e Firestore,
sem Cloud Functions nem plano Blaze.

### Pluggy (Open Finance)

1. No [Dashboard do Pluggy](https://dashboard.pluggy.ai), crie uma aplicação e
   copie `CLIENT_ID` e `CLIENT_SECRET`. Garanta que os produtos `ACCOUNTS` e
   `TRANSACTIONS` estejam habilitados na aplicação.
2. Cadastre os domínios do app no painel (por exemplo `setenta.web.app`,
   `wallet-on.vercel.app` e `localhost`).
3. Configure na Vercel:

   - `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` (somente servidor);
   - `PLUGGY_WEBHOOK_SECRET`: segredo aleatório;
   - `PLUGGY_WEBHOOK_URL`:
     `https://seu-projeto.vercel.app/api/pluggy-webhook?secret=SEGREDO`;
   - `NEXT_PUBLIC_PLUGGY_API_URL`:
     `https://seu-projeto.vercel.app/api/pluggy`. Quando vazio, o app usa
     `/api/pluggy` na Vercel e, no Firebase Hosting, recorre a
     `https://wallet-on.vercel.app/api/pluggy`.
   - `NEXT_PUBLIC_PLUGGY_SANDBOX`: `true` para exibir também os conectores de
     teste (Pluggy Bank/Sandbox). Use enquanto a aplicação não tiver acesso à
     produção e remova depois da aprovação.

4. Em **Configurações > Open Finance (Pluggy)**, clique em **Conectar conta**.
   O widget do Pluggy abre, o usuário autoriza o consentimento e o app guarda o
   `itemId` apenas no servidor (`users/{uid}/private/pluggy`).

O saldo e as contas ficam em `users/{uid}` (`pluggyAccounts`, `pluggyAccountId`,
`pluggyBalance`). As transações são gravadas em `users/{uid}/transactions` com
`externalId` e `provider: "pluggy"`. O webhook apenas sinaliza a sincronização;
os dados sempre são lidos pela API com a API Key do servidor.

A categorização é híbrida: usa a categoria do Pluggy quando disponível, depois
regras locais por descrição/estabelecimento e, por último, o tipo do lançamento.
Em **Configurações > Dados** o botão **Recategorizar Lançamentos** reprocessa os
que ficaram em "Outros", e a categoria também pode ser corrigida manualmente ao
editar qualquer lançamento.

### Pierre (fallback)

A sincronização do Pierre continua disponível em `api/pierre.ts` e aparece em
**Configurações** quando o Pluggy não está conectado. Configure:

- `FIREBASE_PROJECT_ID`: `wallet-on-c0b05`;
- `FIREBASE_CLIENT_EMAIL`: e-mail de uma conta de serviço do Firebase;
- `FIREBASE_PRIVATE_KEY`: chave privada dessa conta, preservando as quebras de linha como `\\n`;
- `NEXT_PUBLIC_PIERRE_API_URL`: URL pública da Function, por exemplo `https://seu-projeto.vercel.app/api/pierre`.

A conta de serviço é usada apenas no servidor para validar o token do usuário,
acessar a chave Pierre na coleção privada e gravar transações. Nunca use essas
três primeiras variáveis com o prefixo `NEXT_PUBLIC_`.

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

Para publicar o ambiente completo:

```bash
npm run deploy:all
```

Esse comando publica tudo, em todos os destinos: o frontend e as regras no
Firebase (Hosting `setenta.web.app`, Firestore e Storage) e depois o frontend e
as Functions na Vercel (`wallet-on.vercel.app`). Publique sempre nos dois, pois
as Functions ficam na Vercel e o app também roda no Firebase Hosting.

Para publicar apenas um destino:

```bash
npm run firebase:deploy          # Firebase Hosting, regras e índices
npx vercel --prod --yes          # Vercel (frontend e Functions)
```

O `firebase:deploy` usa OAuth e ignora o `FIREBASE_TOKEN` legado. Para publicar
apenas os índices, use `npm run firebase:deploy:indexes`.

Para uma PWA totalmente offline, evolua o service worker conforme as estratégias de cache e atualização exigidas pelo ambiente de produção. A versão atual instala o app e oferece fallback para os recursos básicos já visitados.
# Consulta de produtos por código de barras

A busca consulta o catálogo pessoal salvo no Firebase e depois a Function
publicada em `api/barcode.ts`, que tenta Open Food Facts (gratuito e sem chave),
Bluesoft Cosmos (somente se configurado) e UPCitemdb (gratuito e sem chave) por
último, para não gastar a cota diária. Se a Function estiver indisponível, o app
ainda consulta o Open Food Facts direto do navegador.
Os últimos 300 produtos encontrados são salvos no campo `barcodeCatalog` do
documento do usuário, com acesso restrito ao próprio dono pelas regras existentes.
Consultas repetidas usam esse catálogo, inclusive após recarregar a página.
Falhas ao salvar o catálogo não impedem adicionar o produto à lista.
O nome combina descrição, marca e peso/volume disponível, sem estimar medidas ausentes.

Para ativar a busca:

1. Opcional: crie uma conta em https://api.cosmos.bluesoft.com.br e obtenha o token e o
   User-Agent na página https://api.cosmos.bluesoft.com.br/api.
2. Configure `FIREBASE_WEB_API_KEY` do projeto Firebase do app no servidor Vercel.
   Para habilitar também Cosmos, configure `COSMOS_API_TOKEN` e `COSMOS_USER_AGENT`.
   Nunca use o prefixo `NEXT_PUBLIC_` nas credenciais do Cosmos.
3. Publique a Function `api/barcode.ts` na Vercel. Se o frontend estiver no
   Firebase Hosting, configure `NEXT_PUBLIC_BARCODE_API_URL` com a URL completa
   `https://seu-projeto.vercel.app/api/barcode` antes de compilar/publicar o frontend.
   Inclua os domínios do frontend em `ALLOWED_ORIGIN`, separados por vírgula.
4. Teste autenticado com códigos reais. Sem as credenciais Cosmos, UPCitemdb e
   Open Food Facts continuam disponíveis. No `next dev`, use a URL da
   Function publicada ou rode o backend com Vercel Dev, pois o projeto exporta HTML estático.

UPCitemdb oferece 100 requisições/dia no plano gratuito, com limite de 6 consultas
por minuto: https://www.upcitemdb.com/wp/docs/main/development/plan/.
Esses limites não são uma cota independente para cada usuário do app.
Erros, limites e produtos ausentes fazem a busca tentar a próxima fonte.
Na consulta aos planos em 05/09/2026, o Cosmos Basic oferece 25 consultas/dia:
https://api.cosmos.bluesoft.com.br/api-pricings. O cache em memória reduz repetições
por instância, mas não garante o limite global entre reinicializações/instâncias.
O provedor aplica a cota e, em caso de limite, o app tenta a alternativa.
Não foi contratada assinatura. A cobertura real deve ser verificada com os
produtos usados pelo usuário após configurar as credenciais.
