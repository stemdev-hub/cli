# 0003. Clarify axiom 4: model vs package

Status: accepted

## Context

Axiom 4 says views/rendering are out of core scope. ADR-0001 puts the renderer
in the `@stemdev/core` package. The word "core" meant two things.

## Decision

Axiom 4 concerns the data model: Block and Tag know nothing about views or
rendering. The renderer is layered on top of the model and may ship in the same
package. "Core model" means the model; `@stemdev/core` is a package name.

## Rejected

- A separate render package: no independent consumer (see ADR-0001).

## Consequences

Axiom 4 is reworded; meaning unchanged.
