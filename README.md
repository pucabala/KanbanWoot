# 🧩 KanbanWoot

Interface web estilo Kanban integrada ao **Chatwoot**, utilizando campos personalizados do tipo lista para visualizar e mover contatos entre etapas diretamente na interface.

![screenshot](./screenshot.png)

## 🚀 Funcionalidades

- 🗂️ Colunas definidas pelos valores de qualquer atributo de contato do tipo lista, mais a coluna "Não definido" para quem não tem valor
- 🏷️ Dropdown para trocar de atributo; o último escolhido fica salvo em cookie
- 📥 Cada coluna busca só os seus contatos no Chatwoot (filtro no servidor), 15 por vez, carregando mais ao rolar; o total aparece no topo da coluna
- 🧲 Arrastar e soltar para mudar o contato de etapa (`@hello-pangea/dnd`)
- ⚡ Movimentação otimista: o card muda de coluna na hora e volta, com aviso, se a API recusar
- ✅ Filtro opcional pelo atributo `kanbanwoot` para escolher quais contatos entram no board
- 📝 Nomes amigáveis (display name) dos atributos e dos atributos `kbw_*` mostrados nos cards
- 🔒 No Docker, o token do Chatwoot fica só no servidor (proxy no nginx)
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

### Cards

Mostram nome, foto, telefone, e-mail e os atributos do contato cuja chave começa com `kbw_`, com o nome amigável de cada um.

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

> **Só necessário no desenvolvimento local** (`npm start`). Com o Docker, o navegador fala apenas com o próprio KanbanWoot e o nginx repassa as chamadas ao Chatwoot, então não há CORS.

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

Este projeto está pronto para ser publicado via Docker.

O `Dockerfile` incluso faz o build do React e serve os arquivos com nginx. O nginx também funciona como **proxy da API do Chatwoot**: o navegador chama `/chatwoot-api/...` e o nginx repassa para o Chatwoot adicionando o token. Assim o token **nunca chega ao navegador**.

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
| `CHATWOOT_URL` | sim | URL do Chatwoot (sem `/api/...`) |
| `CHATWOOT_ACCOUNT_ID` | sim | ID numérico da conta |
| `CHATWOOT_TOKEN` | sim | Token de acesso de um usuário do Chatwoot |
| `REACT_APP_DEBUG` | não | `true` para logs de debug no console do navegador |

Os nomes antigos (`REACT_APP_CHATWOOT_URL`, `REACT_APP_CHATWOOT_ACCOUNT_ID`, `REACT_APP_CHATWOOT_TOKEN`) continuam aceitos.

O proxy libera apenas o que o KanbanWoot usa: filtrar contatos por coluna, listar definições de atributos, atualizar um contato e remover atributos de um contato. Qualquer outra rota ou método em `/chatwoot-api/` responde `403`.

> ⚠️ **O KanbanWoot não tem login próprio.** Quem acessar a URL dele pode ver e alterar contatos usando o token configurado. Publique-o só em uma rede ou domínio restrito, ou coloque autenticação na frente (ex.: no proxy reverso do Easypanel). Prefira o token de um usuário com permissões mínimas.

Acesse a aplicação na porta 3000 após o deploy.

---

## 🖇️ Como incorporar o KanbanWoot no Chatwoot (Painel de Aplicativos)

Você pode exibir o KanbanWoot diretamente no painel lateral do Chatwoot para que os agentes tenham acesso rápido ao funil de contatos.

**Passo a passo:**

1. No Chatwoot, acesse:
   - **Configurações** > **Integrações** > **Painel de Aplicativos**
2. Clique em **Adicionar um novo aplicativo**.
3. Preencha os campos:
   - **Nome:** KanbanWoot
   - **Endpoint:** `https://meu_kanbanwoot.com/?kbw=kbw_funil`
     - Substitua pelo domínio real do seu KanbanWoot e pela chave do atributo de lista desejado (ex.: `kbw_funil`).
     - Use o `?kbw=` no endpoint: dentro do iframe, alguns navegadores (ex.: Safari) bloqueiam o cookie que guarda o último atributo escolhido.
4. Salve. O KanbanWoot aparecerá como um painel lateral dentro do Chatwoot, fornecendo contexto visual e permitindo movimentação dos contatos sem sair do atendimento.

> O Painel de Aplicativos permite incorporar aplicações externas para fornecer informações adicionais ao agente, como histórico, pedidos ou status personalizado do cliente.

---

## 🔧 Melhorias futuras

- Filtragem por tags, agentes ou inbox
- Integração com histórico de conversas
- Login com autenticação de operadores Chatwoot
