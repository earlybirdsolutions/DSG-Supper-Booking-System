---
name: Zod form resolver compatibility
description: Why the frontend form resolver must remain compatible with the API-generated Zod major version.
---

Keep `@hookform/resolvers` on a release that supports Zod 4 whenever this workspace uses the Zod 4 catalog.

**Why:** An older resolver treated validation failures as uncaught exceptions, so a blank eligibility form opened Vite’s runtime error overlay instead of showing the inline field message.

**How to apply:** When changing Zod, React Hook Form, or the resolver, verify at least one invalid form submission in the browser as well as running TypeScript checks.