# 🧩 KanbanWoot

Interface web estilo Kanban integrada ao **Chatwoot**, utilizando campos personalizados do tipo lista para visualizar e mover contatos entre etapas diretamente na interface.

![screenshot](./screenshot.png)

## 🚀 Funcionalidades

- 🗂️ Colunas definidas pelos valores de qualquer atributo de contato do tipo lista, mais a coluna "Não definido" para quem não tem valor
- 🏷️ Dropdown para trocar de atributo; o último escolhido fica salvo em cookie
- 📥 Cada coluna busca só os seus contatos no Chatwoot (filtro no servidor), 15 por vez, carregando mais ao rolar; o total aparece no topo da coluna
- 🧲 Arrastar e soltar para mudar o contato de etapa (`@hello-pangea/dnd`), ou pelo menu "Mover para…" do card (teclado e celular)
- 🔎 Busca por nome, telefone ou e-mail e filtro por etiqueta
- ⏱️ Tempo na etapa em cada card, com destaque para os parados há mais de N dias
- ↗️ Link para abrir o contato no Chatwoot
- 🏁 Etapas de ganho e perda com motivo (obrigatório na perda), exibido no card
- 🎯 Dentro do Painel de Aplicativos, destaca o card do contato da conversa aberta
- ⚡ Movimentação otimista: o card muda de coluna na hora e volta, com aviso, se a API recusar
- ✅ Filtro opcional pelo atributo `kanbanwoot` para escolher quais contatos entram no board
- 📝 Nomes amigáveis (display name) dos atributos e dos atributos `kbw_*` mostrados nos cards
- 🔐 Login herdado do Chatwoot: publicado no mesmo domínio, usa a sessão do agente já logado (sem 2º login)
- 🔒 Alternativa com token de serviço que fica só no servidor (proxy no nginx)
- 🖇️ Pode ser incorporado ao Chatwoot pelo Painel de Aplicativos

---

## ⚙️ Como funciona

### Atributo do board

O board usa um atributo de contato do tipo **lista**; cada valor da lista vira uma coluna. O atributo é escolhido nesta ordem:

1. Parâmetro `?kbw=<chave_do_atributo>` na URL
2. Cookie `kbw` com o último atributo escolhido no dropdown (ou vindo da URL)
3. Primeiro atributo do tipo lista cuja chave começa com `kbw_`
4. Primeiro atributo do tipo lista

### Colunas

- Cada coluna é buscada separadamente com `POST /contacts/filter` do Chatwoot: `equal_to <valor>` nas etapas e `is_not_present` em "Não definido".
- Mover um card para uma etapa grava o valor no contato; mover para "Não definido" apaga o atributo do contato (`destroy_custom_attributes`).
- Contatos com um valor que **não está na lista** do atributo (ex.: um valor removido da definição) ou com valor vazio não aparecem em nenhuma coluna.

### Filtro `kanbanwoot` (opcional)

Se a conta tiver um atributo de contato com a chave `kanbanwoot` (sugestão: tipo caixa de seleção), **só os contatos com `kanbanwoot` marcado** aparecem no board. Sem esse atributo, todos os contatos entram.

### Busca e filtros

- **Busca**: um só campo. Com `@`, busca no e-mail; só com dígitos (e `+ ( ) - .`), no telefone; senão, no nome. O filtro de contatos do Chatwoot não permite combinar campos com "ou", por isso a busca escolhe um.
- **Etiqueta**: mostra só os contatos com a etiqueta escolhida (etiquetas do contato, não da conversa).
- Agente e caixa de entrada são da conversa, não do contato, e por isso não aparecem como filtro.

### Tempo na etapa

Ao mover um card, o KanbanWoot grava junto a data de entrada na etapa no atributo `<chave_do_atributo>_desde` do contato (ex.: `kbw_funil_desde`). O card mostra há quantos dias está na etapa: em amarelo a partir da metade do limite e em vermelho, com borda, a partir do limite (`KANBANWOOT_STALE_DAYS`, padrão 7 dias). Contatos movidos antes desta versão ficam sem a contagem até a próxima movimentação. Ao mover para "Não definido", os dois atributos são apagados.

### Ganho e perda

Etapas com estes nomes (sem diferenciar maiúsculas) são tratadas como finais:

- **Ganho**: `Ganho`, `Ganhou`, `Vendido`, `Fechado`, `Fechado ganho`, `Won`
- **Perda**: `Perdido`, `Perdeu`, `Fechado perdido`, `Cancelado`, `Lost`

Para usar outros nomes, defina `KANBANWOOT_WON_STAGES` e `KANBANWOOT_LOST_STAGES` (listas separadas por vírgula).

Ao mover um card para uma etapa final, abre um diálogo: na perda o motivo é **obrigatório** (com sugestões de `KANBANWOOT_LOST_REASONS`, mais "Outro…"); no ganho há uma observação opcional. Cancelar não move o card. O motivo fica no atributo `<chave_do_atributo>_motivo` do contato (ex.: `kbw_funil_motivo`) e aparece no card. Ao sair de uma etapa final, o motivo é limpo. Cards em etapas finais não são marcados como parados.

### Contato da conversa aberta

Dentro do Painel de Aplicativos, o KanbanWoot pergunta ao Chatwoot qual contato está na conversa aberta (a cada 2 segundos, porque o Chatwoot não avisa quando o agente troca de conversa). Uma faixa no topo mostra o nome e a etapa do contato, e o card dele ganha destaque e é rolado até ficar visível. Se o card não estiver carregado ou estiver fora dos filtros, a faixa avisa.

As mensagens só são aceitas da página que contém o KanbanWoot e da origem do Chatwoot (a do próprio app no modo `session`; a de `CHATWOOT_PUBLIC_URL` no modo `proxy`). Esse contexto não é assinado pelo Chatwoot e serve só para o destaque, nunca para autenticação.

### Cards

Mostram nome, foto, telefone, e-mail, tempo na etapa, ganho/perda com motivo, link para o contato no Chatwoot e os atributos do contato cuja chave começa com `kbw_`, com o nome amigável de cada um. O menu "Mover para…" leva o card para o topo da coluna escolhida.

---

## 🛠 Tecnologias

- React (com Hooks)
- Tailwind CSS
- Chatwoot API
- @hello-pangea/dnd
- nginx (servidor e proxy no Docker)

---

## 📦 Instalação

```bash
git clone https://github.com/pucabala/KanbanWoot.git
cd KanbanWoot
npm install
```

### 🌐 Variáveis de Ambiente

Copie o arquivo de exemplo e preencha com as credenciais da API do Chatwoot:

```bash
cp .env.example .env
```

O `.env` não é versionado (está no `.gitignore`). Variáveis esperadas:

```env
REACT_APP_CHATWOOT_TOKEN=seu_token_aqui
REACT_APP_CHATWOOT_ACCOUNT_ID=1
REACT_APP_CHATWOOT_URL=https://app.chatwoot.com
REACT_APP_DEBUG=false
```

> **Onde encontrar o token?** No Chatwoot, em Configurações de Perfil → Token de Acesso.
>
> `REACT_APP_DEBUG=true` liga os logs `[DEBUG]` no console do navegador.

> O `.env` é só para desenvolvimento local: nesse modo o token vai para o navegador. No Docker, use as variáveis do container descritas em [Deploy com Docker](#-deploy-com-docker); lá o token fica só no servidor.

### ▶️ Rodar localmente

```bash
npm start
```

---

## 🛡️ Configuração do Chatwoot para uso externo (CORS/Easypanel)

> **Só necessário no desenvolvimento local** (`npm start`). Com o Docker, nos dois modos o navegador só fala com o próprio domínio (o do Chatwoot no modo `session`, o do KanbanWoot no modo `proxy`), então não há CORS.

Para que o KanbanWoot consiga acessar a API do Chatwoot hospedado em outro domínio, é necessário liberar o CORS no backend do Chatwoot.

**Passo a passo:**

1. **Monte o arquivo de configuração do CORS no container do Chatwoot:**
   - Crie/edite o arquivo `/app/config/initializers/cors.rb` no servidor Chatwoot com o seguinte conteúdo:

```ruby
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins 'https://meu_kanbanwoot.com'

    resource '*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      credentials: true
  end
end
```

> **Dica:** Se estiver usando Docker, utilize a opção de montagem para garantir que o arquivo persista entre reinícios do serviço:
>
> - Caminho de montagem: `/app/config/initializers/cors.rb`
> - Conteúdo igual ao acima.
>
> **Dica:** No Easypanel, use a opção de "Montagem de Arquivo" para garantir que o arquivo persista mesmo após reiniciar o serviço.

2. **Reinicie o serviço do Chatwoot** para aplicar a configuração.

3. **Atenção:**
   - Altere o domínio em `origins` para o domínio real onde o KanbanWoot está hospedado.
   - Não utilize `*` em produção por questões de segurança.

4. **(Opcional) Ajuste o servidor Puma para aceitar conexões externas**

Se necessário, edite a configuração do Puma (`config/puma.rb`) para escutar em todas as interfaces:

```ruby
port ENV.fetch("PORT") { 3000 }, '0.0.0.0'
```

Assim, o Chatwoot aceitará conexões externas, facilitando a integração com o Kanbanwoot.

---

## 🐳 Deploy com Docker

O `Dockerfile` incluso faz o build do React e serve os arquivos com nginx na porta 3000. Há dois modos, escolhidos por `KANBANWOOT_AUTH`:

| | `session` (recomendado) | `proxy` (padrão) |
|---|---|---|
| Login | Usa a sessão do agente já logado no Chatwoot | Nenhum: quem acessa a URL usa o board |
| Onde publicar | **No mesmo domínio do Chatwoot**, num subcaminho (ex.: `https://chat.empresa.com/kanban/`) | Qualquer domínio |
| Permissões | As do próprio agente; o Chatwoot registra quem fez cada mudança | As do usuário dono do token de serviço |
| Token no container | Não | Sim (`CHATWOOT_TOKEN`) |

### Modo `session`: login herdado do Chatwoot

O painel do Chatwoot guarda a sessão do agente no cookie `cw_d_session_info`, que o navegador só entrega a páginas do mesmo domínio. Publicado em um subcaminho do Chatwoot, o KanbanWoot lê essa sessão e chama a API do Chatwoot como o próprio agente, do mesmo jeito que o painel do Chatwoot faz. Não há segunda tela de login nem token guardado no KanbanWoot.

- Agente **não logado** no Chatwoot: o KanbanWoot mostra um aviso com link para a tela de login do Chatwoot.
- Agente logado **sem acesso à conta** `CHATWOOT_ACCOUNT_ID`: o board não carrega.
- Logout no Chatwoot encerra o acesso ao KanbanWoot.

```bash
docker build -t kanbanwoot .
docker run -d -p 3000:3000 \
  -e KANBANWOOT_AUTH=session \
  -e CHATWOOT_ACCOUNT_ID=1 \
  -e KANBANWOOT_BASE_PATH=/kanban \
  kanbanwoot
```

Depois, no proxy reverso que atende o domínio do Chatwoot, encaminhe **`/kanban/`** para o container do KanbanWoot e todo o resto para o Chatwoot. Exemplo com nginx:

```nginx
location /kanban/ {
    proxy_pass http://kanbanwoot:3000;   # sem barra no final: o prefixo /kanban é mantido
}
location = /kanban {
    proxy_pass http://kanbanwoot:3000;   # redireciona para /kanban/
}
```

No Traefik ou no Easypanel, use uma regra de caminho `/kanban` no **mesmo domínio** do Chatwoot apontando para o serviço do KanbanWoot.

- `KANBANWOOT_BASE_PATH` deve ser igual ao caminho público quando o proxy **mantém** o prefixo (como no exemplo). Se o seu proxy **remove** o prefixo, deixe a variável vazia e sempre use a URL com a barra final (`/kanban/`).
- O KanbanWoot passa a rodar com os mesmos privilégios de navegador do painel do Chatwoot (mesmo domínio). Só publique assim uma versão do KanbanWoot em que você confia.
- Subdomínios diferentes (ex.: `kanban.empresa.com` e `chat.empresa.com`) **não** funcionam: o cookie do Chatwoot vale só para o host dele.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `KANBANWOOT_AUTH` | sim | `session` |
| `CHATWOOT_ACCOUNT_ID` | sim | ID numérico da conta |
| `KANBANWOOT_BASE_PATH` | não | Subcaminho público, ex.: `/kanban` (veja acima) |
| `KANBANWOOT_STALE_DAYS` | não | Dias na etapa até o card ser marcado como parado (padrão `7`) |
| `KANBANWOOT_WON_STAGES` | não | Nomes das etapas de ganho, separados por vírgula (veja "Ganho e perda") |
| `KANBANWOOT_LOST_STAGES` | não | Nomes das etapas de perda, separados por vírgula |
| `KANBANWOOT_LOST_REASONS` | não | Motivos de perda sugeridos, separados por vírgula |
| `REACT_APP_DEBUG` | não | `true` para logs de debug no console do navegador |

### Modo `proxy`: token de serviço

Para publicar em outro domínio. O nginx funciona como **proxy da API do Chatwoot**: o navegador chama `/chatwoot-api/...` e o nginx repassa para o Chatwoot adicionando o token. Assim o token **nunca chega ao navegador**.

```bash
docker build -t kanbanwoot .
docker run -d -p 3000:3000 \
  -e CHATWOOT_URL=https://app.chatwoot.com \
  -e CHATWOOT_ACCOUNT_ID=1 \
  -e CHATWOOT_TOKEN=seu_token_aqui \
  kanbanwoot
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `KANBANWOOT_AUTH` | não | `proxy` (padrão) |
| `CHATWOOT_URL` | sim | URL do Chatwoot (sem `/api/...`) |
| `CHATWOOT_ACCOUNT_ID` | sim | ID numérico da conta |
| `CHATWOOT_TOKEN` | sim | Token de acesso de um usuário do Chatwoot |
| `KANBANWOOT_BASE_PATH` | não | Subcaminho público, se houver |
| `CHATWOOT_PUBLIC_URL` | não | URL do Chatwoot vista pelo navegador, para o link "abrir no Chatwoot" (padrão: `CHATWOOT_URL`) |
| `KANBANWOOT_STALE_DAYS` | não | Dias na etapa até o card ser marcado como parado (padrão `7`) |
| `KANBANWOOT_WON_STAGES` | não | Nomes das etapas de ganho, separados por vírgula (veja "Ganho e perda") |
| `KANBANWOOT_LOST_STAGES` | não | Nomes das etapas de perda, separados por vírgula |
| `KANBANWOOT_LOST_REASONS` | não | Motivos de perda sugeridos, separados por vírgula |
| `REACT_APP_DEBUG` | não | `true` para logs de debug no console do navegador |

Os nomes antigos (`REACT_APP_CHATWOOT_URL`, `REACT_APP_CHATWOOT_ACCOUNT_ID`, `REACT_APP_CHATWOOT_TOKEN`) continuam aceitos.

O proxy libera apenas o que o KanbanWoot usa: filtrar contatos por coluna, listar etiquetas, listar definições de atributos, atualizar um contato e remover atributos de um contato. Qualquer outra rota ou método em `/chatwoot-api/` responde `403`.

> ⚠️ **Neste modo o KanbanWoot não tem login.** Quem acessar a URL dele pode ver e alterar contatos usando o token configurado. Publique-o só em uma rede ou domínio restrito, ou coloque autenticação na frente (ex.: oauth2-proxy ou a autenticação do Easypanel). Prefira o token de um usuário com permissões mínimas. Se puder publicar no domínio do Chatwoot, prefira o modo `session`.

---

## 🖇️ Como incorporar o KanbanWoot no Chatwoot (Painel de Aplicativos)

Você pode exibir o KanbanWoot diretamente no painel lateral do Chatwoot para que os agentes tenham acesso rápido ao funil de contatos.

**Passo a passo:**

1. No Chatwoot, acesse:
   - **Configurações** > **Integrações** > **Painel de Aplicativos**
2. Clique em **Adicionar um novo aplicativo**.
3. Preencha os campos:
   - **Nome:** KanbanWoot
   - **Endpoint:** `https://chat.empresa.com/kanban/?kbw=kbw_funil` (modo `session`) ou `https://meu_kanbanwoot.com/?kbw=kbw_funil` (modo `proxy`)
     - Substitua pelo endereço real do seu KanbanWoot e pela chave do atributo de lista desejado (ex.: `kbw_funil`).
     - Use o `?kbw=` no endpoint: dentro do iframe, alguns navegadores (ex.: Safari) bloqueiam o cookie que guarda o último atributo escolhido.
4. Salve. O KanbanWoot aparecerá como um painel lateral dentro do Chatwoot, fornecendo contexto visual e permitindo movimentação dos contatos sem sair do atendimento.

> O Painel de Aplicativos permite incorporar aplicações externas para fornecer informações adicionais ao agente, como histórico, pedidos ou status personalizado do cliente.

---

## 🔧 Melhorias futuras

- Filtragem por tags, agentes ou inbox
- Integração com histórico de conversas
