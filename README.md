# Autonomous Engineering

**Um plano aberto para construir software com agentes de IA e autonomia proporcional ao risco.**

Agentes já conseguem escrever código, executar testes e revisar pull requests. O desafio é permitir que mudanças confiáveis sejam integradas sem transformar uma pessoa no gargalo de cada entrega — e sem abrir mão de segurança, responsabilidade e capacidade de reversão.

Este repositório compartilha **o plano técnico que estou desenhando para esse problema**: classificação de risco baseada no diff real, agentes revisores independentes, evidências de CI e segurança vinculadas ao commit, permissões protegidas, integração automática progressiva e mecanismos de rollback.

A proposta é simples: **automatizar o trabalho verificável e reservar decisões humanas para mudanças cujo risco realmente exige supervisão**. O plano foi escrito para founders e times pequenos que querem aumentar a capacidade de entrega sem assumir que código produzido por IA é, por definição, seguro.

> **Estado: proposta de arquitetura, não sistema pronto.** Não há aqui um bot funcional, uma pipeline validada ou resultados de produção demonstrados. O plano precisa ser adaptado e testado antes de habilitar merges automáticos.

## A ideia em uma tabela

| Classe de mudança | Revisão humana | Integração proposta |
| --- | --- | --- |
| **T3 · baixo risco e elegível** | Nenhuma aprovação humana obrigatória | Automerge, **depois** de CI, revisão independente, segurança e demais gates |
| **T2 · risco médio** | Uma aprovação humana por padrão | Automação pode executar o merge após aprovação; exceções futuras baseadas em evidência |
| **T1 · risco alto ou governança** | Aprovação humana obrigatória, eventualmente duas pessoas | Integração assistida, nunca contornando a política de risco |

**T3 não é sinônimo de automerge.** Somente um subconjunto explicitamente autorizado de mudanças de baixo risco deve ser elegível. Toda mudança no commit invalida evidências anteriores que dependam do SHA revisado.

## Por onde começar

Leia o [plano técnico completo](./PLAN.md). Ele trata de:

1. Classificação de risco baseada no diff real.
2. Permissões, caminhos protegidos e separação entre implementador e revisor.
3. Revisão automatizada e validação de evidências.
4. Integração segura, limites de autonomia e rollback.
5. Fases de adoção, testes de aceitação e métricas.

Se você está começando, **não ative automerge imediatamente**. Comece com revisão em *shadow mode*: o sistema registra quais PRs teriam sido elegíveis, enquanto humanos continuam aprovando a integração. Só amplie a autonomia depois de validar os gates.

## Como usar este repositório

1. **Entenda os limites.** Leia a política T1/T2/T3 no [plano](./PLAN.md), compare-a com o seu produto e identifique código que nunca deve ser integrado sem aprovação.
2. **Audite o que já existe.** Confira CI, permissões de bots, proteção de branches, qualidade dos testes e rastreabilidade de revisão por SHA. Não habilite automerge para preencher lacunas desse inventário.
3. **Comece em simulação.** Registre por algumas semanas quais mudanças seriam elegíveis e confronte a decisão com o resultado das revisões.
4. **Expanda mediante evidência.** Libere primeiro categorias pequenas e reversíveis; acompanhe incidentes, reverts e tempo humano por alteração correta.

O plano inclui uma arquitetura conceitual, critérios de risco, etapas de adoção, gates e cenários de aceitação. **Não inclui um serviço instalável nem um workflow de GitHub Actions pronto para produção.**

## O que este material é — e o que não é

**É:** uma proposta operacional para founders e times pequenos adaptarem ao próprio código, stack e tolerância a risco. Os exemplos são ilustrativos, não configurações testadas nem regras universais.

**Não é:** uma ferramenta pronta para instalação, garantia de segurança, cópia do processo interno de outra empresa ou descrição de automações já em execução.

O objetivo não é maximizar PRs mergeados automaticamente. É **entregar mais alterações corretas por hora humana, sem piorar incidentes ou reverts**.

## Referências que influenciaram o plano

- [How the Claude Code team does code review](https://claude.dev/blog/solving-code-review-at-anthropic/) — Anthropic, 15/10/2026.
- [Redesigning source control at Anthropic](https://www.anthropic.com/research/redesigning-source-control) — Anthropic, 13/10/2026.
- [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/) — OpenAI, 11/02/2026.

As práticas publicadas por essas organizações servem como **referências**. Os tiers T1/T2/T3, o fluxo, os critérios e os exemplos neste repositório são **propostas de adaptação**, não descrições literais de processos internos dessas empresas.

## Licença

[MIT](./LICENSE). O conteúdo pode ser reutilizado e adaptado conforme os termos da licença.