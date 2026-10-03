# Axioms

Human-owned. Budget: 10 lines. Changing one requires a superseding ADR.

1. The core model is two primitives: **Block** and **Tag**. Any new construct must do a job neither can.
2. Everything is a block. Blocks nest recursively. Section is not a primitive.
3. Tag is the only classification mechanism.
4. Views/rendering are layered on top of the Block/Tag model, never part of it.
5. Git-native plain Markdown. No external store.
6. Simplicity over completeness. Default answer to a new construct is "do we need this?"
7. Hard edges (transclusion) and soft edges (dependency) are distinct types.
8. Parse-time data (positions) never enters the persisted cache.
9. Document decisions and architecture by hand; generate implementation docs.
10. Beta: no migration compatibility. Change in place.
