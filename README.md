# AM Cost Calculator

A full-stack web application for estimating the cost of **Laser Powder Bed Fusion (LPBF / SLM)** metal additive manufacturing. Built on an MIT-derived cost model, it walks users through a step-by-step wizard to configure the part, machine, material, and process parameters, then delivers a detailed cost breakdown with charts, quantity curves, and AI-powered insights.

> **Shared team website:** the app can be deployed to Vercel with a Supabase database and sign-in — see **[DEPLOY.md](DEPLOY.md)**. The instructions below are for running it locally.

---

## Features

- **5-step analysis wizard** — Part → Machine → Material → Process → Results
- **STL file upload & 3D viewer** — Automatic geometry extraction (volume, height, projected area, bounding box, overhang analysis), computed in the browser so part files are never uploaded
- **Dynamic overhang/support estimation** — Interactive angle slider updates support % proportionally
- **Material-driven build rate** — Layer thickness (µm) and build rate (cm³/hr) defined per material, not machine
- **Multi-laser configuration** — For machines with multiple lasers, choose single / multi-laser per part / parallel zones strategy; live effective build rate preview
- **Machine comparison** — Select up to 3 machines to compare side-by-side cost breakdown in Results
- **Detailed cost breakdown** — Material, machine, labor, consumables, build prep, post-process (support removal), and Metal AM extensions (heat treatment, HIP, part separation, surface treatment, NDT)
- **Cost vs. quantity curve** — Log-scale chart showing how cost per part scales with production volume
- **AI Insights** — Claude-powered DfAM recommendations, AM vs. conventional comparison, cost reduction opportunities (requires Anthropic API key)
- **Export** — Save as project, download as Excel or PDF
- **Machine & Material database** — Full CRUD with duplicate support; pre-seeded with 7 real LPBF machines and 12 metal AM materials

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| 3D Viewer | React Three Fiber, Three.js, @react-three/drei |
| Charts | Recharts |
| Backend | FastAPI, Python 3.11+ |
| Database | SQLite (local) or Supabase Postgres (shared), via SQLAlchemy |
| Sign-in | Supabase Auth (shared deployment only) |
| STL parsing | TypeScript in a Web Worker (in the browser) |
| AI | Anthropic Claude API |
| Export | openpyxl (Excel), ReportLab (PDF) |

---

## Prerequisites

- **Python 3.11+**
- **Node.js 18+** and npm
- (Optional) An [Anthropic API key](https://console.anthropic.com/) for AI insights

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/chinmayphutela95-spec/AMCostCalculator.git
cd AMCostCalculator
```

### 2. Backend setup

```bash
cd backend

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# (Optional) Set your Anthropic API key for AI insights
export ANTHROPIC_API_KEY="sk-ant-..."   # macOS / Linux
# set ANTHROPIC_API_KEY=sk-ant-...      # Windows

# Seed the database with machines and materials
python3 seed_data.py

# Start the API server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`
Interactive API docs: `http://localhost:8000/docs`

### 3. Frontend setup

Open a **new terminal tab**:

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`

---

## One-command start (macOS)

A convenience script starts both servers together:

```bash
chmod +x start.sh
./start.sh
```

> **Note:** The script uses `/opt/homebrew/bin/node` (Apple Silicon default). Edit `start.sh` if your Node.js is in a different path (`which node` to check).

---

## Environment Variables

Create a `.env` file in the `backend/` directory (optional):

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Without this key, the AI Insights section will show an error but all cost calculations work normally. See `backend/.env.example` for the optional Supabase settings used by the shared deployment.

---

## Project Structure

```
AMCostCalculator/
├── backend/
│   ├── main.py               # FastAPI app, all API routes
│   ├── models.py             # SQLAlchemy ORM models (Machine, Material, Project)
│   ├── cost_calculator.py    # Core cost calculation engine (MIT model)
│   ├── auth.py               # Supabase sign-in check, admin role
│   ├── ai_insights.py        # Claude API integration for DfAM insights
│   ├── export_service.py     # Excel / PDF export
│   ├── database.py           # DB session setup
│   ├── seed_data.py          # Pre-seeded machines & materials
│   ├── migrate_to_supabase.py # One-time copy of the local database to Supabase
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── analysis/
│       │   │   ├── AnalysisWizard.tsx    # Main 5-step wizard
│       │   │   └── steps/
│       │   │       ├── PartStep.tsx      # STL upload + manual part params
│       │   │       ├── MachineStep.tsx   # Machine selection + comparison
│       │   │       ├── MaterialStep.tsx  # Material selection
│       │   │       ├── ProcessStep.tsx   # Process params + multi-laser config
│       │   │       └── ResultsStep.tsx   # Cost results + charts + AI
│       │   ├── Machines.tsx              # Machine database CRUD
│       │   ├── Materials.tsx             # Material database CRUD
│       │   ├── History.tsx               # Saved projects
│       │   └── Dashboard.tsx
│       ├── lib/
│       │   ├── api.ts                    # Axios API client
│       │   ├── auth.tsx / supabase.ts    # Sign-in (shared deployment)
│       │   └── geometry/                 # STL parsing, overhang detection, support estimation
│       │   └── utils.ts
│       └── types/
│           └── index.ts                  # TypeScript interfaces
├── supabase/schema.sql                   # Database schema for the shared deployment
├── vercel.json                           # Vercel deployment config
├── start.sh                              # One-command launcher (macOS)
├── DEPLOY.md
└── README.md
```

---

## Cost Model

Based on the **MIT Metal AM Cost Model** (Srivatsan & Sudarshan framework). Cost categories:

| Category | What's included |
|----------|----------------|
| **Material** | Part mass + support mass + powder waste, minus recycled powder |
| **Machine** | Annualized depreciation + maintenance, prorated by machine hours used |
| **Build Prep** | Engineer time × salary (first build + subsequent builds) |
| **Consumables** | Inert gas ($/hr × active build time) + per-build consumables |
| **Labor** | Operator supervision during build + build exchange FTE |
| **Post-Process** | Support removal time `t = c × √(projected_area)` × technician salary |
| **Metal AM Extensions** | Heat treatment, HIP, part separation, surface treatment, NDT (optional) |

### Multi-laser calculation

```
effective_build_rate = material_build_rate × laser_multiplier
total_print_time     = production_run × part_volume / effective_build_rate
```

`laser_multiplier` is 1 for single-laser or equals the number of engaged lasers for multi-laser strategies.

---

## Pre-seeded Data

### Machines
| Machine | Build Volume | Lasers |
|---------|-------------|--------|
| EOS M100 | ⌀100×95mm | 1 |
| EOS M290 | 250×250×325mm | 1 |
| EOS M400-4 | 400×400×400mm | 4 |
| Aconity Midi+ (Steel) | ⌀170×400mm | 1 |
| Aconity Midi+ (Al) | ⌀170×400mm | 1 |
| Renishaw RenAM 500Q | 250×250×350mm | 4 |
| SLM 280 | 280×280×365mm | 2 |

### Materials
316L SS, 17-4PH, Maraging Steel, Ti-6Al-4V ELI, Ti-6Al-4V Grade 5, AlSi10Mg, AlSi12, IN718, IN625, Hastelloy X, CoCrMo, GRCop-84

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/me` | Signed-in user, admin flag, server capabilities |
| GET | `/api/machines` | List all machines |
| POST | `/api/machines` | Create machine |
| PUT | `/api/machines/{id}` | Update machine |
| DELETE | `/api/machines/{id}` | Delete machine |
| GET | `/api/materials` | List all materials |
| POST | `/api/materials` | Create material |
| PUT | `/api/materials/{id}` | Update material |
| DELETE | `/api/materials/{id}` | Delete material |
| POST | `/api/analysis/calculate` | Run cost calculation |
| POST | `/api/ai/analyze` | Get AI insights (requires API key) |
| GET | `/api/projects` | List saved projects |
| POST | `/api/projects` | Save project |
| POST | `/api/export` | Export to Excel/PDF |

Full interactive docs at `http://localhost:8000/docs`

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.
