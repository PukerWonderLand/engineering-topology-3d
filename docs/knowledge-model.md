# Knowledge model

The model uses four causal layers:

1. **Payload and ownership** — data production, transformation, transfer, and consumption.
2. **Control execution** — calls, threads, syscalls, probe, remove, and return.
3. **Synchronization and completion** — locks, waits, wakeups, IRQ, retry, and timeout.
4. **Lifecycle and rollback** — allocation, mapping, initialization, release, and reverse-order cleanup.

A function station is useful only when it records six interfaces: trigger, execution context, consumed data, produced data, state/resources, and completion/error behavior. Journeys select a causal subset so the scene does not become an unreadable all-path graph.
