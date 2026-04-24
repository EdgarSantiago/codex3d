# Codex3D

Codex3D é a build personalizada deste repositório, mantida como um clone e derivado independente do OpenClaude.

Ele mantém o fluxo de agente de programação no terminal, mas adapta o projeto para a direção própria deste repositório: prompts, ferramentas, agentes, MCP, slash commands, saída em streaming e suporte a provedores de modelos locais e em nuvem.

Use APIs compatíveis com OpenAI, Gemini, GitHub Models, Codex OAuth, Codex, Ollama, Atomic Chat e outros backends suportados no mesmo fluxo de trabalho pelo terminal.

[![Política de Segurança](https://img.shields.io/badge/security-policy-0f766e)](SECURITY.md)
[![Licença](https://img.shields.io/badge/license-MIT-2563eb)](LICENSE)

[Início Rápido](#início-rápido) | [Guias de Configuração](#guias-de-configuração) | [Provedores](#provedores-suportados) | [Buddy](#como-o-buddy-funciona) | [Build Local](#build-a-partir-do-código-fonte-e-desenvolvimento-local) | [Extensão VS Code](#extensão-vs-code)

## Por que Codex3D

- Use uma única CLI com APIs em nuvem e backends locais de modelos
- Salve perfis de provedores dentro do app com `/provider`
- Execute com serviços compatíveis com OpenAI, Gemini, GitHub Models, Codex OAuth, Codex, Ollama, Atomic Chat e outros provedores suportados
- Mantenha fluxos de agente de programação em um só lugar: bash, leitura/escrita/edição de arquivos, grep, glob, agentes, tarefas, MCP e ferramentas web
- Use a extensão VS Code incluída para integração de lançamento e suporte a temas
- Use o `/buddy`, um companheiro local com progressão, humor, XP, combos, conquistas e reações visuais

## Relação com o projeto de origem

Codex3D é mantido como um clone e derivado independente do OpenClaude.

Codex3D é um projeto comunitário independente e não é afiliado, endossado ou patrocinado pela Anthropic.

Codex3D vem da base de código do OpenClaude, e o OpenClaude teve origem na base de código do Claude Code antes de ser substancialmente modificado para suporte a múltiplos provedores e uso aberto. "Claude" e "Claude Code" são marcas registradas da Anthropic PBC. Veja [LICENSE](LICENSE) para detalhes.

## Início Rápido

### Instalação local

Se você está executando a partir de um clone local, use:

```bash
npm exec codex3d
```

`npm exec codex3d` expõe o binário local do pacote apenas para esse comando. Ele não adiciona `codex3d` ao `PATH` do seu shell.

Para deixar `codex3d` disponível como um comando normal enquanto desenvolve neste repositório, execute:

```bash
npm link
```

Depois, abra um novo terminal e execute:

```bash
codex3d
```

Dentro do Codex3D:

- execute `/provider` para configuração guiada de provedores e perfis salvos
- execute `/onboard-github` para onboarding do GitHub Models
- execute `/buddy` para criar ou interagir com seu companheiro local

### Configuração rápida com OpenAI

macOS / Linux:

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_MODEL=gpt-4o

codex3d
```

Windows PowerShell:

```powershell
$env:CLAUDE_CODE_USE_OPENAI="1"
$env:OPENAI_API_KEY="sk-your-key-here"
$env:OPENAI_MODEL="gpt-4o"

codex3d
```

### Configuração rápida com Ollama local

macOS / Linux:

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=qwen2.5-coder:7b

codex3d
```

Windows PowerShell:

```powershell
$env:CLAUDE_CODE_USE_OPENAI="1"
$env:OPENAI_BASE_URL="http://localhost:11434/v1"
$env:OPENAI_MODEL="qwen2.5-coder:7b"

codex3d
```

### Comando de lançamento do Ollama

Se você tem o [Ollama](https://ollama.com) instalado, pode pular a configuração manual de variáveis de ambiente:

```bash
ollama launch codex3d --model qwen2.5-coder:7b
```

Isso configura automaticamente `ANTHROPIC_BASE_URL`, roteamento de modelo e autenticação para que todo o tráfego de API passe pela sua instância local do Ollama. Funciona com qualquer modelo que você tenha baixado, local ou em nuvem.

## Guias de Configuração

Guias para iniciantes:

- [Configuração para Pessoas Não Técnicas](docs/non-technical-setup.md)
- [Início Rápido no Windows](docs/quick-start-windows.md)
- [Início Rápido no macOS / Linux](docs/quick-start-mac-linux.md)

Guias avançados e de build local:

- [Configuração Avançada](docs/advanced-setup.md)
- [Instalação no Android](ANDROID_INSTALL.md)

## Provedores Suportados

| Provedor | Caminho de configuração | Observações |
| --- | --- | --- |
| Compatível com OpenAI | `/provider` ou variáveis de ambiente | Funciona com OpenAI, OpenRouter, DeepSeek, Groq, Mistral, LM Studio e outros servidores compatíveis com `/v1` |
| Gemini | `/provider` ou variáveis de ambiente | Suporta chave de API, token de acesso ou fluxo local com ADC |
| GitHub Models | `/onboard-github` | Onboarding interativo com credenciais salvas |
| Codex OAuth | `/provider` | Abre o login do ChatGPT no navegador e armazena credenciais do Codex com segurança |
| Codex | `/provider` | Usa autenticação existente da Codex CLI, armazenamento seguro do Codex3D ou credenciais por ambiente |
| Ollama | `/provider`, variáveis de ambiente ou `ollama launch` | Inferência local sem chave de API |
| Atomic Chat | `/provider`, variáveis de ambiente ou `bun run dev:atomic-chat` | Provedor de modelo local; detecta modelos carregados automaticamente |
| Bedrock / Vertex / Foundry | variáveis de ambiente | Integrações adicionais para ambientes suportados |

## O que funciona

- **Fluxos de programação guiados por ferramentas**: Bash, leitura/escrita/edição de arquivos, grep, glob, agentes, tarefas, MCP e slash commands
- **Respostas em streaming**: Saída de tokens e progresso de ferramentas em tempo real
- **Chamadas de ferramentas**: Loops multi-etapa com chamadas ao modelo, execução de ferramentas e respostas de acompanhamento
- **Imagens**: Entradas de imagem por URL e base64 para provedores com suporte a visão
- **Perfis de provedores**: Configuração guiada e suporte a perfis salvos em `.codex3d-profile.json`
- **Backends locais e remotos**: APIs em nuvem, servidores locais e inferência local em Apple Silicon
- **Buddy local**: Um companheiro persistente que reage ao seu trabalho real na CLI

## Observações sobre provedores

Codex3D suporta múltiplos provedores, mas o comportamento não é idêntico em todos eles.

- Recursos específicos da Anthropic podem não existir em outros provedores
- A qualidade das ferramentas depende muito do modelo selecionado
- Modelos locais menores podem ter dificuldade com fluxos longos de ferramentas em múltiplas etapas
- Alguns provedores impõem limites menores de saída, e o Codex3D adapta onde possível

Para melhores resultados, use modelos com bom suporte a tool/function calling.

## Como o `/buddy` funciona

O `/buddy` é um recurso próprio do Codex3D: um companheiro local dentro da CLI com progressão de jogo, humor, animações e reações ao trabalho real. Ele existe para deixar o fluxo de programação mais vivo sem depender de um serviço externo.

### Comandos principais

```text
/buddy
/buddy status
/buddy mode
/buddy mode <minimal|balanced|expressive>
/buddy rename <nome>
/buddy edit personality <texto>
/buddy reset
/buddy reroll
/buddy mute
/buddy unmute
/buddy help
```

### Criação e interação

- Na primeira vez, `/buddy` cria um único companheiro ativo.
- Depois disso, `/buddy` faz carinho no buddy e dispara uma reação visual curta.
- `/buddy status` mostra nome, espécie, raridade, personalidade, modo, nível, XP, humor, combos, streak, tempo de trabalho, erros alimentados e conquistas.
- `/buddy rename <nome>` muda o nome.
- `/buddy edit personality <texto>` muda a personalidade exibida.
- `/buddy reset` ou `/buddy reroll` cria um novo buddy.
- `/buddy mute` silencia reações; `/buddy unmute` reativa.

### Progressão, XP e conquistas

O buddy progride com ações reais do fluxo de trabalho:

- ganha XP por prompts reais enviados ao modelo
- ganha progresso produtivo quando há execução bem-sucedida de ferramentas
- acumula tempo de trabalho, combos e streaks
- desbloqueia conquistas passivas conforme seu uso evolui
- sobe de nível a partir do XP total

O `/buddy` em si não serve para farmar XP. Comandos locais e slash commands que não viram uma consulta real ao modelo não contam como prompt produtivo.

### Erros como alimento

Quando uma chamada real de ferramenta falha, o buddy pode "comer" esse erro e ganhar progresso bônus.

Não contam como alimento:

- permissões negadas
- falhas de validação
- interrupções por hooks
- `AbortError`
- falhas duplicadas já registradas

Quando um erro válido é alimentado, a UI pode entrar em um estado visual especial de `errorFeed`.

### Humor e animações

O humor do buddy é derivado da atividade recente de trabalho produtivo. Os humores atuais são:

- `excited`
- `content`
- `sleepy`
- `lonely`

A UI tem estados visuais temporários para:

- `idle`
- `pet`
- `speak`
- `errorFeed`
- `combo`
- `achievement`
- `levelUp`

Esses estados aparecem como reações, bolhas, animações ASCII e pequenos eventos visuais no terminal.

### Modos do buddy

O buddy tem três modos para equilibrar experiência e uso de tokens:

| Modo | Comportamento |
| --- | --- |
| `minimal` | Mantém XP, níveis, humor, alimentação de erros e animações locais; desativa comentários do buddy e contexto enviado ao modelo |
| `balanced` | Ativa comentários locais do buddy, mas não envia contexto do buddy ao modelo; é o modo recomendado |
| `expressive` | Ativa comentários locais e também contexto do buddy visível ao modelo para uma experiência mais rica |

Sistemas locais como XP, humor, animações e progressão continuam funcionando em todos os modos. Recursos que podem consumir tokens são controlados pelo modo.

## Roteamento de agentes

Codex3D pode rotear agentes diferentes para modelos diferentes por configuração. Isso ajuda a otimizar custo ou separar tarefas por força do modelo.

Adicione em `~/.claude/settings.json`:

```json
{
  "agentModels": {
    "deepseek-v4-flash": {
      "base_url": "https://api.deepseek.com/v1",
      "api_key": "sk-your-key"
    },
    "gpt-4o": {
      "base_url": "https://api.openai.com/v1",
      "api_key": "sk-your-key"
    }
  },
  "agentRouting": {
    "Explore": "deepseek-v4-flash",
    "Plan": "gpt-4o",
    "general-purpose": "gpt-4o",
    "frontend-dev": "deepseek-v4-flash",
    "default": "gpt-4o"
  }
}
```

Quando não há correspondência de roteamento, o provedor global continua sendo o fallback.

> **Observação:** valores de `api_key` em `settings.json` são armazenados em texto puro. Mantenha esse arquivo privado e não faça commit dele.

## Web Search e Web Fetch

Por padrão, `WebSearch` funciona em modelos não Anthropic usando DuckDuckGo. Isso dá a GPT-4o, DeepSeek, Gemini, Ollama e outros provedores compatíveis com OpenAI um caminho gratuito de busca web.

> **Observação:** o fallback do DuckDuckGo funciona raspando resultados de busca e pode sofrer rate limit, bloqueio ou estar sujeito aos Termos de Serviço do DuckDuckGo. Para uma opção mais confiável, configure Firecrawl.

Para backends Anthropic nativos e respostas Codex, o Codex3D mantém o comportamento nativo de busca web do provedor.

`WebFetch` funciona, mas seu caminho básico de HTTP mais HTML-para-markdown ainda pode falhar em sites renderizados por JavaScript ou sites que bloqueiam requisições HTTP simples.

Configure uma chave de API do [Firecrawl](https://firecrawl.dev) se quiser busca/fetch via Firecrawl:

```bash
export FIRECRAWL_API_KEY=your-key-here
```

Com Firecrawl ativado:

- `WebSearch` pode usar a API de busca do Firecrawl enquanto DuckDuckGo continua como fallback gratuito padrão para modelos não Claude
- `WebFetch` usa o endpoint de scrape do Firecrawl em vez de HTTP bruto, lidando melhor com páginas renderizadas por JavaScript

O plano gratuito em [firecrawl.dev](https://firecrawl.dev) inclui 500 créditos. A chave é opcional.

---

## Servidor gRPC headless

Codex3D pode rodar como um serviço gRPC headless, permitindo integrar suas capacidades agentic — ferramentas, bash e edição de arquivos — em outros aplicativos, pipelines de CI/CD ou interfaces personalizadas. O servidor usa streaming bidirecional para enviar trechos de texto em tempo real, chamadas de ferramentas e solicitações de permissão para comandos sensíveis.

### 1. Iniciar o servidor gRPC

Inicie o motor principal como serviço gRPC em `localhost:50051`:

```bash
npm run dev:grpc
```

#### Configuração

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `GRPC_PORT` | `50051` | Porta em que o servidor gRPC escuta |
| `GRPC_HOST` | `localhost` | Endereço de bind. Use `0.0.0.0` para expor em todas as interfaces, não recomendado sem autenticação |

### 2. Rodar o cliente CLI de teste

Há um cliente CLI leve que se comunica exclusivamente por gRPC. Ele se comporta como a CLI interativa principal, renderizando cores, tokens em streaming e pedidos de permissão para ferramentas via evento gRPC `action_required`.

Em outro terminal, execute:

```bash
npm run dev:grpc:cli
```

*Observação: as definições gRPC ficam em `src/proto/`. Você pode usar esse arquivo para gerar clientes em Python, Go, Rust ou qualquer outra linguagem.*

---

## Build a partir do código fonte e desenvolvimento local

```bash
bun install
bun run build
node dist/cli.mjs
```

Comandos úteis:

- `bun run dev`
- `bun test`
- `bun run test:coverage`
- `bun run security:pr-scan -- --base origin/main`
- `bun run smoke`
- `bun run doctor:runtime`
- `bun run verify:privacy`
- execuções focadas com `bun test ...` para as áreas alteradas

## Testes e cobertura

Codex3D usa o test runner integrado do Bun para testes unitários.

Rode a suíte unitária completa:

```bash
bun test
```

Gere cobertura unitária:

```bash
bun run test:coverage
```

Abra o relatório visual de cobertura:

```bash
open coverage/index.html
```

Se você já tem `coverage/lcov.info` e quer apenas reconstruir a UI:

```bash
bun run test:coverage:ui
```

Use execuções focadas quando tocar apenas uma área:

- `bun run test:provider`
- `bun run test:provider-recommendation`
- `bun test path/to/file.test.ts`

Validação recomendada antes de abrir um PR:

- `bun run build`
- `bun run smoke`
- `bun run test:coverage` quando a mudança afeta runtime compartilhado ou lógica de provedores
- execuções focadas com `bun test ...` para arquivos e fluxos alterados

A cobertura é escrita em `coverage/lcov.info`, e o Codex3D também gera um heatmap em estilo atividade Git em `coverage/index.html`.

## Estrutura do repositório

- `src/` - núcleo da CLI/runtime
- `scripts/` - scripts de build, verificação e manutenção
- `docs/` - documentação de setup, contribuição e projeto
- `python/` - helpers Python independentes e seus testes
- `vscode-extension/` - extensão VS Code
- `.github/` - automação do repositório, templates e CI
- `bin/` - entrypoints lançadores da CLI

## Extensão VS Code

O repositório inclui uma extensão VS Code em `vscode-extension/` para integração de lançamento do Codex3D, UI de controle de provedores e suporte a temas.

## Segurança

Se você acredita que encontrou uma falha de segurança, veja [SECURITY.md](SECURITY.md).

## Contribuição

Contribuições são bem-vindas.

Para mudanças maiores, abra uma issue primeiro para deixar o escopo claro antes da implementação. Comandos úteis de validação incluem:

- `bun run build`
- `bun run test:coverage`
- `bun run smoke`
- execuções focadas com `bun test ...` para arquivos e fluxos alterados

## Aviso legal

Codex3D é um projeto comunitário independente e não é afiliado, endossado ou patrocinado pela Anthropic.

Codex3D é mantido a partir de uma base derivada do OpenClaude, e o OpenClaude teve origem na base de código do Claude Code antes de ser substancialmente modificado para suporte a múltiplos provedores e uso aberto. "Claude" e "Claude Code" são marcas registradas da Anthropic PBC. Veja [LICENSE](LICENSE) para detalhes.

## Licença

Veja [LICENSE](LICENSE).
