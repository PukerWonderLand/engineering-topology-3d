# T113 ARM-XVC reference inventory

The public example was derived from a sanitized engineering review containing architecture notes, an evidence manifest, controlled validation results, and implementation-level service observations. The original operational materials are intentionally not published here.

Public modeling conclusions:

- T113 is an ARM XVC edge gateway, not the Vivado/ProCISE desktop host.
- Each physical JTAG path is an independent failure domain with its own process, lock, runtime state, and health check.
- The powered USB hub is a physical topology entity.
- The KU15P route is modeled as runtime-observed; the 690T route remains an explicit target/inference.
- XVC has no authentication or encryption and belongs inside a trusted or protected network boundary.
