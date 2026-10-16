# Automação ao mudar de etapa (n8n)

Quando um card muda de etapa no KanbanWoot, o atributo do contato muda no Chatwoot, e o Chatwoot avisa por webhook (`contact_updated`). Com o [n8n](https://n8n.io) dá para reagir a isso sem programar no KanbanWoot. Por exemplo, ao entrar em **Proposta**:

- enviar uma mensagem na conversa mais recente do contato;
- criar uma nota privada no contato;
- adicionar etiquetas ao contato (as atuais são mantidas).

O fluxo pronto está em [`n8n/kanbanwoot-mudanca-de-etapa.json`](n8n/kanbanwoot-mudanca-de-etapa.json).

```
Webhook do Chatwoot → Detectar mudança de etapa → Conversas do contato → Escolher conversa ─┬→ Tem mensagem?  → Enviar mensagem
                                                                                           ├→ Tem nota?      → Criar nota
                                                                                           └→ Tem etiquetas? → Etiquetas atuais → Juntar etiquetas → Gravar etiquetas
```

## Passo a passo

1. **Libere o módulo `crypto` no n8n**, usado para conferir a assinatura do webhook. Defina a variável de ambiente do n8n:
   ```
   NODE_FUNCTION_ALLOW_BUILTIN=crypto
   ```
   e reinicie o n8n.

2. **Importe o fluxo**: no n8n, *Workflows → Import from File* → `kanbanwoot-mudanca-de-etapa.json`.

3. **Crie a credencial da API do Chatwoot**: *Credentials → New → Header Auth*, com
   - **Name**: `api_access_token`
   - **Value**: o token de acesso de um usuário do Chatwoot (Configurações de Perfil → Token de Acesso)

   Dê o nome `Chatwoot API` e selecione-a nos nós HTTP do fluxo (Conversas do contato, Enviar mensagem, Criar nota, Etiquetas atuais, Gravar etiquetas). As mensagens sairão em nome desse usuário.

4. **Configure o nó "Detectar mudança de etapa"** (bloco `CONFIG` no início do código):
   - `chatwootUrl`: URL do Chatwoot como o n8n a acessa.
   - `attributeKey`: o atributo de lista do funil (o mesmo `?kbw=` do KanbanWoot).
   - `actions`: o que fazer em cada etapa de destino. `{{nome}}` e `{{etapa}}` são trocados pelo nome do contato e pela etapa. Etapas sem entrada são ignoradas.

5. **Ative o fluxo** e copie a *Production URL* do nó "Webhook do Chatwoot".

6. **Crie o webhook no Chatwoot**: *Configurações → Integrações → Webhooks → Adicionar*:
   - **URL**: a Production URL do n8n
   - **Eventos**: marque só **Contato atualizado** (`contact_updated`)

   Se a sua versão do Chatwoot mostrar um **segredo** para o webhook, copie-o para `webhookSecret` no `CONFIG`. O fluxo então confere o cabeçalho `X-Chatwoot-Signature` (HMAC-SHA256 de `<timestamp>.<corpo>`) e recusa chamadas sem assinatura válida ou com mais de 5 minutos. Sem segredo, qualquer um que descubra a URL do webhook pode disparar as ações; use um segredo sempre que possível.

7. **Teste**: mova um card para uma etapa configurada e veja a execução em *Executions* no n8n.

## Detalhes e limites

- **Só mudanças de etapa disparam ações.** O fluxo compara o valor anterior e o atual do atributo no `changed_attributes` do webhook. Mover para "Não definido" (atributo apagado) não dispara nada.
- **Mudanças feitas fora do KanbanWoot também disparam** (pelo painel do Chatwoot, pela API ou por outra automação), porque o gatilho é o atributo do contato.
- **Qual conversa recebe a mensagem**: a aberta com atividade mais recente; se não houver aberta, a mais recente. Contato sem conversa: a mensagem é pulada e as outras ações seguem.
- **WhatsApp**: fora da janela de 24 horas desde a última mensagem do cliente, o WhatsApp só aceita mensagens de modelo (template) aprovadas. Uma mensagem comum enviada fora da janela falha no Chatwoot. Para esses casos, use um modelo aprovado ou deixe só nota e etiquetas.
- **Etiquetas**: a API do Chatwoot substitui a lista de etiquetas do contato, por isso o fluxo busca as atuais e grava a união.
- **Sem laço**: notas e etiquetas não alteram atributos do contato, então não geram um novo `contact_updated` de mudança de etapa.
