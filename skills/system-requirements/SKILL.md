---
name: system-requirements
description: Use to derive system requirements (an SRS slice) from a business/technical requirement (REQ-NNN) — functional requirements in EARS phrasing, non-functional requirements (performance, security, accessibility, i18n, observability, compatibility), interface/API and data requirements, and testable acceptance criteria in Gherkin. Fourth stage of the product-skills pipeline; reads product/requirements, writes product/system-requirements/SYS-NNN.md.
version: 1.0.0
user-invocable: true
argument-hint: "REQ-NNN [workspace-path]"
---

Turns a requirement into precise, testable **system requirements** the implementation and QA can build/verify against.

## Inputs / outputs
- Input: a `REQ-NNN` id. Reads `product/requirements/REQ-NNN.md` + the affected service cards from `product/system/services/`.
- Output: `product/system-requirements/SYS-NNN.md` (**same number** as the REQ).
- Template: `reference/template.md` — follow it.

## Procedure
1. **Read** the REQ and the cards of its `services`. If the id isn't found, list available REQ ids and stop.
2. **Functional requirements (EARS).** Decompose the goal into atomic, verifiable requirements. Use EARS phrasing:
   - Ubiquitous: "The <system> shall <do X>."
   - Event: "When <trigger>, the <system> shall <response>."
   - State: "While <state>, the <system> shall …"
   - Unwanted: "If <condition>, then the <system> shall <handle>."
   Each gets an id `SYS-NNN-F1, -F2, …` and names the responsible service.
3. **Non-functional requirements.** Only those that actually apply, each measurable: performance (budgets), security, accessibility (e.g. WCAG AA), i18n/l10n, observability (what must be logged/measured), reliability, compatibility. Ids `SYS-NNN-N1, …`.
4. **Interfaces & data.** API/contract changes (new/changed endpoints, request/response, error codes, event schemas), and data changes (entities/migrations, retention). Note backward-compatibility impact.
5. **Acceptance criteria (Gherkin).** For each functional requirement, ≥1 scenario:
   ```
   Scenario: <name>
     Given <context>
     When <action>
     Then <observable outcome>
   ```
   These must be runnable as the definition of done.
6. **Traceability.** Every SYS item references its REQ; the doc lists `Affected services`. Update `product/traceability.md` (`REQ-NNN → SYS-NNN`).
7. **Write** `product/system-requirements/SYS-NNN.md`. **Report** counts (F/N/scenarios). End with: **Next:** `/implementation-plan SYS-NNN`.

## Notes
- Still **what**, not **how** — but precise and testable. Implementation choices belong to the plan.
- If a functional requirement can't be made testable, that's a signal the REQ has an open question — surface it, don't paper over it.
- Keep ids stable: F/N/scenario numbering is the contract QA and the plan will reference.
