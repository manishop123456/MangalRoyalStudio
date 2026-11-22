# Phase 2 Operations & Limitations

## Current Environment & Operational Boundaries
- **Database:** Local PostgreSQL 18.6 (`mangal_royal_studio_dev`), additive migration `20261112180000_phase2_customization_and_3d_assets` applied.
- **Commercial Pricing:** All seeded metal rates, diamond rate matrix entries, and formula rules remain development placeholders until owner commercial approval.
- **Preserved Phase 1 Data:** Existing catalog prices, historical orders/payments/refunds, and `MRS-EAR-2001` inventory (`9` units) remain untouched.
- **3D Viewer Scope:** Built as a zero-dependency WebGL2 `.glb` mesh renderer with metallic lighting and photo-gallery fallback. Complex external-texture `.gltf` bundles or Draco-compressed meshes are not decoded without adding a dedicated decoder package in a networked environment.
- **Storage:** Locally managed 3D assets are stored via `LocalManagedModelStorage` (`services/api/.data/models/`) behind `ModelStorageAdapter` so S3/R2/GCS can be swapped in without route changes.
- **Live Integrations:** Shopify, Razorpay, Resend, and Shiprocket remain unconfigured/sandboxed in development.
