# Objectiv (AZO) / Objective — Model Strategy & Build Plan

| Field | Value |
|-------|--------|
| **Document** | Models, fine-tuning, schedule & budget v1.1 |
| **Date** | 2026-10-01 |
| **Product** | Objectiv (AZO) · Agent: Objective |
| **Window** | **2026-10-01 → 2026-11-25** (8-week MVP) · RL/Factory through mid-Dec |
| **Related** | `azing-agent-build-plan.pdf`, `COMPUTE-STRATEGY.md`, `MONDAY_OBJECTIVE.md`, BRD/FDD/TDD |

This file is the **model + training build plan**: *what* to do, *when*, *how*, *budget*, and *which models why*. Product shell/integrations live in `OBJECTIV_PRODUCT.md` / FDD; this doc owns **weights, fine-tuning, GPU, and gates**.

---

## 1. Short answers

| Question | Answer |
|----------|--------|
| **Serve in Objectiv today?** | **Qwen2.5-Coder-14B + SFT** (`qwen25-coder-14b-sft-w35`) on g5 vLLM (`:8000/v1`) |
| **Fine-tuning?** | **Yes** — **QLoRA SFT** now / SFT v2 in Phase 3; **RL/DPO** in Phase 4 if gates pass |
| **Pretrain from scratch?** | **No** |
| **Separate mail/Slack LLMs?** | **No** — same agent + tools |

---

## 2. Models (roles & why)

| Role | Model | Train? | Why |
|------|--------|--------|-----|
| **Primary (Objectiv daily)** | Qwen2.5-Coder-**14B** + SFT | **QLoRA SFT** (+ later RL) | Code-native; fits g5; one checkpoint for Objectiv / VS Code / `run_agent.py` |
| **Teacher (data only)** | ~**30B** Coder vLLM | No | Better rollouts → distill into 14B |
| **Escalation (Phase 2+)** | **32B** Coder or hosted API | No (MVP) | Hard replan without training 32B |
| **Vision (later)** | Qwen2.5-VL-7B | Off-the-shelf | Screenshots when needed |
| **Chat / mail / meet** | Same 14B + tools | Tool-call labels only | No multi-LLM ops tax |

**Why 14B not 70B / API-only:** budget on Spot g5, controllable trajectories, G1 harness parity, W5 SFT already proven (`W5-SFT-PILOT.md`).

---

## 3. How we fine-tune

### 3.1 SFT (Stage A) — active

| Item | Choice |
|------|--------|
| Method | **QLoRA** 4-bit + LoRA (Unsloth path) |
| Base | `Qwen2.5-Coder-14B-Instruct` |
| GPU | AWS **g5.12xlarge** Spot (train) · **g5.xlarge** serve/eval |
| Data | Objectiv/Codex accept·reject + teacher rollouts + filtered SWE · **same tool names** |
| Scripts | `scripts/aws/*sft*`, sync LoRA → S3 |
| Serve | vLLM model id e.g. `qwen25-coder-14b-sft-w35` → `agent_config.yaml` |

```
Objectiv / Codex / teacher
  → JSONL events (tools + human_label)
  → filter (quality, strip secrets)
  → SFT jsonl
  → QLoRA on g5
  → S3 checkpoint
  → vLLM → Objectiv sidecar
```

### 3.2 RL / DPO (Stage B) — after SFT v2

| Method | When | How |
|--------|------|-----|
| **DPO** | Phase 4 | Accept vs Reject pairs (code + `send_message`) |
| **RL pilot** | Phase 4 | ~50 tasks × 2 rollouts; reward = CI/tests and/or human accept |
| GPU | Account B | `g5.2xlarge` policy + `c6i.4xlarge` Docker workers |

**Promote only if** internal 20 + holdout + SWE subset do not collapse (G3 → G4).

---

## 4. Build plan — what / when / how (model track)

Aligned to Monday board **5031649578** and `azing-agent-build-plan.md`.

| Phase | Dates (target) | What (models) | How | Gate |
|-------|----------------|---------------|-----|------|
| **0 Harness** | Done (≤ 2026-10-14) | Wire `agent_config` → 14B-SFT serve | Sidecar + G1 offline | G1 offline **PASS** |
| **1 Pilot** | **Now → 2026-10-28** | Keep **w35** served; collect ≥20 labeled tasks (code + message) | Objectiv daily + export → S3 | Usable daily; labeled export |
| **2 Router + tools** | → 2026-11-11 | Optional **32B/hosted** escalate; research tools (no new weights) | Thin router in sidecar | Code + research demo |
| **3 Data + SFT v2** | → **2026-11-25** | Train **SFT v2** on unified trajectories | QLoRA g5.12xlarge; merge → vLLM | **G3:** beats base on internal 20 |
| **4 RL + launch** | → **2026-12-05** | DPO/RL pilot; promote or hold | Account B fleet | **G4:** wider internal GO |
| **5 Factory** | → 2026-12-19 | Scheduled agents use **same** promoted checkpoint | Manifest + sandbox | One published agent |

### Week-by-week (model + data) — 8-week MVP core

| Week | Calendar (approx) | Do this | How |
|------|-------------------|---------|-----|
| **1–2** | Early Oct | G1 + serve 14B-SFT; Objectiv approve loop | Tunnel `:8000`; sidecar `:8787` |
| **3** | ~Oct 8–14 | Pilot labeling starts; chat tools in mix | Export labeled sessions |
| **4** | → Oct 28 | ≥20 tasks; mail labels if ready | S3 raw + labeled paths |
| **5** | → Nov 11 | Teacher burst if data thin; router stub | g5.12xlarge teacher Spot |
| **6** | → Nov 18 | **SFT v2 train** | `open-*-sft-iterm` / g5 QLoRA; checkpoint S3 |
| **7** | → Nov 25 | Eval SFT v2 vs base; holdout | `run_agent.py` + same config |
| **8** | → Dec 5 | RL/DPO pilot **or** freeze SFT v2 for launch | Promote only on G3/G4 |

---

## 5. Budget & timelines

### 5.1 Two budget views (both valid)

| View | Total | Scope |
|------|-------|--------|
| **Monday Objective MVP envelope** | **~$5,200** | Phase line items Oct–Dec (product + GPU slice for this board) |
| **coding-agent compute strategy** | **~$10,000** | Full teacher + SFT + RL across 2 AWS accounts (credits) |

Use **Monday envelopes** for product-phase tracking; use **$10K compute** for GPU capacity planning. Do not double-count the same Spot hours in both when reporting spend.

### 5.2 Monday phase envelopes (USD)

| Phase | Due | Envelope | Model-related spend |
|-------|-----|----------|---------------------|
| 0 Harness | 2026-10-14 | $0 | Config only |
| 1 Pilot | 2026-10-28 | $350 | g5 serve / tunnel hours |
| 2 Research & media | 2026-11-11 | $450 | Light GPU + API tools |
| **3 Data + SFT v2** | **2026-11-25** | **$2,500** | **Main QLoRA + teacher top-up** |
| **4 RL + launch** | **2026-12-05** | **$1,200** | RL/DPO pilot |
| 5 Agent Factory | 2026-12-19 | $500 | Eval / serve |
| Governance | 2026-11-25 | $200 | Docs |
| **Total** | | **$5,200** | |

### 5.3 AWS compute strategy (model GPU — Account A/B)

**Account A (~$4,000)** — teacher + SFT + serve/eval  

| Work | Budget | Instance | Notes |
|------|--------|----------|-------|
| Teacher trajectories | ~$1,500 | g5.12xlarge Spot | ~750 hr class |
| **SFT QLoRA 14B** | **~$1,200** | g5.12xlarge Spot | ~600 hr / 80–120 dense GPU-hr bursts |
| Baseline / eval bursts | ~$700 | g5.xlarge / 12xlarge | Incl. buffer |
| Setup / S3 / CPU | ~$100 | c6i / S3 | |

**Account B (~$4,000)** — RL  

| Work | Budget | Instance |
|------|--------|----------|
| RL Docker CPU | ~$2,400 | 8–12× c6i.4xlarge Spot |
| RL policy GPU | ~$800 | g5.2xlarge |
| RL eval + buffer | ~$800 | |

**Contingency ~$2,000** — Spot spikes / extra teacher / extended RL.

### 5.4 Spot rates (planning, us-east-1 approx.)

| Instance | $/hr Spot | Use |
|----------|-----------|-----|
| g5.xlarge | $0.30–0.46 | Serve / eval |
| g5.2xlarge | $0.60–0.90 | RL policy |
| g5.12xlarge | $1.70–2.00 | Teacher + SFT |
| c6i.4xlarge | $0.10–0.15 | RL workers |

### 5.5 Cost controls

1. Spot only for GPU/RL CPU.  
2. Checkpoint to S3 ≥ every 30 min during SFT/RL.  
3. Stop-when-idle on serve/harness.  
4. Teacher on only when generating batches — not 24/7 unless needed.  
5. Mac Mini = orchestrator/cache only — **no** 14B full SFT on Mac.

---

## 6. Serving topology (how Objectiv gets the model)

| Layer | Detail |
|-------|--------|
| Weights | S3 `sft/` + local/EC2 cache |
| Inference | vLLM OpenAI API on g5 |
| Dev access | SSH tunnel → `127.0.0.1:8000/v1` |
| Config | `agent_config.yaml` → `qwen25-coder-14b-sft-*` |
| Clients | Objectiv sidecar, VS Code extension, `run_agent.py` |

---

## 7. Gates (model promotion)

| Gate | When | Criteria |
|------|------|----------|
| **G1** | Phase 0/1 | Same tools Objectiv ↔ `run_agent.py` (offline Done; LLM when `:8000` up) |
| **Pilot** | Phase 1 | ≥20 labeled tasks; daily usable |
| **G3** | Phase 3 | SFT v2 > base instruct on internal 20; holdout OK |
| **G4** | Phase 4 | RL/DPO or freeze SFT v2 → wider internal GO |

---

## 8. Immediate next actions (model track)

1. Keep **w35** served; fix tunnel if `:8000` down.  
2. Run Objectiv pilot → **≥20 labeled** code (+ message) → S3.  
3. Schedule **teacher burst** only if filtered set too small for SFT v2.  
4. **Week 6 window:** SFT v2 QLoRA on g5.12xlarge; promote under G3.  
5. Do **not** start RL until G3 passes.

---

## 9. Decision log

1. Daily model = **fine-tuned 14B**, not raw instruct / not 30B-in-IDE.  
2. Fine-tune = **QLoRA SFT first**, RL second.  
3. Teacher = **data**; student = **UX**.  
4. One harness → one model id everywhere.  
5. Budgets: track Monday **$5.2K** phases + AWS **$10K** compute plan without double-booking hours.

---

## 10. References

- `azing-agent-build-plan.md` / `.pdf` — product phases  
- `COMPUTE-STRATEGY.md` — $10K AWS split  
- `MONDAY_OBJECTIVE.md` — board dates & $5.2K envelopes  
- `W5-SFT-PILOT.md` — first QLoRA numbers  
- `azing-codex/configs/agent_config.yaml`  

---

*Internal — A-Zing. Objectiv (AZO) / Objective. Models build plan v1.1 — 2026-10-01.*
