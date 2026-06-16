import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

export const Route = createFileRoute("/")({
  component: ImpactBridgeApp,
});

// ─────────────────────────────────────────────────────────────────────
// Types & shared state
// ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | "dashboard" | "model" | "prm";
type Toast = { id: number; kind: "success" | "warning" | "info"; text: string };

type LcaData = {
  productName: string;
  category: string;
  boundary: "cradle-to-gate" | "cradle-to-grave" | "gate-to-grave";
  goals: string[];
  dataResponses: { procurement: boolean; design: boolean; operations: boolean; logistics: boolean };
  selectedPlay: string | null;
  selectedArtifact: "rfp" | "letter" | "brief";
  artifactGenerated: boolean;
  completed: boolean;
};

const STEP_LABELS = ["Intake", "Data", "AI Fill", "Footprint", "Actions", "Scenario", "Assign"];

const TABS: { id: Step; label: string }[] = [
  { id: 1, label: "Intake" },
  { id: "prm", label: "PRM" },
  { id: 2, label: "Data" },
  { id: 3, label: "AI Fill" },
  { id: "model", label: "Model" },
  { id: 4, label: "Footprint" },
  { id: 5, label: "Actions" },
  { id: 6, label: "Scenario" },
  { id: 7, label: "Assign" },
];

// ─────────────────────────────────────────────────────────────────────
// Icons (inline SVG)
// ─────────────────────────────────────────────────────────────────────

const I = {
  check: (p?: { size?: number }) => (
    <svg width={p?.size ?? 14} height={p?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  ),
  arrow: () => <span style={{ fontSize: 14 }}>→</span>,
  factory: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 20h20V10l-6 4V10l-6 4V4H2v16z"/></svg>,
  cycle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"/></svg>,
  truck: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="6" width="14" height="11" rx="1"/><path d="M15 9h4l3 4v4h-7z"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg>,
  box: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/></svg>,
  pencil: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>,
  doc: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  envelope: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>,
  team: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  star: () => <span style={{ color: "#D4892A" }}>★</span>,
  chevron: () => <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>▾</span>,
};

// ─────────────────────────────────────────────────────────────────────
// Main App Shell
// ─────────────────────────────────────────────────────────────────────

function ImpactBridgeApp() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [lcaData, setLcaData] = useState<LcaData>({
    productName: "Recycled Tote Bag",
    category: "Apparel & Textiles",
    boundary: "cradle-to-gate",
    goals: ["Reduce carbon footprint", "Cut material costs"],
    dataResponses: { procurement: true, design: true, operations: false, logistics: false },
    selectedPlay: null,
    selectedArtifact: "rfp",
    artifactGenerated: false,
    completed: false,
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  function pushToast(text: string, kind: Toast["kind"] = "success") {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }

  function go(step: Step) {
    setCurrentStep(step);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  const showTabs = currentStep !== "dashboard";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* TOP BAR */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "var(--topbar-height)",
        background: "white", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => go("dashboard")} style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>
            ImpactBridge
          </button>
          <span style={{ width: 1, height: 18, background: "var(--border-solid)" }} />
          <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{lcaData.productName}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {currentStep !== "dashboard" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-tertiary)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green-mid)" }} />
              All changes saved · 2 min ago
            </div>
          )}
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: "var(--green-dark)",
            color: "white", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 600,
          }}>AJ</div>
        </div>
      </header>

      {/* SIDEBAR */}
      <aside style={{
        position: "fixed", top: "var(--topbar-height)", left: 0, bottom: 0,
        width: "var(--sidebar-width)", background: "var(--gray-section)",
        borderRight: "1px solid var(--border)", padding: 20,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}>
        <div>
          <div className="label" style={{ marginBottom: 12 }}>My LCAs</div>
          <button
            onClick={() => go(typeof currentStep === "number" ? currentStep : 1)}
            style={{
              width: "100%", textAlign: "left", padding: "10px 12px",
              borderRadius: 8, fontSize: 14, fontWeight: 500,
              background: "white", borderLeft: "3px solid var(--green-dark)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span>{lcaData.productName}</span>
            {lcaData.completed && <span style={{ color: "var(--green-dark)" }}><I.check size={14} /></span>}
          </button>
          <button
            onClick={() => { setLcaData((d) => ({ ...d, artifactGenerated: false, selectedPlay: null })); go(1); }}
            style={{
              width: "100%", textAlign: "left", padding: "10px 12px",
              borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: "1px dashed var(--green-border)", color: "var(--green-dark)",
            }}
          >+ New LCA</button>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <button onClick={() => go("dashboard")} style={{
            width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8,
            fontSize: 14, color: currentStep === "dashboard" ? "var(--green-dark)" : "var(--text-primary)",
            fontWeight: currentStep === "dashboard" ? 500 : 400,
          }}>Dashboard</button>
          <button style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, fontSize: 14 }}>Settings</button>
          <div style={{ marginTop: 16, padding: "8px 12px" }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Alex Johnson</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Sourcing Lead</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{
        marginLeft: "var(--sidebar-width)", paddingTop: "var(--topbar-height)",
        minHeight: "100vh",
      }}>
        {showTabs && <TabBar current={currentStep} go={go} />}
        <div className="fade-in" key={String(currentStep)}>
          {currentStep === 1 && <Step1 lcaData={lcaData} setLcaData={setLcaData} go={go} />}
          {currentStep === "prm" && <StepPRM lcaData={lcaData} go={go} pushToast={pushToast} />}
          {currentStep === 2 && <Step2 lcaData={lcaData} go={go} pushToast={pushToast} />}
          {currentStep === 3 && <Step3 go={go} />}
          {currentStep === "model" && <StepModel go={go} />}
          {currentStep === 4 && <Step4 go={go} />}
          {currentStep === 5 && <Step5 setLcaData={setLcaData} go={go} pushToast={pushToast} />}
          {currentStep === 6 && <Step6 setLcaData={setLcaData} go={go} pushToast={pushToast} />}
          {currentStep === 7 && <Step7 lcaData={lcaData} setLcaData={setLcaData} go={go} pushToast={pushToast} />}
          {currentStep === "dashboard" && <Dashboard go={go} />}
        </div>
      </main>

      {/* TOASTS */}
      <div style={{ position: "fixed", bottom: 16, right: 16, display: "flex", flexDirection: "column", gap: 8, zIndex: 100 }}>
        {toasts.map((t) => (
          <div key={t.id} className="slide-in" style={{
            background: "white", border: "1px solid var(--border)", borderRadius: 10,
            padding: "12px 16px", fontSize: 14, maxWidth: 280,
            boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{
              color: t.kind === "success" ? "var(--green-dark)" : t.kind === "warning" ? "var(--amber)" : "var(--blue)",
              fontWeight: 600,
            }}>{t.kind === "success" ? "✓" : t.kind === "warning" ? "⚠" : "ℹ"}</span>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────


function TabBar({ current, go }: { current: Step; go: (s: Step) => void }) {
  return (
    <div style={{
      position: "sticky", top: "var(--topbar-height)", zIndex: 40,
      background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)",
      borderBottom: "1px solid var(--border)",
      padding: "0 40px",
    }}>
      <div style={{ display: "flex", gap: 2, overflowX: "auto", minHeight: 48, alignItems: "stretch" }}>
        {TABS.map((t) => {
          const active = t.id === current;
          return (
            <button
              key={String(t.id)}
              onClick={() => go(t.id)}
              style={{
                position: "relative", padding: "0 16px",
                fontSize: 13, fontWeight: active ? 600 : 500,
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                whiteSpace: "nowrap", transition: "color 160ms ease",
                display: "flex", alignItems: "center", gap: 8,
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: active ? "var(--green-dark)" : "var(--border-solid)",
              }} />
              {t.label}
              {active && (
                <span style={{
                  position: "absolute", left: 8, right: 8, bottom: -1,
                  height: 2, background: "var(--green-dark)", borderRadius: 2,
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}



function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="label" style={{ marginBottom: 12 }}>{children}</div>;
}

function BackBtn({ go, to }: { go: (s: Step) => void; to: Step }) {
  return (
    <button onClick={() => go(to)} className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }}>
      ← Back
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STEP 1 — INTAKE
// ─────────────────────────────────────────────────────────────────────

function Step1({ lcaData, setLcaData, go }: { lcaData: LcaData; setLcaData: (f: (d: LcaData) => LcaData) => void; go: (s: Step) => void }) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categories = ["Apparel & Textiles", "Footwear", "Packaging", "Electronics", "Food & Beverage", "Furniture", "Industrial", "Other"];
  const boundaries = [
    { id: "cradle-to-gate", title: "Cradle to Gate", icon: <I.factory />, desc: "Raw materials through manufacturing. Common for B2B suppliers." },
    { id: "cradle-to-grave", title: "Cradle to Grave", icon: <I.cycle />, desc: "Full lifecycle including consumer use and disposal. Required for EPDs." },
    { id: "gate-to-grave", title: "Gate to Grave", icon: <I.truck />, desc: "From your facility to end of life. For distribution and retail focus." },
  ];
  const goals = ["Reduce carbon footprint", "Cut material costs", "Meet supplier compliance requirements", "Prepare for CSRD reporting"];

  function toggleGoal(g: string) {
    setLcaData((d) => {
      const has = d.goals.includes(g);
      let next = has ? d.goals.filter((x) => x !== g) : [...d.goals, g];
      if (next.length > 2) next = next.slice(-2);
      return { ...d, goals: next };
    });
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>
      
      <div className="card">
        <Eyebrow>Step 1 of 7 — LCA Intake</Eyebrow>
        <h1 className="page-title" style={{ marginBottom: 10 }}>Tell us about your product.</h1>
        <p className="body-text" style={{ marginBottom: 32 }}>
          Answer 4 plain-language questions. No LCA expertise needed — the platform handles the technical configuration.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* F1 */}
          <div>
            <label className="label" style={{ display: "block", marginBottom: 8 }}>Product name</label>
            <input
              className="input"
              value={lcaData.productName}
              onChange={(e) => setLcaData((d) => ({ ...d, productName: e.target.value }))}
              placeholder="e.g. Organic cotton tote bag, Running shoe, Cardboard packaging"
            />
          </div>

          {/* F2 */}
          <div style={{ position: "relative" }}>
            <label className="label" style={{ display: "block", marginBottom: 8 }}>Product category</label>
            <button
              type="button"
              className="input"
              onClick={() => setCategoryOpen((o) => !o)}
              style={{ textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <span>{lcaData.category}</span>
              <I.chevron />
            </button>
            {categoryOpen && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                background: "white", border: "1px solid var(--border-solid)", borderRadius: 10,
                boxShadow: "0 4px 20px rgba(0,0,0,0.07)", zIndex: 20, overflow: "hidden",
              }}>
                {categories.map((c) => (
                  <button key={c} type="button"
                    onClick={() => { setLcaData((d) => ({ ...d, category: c })); setCategoryOpen(false); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left", padding: "10px 14px",
                      fontSize: 14, background: c === lcaData.category ? "var(--green-light)" : "transparent",
                    }}
                  >{c}</button>
                ))}
              </div>
            )}
            <div style={{ marginTop: 8, padding: "10px 14px", background: "var(--gray-section)", borderRadius: 8, fontSize: 13, color: "var(--text-secondary)" }}>
              We'll apply PEFCR-aligned methodology and EPA USEEIO emission factors for this category.
            </div>
          </div>

          {/* F3 */}
          <div>
            <label className="label" style={{ display: "block", marginBottom: 10 }}>Lifecycle boundary</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {boundaries.map((b) => {
                const sel = lcaData.boundary === b.id;
                return (
                  <button key={b.id} type="button"
                    onClick={() => setLcaData((d) => ({ ...d, boundary: b.id as LcaData["boundary"] }))}
                    style={{
                      textAlign: "left", padding: 14, borderRadius: 12,
                      border: sel ? "2px solid var(--green-dark)" : "1px solid var(--border-solid)",
                      background: sel ? "var(--green-light)" : "white",
                      transition: "all 180ms ease",
                    }}
                  >
                    <div style={{ color: "var(--green-dark)", marginBottom: 8 }}>{b.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{b.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>{b.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* F4 */}
          <div>
            <label className="label" style={{ display: "block", marginBottom: 10 }}>Primary goal (pick 1–2)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {goals.map((g) => {
                const sel = lcaData.goals.includes(g);
                return (
                  <button key={g} type="button" onClick={() => toggleGoal(g)}
                    style={{
                      padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                      border: "1px solid " + (sel ? "var(--green-dark)" : "var(--border-solid)"),
                      background: sel ? "var(--green-dark)" : "white",
                      color: sel ? "white" : "var(--text-primary)",
                    }}
                  >{g}</button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{
          marginTop: 28, padding: 16, background: "var(--green-light)",
          border: "1px solid var(--green-border)", borderRadius: 12, fontSize: 14, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>Based on your inputs, ImpactBridge will:</div>
          <div>· Set your functional unit to 1 unit of {lcaData.productName}</div>
          <div>· Apply {lcaData.boundary.replace(/-/g, " ")} system boundary</div>
          <div>· Use EPA USEEIO {lcaData.category} emission factors</div>
          <div>· Send data requests to 4 teams</div>
        </div>

        <button onClick={() => go("prm")} className="btn btn-primary" style={{ width: "100%", marginTop: 24, padding: "14px" }}>
          Connect PRM & start LCA →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STEP 2 — DATA COLLECTION
// ─────────────────────────────────────────────────────────────────────

const REQUESTS = [
  { id: "procurement", icon: <I.box />, title: "Procurement", body: "Supplier list, material composition, and unit costs", who: "Maria Chen · Head of Procurement", sent: "June 13, 2026 at 9:04am", received: "June 13, 2026 at 2:31pm", status: "done" as const },
  { id: "design", icon: <I.pencil />, title: "Design & R&D", body: "Bill of materials, material weights, product dimensions", who: "James Park · Senior Product Designer", sent: "June 13, 2026 at 9:04am", received: "June 14, 2026 at 10:17am", status: "done" as const },
  { id: "operations", icon: <I.factory />, title: "Operations", body: "Manufacturing energy consumption, facility location, process steps", who: "Sarah Williams · VP Operations", sent: "June 13, 2026 at 9:04am", received: "—", status: "pending" as const },
  { id: "logistics", icon: <I.truck />, title: "Logistics", body: "Transport distances, shipping methods, warehouse locations", who: "David Kim · Logistics Manager", sent: "June 13, 2026 at 9:04am", received: "—", status: "pending" as const },
];

function Step2({ lcaData, go, pushToast }: { lcaData: LcaData; go: (s: Step) => void; pushToast: (t: string, k?: Toast["kind"]) => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const done = Object.values(lcaData.dataResponses).filter(Boolean).length;

  return (
    <div style={{ padding: 40 }}>
      <BackBtn go={go} to="prm" />
      <Eyebrow>Step 2 of 7 — Data Collection</Eyebrow>
      <h1 className="page-title" style={{ marginBottom: 10 }}>Requests sent to 4 teams.</h1>
      <p className="body-text" style={{ maxWidth: 720, marginBottom: 32 }}>
        ImpactBridge identified who owns each data point and sent them focused request forms. No spreadsheets. No email chains.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 1100 }}>
        {REQUESTS.map((r) => (
          <div key={r.id} className="card card-hover">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ color: "var(--text-secondary)" }}>{r.icon}</div>
                <div className="card-title">{r.title}</div>
              </div>
              {r.status === "done"
                ? <span className="chip chip-green">Completed</span>
                : <span className="chip chip-amber">Awaiting response</span>}
            </div>
            <div className="body-text" style={{ fontSize: 14, marginBottom: 16 }}>{r.body}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", flexDirection: "column", gap: 4 }}>
              <div><span className="label" style={{ marginRight: 6 }}>Owner</span> {r.who}</div>
              <div><span className="label" style={{ marginRight: 6 }}>Sent</span> {r.sent}</div>
              <div><span className="label" style={{ marginRight: 6 }}>Received</span> {r.received}</div>
            </div>
            <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              {r.status === "done" ? (
                <button onClick={() => r.id === "procurement" ? setModalOpen(true) : pushToast(`Opened ${r.title} response`, "info")}
                  className="btn btn-outline btn-sm" style={{ color: "var(--green-dark)", borderColor: "var(--green-border)" }}>
                  View response →
                </button>
              ) : (
                <button onClick={() => pushToast(`Reminder sent to ${r.who.split(" · ")[0]}`, "info")}
                  className="btn btn-outline btn-sm" style={{ color: "var(--amber)", borderColor: "var(--amber-border)" }}>
                  Send reminder →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 1100, marginTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>{done} of 4 responses received</span>
          <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{Math.round((done / 4) * 100)}%</span>
        </div>
        <div style={{ height: 6, background: "var(--border-solid)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${(done / 4) * 100}%`, height: "100%", background: "var(--green-dark)", transition: "width 400ms ease" }} />
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-secondary)" }}>
          The platform will continue to the next step using available data. Missing inputs will be filled with EPA USEEIO benchmarks.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
        <button onClick={() => go(3)} className="btn btn-primary">Continue with available data →</button>
        <button onClick={() => pushToast("You can proceed now — missing data will be AI-filled in Step 3", "info")} className="btn btn-ghost">
          Wait for all responses
        </button>
      </div>

      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)} title="Procurement Response — Maria Chen"
          subtitle="Received June 13, 2026 at 2:31pm · Auto-populated into LCA">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-solid)" }}>
                <th style={{ textAlign: "left", padding: "10px 8px" }} className="label">Field</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }} className="label">Value</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }} className="label">Source</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Primary material", "Recycled polyester (60%) + organic cotton (40%)", "Supplier cert"],
                ["Material weight", "340g per unit", "BOM v3.2"],
                ["Tier 1 supplier", "EcoFiber Ltd, Vietnam", "Supplier registry"],
                ["Material cost/unit", "$2.14", "Purchase order"],
                ["GRS certified", "Yes", "Certificate #GRS-2024-4471"],
                ["Recycled content", "60% post-consumer", "Third-party verified"],
              ].map(([f, v, s], i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 8px", fontWeight: 500 }}>{f}</td>
                  <td style={{ padding: "12px 8px" }} className="tabular">{v}</td>
                  <td style={{ padding: "12px 8px", color: "var(--text-tertiary)", fontSize: 13 }}>{s}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 20, textAlign: "right" }}>
            <button onClick={() => setModalOpen(false)} className="btn btn-outline">Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title, subtitle }: { children: ReactNode; onClose: () => void; title: string; subtitle?: string }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,15,13,0.4)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="fade-in" style={{
        background: "white", borderRadius: 16, padding: 28, maxWidth: 720, width: "100%",
        maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <div style={{ marginBottom: 20 }}>
          <h2 className="section-title" style={{ marginBottom: 6 }}>{title}</h2>
          {subtitle && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{subtitle}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STEP 3 — AI GAP FILLING
// ─────────────────────────────────────────────────────────────────────

function Step3({ go }: { go: (s: Step) => void }) {
  const rows = [
    ["Product name", "Recycled Tote Bag", "Default"],
    ["Category", "Apparel & Textiles", "Default"],
    ["Functional unit", "1 unit (340g)", "Default"],
    ["System boundary", "Cradle to gate", "Default"],
    ["Primary material", "Recycled polyester 60% + organic cotton 40%", "Primary"],
    ["Material weight", "340g", "Primary"],
    ["Material cost/unit", "$2.14", "Primary"],
    ["Tier 1 supplier", "EcoFiber Ltd, Vietnam", "Primary"],
    ["GRS certified", "Yes", "Primary"],
    ["Manufacturing energy", "2.8 kWh/unit", "AI Estimated"],
    ["Transport distance", "14,200 km sea freight", "AI Estimated"],
    ["Facility energy mix", "Vietnam grid average (0.52 kgCO2e/kWh)", "AI Estimated"],
  ];

  function badge(s: string) {
    if (s === "Primary") return <span className="chip chip-green">Primary</span>;
    if (s === "AI Estimated") return <span className="chip chip-amber">AI Estimated</span>;
    return <span className="chip chip-gray">Default</span>;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 40 }}>
      <BackBtn go={go} to={2} />
      <Eyebrow>Step 3 of 7 — AI Gap-Filling</Eyebrow>
      <h1 className="page-title" style={{ marginBottom: 10 }}>2 inputs are missing. We've filled them.</h1>
      <p className="body-text" style={{ maxWidth: 760, marginBottom: 32 }}>
        Where primary data wasn't available, ImpactBridge used EPA USEEIO benchmark data for Apparel & Textiles. Every estimated field is clearly labeled so you always know what's primary vs. filled.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
            <div className="card-title">Data inputs</div>
          </div>
          <div>
            {rows.map(([f, v, s], i) => {
              const isAi = s === "AI Estimated";
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1.2fr 1.8fr auto",
                  alignItems: "center", gap: 12, padding: "14px 24px",
                  borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--border)",
                  background: isAi ? "rgba(254,243,226,0.4)" : "transparent",
                }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{f}</div>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)" }} className="tabular">{v}</div>
                  <div>{badge(s)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ position: "sticky", top: 80, alignSelf: "start", display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 10 }}>About AI-estimated inputs</div>
            <p className="body-text" style={{ fontSize: 14 }}>
              When team data isn't available yet, ImpactBridge fills gaps using the US EPA USEEIO model — the same dataset Fortune 500 companies use for Scope 3 disclosure. Benchmark values are conservative and based on industry averages for your product category and region.
            </p>
            <p className="body-text" style={{ fontSize: 14, marginTop: 10 }}>
              As your team submits their responses, estimated fields are automatically replaced with primary data. Your LCA accuracy score improves over time.
            </p>
          </div>

          <div className="card">
            <div className="label" style={{ marginBottom: 8 }}>Current data accuracy</div>
            <div className="num-large" style={{ color: "var(--green-dark)" }}>74%</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>8 primary · 4 AI-estimated</div>
            <div style={{ height: 6, background: "var(--border-solid)", borderRadius: 4, marginTop: 14, overflow: "hidden" }}>
              <div style={{ width: "74%", height: "100%", background: "var(--green-dark)" }} />
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-tertiary)" }}>
              Accuracy will reach 92% when Operations and Logistics respond
            </div>
          </div>
        </div>
      </div>

      <button onClick={() => go("model")} className="btn btn-primary" style={{ width: "100%", marginTop: 28, padding: 14 }}>
        Build the model →
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STEP 4 — FOOTPRINT
// ─────────────────────────────────────────────────────────────────────

const STAGES = [
  { name: "Materials", value: 1976, pct: 61, color: "#2C6B45" },
  { name: "Manufacturing", value: 648, pct: 20, color: "#4A9B6F" },
  { name: "Logistics", value: 421, pct: 13, color: "#7BC4A0" },
  { name: "Consumer Use", value: 129, pct: 4, color: "#B8E0CC" },
  { name: "End of Life", value: 66, pct: 2, color: "#DCF0E6" },
];

const HOTSPOTS = [
  { id: "materials", badge: "Materials", badgeColor: "green", title: "Raw material extraction and processing", co2: "1,976 kg CO₂e · 61% of total", note: "Recycled polyester and organic cotton blends still carry significant upstream emissions." },
  { id: "manufacturing", badge: "Manufacturing", badgeColor: "amber", title: "Energy use at Tier 1 facility (Vietnam)", co2: "648 kg CO₂e · 20% of total", note: "Vietnam grid average is 0.52 kgCO2e/kWh. Renewable energy procurement would reduce this significantly." },
  { id: "logistics", badge: "Logistics", badgeColor: "blue", title: "Sea freight, Vietnam to distribution center", co2: "421 kg CO₂e · 13% of total", note: "14,200 km sea freight is the primary driver. Nearshoring or consolidation can reduce this." },
];

function Step4({ go }: { go: (s: Step) => void }) {
  const [selectedHotspot, setSelectedHotspot] = useState("materials");

  return (
    <div style={{ padding: 40 }}>
      <BackBtn go={go} to={"model"} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <Eyebrow>Step 4 of 7 — Footprint Breakdown</Eyebrow>
          <h1 className="page-title">Recycled Tote Bag · <span className="tabular">3,240</span> kg CO₂e per unit</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span className="chip chip-green">74% primary data</span>
          <span className="chip chip-gray">Cradle to gate</span>
          <span className="chip chip-gray">Apparel & Textiles</span>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total footprint", value: "3,240", caption: "kg CO₂e per unit" },
          { label: "vs. industry avg", value: "-18%", caption: "Below category average", color: "var(--green-dark)" },
          { label: "Top hotspot", value: "Materials", caption: "accounts for 61%", small: true },
          { label: "Data accuracy", value: "74%", caption: "2 estimates in use" },
        ].map((s, i) => (
          <div key={i} className="card">
            <div className="label" style={{ marginBottom: 12 }}>{s.label}</div>
            <div className={s.small ? "num-medium" : "num-large"} style={{ color: s.color || "var(--text-primary)" }}>{s.value}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{s.caption}</div>
          </div>
        ))}
      </div>

      {/* Chart + hotspots */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>CO₂e by lifecycle stage</div>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={STAGES} layout="vertical" margin={{ left: 16, right: 60 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={110} tick={{ fontSize: 13, fill: "#0F0F0D" }} />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.03)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #E8E8E4", fontSize: 13 }}
                  formatter={(v: any) => [`${Number(v).toLocaleString()} kg CO₂e`, "Emissions"]}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} onClick={(d: any) => setSelectedHotspot(d.name.toLowerCase())}>
                  {STAGES.map((s, i) => <Cell key={i} fill={s.color} cursor="pointer" />)}
                  <LabelList dataKey="value" position="right"
                    formatter={(v: any) => {
                      const n = typeof v === "number" ? v : Number(v);
                      const s = STAGES.find((x) => x.value === n);
                      return `${n.toLocaleString()} kg · ${s?.pct}%`;
                    }}
                    style={{ fontSize: 12, fill: "#6B6B65" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-tertiary)" }}>
            Powered by US EPA USEEIO · PEFCR-aligned methodology · Functional unit: 1 unit (340g)
          </div>
        </div>

        <div>
          <div className="card-title" style={{ marginBottom: 14 }}>Top hotspots</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {HOTSPOTS.map((h) => {
              const sel = selectedHotspot === h.id;
              return (
                <button key={h.id} onClick={() => setSelectedHotspot(h.id)} className="card card-hover"
                  style={{
                    textAlign: "left", padding: 18,
                    border: sel ? "2px solid var(--green-dark)" : "1px solid var(--border)",
                    background: sel ? "var(--green-light)" : "white",
                  }}>
                  <span className={`chip chip-${h.badgeColor}`} style={{ marginBottom: 10 }}>{h.badge}</span>
                  <div style={{ fontSize: 14, fontWeight: 500, margin: "6px 0 6px" }}>{h.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }} className="tabular">{h.co2}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>{h.note}</div>
                  <span style={{ fontSize: 13, color: "var(--green-dark)", fontWeight: 500 }}>See action plays →</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
        <button onClick={() => go(5)} className="btn btn-primary">View action queue →</button>
        <button onClick={() => go(6)} className="btn btn-ghost">Model a scenario first</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STEP 5 — ACTION QUEUE
// ─────────────────────────────────────────────────────────────────────

type Play = {
  id: string; stage: "Materials" | "Manufacturing" | "Logistics";
  play: string; co2: number; cost: number; owner: string;
  effort: "Low" | "Med" | "High"; star?: boolean;
};

const PLAYS: Play[] = [
  { id: "p1", stage: "Materials", play: "Switch to 70% recycled polyester content", co2: -487, cost: -0.22, owner: "Procurement", effort: "Low", star: true },
  { id: "p2", stage: "Manufacturing", play: "Switch Tier 1 facility to renewable energy tariff", co2: -389, cost: 0.08, owner: "Operations", effort: "High" },
  { id: "p3", stage: "Logistics", play: "Consolidate shipments — quarterly instead of monthly", co2: -210, cost: -0.14, owner: "Logistics", effort: "Med", star: true },
  { id: "p4", stage: "Materials", play: "Replace virgin cotton with BCI-certified cotton", co2: -156, cost: -0.06, owner: "Procurement", effort: "Low" },
  { id: "p5", stage: "Manufacturing", play: "ISO 14001 certification at Tier 1", co2: -98, cost: 0.12, owner: "Procurement", effort: "High" },
  { id: "p6", stage: "Logistics", play: "Shift 20% of volume to air-to-sea intermodal", co2: -67, cost: -0.03, owner: "Logistics", effort: "Low" },
];

function Step5({ setLcaData, go, pushToast }: { setLcaData: (f: (d: LcaData) => LcaData) => void; go: (s: Step) => void; pushToast: (t: string, k?: Toast["kind"]) => void }) {
  const [sortBy, setSortBy] = useState<"co2" | "cost">("co2");
  const [filterStage, setFilterStage] = useState<"All" | "Materials" | "Manufacturing" | "Logistics">("All");

  let rows = [...PLAYS];
  if (filterStage !== "All") rows = rows.filter((r) => r.stage === filterStage);
  rows.sort((a, b) => sortBy === "co2" ? a.co2 - b.co2 : a.cost - b.cost);

  const stageChip = (s: Play["stage"]) =>
    s === "Materials" ? "chip-green" : s === "Manufacturing" ? "chip-amber" : "chip-blue";
  const effortDot = (e: Play["effort"]) =>
    e === "Low" ? "var(--green-dark)" : e === "Med" ? "var(--amber)" : "var(--red)";

  function assign(p: Play) {
    setLcaData((d) => ({ ...d, selectedPlay: p.id }));
    pushToast(`Assigning "${p.play}"`, "info");
    setTimeout(() => go(7), 350);
  }

  return (
    <div style={{ padding: 40 }}>
      <BackBtn go={go} to={4} />
      <Eyebrow>Step 5 of 7 — Action Queue</Eyebrow>
      <h1 className="page-title" style={{ marginBottom: 10 }}>6 plays. Ranked by impact.</h1>
      <p className="body-text" style={{ maxWidth: 760, marginBottom: 24 }}>
        Every hotspot converted into an ownable action. Each play shows CO₂ savings and dollar impact together.
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="label">Sort by:</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setSortBy("co2")} className="btn btn-sm"
              style={{ background: sortBy === "co2" ? "var(--green-dark)" : "white", color: sortBy === "co2" ? "white" : "var(--text-primary)", border: "1px solid " + (sortBy === "co2" ? "var(--green-dark)" : "var(--border-solid)") }}>
              CO₂ impact
            </button>
            <button onClick={() => setSortBy("cost")} className="btn btn-sm"
              style={{ background: sortBy === "cost" ? "var(--green-dark)" : "white", color: sortBy === "cost" ? "white" : "var(--text-primary)", border: "1px solid " + (sortBy === "cost" ? "var(--green-dark)" : "var(--border-solid)") }}>
              Cost savings
            </button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="label">Filter by stage:</span>
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value as any)} className="input" style={{ width: "auto", padding: "8px 12px", fontSize: 13 }}>
            <option>All</option><option>Materials</option><option>Manufacturing</option><option>Logistics</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "140px 1fr 130px 130px 130px 100px 110px",
          padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--gray-section)",
        }}>
          {["Stage", "Play", "CO₂ savings", "Cost impact", "Owns", "Effort", "Action"].map((h) => (
            <div key={h} className="label">{h}</div>
          ))}
        </div>
        {rows.map((p) => (
          <div key={p.id} style={{
            display: "grid", gridTemplateColumns: "140px 1fr 130px 130px 130px 100px 110px",
            padding: "16px 20px", borderBottom: "1px solid var(--border)", alignItems: "center",
            borderLeft: p.star ? "3px solid var(--green-dark)" : "3px solid transparent",
            background: p.star ? "#FAFFF8" : "transparent",
            transition: "background 180ms ease",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = p.star ? "#F2FAEE" : "var(--gray-section)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = p.star ? "#FAFFF8" : "transparent")}
          >
            <div><span className={`chip ${stageChip(p.stage)}`}>{p.stage}</span></div>
            <div style={{ fontSize: 14 }}>
              {p.star && <I.star />} {p.play}
              {p.star && <div style={{ fontSize: 11, color: "var(--green-dark)", marginTop: 2, fontWeight: 500 }}>Saves both carbon and money</div>}
            </div>
            <div><span className="chip chip-green tabular">{p.co2} kg</span></div>
            <div><span className={`chip ${p.cost < 0 ? "chip-green" : "chip-red"} tabular`}>
              {p.cost < 0 ? "-$" : "+$"}{Math.abs(p.cost).toFixed(2)}
            </span></div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{p.owner}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: effortDot(p.effort) }} />
              {p.effort}
            </div>
            <div><button onClick={() => assign(p)} className="btn btn-primary btn-sm">Assign →</button></div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 20, padding: 20, borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ fontWeight: 500, color: "var(--green-dark)" }}>
          Total CO₂ reduction potential: -1,407 kg CO₂e/unit (43% of total footprint)
        </div>
        <div style={{ fontWeight: 500, color: "var(--green-dark)" }}>
          Net cost impact: -$0.35/unit at volume
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={() => go(6)} className="btn btn-ghost">Model a scenario →</button>
        <button onClick={() => assign(PLAYS[0])} className="btn btn-primary">Assign a play →</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STEP 6 — SCENARIO MODELING
// ─────────────────────────────────────────────────────────────────────

const MATERIAL_OPTIONS = [
  "100% recycled polyester (GRS certified)",
  "100% organic cotton (GOTS certified)",
  "70% recycled polyester + 30% organic cotton",
  "Hemp / recycled cotton blend",
  "Lyocell (TENCEL)",
];

// Pre-calculated scenarios — relative deltas vs baseline (3,240 kg, $2.14/u)
const SCENARIOS: Record<string, { matBefore: number; matAfter: number; costAfter: number }> = {
  "100% recycled polyester (GRS certified)":        { matBefore: 1976, matAfter: 1480, costAfter: 1.92 },
  "100% organic cotton (GOTS certified)":           { matBefore: 1976, matAfter: 2210, costAfter: 2.48 },
  "70% recycled polyester + 30% organic cotton":    { matBefore: 1976, matAfter: 1612, costAfter: 1.96 },
  "Hemp / recycled cotton blend":                   { matBefore: 1976, matAfter: 1390, costAfter: 2.18 },
  "Lyocell (TENCEL)":                               { matBefore: 1976, matAfter: 1550, costAfter: 2.34 },
};

function Step6({ setLcaData, go, pushToast }: { setLcaData: (f: (d: LcaData) => LcaData) => void; go: (s: Step) => void; pushToast: (t: string, k?: Toast["kind"]) => void }) {
  const [changeType, setChangeType] = useState<"Material" | "Process" | "Supplier">("Material");
  const [stage, setStage] = useState("Materials");
  const [material, setMaterial] = useState(MATERIAL_OPTIONS[2]);
  const [volume, setVolume] = useState(100000);
  const [calculated, setCalculated] = useState(true);
  const [loading, setLoading] = useState(false);

  function calc() {
    setLoading(true);
    setCalculated(false);
    setTimeout(() => { setLoading(false); setCalculated(true); }, 600);
  }

  function assignScenario() {
    setLcaData((d) => ({ ...d, selectedPlay: "p1" }));
    pushToast("Scenario assigned. Generating artifact in Step 7.", "success");
    setTimeout(() => go(7), 350);
  }

  const sc = SCENARIOS[material];
  const matDelta = sc.matAfter - sc.matBefore;
  const totalAfter = 3240 + matDelta;
  const costBefore = 2.14;
  const costDelta = sc.costAfter - costBefore;
  const annualCo2 = Math.round(-matDelta * volume / 1000) * 1000;
  const annualCost = Math.round(-costDelta * volume);

  return (
    <div style={{ padding: 40 }}>
      <BackBtn go={go} to={4} />
      <Eyebrow>Step 6 of 7 — Scenario Modeling</Eyebrow>
      <h1 className="page-title" style={{ marginBottom: 10 }}>Swap a material or process. See the delta instantly.</h1>
      <p className="body-text" style={{ maxWidth: 760, marginBottom: 28 }}>
        Test a product decision without rebuilding the LCA. Designed for designers and R&D — iterate in seconds.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 20, alignItems: "start" }}>
        {/* Controls */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 18 }}>Configure scenario</div>

          <div style={{ marginBottom: 16 }}>
            <div className="label" style={{ marginBottom: 8 }}>What are you changing?</div>
            <div style={{ display: "flex", background: "var(--gray-section)", borderRadius: 10, padding: 4 }}>
              {(["Material", "Process", "Supplier"] as const).map((t) => (
                <button key={t} onClick={() => setChangeType(t)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: changeType === t ? "white" : "transparent",
                  color: changeType === t ? "var(--text-primary)" : "var(--text-secondary)",
                  boxShadow: changeType === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="label" style={{ marginBottom: 8 }}>Which lifecycle stage?</div>
            <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
              <option>Materials</option><option>Manufacturing</option><option>Logistics</option><option>Packaging</option>
            </select>
          </div>

          {changeType === "Material" && (
            <>
              <div style={{ marginBottom: 16 }}>
                <div className="label" style={{ marginBottom: 8 }}>Current material</div>
                <div style={{ padding: "12px 14px", background: "var(--gray-section)", borderRadius: 10, fontSize: 14 }}>
                  Recycled polyester 60% + Organic cotton 40%
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="label" style={{ marginBottom: 8 }}>Swap to</div>
                <select className="input" value={material} onChange={(e) => { setMaterial(e.target.value); setCalculated(false); }}>
                  {MATERIAL_OPTIONS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </>
          )}

          <div style={{ marginBottom: 20 }}>
            <div className="label" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
              <span>Volume (units/year)</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }} className="tabular">{volume.toLocaleString()}</span>
            </div>
            <input type="range" min={10000} max={500000} step={10000} value={volume}
              onChange={(e) => { setVolume(Number(e.target.value)); setCalculated(false); }}
              style={{ width: "100%", accentColor: "var(--green-dark)" }} />
          </div>

          <button onClick={calc} className="btn btn-primary" style={{ width: "100%", padding: 12 }} disabled={loading}>
            {loading ? <><span className="spinner" /> Calculating...</> : "Calculate scenario"}
          </button>
        </div>

        {/* Results */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <span className="chip chip-gray">Baseline</span>
            <span style={{ color: "var(--text-tertiary)" }}>vs.</span>
            <span className="chip chip-green">Scenario</span>
          </div>

          {!calculated ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
              {loading ? "Calculating delta..." : "Adjust inputs then click Calculate scenario."}
            </div>
          ) : (
            <div className="fade-in">
              {[
                ["Material CO₂e", `${sc.matBefore.toLocaleString()} kg`, `${sc.matAfter.toLocaleString()} kg`, `${matDelta > 0 ? "+" : ""}${matDelta} kg`, matDelta < 0],
                ["Total footprint", "3,240 kg", `${totalAfter.toLocaleString()} kg`, `${matDelta > 0 ? "+" : ""}${matDelta} kg`, matDelta < 0],
                ["Material cost/unit", "$2.14", `$${sc.costAfter.toFixed(2)}`, `${costDelta > 0 ? "+" : ""}$${costDelta.toFixed(2)}`, costDelta < 0],
                ["Annual CO₂ reduction", "—", `${Math.abs(annualCo2).toLocaleString()} kg`, `at ${(volume/1000).toFixed(0)}k units`, true],
                ["Annual cost saving", "—", `$${Math.abs(annualCost).toLocaleString()}`, `at ${(volume/1000).toFixed(0)}k units`, costDelta < 0],
              ].map(([metric, before, after, delta, good], i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1.4fr 1fr 30px 1fr 1.2fr",
                  alignItems: "center", padding: "14px 0",
                  borderBottom: i < 4 ? "1px solid var(--border)" : "none",
                  gap: 10,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{metric as string}</div>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)" }} className="tabular">{before as string}</div>
                  <div style={{ textAlign: "center", color: "var(--text-tertiary)" }}>→</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }} className="tabular">{after as string}</div>
                  <div style={{ textAlign: "right" }}>
                    <span className={`chip ${good ? "chip-green" : "chip-red"} tabular`}>
                      {good && (delta as string).includes("$") === false && (delta as string).includes("kg") && !(delta as string).startsWith("at") ? "▼ " : ""}
                      {delta as string}
                    </span>
                  </div>
                </div>
              ))}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 24 }}>
                <div style={{ padding: 20, background: "var(--green-light)", border: "1px solid var(--green-border)", borderRadius: 12 }}>
                  <div className="num-large tabular" style={{ color: "var(--green-dark)" }}>{Math.abs(annualCo2).toLocaleString()} kg</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>Annual carbon reduction at {(volume/1000).toFixed(0)}k units</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>= {Math.round(Math.abs(annualCo2) / 460)} transatlantic flights avoided</div>
                </div>
                <div style={{ padding: 20, background: "var(--green-light)", border: "1px solid var(--green-border)", borderRadius: 12 }}>
                  <div className="num-large tabular" style={{ color: "var(--green-dark)" }}>${Math.abs(annualCost).toLocaleString()}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>Annual cost {costDelta < 0 ? "saving" : "increase"} at {(volume/1000).toFixed(0)}k units</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>Payback: immediate — no capex required</div>
                </div>
              </div>

              <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--amber-light)", border: "1px solid var(--amber-border)", borderRadius: 10, fontSize: 13 }}>
                ⚠ GRS-certified recycled polyester required. 3 certified suppliers identified — see Suppliers tab in action queue.
              </div>

              <button onClick={assignScenario} className="btn btn-primary" style={{ width: "100%", marginTop: 20, padding: 12 }}>
                Assign this scenario →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STEP 7 — ASSIGN & GENERATE
// ─────────────────────────────────────────────────────────────────────

const ARTIFACTS = [
  { id: "rfp" as const, icon: <I.doc />, title: "Supplier RFP", desc: "Request for proposal to certified material suppliers. Includes specs, certification requirements, and timeline." },
  { id: "letter" as const, icon: <I.envelope />, title: "Supplier Engagement Letter", desc: "Introductory outreach to a supplier about a pilot program. Less formal than an RFP." },
  { id: "brief" as const, icon: <I.team />, title: "Internal Process Brief", desc: "A brief for your ops or procurement team explaining the play, the data, and the next steps." },
];

const RFP_TEXT = `SUPPLIER REQUEST FOR PROPOSAL
ImpactBridge · Sustainable Materials Sourcing
Generated: June 15, 2026
Prepared by: Alex Johnson, Sourcing Lead

PRODUCT REFERENCE
Product: Recycled Tote Bag
Current spec: Recycled polyester 60% + Organic cotton 40%
Target spec: 70% GRS-certified recycled polyester + 30% organic cotton
LCA reference: ImpactBridge LCA #RTB-2026-001

BACKGROUND
Our sustainability team has completed a lifecycle assessment for the Recycled Tote Bag product line. The assessment identified a material substitution opportunity that reduces Scope 3.1 emissions by 487 kg CO₂e per unit (24.6% reduction) while delivering a projected cost saving of $0.22/unit at current volume.

We are requesting proposals from GRS-certified recycled polyester suppliers to support a pilot for this transition.

REQUIREMENTS
· Minimum 70% post-consumer recycled polyester content
· GRS (Global Recycled Standard) certification required — current certificate must be submitted with proposal
· Material weight compatibility: 340g/unit finished product
· MOQ: preference for <10,000 unit pilots
· Target cost: at or below $1.96/unit material cost
· Pilot timeline: first delivery within 12 weeks of PO

SUSTAINABILITY CONTEXT
This transition supports our 2026 Scope 3 reduction targets under CSRD reporting requirements. LCA data powered by US EPA USEEIO model, ISO 14044 aligned.

At 100,000 units/year, this change avoids 36,400 kg CO₂e annually — equivalent to removing 79 transatlantic flights from our carbon account.

SUBMISSION
Please respond to sourcing@company.com by June 29, 2026:
  1. Pricing at 5k / 10k / 25k / 50k unit tiers
  2. Current GRS certificate (must be valid through Dec 2026)
  3. Lead time and sample availability
  4. References from 2+ comparable brand customers
  5. Fabric swatch if available

We are evaluating 3 qualified suppliers. Proposals received by the deadline will receive a response within 5 business days.`;

function Step7({ lcaData, setLcaData, go, pushToast }: { lcaData: LcaData; setLcaData: (f: (d: LcaData) => LcaData) => void; go: (s: Step) => void; pushToast: (t: string, k?: Toast["kind"]) => void }) {
  const [recipient, setRecipient] = useState("Maria Chen, Head of Procurement");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(lcaData.artifactGenerated);
  const [copied, setCopied] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (lcaData.artifactGenerated) setGenerated(true); }, [lcaData.artifactGenerated]);

  function generate() {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGenerated(true);
      setLcaData((d) => ({ ...d, artifactGenerated: true, completed: true }));
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    }, 1500);
  }

  function copy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(RFP_TEXT).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 40 }}>
      <BackBtn go={go} to={5} />
      <Eyebrow>Step 7 of 7 — Assign & Generate</Eyebrow>
      <h1 className="page-title" style={{ marginBottom: 10 }}>Turn this play into a sent document.</h1>
      <p className="body-text" style={{ marginBottom: 24 }}>
        Click Generate and ImpactBridge drafts a ready-to-send work artifact using the Claude API. The action does not stop at a recommendation.
      </p>

      <div style={{ padding: 16, background: "var(--green-light)", border: "1px solid var(--green-border)", borderRadius: 12, marginBottom: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Selected play: Switch to 70% recycled polyester content</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          CO₂ savings: -487 kg CO₂e/unit · Cost saving: -$0.22/unit · Effort: Low · Owner: Procurement
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 10 }}>What do you need to send?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {ARTIFACTS.map((a) => {
            const sel = lcaData.selectedArtifact === a.id;
            return (
              <button key={a.id} onClick={() => setLcaData((d) => ({ ...d, selectedArtifact: a.id }))}
                style={{
                  textAlign: "left", padding: 16, borderRadius: 12,
                  border: sel ? "2px solid var(--green-dark)" : "1px solid var(--border-solid)",
                  background: sel ? "var(--green-light)" : "white",
                }}>
                <div style={{ color: "var(--green-dark)", marginBottom: 8 }}>{a.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45 }}>{a.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div className="label" style={{ marginBottom: 8 }}>Send to</div>
        <input className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
      </div>

      <button onClick={generate} disabled={generating} className="btn btn-primary" style={{ width: "100%", padding: 16, fontSize: 15 }}>
        {generating ? <><span className="spinner" /> Generating...</> : "Generate with AI →"}
      </button>

      {generated && (
        <div ref={outputRef} className="card fade-in" style={{ marginTop: 28, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="card-title">Supplier RFP · AI Generated</div>
              <span className="chip chip-green">Ready to send</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Generated in 1.8s</div>
          </div>

          <div className="mono" style={{
            maxHeight: 400, overflowY: "auto",
            background: "var(--gray-section)", border: "1px solid var(--border)", borderRadius: 8,
            padding: 20, lineHeight: 1.8, whiteSpace: "pre-wrap",
          }}>{RFP_TEXT}</div>

          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            <button onClick={copy} className="btn btn-primary">{copied ? "Copied ✓" : "Copy to clipboard"}</button>
            <button onClick={() => pushToast("Downloading RFP...", "info")} className="btn btn-outline">Download .docx</button>
            <button onClick={() => setEmailModalOpen(true)} className="btn btn-outline">Send via email</button>
          </div>

          <div style={{ marginTop: 14, fontSize: 13, color: "var(--text-secondary)" }}>
            Artifact generated using Claude API · Emission data: US EPA USEEIO · Data stays in your environment
          </div>
        </div>
      )}

      {generated && (
        <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid var(--border)" }}>
          <h2 className="section-title" style={{ marginBottom: 16 }}>What's next?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {[
              { t: "Assign remaining plays", d: "5 more plays in your action queue. Each takes one click to assign.", cta: "View action queue →", on: () => go(5) },
              { t: "Track progress", d: "See how assigned plays are reducing your footprint over time.", cta: "Go to dashboard →", on: () => go("dashboard") },
              { t: "Start another LCA", d: "Run a second product to compare footprints across your catalog.", cta: "New LCA →", on: () => go(1) },
            ].map((c, i) => (
              <div key={i} className="card card-hover">
                <div className="card-title" style={{ marginBottom: 8 }}>{c.t}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.55 }}>{c.d}</div>
                <button onClick={c.on} style={{ fontSize: 13, color: "var(--green-dark)", fontWeight: 500 }}>{c.cta}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {emailModalOpen && (
        <Modal onClose={() => setEmailModalOpen(false)} title="Send via email">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>To</div>
              <input className="input" defaultValue="maria.chen@company.com" />
            </div>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Subject</div>
              <input className="input" defaultValue="Supplier RFP — Recycled Polyester (ImpactBridge)" />
            </div>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Body</div>
              <textarea className="input" rows={4} defaultValue="Hi Maria, Please find attached..." />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setEmailModalOpen(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={() => { setEmailModalOpen(false); pushToast("RFP sent to Maria Chen", "success"); }} className="btn btn-primary">Send</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────

function Dashboard({ go }: { go: (s: Step) => void }) {
  return (
    <div style={{ padding: 40 }}>
      <h1 className="page-title" style={{ marginBottom: 6 }}>Dashboard</h1>
      <p className="body-text" style={{ marginBottom: 28 }}>Welcome back, Alex</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { l: "Active LCAs", v: "1", c: "Recycled Tote Bag in progress" },
          { l: "Plays assigned", v: "1 of 6", c: "5 remaining" },
          { l: "CO₂ identified", v: "1,407 kg", c: "reduction potential" },
          { l: "Cost identified", v: "$0.35/unit", c: "net saving potential" },
        ].map((s, i) => (
          <div key={i} className="card">
            <div className="label" style={{ marginBottom: 12 }}>{s.l}</div>
            <div className="num-medium">{s.v}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{s.c}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <div className="card-title">Active LCAs</div>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr auto",
            padding: "12px 20px", borderBottom: "1px solid var(--border)",
            background: "var(--gray-section)",
          }}>
            <div className="label">Product</div>
            <div className="label">Stage</div>
            <div className="label">Data accuracy</div>
            <div />
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr auto",
            padding: "16px 20px", alignItems: "center",
          }}>
            <div style={{ fontWeight: 500 }}>Recycled Tote Bag</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Step 5 of 7</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }} className="tabular">74%</div>
            <button onClick={() => go(5)} className="btn btn-primary btn-sm">Continue →</button>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Recent activity</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              ["RFP generated for recycled polyester play", "Just now"],
              ["Scenario modeled: 70% recycled polyester", "2 min ago"],
              ["2 team responses received", "June 13"],
              ["LCA started: Recycled Tote Bag", "June 13"],
            ].map(([t, w], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
                <span>· {t}</span>
                <span style={{ color: "var(--text-tertiary)", fontSize: 12, whiteSpace: "nowrap" }}>{w}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STEP 3.5 — LCA MODEL (process network, inventory, flows)
// ─────────────────────────────────────────────────────────────────────

const MODEL_PROCESSES = [
  { id: "cotton", name: "Organic cotton cultivation", loc: "IN", db: "ecoinvent 3.10", co2: 412, kind: "background" },
  { id: "rpet", name: "rPET flake, post-consumer", loc: "TR", db: "ecoinvent 3.10", co2: 689, kind: "background" },
  { id: "yarn", name: "Yarn spinning, blended", loc: "VN", db: "Primary", co2: 184, kind: "foreground" },
  { id: "weave", name: "Weaving & knitting", loc: "VN", db: "Primary", co2: 312, kind: "foreground" },
  { id: "dye", name: "Reactive dyeing & finishing", loc: "VN", db: "ecoinvent 3.10", co2: 379, kind: "foreground" },
  { id: "cutsew", name: "Cut, sew & assembly", loc: "VN", db: "Primary", co2: 156, kind: "foreground" },
  { id: "pack", name: "Polybag & carton packaging", loc: "VN", db: "ecoinvent 3.10", co2: 48, kind: "foreground" },
  { id: "freight", name: "Sea freight, HCMC → Rotterdam", loc: "—", db: "ecoinvent 3.10", co2: 421, kind: "background" },
  { id: "tote", name: "Recycled tote bag (1 unit)", loc: "EU", db: "Reference product", co2: 3240, kind: "product" },
];

const TECHNO_FLOWS = [
  { name: "Organic cotton fibre", category: "Materials / Natural fibres", qty: "0.180", unit: "kg", provider: "Organic cotton cultivation | IN", source: "Primary" },
  { name: "rPET flake", category: "Materials / Recycled polymers", qty: "0.120", unit: "kg", provider: "rPET flake, post-consumer | TR", source: "Primary" },
  { name: "Electricity, medium voltage", category: "Energy / Grid", qty: "1.420", unit: "kWh", provider: "Market for electricity | VN", source: "ecoinvent" },
  { name: "Heat, natural gas", category: "Energy / Thermal", qty: "0.640", unit: "MJ", provider: "Steam production | VN", source: "ecoinvent" },
  { name: "Water, deionised", category: "Process water", qty: "11.20", unit: "L", provider: "Tap water | VN", source: "ecoinvent" },
  { name: "Reactive dye, mixed", category: "Chemicals / Dyes", qty: "0.014", unit: "kg", provider: "Dye production | RoW", source: "AI estimated" },
  { name: "Sodium hydroxide, 50%", category: "Chemicals / Inorganic", qty: "0.022", unit: "kg", provider: "NaOH production | RER", source: "ecoinvent" },
  { name: "LDPE polybag", category: "Packaging", qty: "0.008", unit: "kg", provider: "LDPE film | GLO", source: "ecoinvent" },
  { name: "Corrugated board", category: "Packaging", qty: "0.045", unit: "kg", provider: "Corrugated board, recycled | EU", source: "ecoinvent" },
  { name: "Transport, sea, container ship", category: "Logistics", qty: "14.20", unit: "tkm", provider: "Sea freight, transoceanic | GLO", source: "ecoinvent" },
];

const ELEM_FLOWS = [
  { name: "Carbon dioxide, fossil", compartment: "Air / unspecified", qty: "2.940", unit: "kg", cf: "1.00 kg CO₂e/kg" },
  { name: "Methane, fossil", compartment: "Air / unspecified", qty: "0.0042", unit: "kg", cf: "29.8 kg CO₂e/kg" },
  { name: "Dinitrogen monoxide", compartment: "Air / unspecified", qty: "0.00018", unit: "kg", cf: "273 kg CO₂e/kg" },
  { name: "Water, river", compartment: "Resource / in water", qty: "9.84", unit: "L", cf: "AWARE 12.4" },
  { name: "Particulates, < 2.5 µm", compartment: "Air / urban", qty: "0.0011", unit: "kg", cf: "PM2.5 health" },
  { name: "BOD5, biological oxygen demand", compartment: "Water / surface", qty: "0.0036", unit: "kg", cf: "Eutroph. 0.05" },
];

const IMPACT_METHODS = [
  { name: "IPCC 2021, GWP 100a", value: "3.24", unit: "kg CO₂e", contrib: 100 },
  { name: "ReCiPe 2016 — Climate change", value: "3.19", unit: "kg CO₂e", contrib: 98 },
  { name: "ReCiPe 2016 — Water consumption", value: "0.041", unit: "m³", contrib: 64 },
  { name: "ReCiPe 2016 — Fossil resource scarcity", value: "1.18", unit: "kg oil-eq", contrib: 71 },
  { name: "EF 3.1 — Particulate matter", value: "8.4e-8", unit: "disease inc.", contrib: 22 },
  { name: "USEtox — Ecotoxicity, freshwater", value: "0.62", unit: "CTUe", contrib: 38 },
];

function StepModel({ go }: { go: (s: Step) => void }) {
  const [selected, setSelected] = useState("dye");
  const [tab, setTab] = useState<"techno" | "elem" | "params" | "impact">("techno");
  const proc = MODEL_PROCESSES.find((p) => p.id === selected)!;

  const nodeStyle = (kind: string, active: boolean): React.CSSProperties => ({
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${active ? "var(--green-dark)" : "var(--border-solid)"}`,
    background: active ? "var(--green-light)" : kind === "product" ? "white" : kind === "background" ? "var(--gray-section)" : "white",
    boxShadow: active ? "0 0 0 3px rgba(44,107,69,0.12)" : "0 1px 2px rgba(0,0,0,0.03)",
    cursor: "pointer",
    fontSize: 12.5,
    lineHeight: 1.35,
    minWidth: 168,
    transition: "all 160ms ease",
  });

  const Node = ({ id, x, y }: { id: string; x: number; y: number }) => {
    const p = MODEL_PROCESSES.find((m) => m.id === id)!;
    const active = selected === id;
    return (
      <foreignObject x={x} y={y} width={184} height={62}>
        <div onClick={() => setSelected(id)} style={nodeStyle(p.kind, active)}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{p.name}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, color: "var(--text-tertiary)", fontSize: 11 }}>
            <span>{p.loc} · {p.db}</span>
            <span className="tabular" style={{ color: p.kind === "product" ? "var(--green-dark)" : "var(--text-secondary)", fontWeight: 500 }}>{p.co2} g</span>
          </div>
        </div>
      </foreignObject>
    );
  };

  const Arrow = ({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label?: string }) => (
    <g>
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#9B9B95" />
        </marker>
      </defs>
      <path d={`M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`}
        stroke="#C8C8C2" strokeWidth="1.25" fill="none" markerEnd="url(#arr)" />
      {label && (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} textAnchor="middle" fontSize="10" fill="#9B9B95" fontFamily="SF Mono, Menlo, monospace">{label}</text>
      )}
    </g>
  );

  return (
    <div style={{ padding: 40 }}>
      <BackBtn go={go} to={3} />
      

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8, flexWrap: "wrap", gap: 16 }}>
        <div>
          <Eyebrow>Step 3.5 · LCA model</Eyebrow>
          <h1 className="page-title">Product system & inventory</h1>
          <p className="body-text" style={{ marginTop: 8, maxWidth: 680 }}>
            Review the unit processes, technosphere links and elementary flows that make up your product system. Drill into any node to inspect inputs, outputs and data sources.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="chip chip-gray">Functional unit · 1 tote bag</span>
          <span className="chip chip-green">Allocation · mass</span>
          <span className="chip chip-blue">Method · IPCC 2021 GWP100</span>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", background: "white", border: "1px solid var(--border)",
        borderRadius: 12, marginTop: 20, marginBottom: 16, fontSize: 13,
      }}>
        <div style={{ display: "flex", gap: 16, color: "var(--text-secondary)" }}>
          <span>9 processes</span><span>·</span>
          <span>10 technosphere flows</span><span>·</span>
          <span>34 elementary flows</span><span>·</span>
          <span>2 parameters</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm">Validate model</button>
          <button className="btn btn-outline btn-sm">Export · ILCD</button>
        </div>
      </div>

      {/* 3-column work area */}
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 300px", gap: 16, alignItems: "stretch" }}>
        {/* Left: process tree */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Product system</div>
          <div style={{ padding: 8, fontSize: 13 }}>
            <TreeNode label="Recycled Tote Bag" depth={0} bold />
            <TreeNode label="Foreground processes" depth={1} muted />
            {MODEL_PROCESSES.filter((p) => p.kind === "foreground").map((p) => (
              <TreeNode key={p.id} label={p.name} depth={2} active={selected === p.id} onClick={() => setSelected(p.id)} />
            ))}
            <TreeNode label="Background (database)" depth={1} muted />
            {MODEL_PROCESSES.filter((p) => p.kind === "background").map((p) => (
              <TreeNode key={p.id} label={p.name} depth={2} active={selected === p.id} onClick={() => setSelected(p.id)} />
            ))}
          </div>
        </div>

        {/* Center: flow canvas */}
        <div className="card" style={{ padding: 0, overflow: "hidden", background: "linear-gradient(180deg, #fff, #FAFAF8)" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Process network</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-ghost btn-sm">Auto-layout</button>
              <button className="btn btn-ghost btn-sm">Fit</button>
            </div>
          </div>
          <div style={{ position: "relative", height: 460 }}>
            {/* grid */}
            <svg width="100%" height="100%" viewBox="0 0 880 460" style={{ display: "block" }}>
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#EFEFEA" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="880" height="460" fill="url(#grid)" />

              {/* arrows */}
              <Arrow x1={194} y1={70} x2={330} y2={140} label="0.18 kg" />
              <Arrow x1={194} y1={170} x2={330} y2={150} label="0.12 kg" />
              <Arrow x1={514} y1={150} x2={650} y2={150} label="0.30 kg yarn" />
              <Arrow x1={514} y1={250} x2={650} y2={210} label="fabric" />
              <Arrow x1={194} y1={280} x2={330} y2={250} label="grid VN" />
              <Arrow x1={834} y1={150} x2={834} y2={230} />
              <Arrow x1={834} y1={290} x2={834} y2={350} />
              <Arrow x1={194} y1={370} x2={650} y2={370} label="14.2 tkm sea freight" />

              {/* nodes */}
              <Node id="cotton" x={10} y={40} />
              <Node id="rpet" x={10} y={140} />
              <Node id="yarn" x={330} y={120} />
              <Node id="weave" x={330} y={220} />
              <Node id="dye" x={650} y={120} />
              <Node id="cutsew" x={650} y={220} />
              <Node id="pack" x={650} y={320} />
              <Node id="freight" x={10} y={340} />
              <Node id="tote" x={650} y={400 - 80} />

              {/* legend */}
              <g transform="translate(16,420)">
                <rect width="10" height="10" fill="#fff" stroke="#E8E8E4" />
                <text x="16" y="9" fontSize="10.5" fill="#6B6B65">Foreground</text>
                <rect x="100" width="10" height="10" fill="#F4F4F0" stroke="#E8E8E4" />
                <text x="116" y="9" fontSize="10.5" fill="#6B6B65">Background</text>
                <rect x="220" width="10" height="10" fill="#EBF4EE" stroke="#2C6B45" />
                <text x="236" y="9" fontSize="10.5" fill="#6B6B65">Selected</text>
              </g>
            </svg>
          </div>
        </div>

        {/* Right: inspector */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <div className="label">Process inspector</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginTop: 6 }}>{proc.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{proc.loc} · {proc.db}</div>
          </div>
          <div style={{ padding: 16, fontSize: 13, display: "flex", flexDirection: "column", gap: 10 }}>
            <KV k="Reference flow" v="1 kg fabric, finished" />
            <KV k="Allocation" v="Mass-based" />
            <KV k="Time period" v="2023 – 2024" />
            <KV k="Geography" v={proc.loc} />
            <KV k="Data quality" v={<span className="chip chip-green" style={{ padding: "2px 8px", fontSize: 11 }}>Pedigree 2.1</span>} />
            <KV k="GWP100 contribution" v={<span className="tabular" style={{ fontWeight: 500 }}>{proc.co2} g CO₂e</span>} />
            <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }} />
            <div className="label">Uncertainty</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, height: 6, background: "var(--gray-section)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: "18%", right: "26%", top: 0, bottom: 0, background: "var(--green-mid)", borderRadius: 4 }} />
              </div>
              <span className="tabular" style={{ fontSize: 12, color: "var(--text-secondary)" }}>±14%</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Lognormal, GSD² = 1.18 (pedigree matrix)</div>
          </div>
        </div>
      </div>

      {/* Tabs: inventory */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
          {[
            ["techno", "Inputs & outputs", "10"],
            ["elem", "Elementary flows", "34"],
            ["params", "Parameters", "2"],
            ["impact", "Impact assessment", "6"],
          ].map(([id, label, count]) => (
            <button key={id} onClick={() => setTab(id as typeof tab)} style={{
              padding: "10px 14px", fontSize: 13, fontWeight: 500,
              color: tab === id ? "var(--text-primary)" : "var(--text-tertiary)",
              borderBottom: `2px solid ${tab === id ? "var(--green-dark)" : "transparent"}`,
              marginBottom: -1,
            }}>
              {label} <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontWeight: 400 }}>{count}</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          {tab === "techno" && <FlowTable rows={TECHNO_FLOWS} cols={["Flow", "Category", "Amount", "Unit", "Provider", "Source"]} />}
          {tab === "elem" && <FlowTable rows={ELEM_FLOWS.map((f) => ({ name: f.name, category: f.compartment, qty: f.qty, unit: f.unit, provider: f.cf, source: "Characterised" }))} cols={["Flow", "Compartment", "Amount", "Unit", "Char. factor", "Method"]} />}
          {tab === "params" && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--gray-section)" }}>
                    {["Name", "Formula", "Value", "Unit", "Scope"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["yield_loss", "0.04", "0.04", "ratio", "Foreground"],
                    ["renewable_share", "0.18 + 0.02 * year", "0.22", "ratio", "Global"],
                  ].map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                      {r.map((c, j) => <td key={j} className={j > 0 ? "mono" : ""} style={{ padding: "12px 14px" }}>{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === "impact" && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--gray-section)" }}>
                    {["Method / category", "Result", "Unit", "Contribution"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {IMPACT_METHODS.map((m, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 14px", fontWeight: 500 }}>{m.name}</td>
                      <td className="mono tabular" style={{ padding: "12px 14px" }}>{m.value}</td>
                      <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{m.unit}</td>
                      <td style={{ padding: "12px 14px", width: 240 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, height: 6, background: "var(--gray-section)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: `${m.contrib}%`, height: "100%", background: "var(--green-mid)" }} />
                          </div>
                          <span className="tabular" style={{ fontSize: 12, color: "var(--text-secondary)", width: 36, textAlign: "right" }}>{m.contrib}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <button onClick={() => go(4)} className="btn btn-primary" style={{ width: "100%", marginTop: 28, padding: 14 }}>
        Calculate footprint →
      </button>
    </div>
  );
}

function TreeNode({ label, depth, bold, muted, active, onClick }: { label: string; depth: number; bold?: boolean; muted?: boolean; active?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      padding: "6px 8px", paddingLeft: 8 + depth * 14,
      borderRadius: 6, cursor: onClick ? "pointer" : "default",
      background: active ? "var(--green-light)" : "transparent",
      color: muted ? "var(--text-tertiary)" : active ? "var(--green-dark)" : "var(--text-primary)",
      fontWeight: bold ? 600 : active ? 500 : 400,
      fontSize: muted ? 11 : 13,
      textTransform: muted ? "uppercase" : "none",
      letterSpacing: muted ? "0.06em" : "normal",
      display: "flex", alignItems: "center", gap: 6,
    }}>
      {!muted && depth > 0 && <span style={{ color: "var(--text-tertiary)" }}>{depth === 2 ? "└" : "•"}</span>}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
      <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{k}</span>
      <span style={{ textAlign: "right" }}>{v}</span>
    </div>
  );
}

type FlowRow = { name: string; category: string; qty: string; unit: string; provider: string; source: string };
function FlowTable({ rows, cols }: { rows: FlowRow[]; cols: string[] }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--gray-section)" }}>
            {cols.map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ padding: "12px 14px", fontWeight: 500 }}>{r.name}</td>
              <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{r.category}</td>
              <td className="mono tabular" style={{ padding: "12px 14px" }}>{r.qty}</td>
              <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{r.unit}</td>
              <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{r.provider}</td>
              <td style={{ padding: "12px 14px" }}>
                <span className={`chip ${r.source === "Primary" ? "chip-green" : r.source === "AI estimated" ? "chip-amber" : "chip-blue"}`} style={{ fontSize: 11 }}>{r.source}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PRM INTEGRATION — How we knew who to ask
// ─────────────────────────────────────────────────────────────────────

const PRM_FIELDS = [
  { sf: "Account.Industry", maps: "Product category", val: "Apparel & Textiles", conf: "exact" },
  { sf: "Product2.Family", maps: "Functional unit basis", val: "Recycled Tote Bag · 1 unit", conf: "exact" },
  { sf: "Account.Supplier_Tier__c", maps: "Upstream boundary depth", val: "Tier 1 + Tier 2 (12 suppliers)", conf: "exact" },
  { sf: "Opportunity.Manufacturing_Site__c", maps: "Operations facility", val: "Ho Chi Minh City, VN", conf: "exact" },
  { sf: "Contact.Department + Role", maps: "Data owner routing", val: "4 owners auto-identified", conf: "rule" },
];

const PRM_OWNERS = [
  { dept: "Procurement", icon: <I.box />, name: "Maria Chen", title: "Head of Procurement", sfRole: "Supplier Relationship Owner", queries: ["Account.Supplier__r where Tier ≤ 2", "Contract.Material_Spec__c"], why: "Owns 11 of 12 supplier contracts in scope" },
  { dept: "Design & R&D", icon: <I.pencil />, name: "James Park", title: "Senior Product Designer", sfRole: "Product2 Owner", queries: ["Product2.Bill_of_Materials__c", "Product2.Weight_g__c"], why: "Listed as primary owner on Product2 record SKU-TB-018" },
  { dept: "Operations", icon: <I.factory />, name: "Sarah Williams", title: "VP Operations", sfRole: "Site Lead — HCMC", queries: ["Manufacturing_Site__c where Region = APAC", "Energy_Log__c (last 90d)"], why: "Single VP role tied to the HCMC facility account" },
  { dept: "Logistics", icon: <I.truck />, name: "David Kim", title: "Logistics Manager", sfRole: "Shipment Owner", queries: ["Shipment__c where Product2 = SKU-TB-018", "Carrier__r.Mode"], why: "Owns 100% of outbound shipments for this SKU YTD" },
];

function StepPRM({ lcaData, go, pushToast }: { lcaData: LcaData; go: (s: Step) => void; pushToast: (t: string, k?: Toast["kind"]) => void }) {
  const [connected, setConnected] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState("2 min ago");
  const [provider, setProvider] = useState<"salesforce" | "hubspot" | "dynamics">("salesforce");

  function resync() {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); setLastSync("just now"); pushToast("PRM resynced — 4 owners confirmed", "success"); }, 1100);
  }

  return (
    <div style={{ padding: 40, maxWidth: 1180 }}>
      <BackBtn go={go} to={1} />
      
      <Eyebrow>Step 1.5 — PRM Integration</Eyebrow>
      <h1 className="page-title" style={{ marginBottom: 10 }}>How we knew who to ask.</h1>
      <p className="body-text" style={{ maxWidth: 720, marginBottom: 28 }}>
        ImpactBridge connects to your partner relationship system to map every data point in the LCA scope to a real person — no spreadsheets, no guessing who owns what.
      </p>

      {/* Connection bar */}
      <div className="card" style={{ padding: 18, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: "#00A1E0",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontWeight: 700, fontSize: 13, letterSpacing: "-0.02em",
          }}>SF</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 500 }}>Salesforce — Acme Brands Production Org</span>
              {connected && <span className="chip chip-green"><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green-dark)" }} /> Connected</span>}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
              acme.my.salesforce.com · OAuth 2.0 · Read-only · Last sync {lastSync}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={provider}
            onChange={(e) => { setProvider(e.target.value as typeof provider); pushToast(`Switched provider to ${e.target.value}`, "info"); }}
            className="input" style={{ width: "auto", padding: "8px 12px", fontSize: 13 }}
          >
            <option value="salesforce">Salesforce</option>
            <option value="hubspot">HubSpot</option>
            <option value="dynamics">Microsoft Dynamics</option>
          </select>
          <button onClick={resync} className="btn btn-outline btn-sm" disabled={syncing}>
            {syncing ? <><span className="spinner" style={{ borderTopColor: "var(--text-primary)" }} /> Syncing…</> : "Resync"}
          </button>
          <button onClick={() => setConnected(!connected)} className="btn btn-ghost btn-sm">
            {connected ? "Disconnect" : "Reconnect"}
          </button>
        </div>
      </div>

      {/* Field mapping */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="card-title">Field mapping</div>
            <span className="chip chip-gray">{PRM_FIELDS.length} fields resolved</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--gray-section)", color: "var(--text-tertiary)" }}>
                <th style={{ textAlign: "left", padding: "10px 20px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Salesforce field</th>
                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Maps to</th>
                <th style={{ textAlign: "left", padding: "10px 20px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {PRM_FIELDS.map((f) => (
                <tr key={f.sf} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 20px" }}><span className="mono" style={{ color: "var(--text-primary)" }}>{f.sf}</span></td>
                  <td style={{ padding: "12px 12px", color: "var(--text-secondary)" }}>{f.maps}</td>
                  <td style={{ padding: "12px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{f.val}</span>
                      <span className={f.conf === "exact" ? "chip chip-green" : "chip chip-blue"} style={{ fontSize: 10 }}>
                        {f.conf === "exact" ? "exact match" : "routing rule"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Routing logic</div>
          <p className="body-text" style={{ fontSize: 13, marginBottom: 14 }}>
            Each LCA data category is routed to the Salesforce contact whose role + account ownership best matches the request.
          </p>
          <div className="mono" style={{
            background: "var(--gray-section)", padding: 14, borderRadius: 10,
            fontSize: 12, lineHeight: 1.7, color: "var(--text-primary)",
          }}>
{`SELECT Contact.Id, Contact.Email,
       Contact.Department, Contact.Role
FROM   Contact
WHERE  AccountId IN :scopedAccounts
  AND  Role IN ('Procurement','Design',
                'Operations','Logistics')
  AND  IsActive = TRUE
ORDER BY LastActivityDate DESC`}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-tertiary)" }}>
            Query runs against your org. ImpactBridge never writes back.
          </div>
        </div>
      </div>

      {/* Identified owners */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <h2 className="section-title">4 data owners identified</h2>
          <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Resolved from 1,284 contacts across 3 accounts</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {PRM_OWNERS.map((o) => (
            <div key={o.dept} className="card card-hover">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, background: "var(--green-light)",
                    color: "var(--green-dark)", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{o.icon}</div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{o.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{o.title} · {o.dept}</div>
                  </div>
                </div>
                <span className="chip chip-blue" style={{ fontSize: 10 }}>SF · {o.sfRole}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, fontStyle: "italic" }}>
                Why this person: {o.why}
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                <div className="label" style={{ marginBottom: 6 }}>Sourced from</div>
                {o.queries.map((q) => (
                  <div key={q} className="mono" style={{ fontSize: 11, color: "var(--text-secondary)", padding: "2px 0" }}>· {q}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        marginTop: 28, padding: 16, background: "var(--green-light)",
        border: "1px solid var(--green-border)", borderRadius: 12, fontSize: 14, lineHeight: 1.7,
      }}>
        <div style={{ fontWeight: 500, marginBottom: 6 }}>Next: ImpactBridge will send each owner a focused request form covering only the data they own.</div>
        <div style={{ color: "var(--text-secondary)" }}>Forms auto-prefill 38 fields from Salesforce ({lcaData.productName}, BOM, supplier list, site address). Owners only fill what we can't pull automatically.</div>
      </div>

      <button onClick={() => go(2)} className="btn btn-primary" style={{ width: "100%", marginTop: 24, padding: 14 }}>
        Send requests to 4 teams →
      </button>
    </div>
  );
}
