# NVMe Bitmap reference inventory

This example demonstrates a structurally different scene: Host Linux retains NVMe ownership while a Bitmap-controlled SPU/FPGA data path may transparently process payload for registered DMA/IOVA pages.

Public evidence boundaries:

- Linux NVMe and DMA lifecycle concepts are represented as source-proven software responsibilities.
- Registration-before-doorbell and release-before-unmap are modeled ordering requirements.
- Exact FPGA page matching, cryptographic transformation, and forwarding behavior remain `INFERRED` until RTL or runtime evidence is attached.
- The example does not claim that the SPU owns or virtualizes the NVMe controller.
- No production addresses, device identities, credentials, proprietary source, bitstreams, or runtime logs are included.
