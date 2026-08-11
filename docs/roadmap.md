# Roadmap

- [x] Extract T113 node, macro-zone, label, and route-view placement from the main renderer.
- [x] Define a versioned topology schema and validation pipeline.
- [x] Discover multiple YAML examples without editing framework source.
- [x] Bring the enhanced T113 explorer and physical renderer onto the SceneDefinition 2.0 component registry.
- Add evidence citations and source inventory links at node and edge level.
- Add deterministic screenshot regression checks for representative cameras.
- Package reusable camera, LOD, label-layout, and causal-journey primitives.

SceneDefinition 2.0 is the only runtime path. The default T113 route and `?scene=` examples use the same enhanced renderer; new domains are added independently under `examples/<scene-id>/`.
