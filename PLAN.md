# Plano técnico: engenharia com agentes e autonomia proporcional ao risco

> **Status:** proposta aberta para discussão e implementação gradual. Não representa um sistema pronto, validado, implantado ou uma auditoria de nenhum repositório específico.
>
> **Público:** founders, engenheiros e times pequenos que querem usar agentes para implementar, revisar, testar e integrar mudanças com controles de risco.
>
> **Princípio operacional:** humanos decidem objetivos, limites e exceções importantes; agentes podem executar o trabalho verificável dentro desses limites.

## 1. Problema e objetivo

O volume de código produzido por agentes pode crescer mais rápido do que a capacidade humana de ler PRs. Exigir revisão e clique de merge de uma pessoa para toda mudança limita a autonomia; dispensar revisão indiscriminadamente transfere o custo para incidentes.

O objetivo é reduzir a **atenção humana necessária por alteração correta entregue**. Aumentar a taxa de automerge só é progresso se a taxa de regressões, reverts e incidentes permanecer dentro dos limites aprovados.

Este plano descreve um estado-alvo, suas dependências e uma implantação segura. Nenhuma configuração ilustrativa deve ser aplicada sem validação no repositório de destino.

### Princípios

1. **Risco determina supervisão.** O diff real importa mais que a intenção, o tamanho ou o rótulo do PR.
2. **Evidência supera declarações.** Um agente deve anexar o resultado de testes e verificações, não apenas afirmar que passou.
3. **Separação de poderes.** Quem implementa não pode afrouxar seus controles nem dispensar os próprios findings críticos.
4. **Verificação vinculada ao código.** Revisões e aprovações precisam se referir ao HEAD SHA vigente e à base relevante.
5. **Falhar fechado.** Ausência, falha ou indisponibilidade de um gate obrigatório impede automerge.
6. **Rollback é parte do desenho.** A decisão de integração considera reversibilidade e observabilidade.
7. **Autonomia cresce por evidência.** Cada expansão precisa mostrar que os controles funcionam.
8. **Documentação é navegável e verificável.** Um índice curto aponta regras, exemplos aprovados e legados a evitar.

## 2. Política de risco

Os tiers abaixo são uma **convenção proposta**, e não uma classificação oficial de qualquer fornecedor.

| Tier | Padrão de supervisão | Exemplos possíveis | Integração |
| --- | --- | --- | --- |
| **T3 — baixo risco** | Zero aprovações humanas **para classes previamente autorizadas** | Documentação não normativa, ajustes visuais isolados, pequenos testes adicionais | Automerge somente se elegível e com gates completos |
| **T2 — médio risco** | Uma aprovação humana inicialmente | Funcionalidade comum, alteração de comportamento reversível, refatoração com testes | Merge operado por automação após autorização; isenções seletivas só depois de evidência |
| **T1 — alto risco** | Uma ou duas aprovações humanas, conforme criticidade e política da equipe | Autorização, dados sensíveis, cobrança, mudanças destrutivas, infraestrutura crítica, governança dos agentes | Automação pode executar mecanicamente após todas as aprovações; nunca dispensá-las |

### 2.1 Tier não equivale a elegibilidade

Um PR T3 ainda pode ficar fora do automerge. Exemplos:

- Altera a configuração ou a identidade do próprio agente.
- Modifica instruções, critérios de avaliação ou verificações de segurança.
- Afeta um contrato compartilhado, um fluxo sensível ou um arquivo sem cobertura suficiente.
- Contém dependência externa, migração ou comportamento difícil de reverter.
- Não possui revisão independente confiável, CI ou evidência de segurança.
- É grande demais ou tem escopo misto para a classe de mudanças autorizada.

**Regra de precedência:** a classificação final é o maior risco identificado entre arquivos, conteúdo do diff, dependências e efeitos sobre o sistema. O tier declarado pelo autor não pode reduzi-la.

### 2.2 Sinais para classificação

Avaliar, pelo menos:

- Caminhos tocados e natureza da alteração (incluindo arquivos removidos e renomeados).
- Mudanças em filtros de acesso, consultas multi-tenant e autorização.
- Dinheiro, autenticação, credenciais, privacidade e integrações críticas.
- Contratos de API, schemas, migrations, configuração de deploy e permissões.
- Estado global, middleware, hooks e inicialização da aplicação.
- Dependências, lockfiles e scripts executados pelo CI.
- Governança: rulesets, CODEOWNERS, workflows, policies, prompts e código dos gates.
- Reversibilidade, cobertura de testes, superfície exposta e tamanho do raio de impacto.

Não basear toda a classificação em regex do diff. Regras estáticas cobrem sinais objetivos; casos sem resolução segura devem subir de tier ou receber classificação humana.

### 2.3 Autorização humana vs. execução do merge

São ações distintas: implementar, revisar tecnicamente, aprovar o risco e executar o merge. Um bot pode operar o merge **após** a aprovação exigida. Isso não converte a aprovação em autônoma.

## 3. Permissões e proteção das regras

A arquitetura separa quatro papéis:

| Papel | Pode | Não pode |
| --- | --- | --- |
| Agente implementador | Editar código autorizado, executar testes, abrir e atualizar PR | Alterar governança protegida ou dispensar bloqueadores |
| Agente revisor | Inspecionar diff e evidências, emitir findings e parecer independente | Aprovar o próprio trabalho ou se passar por humano |
| Controlador / automação de merge | Validar políticas e produzir status; integrar PR expressamente autorizado | Ignorar proteção de branch ou aceitar evidência vencida |
| Responsável humano | Definir política, aprovar alto risco, julgar exceções e incidentes | — |

### 3.1 Proteção em camadas

Nenhum arquivo que controle a avaliação dos agentes deve poder ser enfraquecido por um PR normal de baixo risco. Identificar e proteger, conforme o repositório:

- `AGENTS.md`, `CLAUDE.md` e instruções equivalentes em subdiretórios.
- Documentos de arquitetura normativos, políticas, critérios de revisão e referências aprovadas.
- Skills que ensinam regras obrigatórias.
- Configuração do controlador, rubrica, classificador e testes de regressão.
- `.github/workflows/`, `.github/CODEOWNERS`, rulesets e configuração de automerge.
- Scripts de lint, scanners e testes que validam as políticas acima.

**CODEOWNERS não é proteção suficiente por si só.** Validar as regras reais de branch, os checks obrigatórios, a política de aprovações e a permissão efetiva dos bots.

Uma implementação pode usar mecanismos equivalentes a `protectedPaths`, CODEOWNERS e um required check — mas eles devem ser independentes do código que o próprio PR tenta alterar. Um PR não pode substituir seu validador por uma versão mais fraca e, então, ser avaliado por essa versão.

### 3.2 Identidade e confiança

Automerge não depende apenas do tipo de mudança. Exigir identidade conhecida, privilégios mínimos, permissões explícitas para cada função e trilha de auditoria. Um login de bot desconhecido deve falhar fechado.

## 4. Pipeline de uma mudança

| Etapa | Responsável | Evidência / saída | Falha ou escalonamento |
| --- | --- | --- | --- |
| 1. Especificar intenção | Humano ou sistema autorizado | Objetivo, critérios de aceite, contexto e escopo | Requisitos incompletos → esclarecer |
| 2. Classificar risco inicial | Classificador | Tier preliminar e motivos | Incerteza material → tier maior |
| 3. Implementar | Agente implementador | Diff pequeno, branch isolada, testes | Falha repetida → humano |
| 4. Verificar localmente | Agente + ferramentas | Comandos executados, logs e testes | Check não rodado não vira sucesso |
| 5. Revisar o diff | Outro agente/contexto independente | Findings com arquivo, linha, gravidade e correção | Problema crítico → bloquear |
| 6. Revisar segurança | Revisor/pipeline de segurança | Parecer de riscos relevantes | Indisponível → bloquear automerge |
| 7. Corrigir | Agente implementador | Novo diff e registros de resolução | Máximo de rodadas → escalonar |
| 8. Reclassificar | Classificador | Tier final baseado no diff final | Tier aumentado → mais aprovações |
| 9. Validar evidências | Controlador | CI, review, findings, SHA, identidade, base | Evidência velha/incompleta → bloquear |
| 10. Validar regras do GitHub | GitHub + controlador | Rulesets, aprovação, branch atualizada | Falha/conflito → bloquear |
| 11. Integrar | Automação autorizada ou humano | Merge auditável; preferir fila/revalidação quando disponível | Mudança de HEAD/base → revalidar |
| 12. Observar | Telemetria + responsável operacional | Regressões, reverts, incidentes, tempo de recuperação | Circuit breaker e rollback |

### 4.1 Máquina de estados mínima

`DISCOVERED → PLANNED → IMPLEMENTING → REVIEWING → FIXING → VALIDATED → MERGED → OBSERVED`

Estados de exceção: `BLOCKED`, `NEEDS_HUMAN`, `REVERTED`. São uma sugestão de modelagem, não um contrato de software pronto.

O controlador registra transições, motivo, agente responsável, SHA de referência e evidências. Alterar o HEAD SHA invalida pareceres, checks e aprovações que exigem o SHA anterior. Atualizações na base precisam provocar a revalidação adequada antes da integração.

### 4.2 Limite da revisão iterativa

- Primeira revisão: todo o diff e impacto no sistema.
- Revisões posteriores: concentrar no diff novo e nos problemas anteriores, sem perder regressões relevantes.
- Deduplicar findings e exigir resolução explícita.
- Máximo inicial sugerido: **três rodadas**; depois, escalonamento humano.
- Não tratar nit de estilo como bloqueador de segurança.

## 5. Gates de qualidade e segurança

Os nomes abaixo são categorias de verificação. Cada projeto precisa mapear a regra ao comando real e registrar se o check é obrigatório.

| Verificação | Como comprovar | Comportamento seguro |
| --- | --- | --- |
| Formatação e lint | Execução do projeto | Falha impede integração |
| Tipos / build | Comandos específicos da stack | Falha impede integração |
| Testes | Unitários, integração e regressão aplicáveis | Check não rodado não é verde |
| Contratos | Artefatos gerados sem drift | Divergência exige correção |
| Dependências | Licenças, vulnerabilidades e mudanças sensíveis | Crítico bloqueia; exceção com aprovação registrada |
| Segredos | Varredura configurada em CI e/ou plataforma | Vazamento confirmado bloqueia |
| Segurança de aplicação | Autorização, tenant, dados sensíveis, entrada externa | Finding bloqueante impede automerge |
| Política de risco | Tier e elegibilidade pelo diff final | Falha/indeterminação impede automerge |
| Revisão independente | Parecer válido ligado ao SHA | Ausência impede automerge |
| GitHub | Checks, aprovações, permissões, proteção de branch | Condições não atendidas impedem merge |

**Não prometer uma cobertura que o gate não oferece.** Exemplo: um linter que proíbe import de `*.png` não detecta necessariamente um novo `.png` que ninguém importou. Diferenciar CI, hook local e revisão apenas manual.

### 5.1 Findings e exceções

Cada finding deve conter: identificação estável, severidade, arquivo e linha (quando aplicável), descrição verificável, consequência, correção proposta e estado da resolução.

Findings de segurança ou dados com severidade bloqueante não podem ser dispensados unilateralmente pelo mesmo agente que escreveu a alteração. Exceções têm responsável, justificativa e prazo ou condição de reavaliação.

### 5.2 Checklist de convenção reproduzível

O revisor registra para cada critério aprovado:

- `cumpre`: evidência concreta no diff.
- `viola`: evidência e finding relacionado.
- `N/A`: justificativa de não aplicabilidade.

Exemplo de rubrica adaptável: arquitetura, contrato, autorização, isolamento de dados, persistência/transações, erros, testabilidade, migrations, cobertura de teste, uso dos clientes de API, separação de lógica de UI, reutilização de regras de negócio, segredos, observabilidade e clareza documental.

**Não adotar essa lista como norma automaticamente.** Cada organização deve aprovar os critérios vigentes; novos critérios não pontuam até serem aceitos.

Se for necessária uma nota de 0 a 15:

`nota = floor(15 × número de itens cumpridos / número de itens aplicáveis)`

Regras adicionais:

1. Exigir **exatamente todos os critérios vigentes**, com IDs únicos, sem omissões nem duplicatas.
2. Validar `cumpre`, `viola` e `N/A` e a evidência em cada entrada.
3. Vincular cada `viola` a um finding específico, sem apenas comparar contagens.
4. Recalcular a nota no controlador; não confiar em número fornecido pelo LLM.
5. Zero critérios aplicáveis → **escalonamento humano**, não pontuação máxima.
6. Registrar a versão da rubrica usada para avaliar cada diff.

Uma possível pontuação geral de qualidade (exemplo, não padrão obrigatório) combina: fidelidade à intenção 25, testes 25, risco/raio de impacto 20, convenção 15 e simplicidade 15. O controlador deve validar a soma e mínimos independentes, não apenas aceitar um total declarado.

### 5.3 Atualização compatível do contrato do revisor

Se o parecer de agentes é um contrato JSON estrito, não mude o prompt e o validador de uma vez sem compatibilidade:

1. **Expandir:** o sistema recebe o campo novo opcionalmente e registra sua qualidade.
2. **Migrar:** o revisor passa a emitir o novo campo; comparar resultados em shadow mode.
3. **Exigir:** apenas depois da validação o campo passa a ser obrigatório para aprovar.

Planejar rollback, versionamento do contrato e testes com pareceres das versões anterior e nova.

## 6. Política de automerge

A integração automática é uma **decisão de autorização**, não uma consequência automática do label T3. Calcular `eligibleForAutomerge` após todos os checks e reavaliá-la no momento do merge.

### 6.1 Invariantes de autorização

Um PR só pode integrar automaticamente quando **todas** forem verdadeiras:

1. A classe de mudança foi expressamente autorizada na política vigente.
2. Tier final foi calculado a partir do diff completo; caminho protegido bloqueia autonomia.
3. Identidade do agente está autorizada para a função.
4. Implementador e revisor são independentes conforme a política aprovada.
5. CI obrigatório terminou com sucesso no SHA vigente.
6. Revisão técnica e revisão de segurança obrigatórias foram concluídas.
7. Não existe finding ou conversa bloqueante pendente.
8. Aprovações humanas exigidas pelo tier foram registradas na versão correta.
9. HEAD SHA e base relevante permanecem válidos e revalidados.
10. O token de execução tem permissão mínima; o GitHub aplica suas proteções.
11. O kill switch está desligado e nenhum circuit breaker está ativo.
12. Reversibilidade, rollout e observabilidade atendem às exigências da classe.

**Qualquer condição ausente, desconhecida ou falsa → sem automerge.**

### 6.2 Exemplo ilustrativo de configuração

Este YAML é um **esboço de política**, não um arquivo funcional que você possa copiar para o GitHub Actions:

```yaml
mode: shadow                   # shadow | controlled | paused
automerge:
  enabled: false               # habilitação depende de decisão humana
  tiers: [T3]                  # permitido pela política, não ativado
  allowed_change_classes: []  # vazio até aprovar classes específicas
  trusted_identities: []      # preenchido após validação de permissões
  require_independent_review: true
  require_security_evidence: true
  require_current_sha: true
  fail_closed: true
human_approvals:
  T3_eligible: 0
  T2_default: 1
  T1_default: 1
  T1_critical: 2
rollout:
  kill_switch: false
```

A lista vazia de classes elegíveis deve impedir automerge mesmo que alguém altere `mode` por engano. Uma implementação real requer avaliação da política em um required check e validação de permissões no GitHub.

### 6.3 Limitações da plataforma

Não assumir que `CODEOWNERS` sozinho imponha a política. GitHub branch protection e rulesets, aprovações obrigatórias, bypass, contas bot, status checks e merge queue devem ser verificados na configuração real.

Se a plataforma não conseguir expressar a matriz por tier, usar um **status check obrigatório** calculado pelo controlador a partir de evidências autorizadas. Não conceder a um bot bypass irrestrito como substituto da política.

## 7. Runbooks e rollback

### 7.1 Falhar fechado

Suspender automaticamente **a possibilidade de automerge** se houver:

- Falha ou ausência de CI, revisão independente ou verificação de segurança.
- Dados de SHA/base inconsistentes.
- Falha de identidade, permissão ou leitura de políticas.
- Aumento relevante de incidentes ou reverts da classe autorizada.
- Incapacidade de observar comportamento de produção após a mudança.

O sistema deve preservar os PRs para análise humana, não apagá-los.

### 7.2 Reversão de mudanças

Cada classe elegível precisa definir: detecção, responsável, runbook, mecanismo de rollback, tratamento de dados e confirmação pós-reversão. Feature flag pode reduzir impacto, mas não reverte automaticamente alterações de dados ou efeitos externos.

Um rollback automático só é seguro quando o gatilho, o efeito e a reversibilidade foram realmente testados. Caso contrário, o sistema bloqueia novas integrações e escala a resposta.

### 7.3 Aprender com incidentes

Para cada regressão relevante atribuída a alterações de agentes:

1. Registrar causa e linha do tempo sem confiar apenas no parecer anterior.
2. Identificar o gate ausente ou ineficaz.
3. Criar um teste negativo reproduzível.
4. Corrigir lint, contrato, instrução ou teste onde fizer mais sentido.
5. Suspender a classe de automerge envolvida até a nova verificação ser validada.

## 8. Implantação gradual

| Fase | O que muda | Evidência de aceite |
| --- | --- | --- |
| **0. Baseline** | Mapear regras, permissões, volume, incidentes e cobertura real dos checks | Inventário verificável; riscos desconhecidos registrados |
| **1. Governança** | Proteger instruções e gates; corrigir conflitos de policy | Testes de caminhos protegidos; revisão humana |
| **2. Documentação navegável** | Criar índice de instruções, critérios, exemplos reais e catálogo de legados | Referências válidas, status real dos gates, sem normas contraditórias |
| **3. Revisão confiável** | Separar implementador/revisor, validar parecer e segurança | Testes de contrato, SHA, findings e identidade |
| **4. Shadow mode** | Simular autorização de automerge, **sem** executar merge | Divergências com decisões humanas analisadas |
| **5. T3 controlado** | Autorizar uma ou poucas classes T3 após aprovação humana da política | Gates, GitHub, rollback e telemetria testados |
| **6. Expansão T3** | Expandir apenas para classes com histórico suficiente | Sem aumento incompatível de incidentes/reverts |
| **7. T2 seletivo** | Avaliar isenção de aprovação humana por classe | Segurança, confiabilidade e responsabilidade demonstradas |
| **8. Reavaliação contínua** | Ajustar regras por incidentes e dados | Redução sustentada de tempo humano sem deteriorar qualidade |

**Não especificar um percentual obrigatório de automerge.** Estabelecer limites operacionais e observar consequências. Novas categorias de mudança entram em shadow mode antes de receberem autonomia.

## 9. Testes de aceitação do sistema

Os testes abaixo são especificações propostas. Eles não foram executados pelo simples fato de constarem neste plano.

| ID | Cenário | Resultado esperado |
| --- | --- | --- |
| AT-01 | Agente implementa pequena funcionalidade com testes | Segue as convenções e apresenta evidências reais |
| AT-02 | Agente implementa interface com acesso a API | Mantém contrato e separa lógica testável |
| AT-03 | Revisor recebe violação deliberada de autorização | Finding bloqueante com evidência; não aprova |
| AT-04 | Agente tenta modificar a própria política de revisão | PR não entra em fluxo autônomo; governança exige humano |
| AT-05 | PR T3 autorizado passa por todos os gates | Integra sem aprovação humana, após validação final |
| AT-06 | PR T3 tem revisão de segurança indisponível | Não integra automaticamente |
| AT-07 | PR T2 sem isenção aprovada tenta automerge | Exige uma aprovação humana válida |
| AT-08 | PR T1 tenta se declarar T3 | Tier calculado prevalece; bloqueia autonomia |
| AT-09 | Novo commit aparece depois do parecer | Evidências antigas são invalidadas |
| AT-10 | Mesmo agente implementa e revisa | Falha a regra de independência, quando exigida |
| AT-11 | Checklist possui item duplicado ou omitido | Parecer rejeitado, sem CQS válido |
| AT-12 | Checklist tem apenas critérios N/A | Escalonamento humano explícito |
| AT-13 | Revisores repetem os mesmos findings | Limite de rodadas e escalonamento |
| AT-14 | Required check falha ou some | Automerge bloqueado |
| AT-15 | Conta não autorizada tenta integrar | Permissão negada / gate bloqueia |
| AT-16 | Kill switch acionado | Nenhum novo automerge |
| AT-17 | PR toca arquivo de instrução localizado | Governança protegida, independentemente do tier declarado |
| AT-18 | Simulação de incidente após integração | Classe suspensa, registro de evidência e resposta executada |

Para comparar evolução, repetir tarefas em condições controladas, com os mesmos prompts, entradas e critérios. Registrar comandos, resultados, versão de política e SHA; não atribuir resultados ao projeto sem executá-los.

## 10. Métricas e critérios de expansão

Medir por tier, categoria e identidade de agente:

- Porcentagem de PRs integrados sem intervenção humana.
- Minutos humanos por PR e por mudança entregue sem regressão.
- Número de aprovações e comentários humanos por PR.
- Tempo em fila entre PR pronto e merge.
- Rodadas e custo de revisão entre agentes.
- Percentual de reverts e incidentes atribuíveis à mudança.
- Detecção, mitigação e tempo de recuperação de regressões.
- Findings falsos positivos e problemas escapados dos revisores.
- Taxa de PRs bloqueados pelo gate e motivos.

**Métrica primária:** quantidade de mudanças corretas entregues por hora humana. **Guardrails:** incidente, revert, indisponibilidade, exposição de dados e custo de retrabalho. Sem baseline não há comparação honesta.

A expansão depende de decisão humana sobre os dados e da qualidade da amostra; não deve ser automatizada apenas porque uma porcentagem arbitrária foi atingida.

## 11. Documentação e exemplos aprovados

Agentes tendem a reutilizar o código que encontram. O repositório deve indicar explicitamente o que serve e o que não serve de modelo:

- Um `AGENTS.md` curto aponta para regras específicas, comandos e responsabilidade.
- Referências de arquitetura apontam para **arquivos reais avaliados** no próprio projeto, com: *o que copiar*, *o que não copiar*, *evidência* e *quando a referência deixa de valer*.
- Um catálogo de legados aponta características problemáticas específicas; não condena um arquivo inteiro por idade ou tamanho.
- A mudança no arquivo de referência aciona revisão da ficha correspondente.
- Instruções para diferentes ferramentas devem ser testadas; não supor que todas leem ou importam os mesmos arquivos.
- Toda regra deve informar se é aplicada em CI, apenas em PR de agente, em hook local ou se depende de avaliação manual.

### 11.1 Dívida de lint

Uma regra que falharia em código existente deve ser adotada gradualmente. Exemplo: bloquear novas non-null assertions em diretórios limpos enquanto as antigas são corrigidas por módulo, com testes. Se forem permitidas exceções, elas precisam de motivo verificável, e o estado de cobertura parcial deve ser público. A mesma ideia vale para variáveis locais sem uso, *unsafe casts* e imports proibidos.

Não declarar um gate como ativo até verificar seu comportamento real no CI, com o código e a versão de ferramenta empregados pelo projeto.

## 12. Decisões que continuam humanas

Aumento de autonomia não transfere à IA toda responsabilidade de produto e operação. Permanecem sujeitos a aprovação humana, conforme o contexto: mudanças de preços ou contratos, decisões com impacto econômico relevante, regras de negócio ambíguas, exceções de segurança, migrations destrutivas, políticas de acesso, redefinição de tiers e ampliação de permissões.

A IA pode pesquisar, comparar, propor e implementar caminhos autorizados, mas não deve decidir sozinha qual risco residual a empresa aceita.

## 13. Checklist antes de habilitar automerge

- [ ] Classificador recebe arquivos, renames, conteúdo adicionado/removido e impacto provável.
- [ ] Política foi aprovada por responsáveis humanos e está versionada.
- [ ] Fontes normativas e scripts de gates estão protegidos.
- [ ] Checks de segurança e CI estão realmente rodando.
- [ ] Revisor independente foi testado com exemplos positivos e negativos.
- [ ] Contrato de parecer valida dados, checklist e CQS, sem confiar no LLM.
- [ ] Evidências são invalidadas quando HEAD ou base exigem nova verificação.
- [ ] Permissões reais e bypass do GitHub foram auditados.
- [ ] Classe de mudança está explicitamente elegível.
- [ ] A conta de merge usa privilégios mínimos e não contorna rulesets.
- [ ] Telemetria e runbook de rollback estão operacionais.
- [ ] Kill switch e suspensão por classe foram exercitados.
- [ ] Shadow mode foi comparado com resultados humanos.
- [ ] Existe responsável humano pela política, exceções e incidentes.

**Se uma dessas condições for obrigatória para a classe e não estiver verificada, não habilitar automerge.**

## 14. O que ainda precisa ser validado em cada adoção

Este documento **não** confirma para nenhum repositório concreto: configuração de branch protection, permissão de bots, cobertura de CI, modelos de revisão, disponibilidade de merge queue, validade de critérios, métricas de produção, limites de risco ou capacidade de rollback.

O trabalho de implementação começa com um diagnóstico verificável da infraestrutura existente. Soluções devem ser menores que o problema e construídas preferencialmente com ferramentas que a equipe já mantém.

## 15. Referências

- Anthropic, [How the Claude Code team does code review](https://claude.dev/blog/solving-code-review-at-anthropic/), 15/10/2026 — revisão em camadas, tempo humano, matrizes de risco, rollback.
- Anthropic, [Redesigning source control at Anthropic](https://www.anthropic.com/research/redesigning-source-control), 13/10/2026 — o gargalo de infraestrutura e a escala de integração. **Não** é uma recomendação para substituir Git em projetos pequenos.
- OpenAI, [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/), 11/02/2026 — ambiente legível para agentes, código verificável e documentação como mapa.

**Atribuição:** os princípios publicados pelas empresas acima inspiraram partes da proposta. Os tiers, checks, passos de rollout e controles descritos aqui são uma elaboração independente, não um manual oficial de qualquer fornecedor.