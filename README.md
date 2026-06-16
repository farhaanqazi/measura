# Measura 🏢📏

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Status](https://img.shields.io/badge/Status-Active_Development-brightgreen)

**Measura** is a high-accuracy, cryptographically-provenanced building measurement extraction tool designed for Automated Valuation Models (AVMs) and the commercial real estate sector. 

By unifying open geospatial data, satellite imagery analysis, and strict deterministic math models, Measura generates reliable Gross External Area (GEA), Gross Internal Area (GIA), and Net Internal Area (NIA) estimates that are empirically defensible.

---

## ✨ Key Features

- 🗺️ **Geospatial Context Extraction:** Queries OpenStreetMap (Overpass API) and generates highly accurate base geometries using Turf.js.
- 🤖 **AI-Assisted Proposals:** Utilizes Anthropic's Claude 3.5 Haiku to propose missing building attributes (e.g., floor count, building type, roof shape) directly from map imagery with strict JSON schemas and 5-second heuristics fallbacks.
- 🔒 **Cryptographic Provenance:** Every single derived measurement is cryptographically hashed via SHA-256 (`generateProvenanceToken`). You can trace any derived GIA/NIA back to its raw geometric footprint and original data source version/timestamp.
- 📐 **Deterministic RICS Derivation:** Implements strict cascading area math (Footprint → GEA → GIA → NIA) driven by immutable, versioned efficiency factor tables based on building use-case.
- 📊 **Analytic Uncertainty Modeling:** Automatically computes shoelace variance and quadrature uncertainty propagation to generate realistic error bars (RMSE) based on satellite imagery Ground Sample Distance (GSD).

## 🚀 Getting Started

### Prerequisites
- Node.js v20+
- `pnpm` or `npm`
- An Anthropic API Key (for Claude 3.5 Haiku AI proposals)
- Supabase CLI (Optional, for local DB development)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/building-measure-app.git
   cd building-measure-app/web
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables:
   Create a `.env.local` file in the `/web` directory:
   ```env
   ANTHROPIC_API_KEY=your_api_key_here
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## 🧪 Testing the Accuracy Harness
Measura includes a robust testing suite containing a dataset of 77 real-world skyscrapers (such as the Burj Khalifa and Shanghai Tower) to continuously validate the mathematical pipelines against known ground-truth square footages.

To run the accuracy report:
```bash
cd web
npx tsx scripts/accuracy-report.ts
```

## 🏗 Architecture & Roadmap
We are developing the core engine in meticulously planned phases:
- **Phase 0-1:** Provenance tokens, Output Validators, and Geospatial Data Intake (✅ Complete)
- **Phase 2:** Deterministic RICS Derivations & Floor Hierarchy (✅ Complete)
- **Phase 3:** Imagery Accuracy & Uncertainty Propagation (✅ Complete)
- **Phase 4-5:** AI Layer Proposals & Machine-readable Exports (✅ Complete)
- **Upcoming:** React UI Refactoring, Ed25519 Cryptographic Signing, and Advanced Residential Sub-type Derivations (Single-family vs Multi-family penalty modeling).

*(See `/docs` and `plan.md` for full implementation details and Intake Contracts).*

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
