# Project Runner Context

## Project Context
How this project is built — stack, architecture, module boundaries, conventions — is
documented in `docs/dev/PROJECT.md`. Before writing or changing code, first read
`docs/dev/PROJECT.md` to understand the stack, the architecture and its module
boundaries, and which patterns are canonical here; follow them instead of introducing
new ones. Its §9 Always/Never rules are binding: if a task seems to require breaking one,
ask — do not break it silently, and do not silently follow a rule that no longer fits.
`PROJECT.md` is machine-written — do not hand-edit it. If something you need is not
covered there, ask.

## Business Context
What the product does, who uses it, and what its capabilities mean is documented in
`docs/dev/BUSINESS.md`. Before adding or changing product behavior, features, or
user-facing flows, first read `docs/dev/BUSINESS.md` to understand the product, its
users and roles, and the business meaning of the entities involved; do not invent
product purpose or scenarios. If something you need is not covered there, ask.

## Design System
The project's design system is documented in `docs/dev/DESIGN.md`. Before creating
or changing any markup, component, or styles, first read `docs/dev/DESIGN.md` and
take values (color, spacing, radius, shadow, typography) and components from there;
do not invent design values. If the system lacks what you need, ask or propose the
nearest system value. Avoid generic "AI slop": no gradient text, no cards-in-cards,
not everything-centered, no default Inter with no intent — follow the system's own patterns.
When asked to fix or refactor one component/surface, change only that surface — do not
restyle its siblings or broaden into a refactor.
