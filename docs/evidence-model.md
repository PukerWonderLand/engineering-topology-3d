# Evidence model

Facts carry an explicit evidence level:

- `CODE_PROVEN`: directly supported by source code.
- `RTL_PROVEN`: supported by RTL or a hardware register contract.
- `RUNTIME_OBSERVED`: observed in logs, traces, or a controlled run.
- `INFERRED`: a current hypothesis or target architecture.

One level never silently upgrades another. A static diagram cannot prove that a device is currently online, and software simulation cannot prove a physical PCIe, USB, JTAG, FPGA, or flash path. Reference data should cite a sanitized source inventory and state unresolved boundaries next to the affected journey.
