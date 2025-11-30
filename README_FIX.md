# 🛠️ Guia de Correção e Execução

Este guia ajuda a configurar o ambiente para rodar o KanbanWoot localmente, corrigindo o erro de falta do Node.js e configuração da API.

## 1. Instalar Node.js

O erro `npm: The term 'npm' is not recognized` indica que o Node.js não está instalado.

1. Baixe o instalador (LTS) em: [nodejs.org](https://nodejs.org/)
2. Instale o Node.js (siga as opções padrão).
3. **Reinicie seu terminal** (ou VS Code) após a instalação para que o comando `npm` seja reconhecido.

## 2. Configurar Variáveis de Ambiente

O arquivo `.env` precisa das suas credenciais reais do Chatwoot.

1. Abra o arquivo `.env` na raiz do projeto.
2. Substitua os valores de exemplo pelos seus dados reais:

```env
REACT_APP_CHATWOOT_TOKEN=seu_token_de_acesso_aqui
REACT_APP_CHATWOOT_ACCOUNT_ID=seu_id_da_conta
REACT_APP_CHATWOOT_URL=https://app.chatwoot.com
REACT_APP_DEBUG=true
```

> **Onde encontrar o Token?** No Chatwoot, vá em Configurações de Perfil (canto inferior esquerdo) -> Token de Acesso.

## 3. Instalar Dependências

No terminal, dentro da pasta do projeto (`KanbanWoot`), execute:

```bash
npm install
```

## 4. Rodar o Projeto

Após instalar, inicie o servidor de desenvolvimento:

```bash
npm start
```

O projeto deve abrir automaticamente em `http://localhost:3000`.
