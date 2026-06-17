import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import pathwaysLogo from "@/assets/pathwayslogo.png";
import sleepAndPlayImg from "@/assets/sleepandplay.webp";
import { calculateScenario, getActionRecommendations, runProductIntake } from "@/lib/api/lca.functions";
import { sendDataRequestEmails } from "@/lib/api/demo.functions";
import { buildFallbackFootprint, INTAKE_API_TIMEOUT_MS } from "@/lib/intake-fallback";
import {
  CARTERS_PRODUCTS,
  LP001_DEMO_ID,
  filterCartersProducts,
  formatCartersCategory,
  type CartersProduct,
} from "@/lib/carters-products";
import type {
  FootprintAnalysis,
  FootprintHotspot,
  ImpactCategory,
  ImpactStage,
  PlayRecommendation,
  ScenarioResult,
} from "@/lib/types/lca";

export const Route = createFileRoute("/")({
  component: PathwaysApp,
});

// ─────────────────────────────────────────────────────────────────────
// Types & shared state
// ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | "dashboard" | "model" | "prm" | "library" | "supplier";
type Toast = { id: number; kind: "success" | "warning" | "info"; text: string };

type LcaData = {
  productName: string;
  sku: string;
  category: string;
  primaryMaterial: string;
  countryOfManufacture: string;
  productWeight: string;
  boundary: "cradle-to-gate" | "cradle-to-grave" | "gate-to-grave";
  goals: string[];
  dataResponses: { procurement: boolean; design: boolean; operations: boolean; logistics: boolean };
  selectedPlay: string | null;
  selectedArtifact: "rfp" | "letter" | "brief";
  artifactGenerated: boolean;
  completed: boolean;
  footprint: FootprintAnalysis | null;
  plays: PlayRecommendation[] | null;
  scenarioResult: ScenarioResult | null;
  pipelineStatus: "idle" | "loading" | "ready" | "error";
  pipelineError: string | null;
  actionsStatus: "idle" | "loading" | "ready" | "error";
  scenarioStatus: "idle" | "loading" | "ready" | "error";
  footprintCalculating: boolean;
  reminderCounts: Record<string, number>;
};

function toIntakeInput(d: LcaData) {
  const productDetails = [
    d.sku && `SKU: ${d.sku}`,
    d.primaryMaterial && `Primary material: ${d.primaryMaterial}`,
    d.countryOfManufacture && `Country of manufacture: ${d.countryOfManufacture}`,
    d.productWeight && `Product weight: ${d.productWeight}`,
  ]
    .filter(Boolean)
    .join(". ");

  return {
    productName: d.productName,
    productDescription: productDetails || undefined,
    category: d.category,
    boundary: d.boundary,
    goals: d.goals,
  };
}

function LoadingPanel({ label, detail }: { label: string; detail?: string }) {
  return (
    <div className="card" style={{ padding: 48, textAlign: "center", marginTop: 24 }}>
      <span className="spinner" style={{ marginBottom: 16, borderTopColor: "var(--green-dark)" }} />
      <div style={{ fontWeight: 500, marginBottom: 6 }}>{label}</div>
      {detail && <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{detail}</div>}
    </div>
  );
}

function SourceBadge({ source }: { source?: "verified" | "ai_estimated" | "estimated" }) {
  if (source !== "verified") return null;
  return (
    <span className="chip chip-green" style={{ fontSize: 10, marginLeft: 8 }}>
      Verified
    </span>
  );
}

const STEP_LABELS = ["Intake", "Data", "Gap fill", "Footprint", "Actions", "Scenario", "Assign"];

const TABS: { id: Step; label: string }[] = [
  { id: 1, label: "Intake" },
  { id: "prm", label: "PRM" },
  { id: 2, label: "Data" },
  { id: 3, label: "Gap fill" },
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

function PathwaysApp() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [lcaData, setLcaData] = useState<LcaData>({
    productName: "",
    sku: "",
    category: "Babywear · Knit Sleepwear",
    primaryMaterial: "",
    countryOfManufacture: "",
    productWeight: "",
    boundary: "cradle-to-gate",
    goals: ["Sustainably Made: expand GOTS organic cotton", "Safe for Kids: eliminate restricted chemistries"],
    dataResponses: { procurement: true, design: true, operations: false, logistics: false },
    selectedPlay: null,
    selectedArtifact: "rfp",
    artifactGenerated: false,
    completed: false,
    footprint: null,
    plays: null,
    scenarioResult: null,
    pipelineStatus: "idle",
    pipelineError: null,
    actionsStatus: "idle",
    scenarioStatus: "idle",
    footprintCalculating: false,
    reminderCounts: {},
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

  const showTabs = currentStep !== "dashboard" && currentStep !== "library" && currentStep !== "supplier";
  const isSupplierView = currentStep === "supplier";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* TOP BAR */}
      {!isSupplierView && (
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "var(--topbar-height)",
        background: "white", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => go("dashboard")} style={{ display: "flex", alignItems: "center" }} aria-label="Pathways home">
            <img src={pathwaysLogo} alt="Pathways" style={{ height: 40, width: "auto", display: "block" }} />
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
      )}

      {isSupplierView && (
        <header style={{
          position: "fixed", top: 0, left: 0, right: 0, height: "var(--topbar-height)",
          background: "white", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 24px", zIndex: 50,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src={pathwaysLogo} alt="Pathways" style={{ height: 40, width: "auto", display: "block" }} />
            <span style={{ width: 1, height: 18, background: "var(--border-solid)" }} />
            <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Data request from Carter's, Inc.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-secondary)" }}>
            <span>Sunil Mehta · Shahi Exports</span>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", background: "var(--green-dark)",
              color: "white", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 600,
            }}>SM</div>
          </div>
        </header>
      )}

      {/* SIDEBAR */}
      {!isSupplierView && (
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
          <button onClick={() => go("library")} style={{
            width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8,
            fontSize: 14, color: currentStep === "library" ? "var(--green-dark)" : "var(--text-primary)",
            fontWeight: currentStep === "library" ? 500 : 400,
          }}>My LCAs</button>
          <button onClick={() => go("supplier")} style={{
            width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8,
            fontSize: 14, color: currentStep === "supplier" ? "var(--green-dark)" : "var(--text-primary)",
            fontWeight: currentStep === "supplier" ? 500 : 400,
          }}>Data Request View</button>
          <button style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, fontSize: 14 }}>Settings</button>
          <div style={{ marginTop: 16, padding: "8px 12px" }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Alex Johnson</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Sourcing Lead at Carter's, Inc.</div>
          </div>
        </div>
      </aside>
      )}

      {/* MAIN */}
      <main style={{
        marginLeft: isSupplierView ? 0 : "var(--sidebar-width)", paddingTop: "var(--topbar-height)",
        minHeight: "100vh",
      }}>
        {showTabs && <TabBar current={currentStep} go={go} />}
        <div className="fade-in" key={String(currentStep)}>
          {currentStep === 1 && <Step1 lcaData={lcaData} setLcaData={setLcaData} go={go} pushToast={pushToast} />}
          {currentStep === "prm" && <StepPRM lcaData={lcaData} go={go} pushToast={pushToast} />}
          {currentStep === 2 && <Step2 lcaData={lcaData} setLcaData={setLcaData} go={go} pushToast={pushToast} />}
          {currentStep === 3 && <Step3 go={go} />}
          {currentStep === "model" && <StepModel go={go} setLcaData={setLcaData} />}
          {currentStep === 4 && <Step4 lcaData={lcaData} go={go} />}
          {currentStep === 5 && <Step5 lcaData={lcaData} setLcaData={setLcaData} go={go} pushToast={pushToast} />}
          {currentStep === 6 && <Step6 lcaData={lcaData} setLcaData={setLcaData} go={go} pushToast={pushToast} />}
          {currentStep === 7 && <Step7 lcaData={lcaData} setLcaData={setLcaData} go={go} pushToast={pushToast} />}
          {currentStep === "dashboard" && <Dashboard go={go} />}
          {currentStep === "library" && <Library go={go} pushToast={pushToast} />}
          {currentStep === "supplier" && <SupplierUpload go={go} pushToast={pushToast} />}
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
// STEP 1: INTAKE
// ─────────────────────────────────────────────────────────────────────

function Step1({ lcaData, setLcaData, go, pushToast }: { lcaData: LcaData; setLcaData: (f: (d: LcaData) => LcaData) => void; go: (s: Step) => void; pushToast: (t: string, k?: Toast["kind"]) => void }) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [plmLoading, setPlmLoading] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);
  const plmLoadTimerRef = useRef<number | null>(null);
  const productMatches = filterCartersProducts(lcaData.productName);
  const categories = [
    ...new Set([
      "Babywear · Knit Sleepwear",
      "Footwear",
      "Packaging",
      "Electronics",
      "Food & Beverage",
      "Furniture",
      "Industrial",
      "Other",
      ...CARTERS_PRODUCTS.map(formatCartersCategory),
    ]),
  ];
  const boundaries = [
    { id: "cradle-to-gate", title: "Cradle to Gate", icon: <I.factory />, desc: "Materials through manufacturing." },
    { id: "cradle-to-grave", title: "Cradle to Grave", icon: <I.cycle />, desc: "Full lifecycle incl. use & disposal." },
    { id: "gate-to-grave", title: "Gate to Grave", icon: <I.truck />, desc: "From your facility to end of life." },
  ];
  const goals = [
    "Sustainably Made: expand GOTS organic cotton",
    "Safe for Kids: eliminate restricted chemistries (ZDHC MRSL)",
    "Tough for Play: durability ≥ 50 wash cycles",
  ];

  function toggleGoal(g: string) {
    setLcaData((d) => {
      const has = d.goals.includes(g);
      let next = has ? d.goals.filter((x) => x !== g) : [...d.goals, g];
      if (next.length > 2) next = next.slice(-2);
      return { ...d, goals: next };
    });
  }

  function selectProduct(product: CartersProduct) {
    const isDemoProduct = product.id === LP001_DEMO_ID;
    if (plmLoadTimerRef.current) window.clearTimeout(plmLoadTimerRef.current);

    setLcaData((d) => ({
      ...d,
      productName: product.name,
      sku: product.sku,
      category: formatCartersCategory(product),
      primaryMaterial: "",
      countryOfManufacture: "",
      productWeight: "",
    }));
    setProductSearchOpen(false);

    if (!isDemoProduct) {
      setPlmLoading(false);
      return;
    }

    setPlmLoading(true);
    plmLoadTimerRef.current = window.setTimeout(() => {
      setLcaData((d) => ({
        ...d,
        primaryMaterial: "Organic Cotton (GOTS Certified)",
        countryOfManufacture: "Bangladesh",
        productWeight: "0.4 lbs",
      }));
      setPlmLoading(false);
      pushToast("Product specs loaded from Carter's PLM", "success");
      plmLoadTimerRef.current = null;
    }, 1000);
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setProductSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (plmLoadTimerRef.current) window.clearTimeout(plmLoadTimerRef.current);
    };
  }, []);

  async function handleStartLca() {
    if (!lcaData.productName.trim() || lcaData.goals.length === 0) {
      pushToast("Add a product name and at least one goal", "warning");
      return;
    }

    setSubmitting(true);
    setLcaData((d) => ({ ...d, pipelineStatus: "loading", pipelineError: null, footprint: null, plays: null, scenarioResult: null }));

    let settled = false;

    const complete = (footprint: FootprintAnalysis, toastMsg: string, kind: Toast["kind"] = "success") => {
      if (settled) return;
      settled = true;
      setLcaData((d) => ({
        ...d,
        footprint,
        pipelineStatus: "ready",
        actionsStatus: "idle",
        scenarioStatus: "idle",
      }));
      pushToast(toastMsg, kind);
      go("prm");
      setSubmitting(false);
    };

    const apiCall = runProductIntake({ data: toIntakeInput(lcaData) });

    const timeoutId = window.setTimeout(() => {
      complete(
        buildFallbackFootprint(),
        "Showing estimated emission factors; live analysis still running",
        "info",
      );
    }, INTAKE_API_TIMEOUT_MS);

    try {
      const result = await apiCall;
      window.clearTimeout(timeoutId);
      if (!settled) {
        const verified = result.footprint.verifiedCount;
        const estimated = result.footprint.estimatedCount;
        complete(
          result.footprint,
          `Product classified · ${verified} verified and ${estimated} estimated emission sources`,
        );
      } else {
        setLcaData((d) => ({ ...d, footprint: result.footprint }));
      }
    } catch (error) {
      window.clearTimeout(timeoutId);
      if (!settled) {
        const message = error instanceof Error ? error.message : "Analysis failed";
        setLcaData((d) => ({ ...d, pipelineStatus: "error", pipelineError: message }));
        pushToast("Analysis failed. Check API keys and try again", "warning");
        setSubmitting(false);
      }
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>
      
      <div className="card">
        <Eyebrow>LCA Intake</Eyebrow>
        <h1 className="page-title" style={{ marginBottom: 10 }}>Tell us about your product.</h1>
        <p className="body-text" style={{ marginBottom: 32 }}>
          Four quick questions. Pathways handles the technical setup.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* F1: product search */}
          <div ref={productSearchRef} style={{ position: "relative" }}>
            <label className="label" style={{ display: "block", marginBottom: 8 }}>Product name</label>
            <input
              className="input"
              value={lcaData.productName}
              onChange={(e) => {
                if (plmLoadTimerRef.current) window.clearTimeout(plmLoadTimerRef.current);
                setPlmLoading(false);
                setLcaData((d) => ({
                  ...d,
                  productName: e.target.value,
                  sku: "",
                  primaryMaterial: "",
                  countryOfManufacture: "",
                  productWeight: "",
                }));
                setProductSearchOpen(true);
              }}
              onFocus={() => setProductSearchOpen(true)}
              placeholder="Search Carter's product DB by name, category, or SKU"
              autoComplete="off"
            />
            {productSearchOpen && lcaData.productName.trim() && productMatches.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                background: "white", border: "1px solid var(--border-solid)", borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,0.08)", zIndex: 30, overflow: "hidden", maxHeight: 320, overflowY: "auto",
              }}>
                {productMatches.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => selectProduct(product)}
                    style={{
                      display: "block", width: "100%", textAlign: "left", padding: "12px 14px",
                      borderBottom: "1px solid var(--border)", background: "white",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--green-light)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "white"; }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{product.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                      {formatCartersCategory(product)} · <span className="mono">{product.sku}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {productSearchOpen && lcaData.productName.trim() && productMatches.length === 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                background: "white", border: "1px solid var(--border-solid)", borderRadius: 10,
                padding: "14px", fontSize: 13, color: "var(--text-tertiary)", zIndex: 30,
              }}>
                No matching Carter's products; you can still enter a custom name.
              </div>
            )}
          </div>

          {lcaData.sku && (
            <div>
              <label className="label" style={{ display: "block", marginBottom: 8 }}>SKU</label>
              <input className="input" value={lcaData.sku} readOnly style={{ background: "var(--gray-section)", color: "var(--text-secondary)" }} />
            </div>
          )}

          {plmLoading && (
            <div className="card" style={{ padding: 16, background: "var(--green-light)", border: "1px solid var(--green-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--text-secondary)" }}>
                <span className="spinner" style={{ borderTopColor: "var(--green-dark)" }} />
                Loading from Carter's PLM…
              </div>
            </div>
          )}

          {!plmLoading && (lcaData.primaryMaterial || lcaData.countryOfManufacture || lcaData.productWeight) && (
            <div className="card" style={{ padding: 16, background: "var(--green-light)", border: "1px solid var(--green-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span className="chip chip-green" style={{ fontSize: 11 }}>Loaded from Carter's PLM</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "112px 1fr", gap: 16, alignItems: "start" }}>
                <div style={{
                  borderRadius: 10, overflow: "hidden", background: "white",
                  border: "1px solid var(--green-border)", aspectRatio: "1",
                }}>
                  <img
                    src={sleepAndPlayImg}
                    alt={lcaData.productName || "Product image from Carter's PLM"}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {lcaData.primaryMaterial && (
                    <div>
                      <div className="label" style={{ marginBottom: 4 }}>Primary material</div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{lcaData.primaryMaterial}</div>
                    </div>
                  )}
                  {lcaData.countryOfManufacture && (
                    <div>
                      <div className="label" style={{ marginBottom: 4 }}>Country of manufacture</div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{lcaData.countryOfManufacture}</div>
                    </div>
                  )}
                  {lcaData.productWeight && (
                    <div>
                      <div className="label" style={{ marginBottom: 4 }}>Product weight</div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{lcaData.productWeight}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
              Uses PEFCR + ecoinvent 3.10 / Higg MSI 3.7 for this category.
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


        <button onClick={handleStartLca} className="btn btn-primary" style={{ width: "100%", marginTop: 24, padding: "14px" }} disabled={submitting}>
          {submitting ? <><span className="spinner" style={{ borderTopColor: "white" }} /> Setting up your LCA…</> : "Connect PRM & start LCA →"}
        </button>
        {lcaData.pipelineStatus === "error" && (
          <div style={{ marginTop: 12, fontSize: 13, color: "var(--amber)" }}>{lcaData.pipelineError}</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STEP 2: DATA COLLECTION
// ─────────────────────────────────────────────────────────────────────

type RequestStatus = "done" | "pending";
const REQUESTS: { id: string; icon: ReactNode; title: string; body: string; who: string; sent: string; received: string; status: RequestStatus; group: "internal" | "external" }[] = [
  // Internal · Carter's HQ (9)
  { id: "pm",          group: "internal", icon: <I.box />,    title: "Product Management",            body: "BOM, product weight/dimensions, compliance deadlines, supplier contact list",                  who: "Alex Johnson · Sr. Product Manager, Little Planet™",       sent: "June 13, 2026 at 9:04am", received: "June 13, 2026 at 11:42am", status: "done"    },
  { id: "design",      group: "internal", icon: <I.pencil />, title: "Design & Product Development",  body: "Material % composition, GSM, snap & trim spec, wash-cycle durability, end-of-life design",     who: "Megan O'Connell · Senior Designer, Little Planet™",        sent: "June 13, 2026 at 9:04am", received: "June 14, 2026 at 10:17am", status: "done"    },
  { id: "rd",          group: "internal", icon: <I.pencil />, title: "R&D / Engineering",             body: "Process specs (knit, dye, finish), packaging design, disassembly index",                       who: "Wei Zhang · Textile R&D Engineer",                         sent: "June 13, 2026 at 9:04am", received: "-",                         status: "pending" },
  { id: "sourcing",    group: "internal", icon: <I.box />,    title: "Sourcing, Babywear",           body: "Tier 1 + Tier 2 vendor list, fabric spec contracts, supplier locations, inbound freight",      who: "Priya Raghavan · Director, Sourcing, Babywear",           sent: "June 13, 2026 at 9:04am", received: "June 13, 2026 at 2:31pm",  status: "done"    },
  { id: "procurement", group: "internal", icon: <I.box />,    title: "Procurement, Trims & Packaging", body: "Trim & packaging POs (YKK, Avery Dennison FSC), inbound packaging materials",                 who: "Hannah Park · Procurement Manager, Trims & Packaging",     sent: "June 13, 2026 at 9:04am", received: "June 14, 2026 at 8:55am",  status: "done"    },
  { id: "mfgops",      group: "internal", icon: <I.factory />,title: "Manufacturing Ops",             body: "Tier 1 facility energy mix, water use, waste manifests, ZDHC ClearStream",                     who: "Rakesh Iyer · Mfg Ops Lead, India South",                  sent: "June 13, 2026 at 9:04am", received: "-",                         status: "pending" },
  { id: "facilities",  group: "internal", icon: <I.factory />,title: "Facilities, Bengaluru",        body: "Per-line equipment efficiency, steam consumption, compressed-air kWh per run",                 who: "Anjali Krishnan · Facilities Manager, Shahi Unit 8 (embed)",sent: "June 13, 2026 at 9:04am", received: "-",                         status: "pending" },
  { id: "logistics",   group: "internal", icon: <I.truck />,  title: "Global Logistics",              body: "Mundra → Savannah lane, container utilization, inbound/outbound freight volumes YTD",          who: "Daniel Reyes · Sr. Manager, Global Logistics",             sent: "June 13, 2026 at 9:04am", received: "June 13, 2026 at 4:08pm",  status: "done"    },
  { id: "dcops",       group: "internal", icon: <I.truck />,  title: "Distribution, Braselton DC",   body: "Warehouse energy use, last-mile carrier mix from Braselton DC",                                who: "Marcus Lee · DC Operations Manager, Braselton GA",         sent: "June 13, 2026 at 9:04am", received: "-",                         status: "pending" },
  // External · vendor contacts via Pathways Data Request (7)
  { id: "shahi",       group: "external", icon: <I.box />,    title: "Tier 1: Shahi Exports",        body: "Primary material production data, component EPDs, packaging weight",                           who: "Sunil Mehta · Sustainability Lead, Shahi Exports",        sent: "June 13, 2026 at 9:05am", received: "June 14, 2026 at 6:12pm",  status: "done"    },
  { id: "arvind",      group: "external", icon: <I.box />,    title: "Tier 2 Mill: Arvind Limited",  body: "GOTS certificate, dye-house energy, effluent (kg) for the knit fabric",                       who: "Lakshmi Narayanan · EHS Manager, Arvind (Naroda)",        sent: "June 13, 2026 at 9:05am", received: "June 15, 2026 at 9:30am",  status: "done"    },
  { id: "lenzing",     group: "external", icon: <I.box />,    title: "Tier 2 Fiber: Lenzing AG",     body: "EcoVero™ LCA module + FSC chain-of-custody for the 5% viscose blend",                          who: "Klaus Berger · Sustainability Manager, Lenzing AG",       sent: "June 13, 2026 at 9:05am", received: "June 14, 2026 at 1:48pm",  status: "done"    },
  { id: "shahi-fin",   group: "external", icon: <I.factory />,title: "Contract Mfg: Shahi Unit 8 Finishing", body: "Per-unit energy (kWh), scrap rate, coating/printing process emissions",                  who: "Aditi Sharma · Plant Manager, Shahi Unit 8 Finishing",    sent: "June 13, 2026 at 9:05am", received: "-",                         status: "pending" },
  { id: "ykk",         group: "external", icon: <I.box />,    title: "Trim Supplier: YKK SNAD",      body: "Snap material spec, nickel-free certificate, component weight per garment",                    who: "Tomoko Yamada · Account Manager, YKK SNAD (Tirupur)",     sent: "June 13, 2026 at 9:05am", received: "June 13, 2026 at 11:05pm", status: "done"    },
  { id: "maersk",      group: "external", icon: <I.truck />,  title: "3PL Ocean: Maersk Spot",       body: "Mundra → Savannah lane distance, vessel fuel mix (VLSFO vs. bio-blend), TEU utilization",      who: "Henrik Sørensen · Account Director, Maersk Spot",         sent: "June 13, 2026 at 9:05am", received: "-",                         status: "pending" },
  { id: "schneider",   group: "external", icon: <I.truck />,  title: "3PL Inland: Schneider National", body: "Savannah → Braselton drayage distance, diesel gal/mile, rail vs. road mode mix",             who: "Carla Mendes · Operations Lead, Schneider National",      sent: "June 13, 2026 at 9:05am", received: "-",                         status: "pending" },
];


function Step2({ lcaData, setLcaData, go, pushToast }: { lcaData: LcaData; setLcaData: (f: (d: LcaData) => LcaData) => void; go: (s: Step) => void; pushToast: (t: string, k?: Toast["kind"]) => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const total = REQUESTS.length;
  const done = REQUESTS.filter((r) => r.status === "done").length;
  const pending = total - done;

  function sendReminder(requestId: string, ownerName: string) {
    const nextCount = (lcaData.reminderCounts[requestId] ?? 0) + 1;
    setLcaData((d) => ({
      ...d,
      reminderCounts: { ...d.reminderCounts, [requestId]: nextCount },
    }));
    pushToast(`Reminder ${nextCount} sent to ${ownerName}`, "info");
  }

  return (
    <div style={{ padding: 40 }}>
      <BackBtn go={go} to="prm" />
      <Eyebrow>Data Collection</Eyebrow>
      <h1 className="page-title" style={{ marginBottom: 10 }}>Requests sent to {total} owners.</h1>
      <div style={{ maxWidth: 1100, marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            {done} of {total} responses received · waiting on {pending}
          </span>
          <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{Math.round((done / total) * 100)}%</span>
        </div>
        <div style={{ height: 6, background: "var(--border-solid)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${(done / total) * 100}%`, height: "100%", background: "var(--green-dark)", transition: "width 400ms ease" }} />
        </div>
      </div>

      {(["internal", "external"] as const).map((g) => {
        const items = REQUESTS.filter((r) => r.group === g);
        const groupDone = items.filter((r) => r.status === "done").length;
        const isInternal = g === "internal";
        return (
          <div key={g} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, maxWidth: 1100 }}>
              <span className={isInternal ? "chip chip-green" : "chip chip-blue"} style={{ fontSize: 11 }}>
                {isInternal ? "Internal · Carter's HQ" : "External · vendor accounts"}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                {groupDone} of {items.length} responses
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 1100 }}>
              {items.map((r) => {
                const reminders = lcaData.reminderCounts[r.id] ?? 0;
                const ownerName = r.who.split(" · ")[0];
                return (
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
                    {r.status === "pending" && (
                      <div><span className="label" style={{ marginRight: 6 }}>Reminders</span> {reminders} sent</div>
                    )}
                  </div>
                  <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                    {r.status === "done" ? (
                      <button onClick={() => r.id === "sourcing" ? setModalOpen(true) : pushToast(`Opened ${r.title} response`, "info")}
                        className="btn btn-outline btn-sm" style={{ color: "var(--green-dark)", borderColor: "var(--green-border)" }}>
                        View response →
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => sendReminder(r.id, ownerName)}
                          className="btn btn-outline btn-sm" style={{ color: "var(--amber)", borderColor: "var(--amber-border)" }}>
                          {reminders > 0 ? `Send reminder (${reminders} sent) →` : "Send reminder →"}
                        </button>
                        <button onClick={() => go("supplier")}
                          className="btn btn-ghost btn-sm" style={{ color: "var(--text-secondary)" }}>
                          Open data request ↗
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
        <button onClick={() => go(3)} className="btn btn-primary">Continue with available data →</button>
        <button onClick={() => pushToast(`Waiting on ${pending} owners; reminders queued for tomorrow 9am`, "info")} className="btn btn-ghost">
          Wait for all responses
        </button>
      </div>


      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)} title="Sourcing Response · Priya Raghavan"
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
                ["Fabric blend", "60% organic cotton (GOTS) + 40% Lenzing™ EcoVero™ viscose", "Supplier cert"],
                ["Garment weight", "112g per piece · 336g per 3-pack", "Tech pack v4.1"],
                ["Tier 1 cut & sew", "Shahi Exports, Unit 8, Bengaluru, IN", "Vendor registry"],
                ["Tier 2 fabric mill", "Arvind Limited, Naroda, Ahmedabad, IN", "Vendor registry"],
                ["FOB cost / 3-pack", "$4.62", "PO #CT-2026-08841"],
                ["GOTS certified", "Yes: Scope Certificate #GOTS-IN-9182", "Control Union"],
                ["OEKO-TEX Std 100", "Class I (suitable for infants)", "Cert #21.HIN.55812"],
                ["Snap component", "Nickel-free brass, YKK SNAD, Tirupur, IN", "Tech pack"],
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
// STEP 3: GAP FILL
// ─────────────────────────────────────────────────────────────────────

type FillRow = { field: string; value: string; source: "Default" | "Primary" | "Estimated" };
type FillGroup = { id: string; label: string; rows: FillRow[] };

const AI_FILL_GROUPS: FillGroup[] = [
  {
    id: "scope",
    label: "Goal & scope",
    rows: [
      { field: "Product name", value: "Little Planet™ Organic Sleep & Play (3-Pack)", source: "Default" },
      { field: "SKU / style", value: "LP-3PSP-NB · Style #225G731", source: "Default" },
      { field: "Category", value: "Babywear · Knit Sleepwear", source: "Default" },
      { field: "Functional unit", value: "1 unit (112g per piece · 336g per 3-pack)", source: "Default" },
      { field: "System boundary", value: "Cradle to gate", source: "Default" },
      { field: "Allocation method", value: "Physical (mass)", source: "Default" },
      { field: "Reference year", value: "2026", source: "Default" },
      { field: "Geography", value: "IN production · US consumption", source: "Default" },
      { field: "Impact method", value: "PEFCR Apparel · ReCiPe 2016 Midpoint", source: "Default" },
    ],
  },
  {
    id: "materials",
    label: "Materials & BOM",
    rows: [
      { field: "Fabric blend", value: "60% GOTS organic cotton + 40% Lenzing™ EcoVero™ viscose", source: "Primary" },
      { field: "Fabric GSM", value: "180 GSM single jersey interlock", source: "Primary" },
      { field: "Yarn count", value: "30/1 combed ring-spun organic cotton", source: "Primary" },
      { field: "Garment weight", value: "112g per piece · 336g per 3-pack", source: "Primary" },
      { field: "Cotton origin", value: "Gujarat, IN (GOTS Scope Cert #GOTS-IN-9182)", source: "Primary" },
      { field: "Viscose supplier", value: "Lenzing AG · EcoVero™ (FSC chain of custody)", source: "Primary" },
      { field: "Trim, snaps", value: "Nickel-free brass YKK SNAD · 4.2g per garment", source: "Primary" },
      { field: "Thread & label", value: "100% organic cotton thread · woven cotton label", source: "Primary" },
      { field: "BOM line items", value: "14 components (fabric, trims, packaging)", source: "Primary" },
    ],
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    rows: [
      { field: "Tier 1 cut & sew", value: "Shahi Exports, Unit 8, Bengaluru, IN", source: "Primary" },
      { field: "Tier 2 fabric mill", value: "Arvind Limited, Naroda, Ahmedabad, IN", source: "Primary" },
      { field: "Knit process", value: "Circular knit · 28 gauge", source: "Primary" },
      { field: "Dye process", value: "Reactive dye · cold-pad batch", source: "Primary" },
      { field: "Finish process", value: "Softener + enzyme wash · OEKO-TEX Class I", source: "Primary" },
      { field: "Production volume", value: "480,000 units / year (run rate)", source: "Primary" },
      { field: "Manufacturing energy", value: "2.8 kWh / 3-pack", source: "Estimated" },
      { field: "Process water", value: "42 L / 3-pack (knit + dye + finish)", source: "Estimated" },
      { field: "Wastewater effluent", value: "38 L / 3-pack · ZDHC Level 3", source: "Estimated" },
      { field: "Scrap rate", value: "4.2% cut-and-sew · 1.8% finishing", source: "Estimated" },
    ],
  },
  {
    id: "energy",
    label: "Energy & utilities",
    rows: [
      { field: "Facility energy mix", value: "India South grid (0.71 kgCO₂e/kWh)", source: "Estimated" },
      { field: "Steam consumption", value: "0.6 kg steam / garment (dye house)", source: "Estimated" },
      { field: "Compressed air", value: "0.04 kWh / garment (finishing line)", source: "Estimated" },
      { field: "Renewable on-site", value: "0% (no PPA at Unit 8; pilot planned)", source: "Estimated" },
    ],
  },
  {
    id: "logistics",
    label: "Logistics & distribution",
    rows: [
      { field: "Ocean lane", value: "Mundra, IN → Savannah, GA", source: "Primary" },
      { field: "Port of export", value: "Mundra · ICD Bengaluru drayage", source: "Primary" },
      { field: "Port of import", value: "Savannah · Schneider drayage to Braselton DC", source: "Primary" },
      { field: "Transport distance", value: "13,800 km sea + 280 mi inland", source: "Estimated" },
      { field: "Container utilization", value: "82% TEU fill (consolidated weekly)", source: "Estimated" },
      { field: "Last-mile mode", value: "67% truck · 33% rail from Braselton DC", source: "Estimated" },
      { field: "FOB cost / 3-pack", value: "$4.62", source: "Primary" },
    ],
  },
  {
    id: "packaging",
    label: "Packaging",
    rows: [
      { field: "Primary pack", value: "FSC hangtag + belly band (no polybag)", source: "Primary" },
      { field: "Hangtag material", value: "FSC Mix 70% recycled paperboard", source: "Primary" },
      { field: "Carton spec", value: "Corrugated master carton · 24 3-packs", source: "Primary" },
      { field: "Packaging weight", value: "18g per 3-pack (hangtag + band)", source: "Estimated" },
    ],
  },
  {
    id: "compliance",
    label: "Certifications & compliance",
    rows: [
      { field: "GOTS / OEKO-TEX", value: "GOTS Scope Cert + OEKO-TEX Class I", source: "Primary" },
      { field: "ZDHC MRSL", value: "Level 3 · ClearStream effluent 2026-Q1", source: "Primary" },
      { field: "Nickel-free trim cert", value: "YKK SNAD cert #YKK-NF-2026-0412", source: "Primary" },
      { field: "Restricted substances", value: "CPSIA + REACH Annex XVII compliant", source: "Primary" },
    ],
  },
  {
    id: "eol",
    label: "End of life",
    rows: [
      { field: "Disposal route", value: "85% landfill · 12% incineration · 3% textile recycling", source: "Estimated" },
      { field: "Recyclability index", value: "0.42 (mixed fiber; mono-cotton target 0.78)", source: "Estimated" },
      { field: "Biodegradability", value: "Cotton fraction biodegradable · viscose semi-synthetic", source: "Estimated" },
    ],
  },
];

const AI_FILL_ROWS = AI_FILL_GROUPS.flatMap((g) => g.rows);

const AI_THINKING_STEPS = [
  "Scanning 16 responses for gaps…",
  "12 fields missing from R&D, Ops, 3PL",
  "Querying ecoinvent 3.10: knit, IN",
  "Cross-referencing Higg MSI 3.7",
  "Estimating mfg energy from grid mix",
  "Inferring Mundra → Savannah lane",
  "Filling packaging & end-of-life defaults",
];

function Step3({ go }: { go: (s: Step) => void }) {
  const [phase, setPhase] = useState<"thinking" | "filling" | "done">("thinking");
  const [thinkingIdx, setThinkingIdx] = useState(0);
  const [filledAiCount, setFilledAiCount] = useState(0);
  const [accuracy, setAccuracy] = useState(58);
  const [buildingModel, setBuildingModel] = useState(false);

  const aiRows = AI_FILL_ROWS.filter((r) => r.source === "Estimated");
  const primaryCount = AI_FILL_ROWS.filter((r) => r.source !== "Estimated").length;

  useEffect(() => {
    if (phase === "done") return;
    const rotate = setInterval(() => setThinkingIdx((i) => (i + 1) % AI_THINKING_STEPS.length), 850);
    return () => clearInterval(rotate);
  }, [phase]);

  useEffect(() => {
    if (phase !== "thinking") return;
    const startFill = setTimeout(() => setPhase("filling"), 2400);
    return () => clearTimeout(startFill);
  }, [phase]);

  useEffect(() => {
    if (phase !== "filling") return;
    if (filledAiCount >= aiRows.length) {
      const doneTimer = setTimeout(() => {
        setPhase("done");
        setAccuracy(74);
      }, 500);
      return () => clearTimeout(doneTimer);
    }
    const fillTimer = setTimeout(() => {
      setFilledAiCount((c) => c + 1);
      setAccuracy((a) => Math.min(74, a + Math.ceil(16 / aiRows.length)));
    }, 520);
    return () => clearTimeout(fillTimer);
  }, [phase, filledAiCount, aiRows.length]);

  function badge(s: string, loading?: boolean) {
    if (loading || s === "Estimated") return null;
    if (s === "Primary") return <span className="chip chip-green" style={{ fontSize: 10 }}>Primary</span>;
    return <span className="chip chip-gray" style={{ fontSize: 10 }}>Default</span>;
  }

  function rowState(row: FillRow, rowIndex: number) {
    if (row.source !== "Estimated") return { value: row.value, loading: false, filled: true };
    const aiIndex = AI_FILL_ROWS.slice(0, rowIndex + 1).filter((r) => r.source === "Estimated").length - 1;
    if (phase === "thinking") return { value: "", loading: true, filled: false };
    if (phase === "filling" && aiIndex >= filledAiCount) return { value: "", loading: true, filled: false };
    return { value: row.value, loading: false, filled: true };
  }

  async function handleBuildModel() {
    setBuildingModel(true);
    await new Promise((r) => setTimeout(r, 600));
    go("model");
  }

  const title = phase === "done"
    ? `${aiRows.length} gaps filled. Model ready.`
    : phase === "filling"
      ? "Filling gaps with benchmark data…"
      : "Analyzing gaps across 16 responses…";

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: 40 }}>
      <BackBtn go={go} to={2} />
      <Eyebrow>Gap fill</Eyebrow>
      <h1 className="page-title" style={{ marginBottom: 8 }}>{title}</h1>
      <p className="body-text" style={{ maxWidth: 760, marginBottom: 20 }}>
        {phase === "done"
          ? `${AI_FILL_ROWS.length} LCA inputs assembled: ${primaryCount} from owners, ${aiRows.length} from benchmarks.`
          : "Comparing owner responses to the BOM and filling gaps from benchmarks."}
      </p>

      {(phase === "thinking" || phase === "filling") && (
        <div className="card" style={{ padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, background: "var(--green-light)", border: "1px solid var(--green-border)" }}>
          <span className="spinner" style={{ borderTopColor: "var(--green-dark)", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--green-dark)" }}>
              {phase === "thinking" ? "Matching responses to BOM template" : `Estimating field ${filledAiCount + 1} of ${aiRows.length}…`}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }} className="fade-in" key={thinkingIdx}>
              {AI_THINKING_STEPS[thinkingIdx]}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 20, alignItems: "start" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden", maxHeight: 520, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "baseline", flexShrink: 0 }}>
            <div className="card-title" style={{ fontSize: 14 }}>LCA data inputs</div>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{AI_FILL_ROWS.length} fields · {AI_FILL_GROUPS.length} sections</span>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {AI_FILL_GROUPS.map((group) => (
              <div key={group.id}>
                <div style={{
                  padding: "8px 18px", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)",
                  textTransform: "uppercase", letterSpacing: "0.06em", background: "var(--gray-section)",
                  borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 1,
                }}>
                  {group.label}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                  {group.rows.map((row) => {
                    const rowIndex = AI_FILL_ROWS.indexOf(row);
                    const { value, loading, filled } = rowState(row, rowIndex);
                    const isAi = row.source === "Estimated";
                    return (
                      <div key={row.field} style={{
                        padding: "8px 14px", borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)",
                        background: isAi && filled ? "rgba(254,243,226,0.35)" : isAi && loading ? "rgba(254,243,226,0.12)" : "transparent",
                        transition: "background 400ms ease", minHeight: 52,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 3 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>{row.field}</div>
                          {badge(row.source, loading)}
                        </div>
                        <div style={{ fontSize: 12, color: loading ? "var(--text-tertiary)" : "var(--text-secondary)", lineHeight: 1.35 }} className="tabular">
                          {loading ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <span className="spinner" style={{ width: 10, height: 10, borderTopColor: "var(--amber)" }} />
                              <span style={{ fontStyle: "italic" }}>Inferring…</span>
                            </span>
                          ) : value}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="card-title" style={{ fontSize: 13, marginBottom: 8 }}>Input summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
              {AI_FILL_GROUPS.map((g) => (
                <div key={g.id} style={{ padding: "6px 8px", background: "var(--gray-section)", borderRadius: 6 }}>
                  <div style={{ color: "var(--text-tertiary)", fontSize: 10, marginBottom: 2 }}>{g.label}</div>
                  <div style={{ fontWeight: 600 }}>{g.rows.length}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div className="label" style={{ marginBottom: 6 }}>Data accuracy</div>
            <div className="num-large" style={{ color: "var(--green-dark)", fontSize: 28 }}>{accuracy}%</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              {phase === "done" ? `${primaryCount} primary · ${aiRows.length} gap-filled` : `${primaryCount + filledAiCount} primary · ${filledAiCount} gap-filled`}
            </div>
            <div style={{ height: 5, background: "var(--border-solid)", borderRadius: 4, marginTop: 10, overflow: "hidden" }}>
              <div style={{ width: `${accuracy}%`, height: "100%", background: "var(--green-dark)", transition: "width 500ms ease" }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
              {phase === "done" ? "Reaches 92% when Ops & Logistics respond" : "Updating as gaps fill…"}
            </div>
          </div>
        </div>
      </div>

      <button onClick={handleBuildModel} className="btn btn-primary" style={{ width: "100%", marginTop: 20, padding: 14 }} disabled={phase !== "done" || buildingModel}>
        {buildingModel ? <><span className="spinner" style={{ borderTopColor: "white" }} /> Preparing model…</> : "Build the model →"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STEP 4: FOOTPRINT
// ─────────────────────────────────────────────────────────────────────

const STAGE_COLORS = ["#2C6B45", "#4A9B6F", "#7BC4A0", "#B8E0CC", "#DCF0E6"];

const IMPACT_CATEGORIES: ImpactCategory[] = [
  {
    id: "climate",
    label: "Climate change",
    total: 3240,
    unit: "kg CO₂e",
    vsIndustry: "-18%",
    vsIndustryGood: true,
    topHotspot: "Materials",
    topHotspotPct: 61,
    stages: [
      { name: "Materials", value: 1976, pct: 61, color: STAGE_COLORS[0] },
      { name: "Manufacturing", value: 648, pct: 20, color: STAGE_COLORS[1] },
      { name: "Logistics", value: 421, pct: 13, color: STAGE_COLORS[2] },
      { name: "Consumer Use", value: 129, pct: 4, color: STAGE_COLORS[3] },
      { name: "End of Life", value: 66, pct: 2, color: STAGE_COLORS[4] },
    ],
  },
  {
    id: "water",
    label: "Water deprivation",
    total: 8420,
    unit: "m³ world eq.",
    vsIndustry: "+12%",
    vsIndustryGood: false,
    topHotspot: "Materials",
    topHotspotPct: 70,
    stages: [
      { name: "Materials", value: 5894, pct: 70, color: STAGE_COLORS[0] },
      { name: "Manufacturing", value: 1684, pct: 20, color: STAGE_COLORS[1] },
      { name: "Logistics", value: 505, pct: 6, color: STAGE_COLORS[2] },
      { name: "Consumer Use", value: 253, pct: 3, color: STAGE_COLORS[3] },
      { name: "End of Life", value: 84, pct: 1, color: STAGE_COLORS[4] },
    ],
  },
  {
    id: "energy",
    label: "Energy demand",
    total: 148,
    unit: "MJ",
    vsIndustry: "-9%",
    vsIndustryGood: true,
    topHotspot: "Manufacturing",
    topHotspotPct: 39,
    renewableTotal: 42,
    nonRenewableTotal: 106,
    stages: [
      { name: "Materials", value: 52, pct: 35, color: STAGE_COLORS[0], renewable: 18, nonRenewable: 34 },
      { name: "Manufacturing", value: 58, pct: 39, color: STAGE_COLORS[1], renewable: 12, nonRenewable: 46 },
      { name: "Logistics", value: 28, pct: 19, color: STAGE_COLORS[2], renewable: 8, nonRenewable: 20 },
      { name: "Consumer Use", value: 7, pct: 5, color: STAGE_COLORS[3], renewable: 2, nonRenewable: 5 },
      { name: "End of Life", value: 3, pct: 2, color: STAGE_COLORS[4], renewable: 2, nonRenewable: 1 },
    ],
  },
  {
    id: "eutrophication",
    label: "Eutrophication",
    total: 2.8,
    unit: "kg PO₄³⁻ eq.",
    vsIndustry: "+8%",
    vsIndustryGood: false,
    topHotspot: "Materials",
    topHotspotPct: 54,
    stages: [
      { name: "Materials", value: 1.51, pct: 54, color: STAGE_COLORS[0] },
      { name: "Manufacturing", value: 0.87, pct: 31, color: STAGE_COLORS[1] },
      { name: "Logistics", value: 0.22, pct: 8, color: STAGE_COLORS[2] },
      { name: "Consumer Use", value: 0.14, pct: 5, color: STAGE_COLORS[3] },
      { name: "End of Life", value: 0.06, pct: 2, color: STAGE_COLORS[4] },
    ],
  },
  {
    id: "acidification",
    label: "Acidification",
    total: 18.6,
    unit: "kg SO₂ eq.",
    vsIndustry: "-14%",
    vsIndustryGood: true,
    topHotspot: "Manufacturing",
    topHotspotPct: 43,
    stages: [
      { name: "Materials", value: 6.5, pct: 35, color: STAGE_COLORS[0] },
      { name: "Manufacturing", value: 8.0, pct: 43, color: STAGE_COLORS[1] },
      { name: "Logistics", value: 2.4, pct: 13, color: STAGE_COLORS[2] },
      { name: "Consumer Use", value: 1.1, pct: 6, color: STAGE_COLORS[3] },
      { name: "End of Life", value: 0.6, pct: 3, color: STAGE_COLORS[4] },
    ],
  },
  {
    id: "toxicity",
    label: "Human toxicity",
    total: 12.4,
    unit: "CTUh",
    vsIndustry: "-22%",
    vsIndustryGood: true,
    topHotspot: "Materials",
    topHotspotPct: 58,
    stages: [
      { name: "Materials", value: 7.2, pct: 58, color: STAGE_COLORS[0] },
      { name: "Manufacturing", value: 3.1, pct: 25, color: STAGE_COLORS[1] },
      { name: "Logistics", value: 1.2, pct: 10, color: STAGE_COLORS[2] },
      { name: "Consumer Use", value: 0.6, pct: 5, color: STAGE_COLORS[3] },
      { name: "End of Life", value: 0.3, pct: 2, color: STAGE_COLORS[4] },
    ],
  },
];

const HOTSPOTS = [
  {
    id: "materials",
    badge: "Materials",
    badgeColor: "green",
    title: "Organic cotton + EcoVero™",
    impacts: {
      climate: "1,976 kg · 61%",
      water: "5,894 m³ · 70%",
      energy: "52 MJ · 35%",
      eutrophication: "1.51 kg · 54%",
      acidification: "6.5 kg · 35%",
      toxicity: "7.2 CTUh · 58%",
    },
    note: "Cotton farming drives water and toxicity.",
  },
  {
    id: "manufacturing",
    badge: "Manufacturing",
    badgeColor: "amber",
    title: "Shahi Unit 8: dye & cut/sew",
    impacts: {
      climate: "648 kg · 20%",
      water: "1,684 m³ · 20%",
      energy: "58 MJ · 39%",
      eutrophication: "0.87 kg · 31%",
      acidification: "8.0 kg · 43%",
      toxicity: "3.1 CTUh · 25%",
    },
    note: "Grid mix and reactive dyeing drive acidification.",
  },
  {
    id: "logistics",
    badge: "Logistics",
    badgeColor: "blue",
    title: "Mundra → Savannah freight",
    impacts: {
      climate: "421 kg · 13%",
      water: "505 m³ · 6%",
      energy: "28 MJ · 19%",
      eutrophication: "0.22 kg · 8%",
      acidification: "2.4 kg · 13%",
      toxicity: "1.2 CTUh · 10%",
    },
    note: "Sea freight is the main logistics driver.",
  },
];

function formatImpactValue(value: number, unit: string): string {
  if (unit === "kg PO₄³⁻ eq." || unit === "kg SO₂ eq." || unit === "CTUh") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function shortenHotspotNote(note: string, maxLen = 72): string {
  const trimmed = note.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const sentence = trimmed.match(/^[^.!?]+[.!?]/)?.[0]?.trim();
  if (sentence && sentence.length <= maxLen) return sentence;
  const cut = trimmed.slice(0, maxLen - 1).replace(/\s+\S*$/, "");
  return `${cut}…`;
}

function Step4({ lcaData, go }: { lcaData: LcaData; go: (s: Step) => void }) {
  const impactCategories = lcaData.footprint?.impactCategories ?? IMPACT_CATEGORIES;
  const hotspots = (lcaData.footprint?.hotspots ?? HOTSPOTS) as FootprintHotspot[];
  const [selectedImpact, setSelectedImpact] = useState(impactCategories[0]?.id ?? "climate");
  const [selectedHotspot, setSelectedHotspot] = useState(hotspots[0]?.id ?? "materials");

  useEffect(() => {
    if (impactCategories[0]?.id) setSelectedImpact(impactCategories[0].id);
    if (hotspots[0]?.id) setSelectedHotspot(hotspots[0].id);
  }, [lcaData.footprint]);

  if (lcaData.pipelineStatus === "loading" || lcaData.footprintCalculating) {
    return (
      <div style={{ padding: 40 }}>
        <BackBtn go={go} to={"model"} />
        <LoadingPanel
          label="Calculating multi-impact footprint…"
          detail={lcaData.footprintCalculating ? "Aggregating impacts across six categories…" : "Calling Claude and Climatiq; this may take a moment."}
        />
      </div>
    );
  }

  if (!lcaData.footprint) {
    return (
      <div style={{ padding: 40 }}>
        <BackBtn go={go} to={"model"} />
        <div className="card" style={{ padding: 32, maxWidth: 640 }}>
          <h1 className="page-title" style={{ marginBottom: 10 }}>Footprint not ready yet</h1>
          <p className="body-text" style={{ marginBottom: 20 }}>Complete intake to classify your product and pull emission factors.</p>
          <button onClick={() => go(1)} className="btn btn-primary">Go to intake →</button>
        </div>
      </div>
    );
  }

  const impact = impactCategories.find((c) => c.id === selectedImpact) ?? impactCategories[0]!;
  const isEnergy = impact.id === "energy";
  const accuracy = Math.max(lcaData.footprint.dataAccuracy || 74, 74);
  const gapFilledPct = 100 - accuracy;

  return (
    <div style={{ padding: 40 }}>
      <BackBtn go={go} to={"model"} />
      <div style={{ marginBottom: 28 }}>
        <Eyebrow>Footprint Breakdown</Eyebrow>
        <h1 className="page-title">{lcaData.productName} · multi-impact footprint</h1>
        <p className="body-text" style={{ marginTop: 8, maxWidth: 720 }}>
          Pick an impact category to explore stages and hotspots.
        </p>
      </div>

      {/* Impact category selector */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
        {impactCategories.map((c) => {
          const active = c.id === selectedImpact;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedImpact(c.id)}
              className="btn btn-sm"
              style={{
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                background: active ? "var(--green-dark)" : "white",
                color: active ? "white" : "var(--text-primary)",
                border: `1px solid ${active ? "var(--green-dark)" : "var(--border-solid)"}`,
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Stat cards for selected impact */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: `${impact.label} total`, value: formatImpactValue(impact.total, impact.unit), caption: `${impact.unit} per 3-pack` },
          { label: "vs. industry avg", value: impact.vsIndustry, caption: impact.vsIndustryGood ? "Below category average" : "Above category average", color: impact.vsIndustryGood ? "var(--green-dark)" : "var(--amber)" },
          { label: "Top hotspot", value: impact.topHotspot, caption: `accounts for ${impact.topHotspotPct}%`, small: true },
          { label: "Data accuracy", value: `${accuracy}%`, caption: `Mostly primary data · ${gapFilledPct}% AI gap-filled` },
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
          <div className="card-title" style={{ marginBottom: 16 }}>
            {impact.label} by lifecycle stage
            {isEnergy && <span style={{ fontWeight: 400, color: "var(--text-tertiary)", fontSize: 13 }}> · renewable vs. non-renewable split</span>}
          </div>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              {isEnergy ? (
                <BarChart data={impact.stages} layout="vertical" margin={{ left: 16, right: 80 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={110} tick={{ fontSize: 13, fill: "#0F0F0D" }} />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.03)" }}
                    contentStyle={{ borderRadius: 8, border: "1px solid #E8E8E4", fontSize: 13 }}
                    formatter={(v: number, name: string) => [`${v.toLocaleString()} MJ`, name === "renewable" ? "Renewable" : "Non-renewable"]}
                  />
                  <Bar dataKey="renewable" stackId="energy" fill="#4A9B6F" radius={[0, 0, 0, 0]} onClick={(d: { name: string }) => setSelectedHotspot(d.name.toLowerCase())} />
                  <Bar dataKey="nonRenewable" stackId="energy" fill="#D4892A" radius={[0, 6, 6, 0]} onClick={(d: { name: string }) => setSelectedHotspot(d.name.toLowerCase())}>
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v: number) => {
                        const s = impact.stages.find((x) => x.value === v);
                        return `${v.toLocaleString()} MJ · ${s?.pct}%`;
                      }}
                      style={{ fontSize: 12, fill: "#6B6B65" }}
                    />
                  </Bar>
                </BarChart>
              ) : (
                <BarChart data={impact.stages} layout="vertical" margin={{ left: 16, right: 80 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={110} tick={{ fontSize: 13, fill: "#0F0F0D" }} />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.03)" }}
                    contentStyle={{ borderRadius: 8, border: "1px solid #E8E8E4", fontSize: 13 }}
                    formatter={(v: number) => [`${formatImpactValue(v, impact.unit)} ${impact.unit}`, impact.label]}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} onClick={(d: { name: string }) => setSelectedHotspot(d.name.toLowerCase())}>
                    {impact.stages.map((s, i) => <Cell key={i} fill={s.color} cursor="pointer" />)}
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v: number) => {
                        const s = impact.stages.find((x) => x.value === v);
                        return `${formatImpactValue(v, impact.unit)} · ${s?.pct}%`;
                      }}
                      style={{ fontSize: 12, fill: "#6B6B65" }}
                    />
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          {isEnergy && (
            <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#4A9B6F", marginRight: 6 }} />Renewable ({impact.renewableTotal} MJ · {Math.round((impact.renewableTotal! / impact.total) * 100)}%)</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#D4892A", marginRight: 6 }} />Non-renewable ({impact.nonRenewableTotal} MJ · {Math.round((impact.nonRenewableTotal! / impact.total) * 100)}%)</span>
            </div>
          )}
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-tertiary)" }}>
            ecoinvent 3.10 + Higg MSI 3.7 · per 3-pack (340g)
          </div>
        </div>

        <div>
          <div className="card-title" style={{ marginBottom: 14 }}>Top hotspots · {impact.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {hotspots.map((h) => {
              const sel = selectedHotspot === h.id;
              return (
                <button key={h.id} onClick={() => setSelectedHotspot(h.id)} className="card card-hover"
                  style={{
                    textAlign: "left", padding: 18,
                    border: sel ? "2px solid var(--green-dark)" : "1px solid var(--border)",
                    background: sel ? "var(--green-light)" : "white",
                  }}>
                  <span className={`chip chip-${h.badgeColor}`} style={{ marginBottom: 10 }}>{h.badge}</span>
                  <SourceBadge source={h.source} />
                  <div style={{ fontSize: 14, fontWeight: 500, margin: "6px 0 6px" }}>{h.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }} className="tabular">{h.impacts[impact.id as keyof typeof h.impacts]}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45, marginBottom: 10 }}>{shortenHotspotNote(h.note)}</div>
                  <span style={{ fontSize: 13, color: "var(--green-dark)", fontWeight: 500 }}>See action plays →</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* All impacts summary table */}
      <div className="card" style={{ marginTop: 28, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
          <div className="card-title">Full impact profile</div>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>Six categories · per 3-pack</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--gray-section)" }}>
              {["Impact category", "Result", "Unit", "Top stage", "vs. industry"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 20px", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {impactCategories.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelectedImpact(c.id)}
                style={{
                  borderTop: "1px solid var(--border)",
                  cursor: "pointer",
                  background: c.id === selectedImpact ? "var(--green-light)" : "transparent",
                }}
              >
                <td style={{ padding: "14px 20px", fontWeight: 500 }}>
                  {c.label}
                  <SourceBadge source={c.source} />
                </td>
                <td className="tabular" style={{ padding: "14px 20px", fontWeight: 500 }}>
                  {formatImpactValue(c.total, c.unit)}
                  {c.id === "energy" && (
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400, marginTop: 2 }}>
                      {c.renewableTotal} MJ ren. · {c.nonRenewableTotal} MJ non-ren.
                    </div>
                  )}
                </td>
                <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>{c.unit}</td>
                <td style={{ padding: "14px 20px", color: "var(--text-secondary)" }}>{c.topHotspot} ({c.topHotspotPct}%)</td>
                <td style={{ padding: "14px 20px", color: c.vsIndustryGood ? "var(--green-dark)" : "var(--amber)", fontWeight: 500 }}>{c.vsIndustry}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
        <button onClick={() => go(5)} className="btn btn-primary">View action queue →</button>
        <button onClick={() => go(6)} className="btn btn-ghost">Model a scenario first</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STEP 5: ACTION QUEUE
// ─────────────────────────────────────────────────────────────────────

type Play = {
  id: string; stage: "Materials" | "Manufacturing" | "Logistics";
  play: string; co2: number; cost: number; owner: string;
  effort: "Low" | "Med" | "High"; star?: boolean;
  pillar?: "Sustainably Made" | "Safe for Kids" | "Tough for Play";
  supplier?: string;
  impactScores?: Partial<Record<string, number>>;
};

const ACTION_IMPACT_CATEGORIES = [
  { id: "climate", label: "Climate" },
  { id: "water", label: "Water" },
  { id: "energy", label: "Energy" },
  { id: "eutrophication", label: "Eutrophication" },
  { id: "acidification", label: "Acidification" },
  { id: "toxicity", label: "Toxicity" },
] as const;

const PLAYS: Play[] = [
  { id: "p1", stage: "Materials", play: "Switch to 100% GOTS organic cotton, drop EcoVero™ blend", co2: -487, cost: -0.22, owner: "Sourcing", effort: "Low", star: true, pillar: "Sustainably Made", impactScores: { climate: -487, water: -1800, energy: -38, eutrophication: -0.6, acidification: -2.8, toxicity: -3.5 } },
  { id: "p2", stage: "Manufacturing", play: "Install solar PPA at Shahi Unit 8 (4.2 MW rooftop)", co2: -389, cost: 0.08, owner: "Mfg Ops", effort: "High", pillar: "Sustainably Made", impactScores: { climate: -389, water: -120, energy: -52, eutrophication: -0.2, acidification: -4.1, toxicity: -0.8 } },
  { id: "p3", stage: "Logistics", play: "Consolidate Mundra→Savannah sailings to bi-weekly with Maersk", co2: -210, cost: -0.14, owner: "Logistics", effort: "Med", star: true, impactScores: { climate: -210, water: -80, energy: -18, eutrophication: -0.1, acidification: -1.2, toxicity: -0.4 } },
  { id: "p4", stage: "Materials", play: "Replace snaps with nickel-free YKK SNAD brass (Safe for Kids)", co2: -42, cost: 0.04, owner: "Design", effort: "Low", pillar: "Safe for Kids", impactScores: { climate: -42, water: -15, energy: -4, eutrophication: -0.05, acidification: -0.3, toxicity: -1.8 } },
  { id: "p5", stage: "Materials", play: "Add 30% REPREVE® recycled polyester to trim & label tape", co2: -156, cost: -0.06, owner: "Sourcing", effort: "Low", pillar: "Sustainably Made", impactScores: { climate: -156, water: -420, energy: -12, eutrophication: -0.15, acidification: -0.9, toxicity: -0.6 } },
  { id: "p6", stage: "Manufacturing", play: "Increase fabric GSM to 195 for 60-wash durability", co2: 24, cost: 0.09, owner: "Design", effort: "Med", pillar: "Tough for Play", impactScores: { climate: 24, water: 40, energy: 8, eutrophication: 0.04, acidification: 0.2, toxicity: 0.1 } },
  { id: "p7", stage: "Materials", play: "Use FSC-certified hangtags and polybag-free pack-out", co2: -28, cost: -0.02, owner: "Packaging", effort: "Low", pillar: "Sustainably Made", impactScores: { climate: -28, water: -35, energy: -6, eutrophication: -0.03, acidification: -0.15, toxicity: -0.2 } },
];

function playImpactScore(play: Play, categoryId: string): number {
  if (play.impactScores?.[categoryId] != null) return play.impactScores[categoryId]!;
  if (categoryId === "climate") return play.co2;
  const scale: Record<string, number> = { water: 0.35, energy: 0.28, eutrophication: 0.001, acidification: 0.008, toxicity: 0.012 };
  return play.co2 * (scale[categoryId] ?? 0.2);
}

function formatPlayImpact(score: number, categoryId: string): string {
  const units: Record<string, string> = {
    climate: "kg CO₂e", water: "m³", energy: "MJ",
    eutrophication: "kg PO₄³⁻", acidification: "kg SO₂", toxicity: "CTUh",
  };
  const unit = units[categoryId] ?? "";
  const sign = score < 0 ? "−" : "+";
  return `${sign}${Math.abs(score).toLocaleString(undefined, { maximumFractionDigits: categoryId === "climate" ? 0 : 1 })} ${unit}`;
}

function Step5({ lcaData, setLcaData, go, pushToast }: { lcaData: LcaData; setLcaData: (f: (d: LcaData) => LcaData) => void; go: (s: Step) => void; pushToast: (t: string, k?: Toast["kind"]) => void }) {
  const [sortCategory, setSortCategory] = useState<string>("climate");
  const [filterStage, setFilterStage] = useState<"All" | "Materials" | "Manufacturing" | "Logistics">("All");

  useEffect(() => {
    if (!lcaData.footprint || lcaData.plays || lcaData.actionsStatus === "loading") return;

    let cancelled = false;
    setLcaData((d) => ({ ...d, actionsStatus: "loading" }));

    getActionRecommendations({
      data: {
        intake: toIntakeInput(lcaData),
        footprint: lcaData.footprint,
      },
    })
      .then((plays) => {
        if (cancelled) return;
        setLcaData((d) => ({ ...d, plays, actionsStatus: "ready" }));
      })
      .catch(() => {
        if (cancelled) return;
        setLcaData((d) => ({ ...d, actionsStatus: "error" }));
        pushToast("Could not load live recommendations; showing defaults", "warning");
      });

    return () => { cancelled = true; };
  }, [lcaData.footprint]);

  const activePlays = (lcaData.plays ?? PLAYS) as Play[];
  let rows = [...activePlays];
  if (filterStage !== "All") rows = rows.filter((r) => r.stage === filterStage);
  rows.sort((a, b) => playImpactScore(a, sortCategory) - playImpactScore(b, sortCategory));

  const selectedCategory = ACTION_IMPACT_CATEGORIES.find((c) => c.id === sortCategory)!;

  const totalCo2 = rows.reduce((sum, row) => sum + (row.co2 < 0 ? row.co2 : 0), 0);
  const totalCost = rows.reduce((sum, row) => sum + (row.cost < 0 ? row.cost : 0), 0);
  const baselineCo2 = lcaData.footprint?.totalCo2e ?? lcaData.footprint?.impactCategories.find((c) => c.id === "climate")?.total ?? 3240;
  const stageChip = (s: Play["stage"]) =>
    s === "Materials" ? "chip-green" : s === "Manufacturing" ? "chip-amber" : "chip-blue";

  function assign(p: Play) {
    setLcaData((d) => ({ ...d, selectedPlay: p.id }));
    pushToast(`Assigning "${p.play}"`, "info");
    setTimeout(() => go(7), 350);
  }

  return (
    <div style={{ padding: 40 }}>
      <BackBtn go={go} to={4} />
      <Eyebrow>Action Queue</Eyebrow>
      <h1 className="page-title" style={{ marginBottom: 10 }}>{rows.length} plays · ranked by {selectedCategory.label.toLowerCase()}</h1>
      <p className="body-text" style={{ maxWidth: 760, marginBottom: 24 }}>
        Interventions from your hotspots. Sort by impact category.
      </p>

      {lcaData.actionsStatus === "loading" && <LoadingPanel label="Generating action recommendations…" />}

      {lcaData.actionsStatus !== "loading" && (
      <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="label">Sort by impact:</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ACTION_IMPACT_CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setSortCategory(c.id)} className="btn btn-sm"
                style={{
                  background: sortCategory === c.id ? "var(--green-dark)" : "white",
                  color: sortCategory === c.id ? "white" : "var(--text-primary)",
                  border: "1px solid " + (sortCategory === c.id ? "var(--green-dark)" : "var(--border-solid)"),
                }}>
                {c.label}
              </button>
            ))}
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
          display: "grid", gridTemplateColumns: "110px 1fr 120px 100px 90px 80px",
          padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--gray-section)",
        }}>
          {["Stage", "Play", selectedCategory.label, "Cost", "Owner", ""].map((h) => (
            <div key={h} className="label">{h}</div>
          ))}
        </div>
        {rows.map((p) => {
          const impact = playImpactScore(p, sortCategory);
          return (
          <div key={p.id} style={{
            display: "grid", gridTemplateColumns: "110px 1fr 120px 100px 90px 80px",
            padding: "14px 20px", borderBottom: "1px solid var(--border)", alignItems: "center",
            borderLeft: p.star ? "3px solid var(--green-dark)" : "3px solid transparent",
            background: p.star ? "#FAFFF8" : "transparent",
            transition: "background 180ms ease",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = p.star ? "#F2FAEE" : "var(--gray-section)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = p.star ? "#FAFFF8" : "transparent")}
          >
            <div><span className={`chip ${stageChip(p.stage)}`}>{p.stage}</span></div>
            <div style={{ fontSize: 14 }}>
              {p.star && <I.star />}{p.play}
              {p.pillar && <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 8 }}>{p.pillar}</span>}
            </div>
            <div>
              <span className={`chip ${impact < 0 ? "chip-green" : "chip-red"} tabular`} style={{ fontSize: 11 }}>
                {formatPlayImpact(impact, sortCategory)}
              </span>
            </div>
            <div><span className={`chip ${p.cost < 0 ? "chip-green" : "chip-red"} tabular`} style={{ fontSize: 11 }}>
              {p.cost < 0 ? "−$" : "+$"}{Math.abs(p.cost).toFixed(2)}
            </span></div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.owner}</div>
            <div><button onClick={() => assign(p)} className="btn btn-primary btn-sm">Assign</button></div>
          </div>
        );})}
      </div>

      <div style={{
        marginTop: 20, padding: 20, borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ fontWeight: 500, color: "var(--green-dark)" }}>
          Total CO₂ reduction potential: {totalCo2.toLocaleString()} kg CO₂e/unit ({baselineCo2 ? Math.round(Math.abs(totalCo2 / baselineCo2) * 100) : 0}% of total footprint)
        </div>
        <div style={{ fontWeight: 500, color: "var(--green-dark)" }}>
          Net cost impact: {totalCost < 0 ? "-" : "+"}${Math.abs(totalCost).toFixed(2)}/unit at volume
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={() => go(6)} className="btn btn-ghost">Model a scenario →</button>
        <button onClick={() => activePlays[0] && assign(activePlays[0])} className="btn btn-primary">Assign a play →</button>
      </div>
      </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STEP 6: SCENARIO MODELING
// ─────────────────────────────────────────────────────────────────────

const MATERIAL_OPTIONS = [
  "100% GOTS organic cotton · Shahi Exports (current Tier 1)",
  "100% GOTS organic cotton · Arvind Limited fully vertical",
  "70% GOTS cotton + 30% Lenzing™ EcoVero™ · Lenzing AG / Arvind",
  "60% GOTS cotton + 40% REPREVE® rPET · Unifi Inc.",
  "100% TENCEL™ Lyocell · Lenzing AG (premium Little Planet capsule)",
];

// Pre-calculated scenarios: relative deltas vs baseline (3,240 g, $4.62/3-pack)
const SCENARIOS: Record<string, { matBefore: number; matAfter: number; costAfter: number }> = {
  "100% GOTS organic cotton · Shahi Exports (current Tier 1)":         { matBefore: 1976, matAfter: 1489, costAfter: 4.40 },
  "100% GOTS organic cotton · Arvind Limited fully vertical":          { matBefore: 1976, matAfter: 1402, costAfter: 4.48 },
  "70% GOTS cotton + 30% Lenzing™ EcoVero™ · Lenzing AG / Arvind":     { matBefore: 1976, matAfter: 1612, costAfter: 4.66 },
  "60% GOTS cotton + 40% REPREVE® rPET · Unifi Inc.":                  { matBefore: 1976, matAfter: 1390, costAfter: 4.58 },
  "100% TENCEL™ Lyocell · Lenzing AG (premium Little Planet capsule)": { matBefore: 1976, matAfter: 1550, costAfter: 4.94 },
};

const BASELINE_UNIT_COST_USD = 4.62;

function enrichScenarioWithCost(
  result: ScenarioResult,
  opts: { changeType: string; material: string; volume: number; baselineCost: number },
): ScenarioResult {
  if (opts.changeType !== "Material") return result;

  const scenario = SCENARIOS[opts.material];
  if (!scenario) return result;

  const hasCostRow = result.rows.some((row) => row.metric.toLowerCase().includes("cost"));
  const costDelta = scenario.costAfter - opts.baselineCost;
  const annualCostSavingUsd = (opts.baselineCost - scenario.costAfter) * opts.volume;

  return {
    ...result,
    annualCostSavingUsd: result.annualCostSavingUsd ?? annualCostSavingUsd,
    rows: hasCostRow
      ? result.rows
      : [
          ...result.rows,
          {
            metric: "Material cost / 3-pack",
            before: `$${opts.baselineCost.toFixed(2)}`,
            after: `$${scenario.costAfter.toFixed(2)}`,
            delta: `${costDelta > 0 ? "+" : ""}$${costDelta.toFixed(2)}`,
            improved: costDelta < 0,
            source: result.source ?? "ai_estimated",
          },
          {
            metric: "Annual cost impact",
            before: "-",
            after: `${annualCostSavingUsd >= 0 ? "+" : "−"}$${Math.abs(Math.round(annualCostSavingUsd)).toLocaleString()}`,
            delta: `at ${(opts.volume / 1000).toFixed(0)}k units/yr`,
            improved: annualCostSavingUsd >= 0,
            source: result.source ?? "ai_estimated",
          },
        ],
  };
}

function Step6({ lcaData, setLcaData, go, pushToast }: { lcaData: LcaData; setLcaData: (f: (d: LcaData) => LcaData) => void; go: (s: Step) => void; pushToast: (t: string, k?: Toast["kind"]) => void }) {
  const [changeType, setChangeType] = useState<"Material" | "Process" | "Supplier">("Material");
  const [stage, setStage] = useState("Materials");
  const [material, setMaterial] = useState(MATERIAL_OPTIONS[2]);
  const [intervention, setIntervention] = useState("");
  const [volume, setVolume] = useState(100000);
  const [calculated, setCalculated] = useState(false);
  const [loading, setLoading] = useState(false);

  const baselineClimate = lcaData.footprint?.impactCategories.find((c) => c.id === "climate")?.total ?? 3240;
  const fallbackScenario = SCENARIOS[material];
  const scenarioResult = lcaData.scenarioResult;

  async function calc() {
    if (!lcaData.footprint) {
      pushToast("Complete intake and footprint analysis first", "warning");
      return;
    }

    setLoading(true);
    setCalculated(false);
    setLcaData((d) => ({ ...d, scenarioStatus: "loading", scenarioResult: null }));

    const selectedIntervention =
      changeType === "Material"
        ? `Swap material to: ${material}`
        : intervention.trim() || `${changeType} change at ${stage}`;

    try {
      const result = enrichScenarioWithCost(
        await calculateScenario({
          data: {
            intake: toIntakeInput(lcaData),
            footprint: lcaData.footprint,
            intervention: selectedIntervention,
            changeType,
            stage,
            volume,
            carbonPricePerTonne: 65,
            baselineUnitCostUsd: BASELINE_UNIT_COST_USD,
          },
        }),
        { changeType, material, volume, baselineCost: BASELINE_UNIT_COST_USD },
      );
      setLcaData((d) => ({ ...d, scenarioResult: result, scenarioStatus: "ready" }));
      setCalculated(true);
    } catch {
      const matDelta = fallbackScenario.matAfter - fallbackScenario.matBefore;
      setLcaData((d) => ({
        ...d,
        scenarioResult: {
          intervention: selectedIntervention,
          source: "ai_estimated",
          carbonCostSavingsUsd: Math.abs(matDelta) * volume / 1000 * 65,
          annualCo2ReductionKg: Math.abs(matDelta) * volume / 1000,
          annualCostSavingUsd: (BASELINE_UNIT_COST_USD - fallbackScenario.costAfter) * volume,
          rows: [
            { metric: "Material CO₂e", before: `${fallbackScenario.matBefore.toLocaleString()} kg`, after: `${fallbackScenario.matAfter.toLocaleString()} kg`, delta: `${matDelta > 0 ? "+" : ""}${matDelta} kg`, improved: matDelta < 0, source: "ai_estimated" },
            { metric: "Total footprint", before: `${baselineClimate.toLocaleString()} kg`, after: `${(baselineClimate + matDelta).toLocaleString()} kg`, delta: `${matDelta > 0 ? "+" : ""}${matDelta} kg`, improved: matDelta < 0, source: "ai_estimated" },
            { metric: "Material cost / 3-pack", before: `$${BASELINE_UNIT_COST_USD.toFixed(2)}`, after: `$${fallbackScenario.costAfter.toFixed(2)}`, delta: `${fallbackScenario.costAfter - BASELINE_UNIT_COST_USD > 0 ? "+" : ""}$${(fallbackScenario.costAfter - BASELINE_UNIT_COST_USD).toFixed(2)}`, improved: fallbackScenario.costAfter < BASELINE_UNIT_COST_USD, source: "ai_estimated" },
            { metric: "Annual CO₂ reduction", before: "-", after: `${Math.abs(matDelta * volume / 1000).toLocaleString()} kg`, delta: `at ${(volume / 1000).toFixed(0)}k units`, improved: true, source: "ai_estimated" },
            { metric: "Carbon cost savings", before: "-", after: `$${Math.round(Math.abs(matDelta) * volume / 1000 * 65).toLocaleString()}`, delta: "@ $65/tonne CO₂e", improved: true, source: "ai_estimated" },
            { metric: "Annual cost impact", before: "-", after: `${(BASELINE_UNIT_COST_USD - fallbackScenario.costAfter) * volume >= 0 ? "+" : "−"}$${Math.abs(Math.round((BASELINE_UNIT_COST_USD - fallbackScenario.costAfter) * volume)).toLocaleString()}`, delta: `at ${(volume / 1000).toFixed(0)}k units/yr`, improved: fallbackScenario.costAfter <= BASELINE_UNIT_COST_USD, source: "ai_estimated" },
          ],
          impactCategories: lcaData.footprint!.impactCategories.map((category) => ({
            id: category.id,
            label: category.label,
            before: category.total,
            after: category.id === "climate" ? category.total + matDelta : category.total * 0.95,
            unit: category.unit,
            source: "ai_estimated" as const,
          })),
        },
        scenarioStatus: "ready",
      }));
      setCalculated(true);
      pushToast("Scenario modeled with fallback values", "warning");
    } finally {
      setLoading(false);
    }
  }

  function assignScenario() {
    setLcaData((d) => ({ ...d, selectedPlay: d.plays?.[0]?.id ?? "p1" }));
    pushToast("Scenario assigned. Generating artifact in Step 7.", "success");
    setTimeout(() => go(7), 350);
  }

  const comparisonRows = scenarioResult?.rows ?? [];
  const impactRows = scenarioResult?.impactCategories ?? [];

  return (
    <div style={{ padding: 40 }}>
      <BackBtn go={go} to={4} />
      <Eyebrow>Scenario Modeling</Eyebrow>
      <h1 className="page-title" style={{ marginBottom: 10 }}>Model a swap. See the delta.</h1>
      <p className="body-text" style={{ maxWidth: 760, marginBottom: 28 }}>
        Recalculates footprint and unit cost with your intervention, incl. carbon cost at $65/tonne CO₂e.
      </p>

      {!lcaData.footprint && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          Complete intake first to build a baseline footprint.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 20, alignItems: "start" }}>
        {/* Controls */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 18 }}>Configure scenario</div>

          <div style={{ marginBottom: 16 }}>
            <div className="label" style={{ marginBottom: 8 }}>What are you changing?</div>
            <div style={{ display: "flex", background: "var(--gray-section)", borderRadius: 10, padding: 4 }}>
              {(["Material", "Process", "Supplier"] as const).map((t) => (
                <button key={t} onClick={() => { setChangeType(t); setCalculated(false); }} style={{
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
            <select className="input" value={stage} onChange={(e) => { setStage(e.target.value); setCalculated(false); }}>
              <option>Materials</option><option>Manufacturing</option><option>Logistics</option><option>Packaging</option>
            </select>
          </div>

          {changeType === "Material" && (
            <>
              <div style={{ marginBottom: 16 }}>
                <div className="label" style={{ marginBottom: 8 }}>Current material</div>
                <div style={{ padding: "12px 14px", background: "var(--gray-section)", borderRadius: 10, fontSize: 14 }}>
                  60% GOTS organic cotton + 40% Lenzing™ EcoVero™ viscose
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

          {changeType !== "Material" && (
            <div style={{ marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 8 }}>Describe the intervention</div>
              <textarea
                className="input"
                rows={3}
                value={intervention}
                onChange={(e) => { setIntervention(e.target.value); setCalculated(false); }}
                placeholder={changeType === "Process" ? "e.g. Switch dye house to cold-pad batch reactive dyeing" : "e.g. Nearshore cut & sew to Guatemala to reduce freight distance"}
              />
            </div>
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

          <button onClick={calc} className="btn btn-primary" style={{ width: "100%", padding: 12 }} disabled={loading || !lcaData.footprint}>
            {loading ? <><span className="spinner" /> Modeling scenario…</> : "Calculate scenario"}
          </button>
        </div>

        {/* Results */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <span className="chip chip-gray">Baseline</span>
            <span style={{ color: "var(--text-tertiary)" }}>vs.</span>
            <span className="chip chip-green">Scenario</span>
            {scenarioResult?.source && <SourceBadge source={scenarioResult.source} />}
          </div>

          {!calculated ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
              {loading ? "Recalculating footprint across all impact categories…" : "Adjust inputs then click Calculate scenario."}
            </div>
          ) : (
            <div className="fade-in">
              {comparisonRows.map((row, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1.4fr 1fr 30px 1fr 1.2fr",
                  padding: "14px 0", borderBottom: "1px solid var(--border)", alignItems: "center", fontSize: 14,
                }}>
                  <div style={{ fontWeight: 500 }}>
                    {row.metric}
                    <SourceBadge source={row.source} />
                  </div>
                  <div className="tabular" style={{ color: "var(--text-secondary)" }}>{row.before}</div>
                  <div style={{ textAlign: "center", color: "var(--text-tertiary)" }}>→</div>
                  <div className="tabular">{row.after}</div>
                  <div className="tabular" style={{ color: row.improved ? "var(--green-dark)" : "var(--amber)", fontWeight: 500 }}>{row.delta}</div>
                </div>
              ))}

              {impactRows.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div className="card-title" style={{ marginBottom: 12 }}>Impact categories · before / after</div>
                  {impactRows.map((row) => (
                    <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
                      <div>{row.label} <SourceBadge source={row.source} /></div>
                      <div className="tabular">{row.before.toLocaleString()} {row.unit}</div>
                      <div className="tabular" style={{ color: row.after < row.before ? "var(--green-dark)" : "var(--amber)", fontWeight: 500 }}>
                        {row.after.toLocaleString()} {row.unit}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {scenarioResult?.carbonCostSavingsUsd != null && (
                <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ padding: 16, background: "var(--green-light)", borderRadius: 10, fontSize: 14 }}>
                    Carbon cost savings at $65/tonne CO₂e: <strong>${Math.round(scenarioResult.carbonCostSavingsUsd).toLocaleString()}</strong> annually
                  </div>
                  {scenarioResult.annualCostSavingUsd != null && (
                    <div style={{ padding: 16, background: "var(--gray-section)", borderRadius: 10, fontSize: 14 }}>
                      Unit cost impact at volume: <strong>{scenarioResult.annualCostSavingUsd >= 0 ? "+" : "−"}${Math.abs(Math.round(scenarioResult.annualCostSavingUsd)).toLocaleString()}</strong> annually
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
        <button onClick={() => go(4)} className="btn btn-ghost">← Back to footprint</button>
        <button onClick={assignScenario} className="btn btn-primary" disabled={!calculated}>Assign this scenario →</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STEP 7: ASSIGN & GENERATE
// ─────────────────────────────────────────────────────────────────────

const ARTIFACTS = [
  { id: "rfp" as const, icon: <I.doc />, title: "Supplier RFP", desc: "RFP with specs, certs, and timeline." },
  { id: "letter" as const, icon: <I.envelope />, title: "Supplier Engagement Letter", desc: "Intro outreach for a pilot program." },
  { id: "brief" as const, icon: <I.team />, title: "Internal Process Brief", desc: "Brief for ops/procurement on next steps." },
];

const RFP_TEXT = `SUPPLIER REQUEST FOR PROPOSAL
Carter's, Inc. · Global Sourcing · Babywear
Generated: June 15, 2026
Prepared by: Alex Johnson, Sourcing Lead, Little Planet™

PRODUCT REFERENCE
Product: Little Planet™ Organic Sleep & Play (3-Pack), NB–9M
SKU: LP-3PSP-NB · Style #225G731
Current spec: 60% GOTS organic cotton + 40% Lenzing™ EcoVero™ viscose
Target spec: 100% GOTS organic cotton, 195 GSM interlock, OEKO-TEX Std 100 Class I
LCA reference: Pathways LCA #LP-2026-3PSP-001

BACKGROUND
Aligned to Carter's Raise the Future™ commitments (Sustainably Made, Safe for Kids, and Tough for Play), the sourcing team has completed a lifecycle assessment for the Little Planet™ Organic Sleep & Play (3-Pack). The assessment identifies a single-fiber simplification at our Tier 1 partner Shahi Exports (Unit 8, Bengaluru) that reduces Scope 3.1 emissions by 487 g CO₂e per 3-pack (15% vs. baseline) and lowers landed cost by $0.22 per 3-pack at run-rate volume.

We are inviting GOTS Scope-Certified Tier 2 fabric mills to submit proposals for a 12,000-unit Fall '26 pilot.

REQUIREMENTS: RAISE THE FUTURE™ COMPLIANCE
· Sustainably Made: 100% GOTS organic cotton, valid Scope Certificate (Control Union or Ecocert) through FY27
· Safe for Kids: OEKO-TEX Standard 100 Class I (suitable for products in direct contact with infants <36 mo); ZDHC MRSL v3.1 Level 3 compliance; nickel-free trims
· Tough for Play: Wash durability ≥ 50 cycles per Carter's Test Method CT-DUR-04 (no >5% pilling, no seam failure)
· Color: Bluesign®-approved reactive dyes, GOTS-permitted auxiliary list only
· Fabric: 195 GSM single jersey interlock, 100% combed ring-spun organic cotton

COMMERCIAL
· FOB India target: ≤ $4.40 / 3-pack at 50k units, ≤ $4.55 at 12k pilot
· MOQ: 12,000 units (4,000 per size NB / 3M / 6M)
· First delivery: Mundra port, week 38 / 2026
· Payment: NET 60 against OBL, Carter's standard vendor terms

SUSTAINABILITY CONTEXT
This change supports Carter's 2030 Scope 3 reduction commitment and the Raise the Future™ goal to expand GOTS-certified organic cotton across the Little Planet™ assortment. LCA modeled in Pathways using ecoinvent 3.10 + Higg MSI 3.7 (South Asia knit garment), PEFCR Apparel & Footwear methodology, ISO 14044 aligned.

At 480,000 3-packs / year (Little Planet™ Sleep & Play run rate), this change avoids 234,000 kg CO₂e annually, roughly the footprint of 51 round-trip transatlantic flights.

SUBMISSION
Please respond to sourcing.babywear@carters.com by June 29, 2026:
  1. Pricing at 12k / 25k / 50k / 100k tiers (FOB Mundra)
  2. Current GOTS Scope Certificate + OEKO-TEX Std 100 Class I cert
  3. ZDHC ClearStream report (latest cycle) and BSCI / SLCP audit
  4. Sample yardage (3 yds/colorway) within 14 days
  5. References from 2+ infant/toddler brand customers

Invited vendors: Arvind Limited (Naroda), Pratibha Syntex (Pithampur), Spectrum Knits (Tirupur). Proposals received by the deadline will receive a response within 5 business days.`;

function Step7({ lcaData, setLcaData, go, pushToast }: { lcaData: LcaData; setLcaData: (f: (d: LcaData) => LcaData) => void; go: (s: Step) => void; pushToast: (t: string, k?: Toast["kind"]) => void }) {
  const [recipient, setRecipient] = useState("Priya Raghavan, Director of Sourcing, Babywear");
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
      <Eyebrow>Assign & Generate</Eyebrow>
      <h1 className="page-title" style={{ marginBottom: 10 }}>Generate and send.</h1>
      <p className="body-text" style={{ marginBottom: 24 }}>
        Pathways drafts a ready-to-send artifact from your assigned play.
      </p>

      <div style={{ padding: 16, background: "var(--green-light)", border: "1px solid var(--green-border)", borderRadius: 12, marginBottom: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Selected play: Move to 100% GOTS organic cotton with Shahi Exports</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Pillar: Sustainably Made · CO₂: -487 g/3-pack · Cost: -$0.22/3-pack · Effort: Low · Owner: Sourcing, Babywear
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
            Artifact generated with Claude · ecoinvent + Higg MSI data
          </div>
        </div>
      )}

      {generated && (
        <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid var(--border)" }}>
          <h2 className="section-title" style={{ marginBottom: 16 }}>What's next?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {[
              { t: "Assign remaining plays", d: "5 more plays in your queue.", cta: "View action queue →", on: () => go(5) },
              { t: "Track progress", d: "See footprint reduction over time.", cta: "Go to My LCAs →", on: () => go("library") },
              { t: "Start another LCA", d: "Run a second product to compare.", cta: "New LCA →", on: () => go(1) },
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
              <input className="input" defaultValue="priya.raghavan@carters.com" />
            </div>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Subject</div>
              <input className="input" defaultValue="Supplier RFP: 100% GOTS Organic Cotton, Little Planet™ Sleep & Play" />
            </div>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Body</div>
              <textarea className="input" rows={4} defaultValue="Hi Priya, Please find attached the RFP for the Little Planet™ 3-pack GOTS pilot..." />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setEmailModalOpen(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={() => { setEmailModalOpen(false); pushToast("RFP sent to Priya Raghavan", "success"); }} className="btn btn-primary">Send</button>
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
      <p className="body-text" style={{ marginBottom: 28 }}>Welcome back, Alex · Sourcing Lead, Little Planet™</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { l: "Active LCAs", v: "1", c: "Little Planet™ 3-Pack in progress" },
          { l: "Raise the Future™ plays assigned", v: "1 of 6", c: "5 remaining" },
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
            <div style={{ fontWeight: 500 }}>Little Planet™ Organic Sleep & Play (3-Pack)</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Step 5 of 7</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }} className="tabular">74%</div>
            <button onClick={() => go(5)} className="btn btn-primary btn-sm">Continue →</button>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Recent activity</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              ["RFP generated: 100% GOTS organic cotton pilot", "Just now"],
              ["Scenario modeled: GOTS cotton + REPREVE® rPET trim", "2 min ago"],
              ["2 team responses received", "June 13"],
              ["LCA started: Little Planet™ Organic Sleep & Play (3-Pack)", "June 13"],
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
// STEP 3.5: LCA MODEL (process network, inventory, flows)
// ─────────────────────────────────────────────────────────────────────

const MODEL_PROCESSES = [
  { id: "cotton", name: "GOTS organic cotton cultivation, Madhya Pradesh", loc: "IN", db: "ecoinvent 3.10", co2: 412, kind: "background" },
  { id: "ecovero", name: "Lenzing™ EcoVero™ viscose fibre", loc: "AT", db: "Lenzing EPD", co2: 689, kind: "background" },
  { id: "yarn", name: "Ring-spun yarn, Arvind Naroda", loc: "IN", db: "Primary (Arvind)", co2: 184, kind: "foreground" },
  { id: "weave", name: "Single-jersey knitting, 195 GSM", loc: "IN", db: "Primary (Arvind)", co2: 312, kind: "foreground" },
  { id: "dye", name: "Bluesign® reactive dye + finishing", loc: "IN", db: "Higg MSI 3.7", co2: 379, kind: "foreground" },
  { id: "cutsew", name: "Cut, sew & snap assembly, Shahi Unit 8", loc: "IN", db: "Primary (Shahi)", co2: 156, kind: "foreground" },
  { id: "pack", name: "FSC™ hangtag + recycled carton pack-out", loc: "IN", db: "ecoinvent 3.10", co2: 48, kind: "foreground" },
  { id: "freight", name: "Sea freight, Mundra → Savannah, GA", loc: "-", db: "ecoinvent 3.10", co2: 421, kind: "background" },
  { id: "tote", name: "Little Planet™ Sleep & Play 3-Pack (FU)", loc: "US", db: "Reference product", co2: 3240, kind: "product" },
];

const TECHNO_FLOWS = [
  { name: "Organic cotton fibre (GOTS)", category: "Materials / Natural fibres", qty: "0.202", unit: "kg", provider: "GOTS cotton cultivation | IN-MP", source: "Primary" },
  { name: "Lenzing™ EcoVero™ viscose", category: "Materials / Cellulosic", qty: "0.134", unit: "kg", provider: "EcoVero™ fibre | AT", source: "Lenzing EPD" },
  { name: "Brass snap, nickel-free (YKK SNAD)", category: "Components / Trims", qty: "0.012", unit: "kg", provider: "Snap forming | IN-Tirupur", source: "Primary" },
  { name: "Electricity, medium voltage", category: "Energy / Grid", qty: "1.420", unit: "kWh", provider: "Market for electricity | IN-South", source: "ecoinvent" },
  { name: "Heat, natural gas (boiler)", category: "Energy / Thermal", qty: "0.640", unit: "MJ", provider: "Steam production | IN", source: "ecoinvent" },
  { name: "Process water (RO)", category: "Process water", qty: "11.20", unit: "L", provider: "Tap water | IN", source: "ecoinvent" },
  { name: "Reactive dye, Bluesign® basic", category: "Chemicals / Dyes", qty: "0.014", unit: "kg", provider: "Dye production | RoW", source: "Benchmark" },
  { name: "Sodium hydroxide, 50%", category: "Chemicals / Inorganic", qty: "0.022", unit: "kg", provider: "NaOH production | RER", source: "ecoinvent" },
  { name: "FSC™ hangtag (recycled paper)", category: "Packaging", qty: "0.006", unit: "kg", provider: "FSC paper | EU", source: "ecoinvent" },
  { name: "Corrugated carton, master pack", category: "Packaging", qty: "0.045", unit: "kg", provider: "Corrugated board, recycled | IN", source: "ecoinvent" },
  { name: "Transport, sea, container ship", category: "Logistics", qty: "13.80", unit: "tkm", provider: "Sea freight, Mundra→Savannah | GLO", source: "ecoinvent" },
  { name: "Transport, truck, drayage GA", category: "Logistics", qty: "0.420", unit: "tkm", provider: "Truck, EURO 5 equiv | US", source: "ecoinvent" },
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
  { name: "ReCiPe 2016: Climate change", value: "3.19", unit: "kg CO₂e", contrib: 98 },
  { name: "ReCiPe 2016: Water consumption", value: "0.041", unit: "m³", contrib: 64 },
  { name: "ReCiPe 2016: Fossil resource scarcity", value: "1.18", unit: "kg oil-eq", contrib: 71 },
  { name: "EF 3.1: Particulate matter", value: "8.4e-8", unit: "disease inc.", contrib: 22 },
  { name: "USEtox: Ecotoxicity, freshwater", value: "0.62", unit: "CTUe", contrib: 38 },
];

const MODEL_LOAD_STEPS = [
  "Assembling 9 foreground processes…",
  "Linking 10 technosphere flows…",
  "Resolving ecoinvent 3.10 background datasets…",
  "Applying mass allocation & IPCC 2021 GWP100…",
  "Validating product system graph…",
];

function StepModel({ go, setLcaData }: { go: (s: Step) => void; setLcaData: (f: (d: LcaData) => LcaData) => void }) {
  const [loading, setLoading] = useState(true);
  const [calculatingFootprint, setCalculatingFootprint] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [selected, setSelected] = useState("dye");
  const [tab, setTab] = useState<"techno" | "elem" | "params" | "impact">("techno");
  const proc = MODEL_PROCESSES.find((p) => p.id === selected)!;

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setLoadStep((s) => Math.min(s + 1, MODEL_LOAD_STEPS.length - 1));
    }, 650);
    const doneTimer = setTimeout(() => setLoading(false), 3200);
    return () => { clearInterval(stepInterval); clearTimeout(doneTimer); };
  }, []);

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

  function handleCalculateFootprint() {
    setCalculatingFootprint(true);
    setLcaData((d) => ({ ...d, footprintCalculating: true }));
    go(4);
    window.setTimeout(() => {
      setLcaData((d) => ({ ...d, footprintCalculating: false }));
      setCalculatingFootprint(false);
    }, 1800);
  }

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

      {loading ? (
        <div style={{ maxWidth: 640, margin: "80px auto", textAlign: "center" }}>
          <Eyebrow>LCA Model</Eyebrow>
          <h1 className="page-title" style={{ marginBottom: 24 }}>Building product system model…</h1>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <span className="spinner" style={{ width: 28, height: 28, borderTopColor: "var(--green-dark)" }} />
          </div>
          <div className="card" style={{ padding: "20px 24px", textAlign: "left" }}>
            {MODEL_LOAD_STEPS.map((step, i) => (
              <div key={step} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "8px 0",
                fontSize: 14, color: i <= loadStep ? "var(--text-primary)" : "var(--text-tertiary)",
                transition: "color 300ms ease",
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 600,
                  background: i < loadStep ? "var(--green-dark)" : i === loadStep ? "var(--green-light)" : "var(--gray-section)",
                  color: i < loadStep ? "white" : i === loadStep ? "var(--green-dark)" : "var(--text-tertiary)",
                  border: i === loadStep ? "2px solid var(--green-dark)" : "none",
                }}>
                  {i < loadStep ? "✓" : i === loadStep ? <span className="spinner" style={{ width: 10, height: 10, borderTopColor: "var(--green-dark)" }} /> : i + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>
      ) : (
      <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8, flexWrap: "wrap", gap: 16 }}>
        <div>
          <Eyebrow>LCA Model</Eyebrow>
          <h1 className="page-title">Product system & inventory</h1>
          <p className="body-text" style={{ marginTop: 8, maxWidth: 680 }}>
            Unit processes, flows, and data sources. Click any node to inspect.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="chip chip-gray">Functional unit · 1 × 3-pack (336g)</span>
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
            <TreeNode label="Little Planet™ Organic Sleep & Play (3-Pack)" depth={0} bold />
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
          <div style={{ position: "relative", height: 640 }}>
            {/* grid */}
            <svg width="100%" height="100%" viewBox="0 0 880 640" style={{ display: "block" }}>
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#EFEFEA" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="880" height="640" fill="url(#grid)" />

              {/* arrows */}
              <Arrow x1={194} y1={70} x2={330} y2={140} label="0.20 kg cotton" />
              <Arrow x1={194} y1={170} x2={330} y2={150} label="0.13 kg EcoVero™" />
              <Arrow x1={514} y1={150} x2={650} y2={150} label="0.30 kg yarn" />
              <Arrow x1={514} y1={250} x2={650} y2={210} label="fabric" />
              <Arrow x1={194} y1={280} x2={330} y2={250} label="IN-South grid" />
              <Arrow x1={834} y1={150} x2={834} y2={230} />
              <Arrow x1={834} y1={290} x2={834} y2={350} />
              <Arrow x1={194} y1={370} x2={650} y2={370} label="13.8 tkm Mundra→Savannah" />

              {/* nodes */}
              <Node id="cotton" x={10} y={40} />
              <Node id="ecovero" x={10} y={140} />
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

      <button onClick={handleCalculateFootprint} className="btn btn-primary" style={{ width: "100%", marginTop: 28, padding: 14 }} disabled={calculatingFootprint}>
        {calculatingFootprint ? <><span className="spinner" style={{ borderTopColor: "white" }} /> Calculating footprint…</> : "Calculate footprint →"}
      </button>
      </>
      )}
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
                <span className={`chip ${r.source === "Primary" ? "chip-green" : r.source === "Benchmark" ? "chip-gray" : "chip-blue"}`} style={{ fontSize: 11 }}>{r.source}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PRM INTEGRATION: How we knew who to ask
// ─────────────────────────────────────────────────────────────────────

const PRM_FIELDS = [
  { sf: "Account (Vendor) → Account.Parent", maps: "Account relationships: who supplies what", val: "11 vendor accounts linked to Style 225G731 BOM (Shahi, Arvind, Lenzing, YKK, Maersk…)", conf: "exact" },
  { sf: "Contact (External) where AccountId IN :vendors", maps: "Supplier contacts: named person per vendor, not a generic inbox", val: "7 named supplier contacts (Sustainability, EHS, Plant Mgr, Account Director)", conf: "exact" },
  { sf: "User + Contact (Internal) where Department IN (…)", maps: "Internal team members: procurement, ops, logistics owners", val: "9 Carter's HQ owners (Sourcing, Procurement, Mfg Ops, Facilities, Logistics, DC)", conf: "exact" },
  { sf: "Contact.ReportsToId chain", maps: "Org hierarchy: right person vs. generic role inbox", val: "Resolved to individual owner at each vendor (skipped 4 shared aliases)", conf: "exact" },
  { sf: "AccountContactRelation.Roles", maps: "Account ↔ material/component coverage", val: "Maps each contact to the BOM line they own (fabric, trim, fiber, freight)", conf: "rule" },
  { sf: "Contact.Last_Verified_At__c", maps: "Contact freshness: avoids bouncing emails", val: "16/16 contacts verified in last 90 days", conf: "rule" },
];

const PRM_OWNERS = [
  // Internal · Carter's HQ
  { dept: "Product Management", icon: <I.box />, name: "Alex Johnson", email: "alex.johnson@carters.com", title: "Sr. Product Manager, Little Planet™", sfRole: "Product2 Lead, Style 225G731", group: "Internal · Carter's HQ", queries: ["Bill of materials", "Product weight", "Compliance deadline", "Supplier contact list"], why: "Primary PM on the SKU; owns BOM, product specs, weight/dimensions, and compliance timeline" },
  { dept: "Design & PD", icon: <I.pencil />, name: "Megan O'Connell", email: "megan.oconnell@carters.com", title: "Senior Designer, Little Planet™", sfRole: "Material Composition Owner", group: "Internal · Carter's HQ", queries: ["Material composition", "Fabric weight (GSM)", "Wash durability cycles", "End-of-life design"], why: "Owns material % composition, snap/trim selection, and end-of-life recyclability assumptions" },
  { dept: "R&D / Engineering", icon: <I.pencil />, name: "Wei Zhang", email: "wei.zhang@carters.com", title: "Textile R&D Engineer", sfRole: "Process Spec Owner", group: "Internal · Carter's HQ", queries: ["Process specs (knit, dye, finish)", "Packaging design", "Disassembly index"], why: "Defines manufacturing process specs (knitting, dyeing, finishing) and packaging design system" },
  { dept: "Sourcing, Babywear", icon: <I.box />, name: "Priya Raghavan", email: "priya.raghavan@carters.com", title: "Director, Sourcing, Babywear", sfRole: "Vendor Relationship Owner, Shahi Exports", group: "Internal · Carter's HQ", queries: ["Tier 1–2 vendor accounts", "Fabric specification", "Supplier location", "Inbound freight"], why: "Owns Shahi Exports MSA + 9 of 11 Tier-2 mill contracts; routes Tier-1/2 supplier requests" },
  { dept: "Procurement, Trims", icon: <I.box />, name: "Hannah Park", email: "hannah.park@carters.com", title: "Procurement Manager, Trims & Packaging", sfRole: "PO Owner, YKK / Avery Dennison", group: "Internal · Carter's HQ", queries: ["Trim and packaging purchase orders", "Supplier packaging materials"], why: "Owns inbound packaging materials and trim supplier routing (YKK SNAD, Avery Dennison FSC)" },
  { dept: "Manufacturing Ops", icon: <I.factory />, name: "Rakesh Iyer", email: "rakesh.iyer@carters.com", title: "Mfg Ops Lead, India South", sfRole: "Site Lead, Bengaluru", group: "Internal · Carter's HQ", queries: ["Manufacturing site (India South)", "Energy log (last 90 days)", "Water use", "Waste manifest", "ZDHC ClearStream compliance"], why: "Single ops lead tied to Shahi Unit 8; owns electricity, gas, water, and on-site waste data" },
  { dept: "Facilities, Bengaluru", icon: <I.factory />, name: "Anjali Krishnan", email: "anjali.krishnan@carters.com", title: "Facilities Manager, Shahi Unit 8 (embed)", sfRole: "Equipment Efficiency Owner", group: "Internal · Carter's HQ", queries: ["Equipment efficiency", "Steam consumption", "Compressed air (kWh)"], why: "Tracks per-line equipment efficiency and process utility consumption per production run" },
  { dept: "Global Logistics", icon: <I.truck />, name: "Daniel Reyes", email: "daniel.reyes@carters.com", title: "Sr. Manager, Global Logistics", sfRole: "Shipment Owner, IN→US lanes", group: "Internal · Carter's HQ", queries: ["Shipment records for SKU-LP-3PSP-NB", "Carrier transport mode", "Mundra–Savannah shipping lane"], why: "Owns Mundra→Savannah outbound shipments and inbound freight volumes for this style YTD" },
  { dept: "Distribution, Braselton DC", icon: <I.truck />, name: "Marcus Lee", email: "marcus.lee@carters.com", title: "DC Operations Manager, Braselton GA", sfRole: "Warehouse Energy Owner", group: "Internal · Carter's HQ", queries: ["Braselton warehouse data", "Warehouse energy (kWh)", "Last-mile carrier mix"], why: "Owns warehousing energy use and last-mile carrier mix from Braselton DC to retail / DTC" },

  // External · Tier-1 / Tier-2 / 3PL (Pathways Data Requests)
  { dept: "Tier 1 Supplier", icon: <I.box />, name: "Sunil Mehta", email: "sunil.mehta@shahi.co.in", title: "Sustainability Lead, Shahi Exports", sfRole: "External : vendor contact", group: "External · Data Request", queries: ["Primary material production data", "Component EPDs", "Packaging weight"], why: "Cut-and-sew partner for Style 225G731; provides primary material data, component EPDs, and packaging weight" },
  { dept: "Tier 2 Mill", icon: <I.box />, name: "Lakshmi Narayanan", email: "lakshmi.narayanan@arvind.com", title: "EHS Manager, Arvind Limited (Naroda)", sfRole: "External : tier-2 mill contact", group: "External · Data Request", queries: ["GOTS certificate", "Dye house energy", "Effluent (kg)"], why: "Owns GOTS certificate, dye-house energy, and effluent data for the knit fabric supplied to Shahi" },
  { dept: "Tier 2 Fiber", icon: <I.box />, name: "Klaus Berger", email: "klaus.berger@lenzing.com", title: "Sustainability Manager, Lenzing AG", sfRole: "External : ecovero account", group: "External · Data Request", queries: ["EcoVero LCA module", "Wood pulp FSC chain of custody"], why: "Provides EcoVero™ viscose LCA module + FSC chain-of-custody for the 5% blend" },
  { dept: "Contract Manufacturer", icon: <I.factory />, name: "Aditi Sharma", email: "aditi.sharma@shahi.co.in", title: "Plant Manager, Shahi Unit 8 Finishing", sfRole: "External : toll mfg contact", group: "External · Data Request", queries: ["Energy per unit (kWh)", "Scrap rate (%)", "Coating process emissions"], why: "Runs finishing line; owns per-unit energy, scrap rate, and process-specific emissions (printing, coating)" },
  { dept: "Trim Supplier", icon: <I.box />, name: "Tomoko Yamada", email: "tomoko.yamada@ykk.com", title: "Account Manager, YKK SNAD (Tirupur)", sfRole: "External : trim vendor", group: "External · Data Request", queries: ["Snap material specification", "Nickel-free certificate", "Component weight (g)"], why: "Supplies nickel-free brass snaps; provides component spec, certificate, and weight per garment" },
  { dept: "3PL, Ocean", icon: <I.truck />, name: "Henrik Sørensen", email: "henrik.sorensen@maersk.com", title: "Account Director, Maersk Spot", sfRole: "External : carrier contact", group: "External · Data Request", queries: ["Lane distance (nautical miles)", "Vessel fuel type", "TEU utilization (%)"], why: "Confirms Mundra→Savannah lane distance, fuel mix (VLSFO vs. bio-blend), and TEU utilization" },
  { dept: "3PL, Inland US", icon: <I.truck />, name: "Carla Mendes", email: "carla.mendes@schneider.com", title: "Operations Lead, Schneider National", sfRole: "External : drayage / trucking", group: "External · Data Request", queries: ["Drayage distance (miles)", "Diesel consumption (gal/mile)", "Rail vs. road mode mix"], why: "Owns Savannah port → Braselton DC drayage; provides fuel consumption and rail/road mode confirmations" },
];

function PrmDeliverables({ queries }: { queries: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 12 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span className="label">Deliverables needed ({queries.length})</span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 150ms ease",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          {queries.map((q) => (
            <div key={q} style={{ fontSize: 13, color: "var(--text-secondary)", padding: "2px 0" }}>
              · {q}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepPRM({ lcaData, go, pushToast }: { lcaData: LcaData; go: (s: Step) => void; pushToast: (t: string, k?: Toast["kind"]) => void }) {
  const [connected, setConnected] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [ownersLoading, setOwnersLoading] = useState(true);
  const [lastSync, setLastSync] = useState("2 min ago");
  const [provider, setProvider] = useState<"salesforce" | "hubspot" | "dynamics">("salesforce");

  useEffect(() => {
    setOwnersLoading(true);
    const timer = window.setTimeout(() => setOwnersLoading(false), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  function resync() {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); setLastSync("just now"); pushToast("PRM resynced: 16 owners confirmed across internal + external partners", "success"); }, 1100);
  }

  async function sendRequests() {
    setSending(true);
    const minDelay = new Promise((r) => setTimeout(r, 3800));
    const emailPromise = sendDataRequestEmails({
      data: { productName: lcaData.productName || "Little Planet™ Organic Sleep & Play (3-Pack)" },
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Email failed";
      return { sent: false as const, error: message };
    });
    const [emailResult] = await Promise.all([emailPromise, minDelay]);
    setSending(false);
    if (emailResult && "sent" in emailResult && emailResult.sent) {
      pushToast("16 data requests queued · demo email sent", "success");
    } else {
      const errMsg = emailResult && "error" in emailResult ? emailResult.error : "unknown error";
      pushToast(`Requests dispatched · email skipped (${errMsg})`, "info");
    }
    go(2);
  }

  return (
    <div style={{ padding: 40, maxWidth: 1180 }}>
      <BackBtn go={go} to={1} />
      
      <Eyebrow>PRM Integration</Eyebrow>
      <h1 className="page-title" style={{ marginBottom: 28 }}>How we knew who to ask.</h1>


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
              <span style={{ fontWeight: 500 }}>Salesforce · Carter's Inc. · Sourcing Production Org</span>
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


      {/* Identified owners */}
      {ownersLoading ? (
        <div className="card" style={{ marginTop: 28, padding: 32, textAlign: "center" }}>
          <span className="spinner" style={{ marginBottom: 14, borderTopColor: "var(--green-dark)" }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Identifying data owners…</div>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Matching BOM fields to contacts across 1,284 records</div>
        </div>
      ) : (
      <>
      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <h2 className="section-title">{PRM_OWNERS.length} data owners identified</h2>
          <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
            Resolved from 1,284 contacts · 9 internal + 7 external
          </span>
        </div>

        {(["Internal · Carter's HQ", "External · Data Request"] as const).map((groupName) => {
          const groupOwners = PRM_OWNERS.filter((o) => o.group === groupName);
          const isExternal = groupName.startsWith("External");
          return (
            <div key={groupName} style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span className={isExternal ? "chip chip-blue" : "chip chip-green"} style={{ fontSize: 11 }}>
                  {isExternal ? "External vendors · Pathways Data Request" : "Internal Carter's HQ · Pathways Data Request"}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  {groupOwners.length} {isExternal ? "supplier contacts" : "team members"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {groupOwners.map((o) => (
                  <div key={o.name} className="card card-hover">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10,
                          background: isExternal ? "#EAF2FB" : "var(--green-light)",
                          color: isExternal ? "#1E4FA3" : "var(--green-dark)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>{o.icon}</div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{o.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{o.title} · {o.dept}</div>
                          <span className="mono" style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, display: "inline-block" }}>
                            {o.email}
                          </span>
                        </div>
                      </div>
                      <span className={isExternal ? "chip chip-blue" : "chip chip-gray"} style={{ fontSize: 10 }}>{o.sfRole}</span>
                    </div>
                    <PrmDeliverables queries={o.queries} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>



      <button onClick={sendRequests} className="btn btn-primary" style={{ width: "100%", marginTop: 24, padding: 14 }} disabled={sending}>
        {sending ? (
          <><span className="spinner" style={{ borderTopColor: "white" }} /> Sending requests…</>
        ) : (
          <>Send requests →</>
        )}
      </button>
      </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// LIBRARY: Completed LCAs (track, rerun with updated data, version)
// ─────────────────────────────────────────────────────────────────────

type LcaRecord = {
  id: string;
  product: string;
  sku: string;
  status: "Completed" | "In progress" | "Needs refresh";
  pillar: "Sustainably Made" | "Safe for Kids" | "Tough for Play";
  footprint: number;     // g CO2e per unit
  delta: number;         // % vs previous version
  baseline: number;      // baseline footprint
  accuracy: number;      // %
  version: string;
  versions: number;
  lastRun: string;
  nextDue: string;
  owner: string;
  staleness: "fresh" | "aging" | "stale";
  trend: number[];
  playsAssigned: number;
  playsTotal: number;
};

const LCA_LIBRARY: LcaRecord[] = [
  {
    id: "lca-001", product: "Little Planet™ Organic Sleep & Play (3-Pack)", sku: "225G731 · LP-3PSP-NB",
    status: "Completed", pillar: "Sustainably Made",
    footprint: 3240, delta: -15.0, baseline: 3812, accuracy: 74,
    version: "v1.3", versions: 3, lastRun: "Jun 15, 2026", nextDue: "Sep 15, 2026",
    owner: "Alex Johnson", staleness: "fresh",
    trend: [3812, 3640, 3420, 3380, 3290, 3240], playsAssigned: 1, playsTotal: 7,
  },
  {
    id: "lca-002", product: "Carter's® 5-Pack Short-Sleeve Cotton Bodysuits", sku: "1H693410 · CT-BSS5-12M",
    status: "Completed", pillar: "Tough for Play",
    footprint: 4180, delta: -8.2, baseline: 4555, accuracy: 81,
    version: "v2.0", versions: 5, lastRun: "May 28, 2026", nextDue: "Aug 28, 2026",
    owner: "Priya Raghavan", staleness: "fresh",
    trend: [4555, 4480, 4380, 4290, 4220, 4180], playsAssigned: 4, playsTotal: 6,
  },
  {
    id: "lca-003", product: "OshKosh B'gosh® Vintage Denim Short, Toddler", sku: "3J451102 · OK-DSH-3T",
    status: "Needs refresh", pillar: "Sustainably Made",
    footprint: 5640, delta: 2.4, baseline: 5510, accuracy: 68,
    version: "v1.1", versions: 2, lastRun: "Feb 10, 2026", nextDue: "Overdue · May 10",
    owner: "Megan O'Connell", staleness: "stale",
    trend: [5510, 5560, 5590, 5620, 5630, 5640], playsAssigned: 2, playsTotal: 5,
  },
  {
    id: "lca-004", product: "Little Planet™ Organic Cotton Footed Pajama", sku: "115G642 · LP-FPJ-9M",
    status: "Completed", pillar: "Safe for Kids",
    footprint: 2960, delta: -22.4, baseline: 3815, accuracy: 86,
    version: "v2.2", versions: 4, lastRun: "Jun 02, 2026", nextDue: "Sep 02, 2026",
    owner: "Alex Johnson", staleness: "fresh",
    trend: [3815, 3540, 3320, 3140, 3020, 2960], playsAssigned: 5, playsTotal: 5,
  },
  {
    id: "lca-005", product: "Carter's® Heavyweight Sherpa Hooded Jacket", sku: "1L885221 · CT-SHJ-4T",
    status: "Completed", pillar: "Tough for Play",
    footprint: 9120, delta: -5.6, baseline: 9665, accuracy: 72,
    version: "v1.2", versions: 2, lastRun: "Apr 22, 2026", nextDue: "Jul 22, 2026",
    owner: "Daniel Reyes", staleness: "aging",
    trend: [9665, 9540, 9410, 9290, 9180, 9120], playsAssigned: 2, playsTotal: 8,
  },
  {
    id: "lca-006", product: "Little Planet™ Recycled Polyester Swim Trunk", sku: "335G119 · LP-SWM-5",
    status: "In progress", pillar: "Sustainably Made",
    footprint: 0, delta: 0, baseline: 2410, accuracy: 41,
    version: "v0.4 (draft)", versions: 1, lastRun: "-", nextDue: "-",
    owner: "Alex Johnson", staleness: "fresh",
    trend: [], playsAssigned: 0, playsTotal: 0,
  },
];

function Library({ go, pushToast }: { go: (s: Step) => void; pushToast: (t: string, k?: Toast["kind"]) => void }) {
  const [filter, setFilter] = useState<"all" | "completed" | "stale" | "in-progress">("all");
  const [pillarFilter, setPillarFilter] = useState<"all" | "Sustainably Made" | "Safe for Kids" | "Tough for Play">("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = LCA_LIBRARY.filter((r) => {
    if (filter === "completed" && r.status !== "Completed") return false;
    if (filter === "stale" && r.status !== "Needs refresh") return false;
    if (filter === "in-progress" && r.status !== "In progress") return false;
    if (pillarFilter !== "all" && r.pillar !== pillarFilter) return false;
    if (query && !`${r.product} ${r.sku} ${r.owner}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const open = openId ? LCA_LIBRARY.find((r) => r.id === openId) ?? null : null;

  function rerun(r: LcaRecord) {
    pushToast(`Re-running ${r.product} with refreshed Tier-1/Tier-2 data; new version queued`, "info");
    setOpenId(null);
  }
  function refreshData(r: LcaRecord) {
    pushToast(`Re-pulling Salesforce vendor + ZDHC ClearStream data for ${r.sku}`, "info");
  }

  return (
    <div style={{ padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <Eyebrow>My LCAs</Eyebrow>
          <h1 className="page-title" style={{ marginBottom: 6 }}>LCA library</h1>
          <p className="body-text" style={{ maxWidth: 720 }}>
            All LCAs in one place. Re-run, compare versions, track Raise the Future™ progress.
          </p>
        </div>
        <button onClick={() => go(1)} className="btn btn-primary">+ Start a new LCA</button>
      </div>

      {/* Filter row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="input" placeholder="Search by product or owner…" value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: "1 1 280px", maxWidth: 360 }}
        />
        <div style={{ display: "flex", gap: 4, background: "var(--gray-section)", padding: 4, borderRadius: 10 }}>
          {([
            ["all", "All"], ["completed", "Completed"], ["stale", "Needs refresh"], ["in-progress", "In progress"],
          ] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: filter === k ? "white" : "transparent",
              color: filter === k ? "var(--text-primary)" : "var(--text-secondary)",
              boxShadow: filter === k ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}>{l}</button>
          ))}
        </div>
        <select className="input" value={pillarFilter} onChange={(e) => setPillarFilter(e.target.value as any)} style={{ width: "auto", padding: "8px 12px", fontSize: 13 }}>
          <option value="all">All Raise the Future™ pillars</option>
          <option>Sustainably Made</option>
          <option>Safe for Kids</option>
          <option>Tough for Play</option>
        </select>
        <span style={{ fontSize: 13, color: "var(--text-tertiary)", marginLeft: "auto" }}>
          {filtered.length} of {LCA_LIBRARY.length} LCAs
        </span>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "2.2fr 130px 110px 130px 130px 130px 150px 140px",
          padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--gray-section)",
        }}>
          {["Product", "Status", "Version", "g CO₂e / unit", "Δ vs. baseline", "Accuracy", "Last run / next due", ""].map((h, i) => (
            <div key={i} className="label">{h}</div>
          ))}
        </div>
        {filtered.map((r) => {
          const isOpen = open?.id === r.id;
          const statusChip =
            r.status === "Completed" ? "chip chip-green"
            : r.status === "Needs refresh" ? "chip chip-amber"
            : "chip chip-gray";
          const stalenessBar =
            r.staleness === "fresh" ? "var(--green-dark)"
            : r.staleness === "aging" ? "#D9A441"
            : "#C44545";
          return (
            <div key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <div
                onClick={() => setOpenId(isOpen ? null : r.id)}
                style={{
                  display: "grid", gridTemplateColumns: "2.2fr 130px 110px 130px 130px 130px 150px 140px",
                  padding: "16px 20px", alignItems: "center",
                  borderLeft: `3px solid ${stalenessBar}`,
                  background: isOpen ? "var(--gray-section)" : "transparent",
                  cursor: "pointer", transition: "background 160ms ease",
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{r.product}</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                    <span style={{ color: "var(--green-dark)" }}>{r.pillar}</span> · Owner: {r.owner}
                  </div>
                </div>
                <div><span className={statusChip}>{r.status}</span></div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }} className="tabular">{r.version}</div>
                <div className="tabular" style={{ fontSize: 14, fontWeight: 500 }}>
                  {r.footprint > 0 ? r.footprint.toLocaleString() : "-"}
                </div>
                <div>
                  {r.status === "In progress" ? (
                    <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>-</span>
                  ) : (
                    <span className={`chip ${r.delta < 0 ? "chip-green" : "chip-red"} tabular`}>
                      {r.delta < 0 ? "▼ " : "▲ "}{Math.abs(r.delta).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13 }} className="tabular">{r.accuracy}%</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  <div>{r.lastRun}</div>
                  <div style={{ color: r.staleness === "stale" ? "#C44545" : "var(--text-tertiary)", marginTop: 2 }}>
                    Due: {r.nextDue}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); rerun(r); }}
                    className="btn btn-sm"
                    style={{
                      background: r.staleness === "stale" ? "var(--green-dark)" : "white",
                      color: r.staleness === "stale" ? "white" : "var(--text-primary)",
                      border: "1px solid " + (r.staleness === "stale" ? "var(--green-dark)" : "var(--border-solid)"),
                    }}
                  >
                    {r.status === "In progress" ? "Resume" : "Re-run ↻"}
                  </button>
                </div>
              </div>

              {isOpen && r.status !== "In progress" && (
                <div className="fade-in" style={{ padding: "0 20px 24px 23px", background: "var(--gray-section)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 16, paddingTop: 16 }}>
                    {/* Trend sparkline */}
                    <div className="card" style={{ background: "white" }}>
                      <div className="label" style={{ marginBottom: 12 }}>Footprint trend across versions</div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 56, marginBottom: 8 }}>
                        {r.trend.map((v, i) => {
                          const max = Math.max(...r.trend);
                          const min = Math.min(...r.trend);
                          const range = Math.max(1, max - min);
                          const barH = Math.round(((v - min) / range) * 44 + 12);
                          const isLast = i === r.trend.length - 1;
                          return (
                            <div
                              key={i}
                              title={`${v.toLocaleString()} g CO₂e`}
                              style={{
                                flex: 1,
                                height: barH,
                                borderRadius: 4,
                                background: isLast ? "var(--green-dark)" : "var(--green-light)",
                                border: "1px solid " + (isLast ? "var(--green-dark)" : "var(--green-border)"),
                              }}
                            />
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                        {r.trend.map((v, i) => (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              textAlign: "center",
                              fontSize: 10,
                              color: i === r.trend.length - 1 ? "var(--text-primary)" : "var(--text-secondary)",
                              fontWeight: i === r.trend.length - 1 ? 500 : 400,
                            }}
                            className="tabular"
                          >
                            {v.toLocaleString()}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        {r.trend.map((_, i) => (
                          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "var(--text-tertiary)" }}>
                            v{i + 1}
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                        Baseline {r.baseline.toLocaleString()} g → current {r.footprint.toLocaleString()} g · {r.versions} versions on record
                      </div>
                    </div>

                    {/* Plays + actions */}
                    <div className="card" style={{ background: "white" }}>
                      <div className="label" style={{ marginBottom: 10 }}>Action queue</div>
                      <div style={{ fontSize: 22, fontWeight: 500 }} className="tabular">
                        {r.playsAssigned}<span style={{ fontSize: 14, color: "var(--text-tertiary)" }}> / {r.playsTotal}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, marginBottom: 12 }}>
                        Plays assigned to sourcing, design & ops
                      </div>
                      <div style={{ height: 6, background: "var(--gray-section)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          width: `${r.playsTotal ? (r.playsAssigned / r.playsTotal) * 100 : 0}%`,
                          height: "100%", background: "var(--green-dark)",
                        }} />
                      </div>
                    </div>

                    {/* Refresh signals */}
                    <div className="card" style={{ background: "white" }}>
                      <div className="label" style={{ marginBottom: 10 }}>Refresh signals</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Salesforce vendor data</span>
                          <span className="chip chip-green" style={{ fontSize: 11 }}>Synced 2h ago</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>ZDHC ClearStream</span>
                          <span className={`chip ${r.staleness === "stale" ? "chip-amber" : "chip-green"}`} style={{ fontSize: 11 }}>
                            {r.staleness === "stale" ? "New cycle available" : "Current"}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Higg MSI release</span>
                          <span className="chip chip-gray" style={{ fontSize: 11 }}>v3.7 (in use)</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>FOB pricing (PO refresh)</span>
                          <span className="chip chip-gray" style={{ fontSize: 11 }}>{r.lastRun}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {r.staleness === "stale" && (
                    <div style={{
                      marginTop: 14, padding: "12px 16px", background: "var(--amber-light)",
                      border: "1px solid var(--amber-border)", borderRadius: 10, fontSize: 13,
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
                    }}>
                      <span>
                        ⚠ Past 90-day refresh cadence. Arvind switched mills in Apr; re-run to update energy mix.
                      </span>
                      <button onClick={() => rerun(r)} className="btn btn-primary btn-sm">Re-run with updated data →</button>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <button onClick={() => refreshData(r)} className="btn btn-outline btn-sm">Pull latest vendor data</button>
                    <button onClick={() => go(4)} className="btn btn-outline btn-sm">View footprint</button>
                    <button onClick={() => go(5)} className="btn btn-outline btn-sm">Open action queue</button>
                    <button onClick={() => go(6)} className="btn btn-outline btn-sm">Model a scenario</button>
                    <button onClick={() => pushToast(`Comparing ${r.version} vs prior version`, "info")} className="btn btn-ghost btn-sm">Compare versions</button>
                    <button onClick={() => pushToast("Exporting LCA report (PDF + .xlsx)", "info")} className="btn btn-ghost btn-sm">Export report</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", fontSize: 14 }}>
            No LCAs match these filters.
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-tertiary)" }}>
        LCAs auto-flag for refresh every 90 days or on vendor / pricing changes.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SUPPLIER DATA REQUEST: external upload portal (post-email link)
// ─────────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const UPLOAD_ACCEPT = ".pdf,.csv,.xlsx,.xls,.jpg,.jpeg,.png";
const UPLOAD_PATTERN = /\.(pdf|csv|xlsx|xls|jpg|jpeg|png)$/i;

type UploadedFile = { name: string; size: number; type: string; file: File };

function SupplierUpload({ go, pushToast }: { go: (s: Step) => void; pushToast: (t: string, k?: Toast["kind"]) => void }) {
  const [step, setStep] = useState<"email" | "form" | "done">("email");
  const [filled, setFilled] = useState<Record<string, boolean>>({});
  const [uploaded, setUploaded] = useState<Record<string, UploadedFile | null>>({ gots: null, energy: null, packaging: null });
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [signature, setSignature] = useState("");
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const signatureIsCursive = signature.trim().length > 0;

  const fields = [
    { id: "matComp", label: "Primary material composition", help: "Confirm fabric blend for Style 225G731.", prefill: "60% organic cotton (GOTS) + 40% Lenzing™ EcoVero™ viscose" },
    { id: "weight",  label: "Component weight (g per garment)", help: "Fabric weight per piece, excl. trim.", prefill: "112" },
    { id: "scrap",   label: "Cut-and-sew scrap rate (%)",       help: "Avg. for this style, last 90 days.", prefill: "3.4" },
    { id: "pkgWt",   label: "Packaging weight (g per 3-pack)",  help: "Polybag + hangtag + carton.", prefill: "18" },
  ];
  const uploads = [
    { id: "gots",      label: "GOTS Scope Certificate", hint: "PDF · current cycle" },
    { id: "energy",    label: "Facility energy log (last 90 days)", hint: "CSV or XLSX · kWh by source" },
    { id: "packaging", label: "Packaging spec sheet", hint: "PDF or image" },
  ];
  const filledCount = Object.values(filled).filter(Boolean).length + Object.values(uploaded).filter(Boolean).length;
  const totalCount = fields.length + uploads.length;
  const pct = Math.round((filledCount / totalCount) * 100);

  function handleFile(id: string, file: File) {
    if (!UPLOAD_PATTERN.test(file.name)) {
      pushToast("PDF, CSV, XLSX, JPG, or PNG only", "warning");
      return;
    }
    setUploaded((u) => ({ ...u, [id]: { name: file.name, size: file.size, type: file.type, file } }));
    pushToast(`${file.name} attached`, "success");
  }

  function openFilePicker(id: string) {
    fileInputRefs.current[id]?.click();
  }

  function clearUpload(id: string) {
    setUploaded((u) => ({ ...u, [id]: null }));
    const input = fileInputRefs.current[id];
    if (input) input.value = "";
  }

  return (
    <div style={{ padding: 40, maxWidth: 980, margin: "0 auto" }}>
      {step === "email" && (
        <>
          <Eyebrow>Your inbox</Eyebrow>
          <h1 className="page-title" style={{ marginBottom: 10 }}>Data request: Style 225G731</h1>
          <p className="body-text" style={{ maxWidth: 720, marginBottom: 28 }}>
            Secure upload link for Style 225G731 from Priya at Carter's.
          </p>
        </>
      )}

      {step === "form" && (
        <>
          <Eyebrow>Data request</Eyebrow>
          <h1 className="page-title" style={{ marginBottom: 10 }}>Style 225G731 · Little Planet™ 3-Pack Sleep & Play</h1>
          <p className="body-text" style={{ maxWidth: 720, marginBottom: 28 }}>
            Confirm 4 data points and attach 3 documents. Pre-filled from your last submission.
          </p>
        </>
      )}

      {/* ── STAGE 1: EMAIL ── */}
      {step === "email" && (
        <div className="card" style={{ padding: 0, overflow: "hidden", maxWidth: 720 }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--gray-section)", fontSize: 12, color: "var(--text-tertiary)", display: "flex", justifyContent: "space-between" }}>
            <span>Inbox · sunil.mehta@shahi.co.in</span>
            <span>June 13, 2026 · 9:05am IST</span>
          </div>
          <div style={{ padding: "22px 24px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 6 }}>From <strong style={{ color: "var(--text-primary)" }}>Priya Raghavan</strong> &lt;priya.raghavan@carters.com&gt; via Pathways</div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 14 }}>Subject: <strong style={{ color: "var(--text-primary)" }}>Data request: Style 225G731 (Little Planet™ 3-Pack Sleep & Play)</strong></div>
            <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 14 }}>Hi Sunil,</p>
            <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 14 }}>
              We're refreshing the LCA for <strong>Style 225G731</strong> at Shahi Unit 8. Need 4 data points and 3 documents.
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 14 }}>
              Pre-filled from your last submission; mostly confirm and attach. <strong>~10 min</strong>, no login needed.
            </p>
            <button onClick={() => setStep("form")} className="btn btn-primary" style={{ marginTop: 6, marginBottom: 16, padding: "12px 22px" }}>
              Open data request →
            </button>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
              Link expires June 27. Reply to this email with questions.<br />
              - Priya
            </p>
          </div>
          <div style={{ padding: "12px 20px", background: "var(--gray-section)", fontSize: 11, color: "var(--text-tertiary)", textAlign: "center" }}>
            Sent securely via Pathways · pathways.carters.com/r/9F2K-A81P
          </div>
        </div>
      )}

      {/* ── STAGE 2: FORM ── */}
      {step === "form" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24, alignItems: "start" }}>
          <div>
            {/* Branded header */}
            <div className="card" style={{ padding: 20, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>Data request from Carter's, Inc.</div>
                <div style={{ fontWeight: 500, fontSize: 16 }}>Style 225G731 · Little Planet™ 3-Pack Sleep & Play</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>For Sunil Mehta · Shahi Exports · Unit 8, Bengaluru</div>
              </div>
              <span className="chip chip-green" style={{ fontSize: 11 }}>Secure link · expires Jun 27</span>
            </div>

            {/* Pre-filled fields */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 4 }}>Confirm 4 data points</div>
              <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 16 }}>
                Pre-filled from June 2025. Edit if changed, then confirm.
              </div>
              {fields.map((f) => (
                <div key={f.id} style={{ paddingTop: 14, paddingBottom: 14, borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                    <label style={{ fontSize: 14, fontWeight: 500 }}>{f.label}</label>
                    <label style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input type="checkbox" checked={!!filled[f.id]} onChange={(e) => setFilled((s) => ({ ...s, [f.id]: e.target.checked }))} />
                      Confirm
                    </label>
                  </div>
                  <input className="input" defaultValue={f.prefill} style={{ fontSize: 14 }} />
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6 }}>{f.help}</div>
                </div>
              ))}
            </div>

            {/* Upload */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 4 }}>Attach 3 documents</div>
              <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 16 }}>
                Drag &amp; drop or click. PDF, CSV, XLSX, JPG/PNG.
              </div>
              {uploads.map((u) => (
                <div key={u.id} style={{ paddingTop: 14, paddingBottom: 14, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{u.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>{u.hint}</div>
                  <input
                    ref={(el) => { fileInputRefs.current[u.id] = el; }}
                    type="file"
                    accept={UPLOAD_ACCEPT}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(u.id, file);
                    }}
                  />
                  {uploaded[u.id] ? (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                      padding: "12px 14px", borderRadius: 10, background: "var(--green-light)",
                      border: "1px solid var(--green-border)",
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          ✓ {uploaded[u.id]!.name}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                          {formatFileSize(uploaded[u.id]!.size)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => openFilePicker(u.id)}>Replace</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => clearUpload(u.id)}>Remove</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openFilePicker(u.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openFilePicker(u.id); }}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(u.id); }}
                      onDragLeave={() => setDragOver((id) => (id === u.id ? null : id))}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(null);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleFile(u.id, file);
                      }}
                      style={{
                        padding: "20px 16px", borderRadius: 10, textAlign: "center", cursor: "pointer",
                        border: `2px dashed ${dragOver === u.id ? "var(--green-dark)" : "var(--border-solid)"}`,
                        background: dragOver === u.id ? "var(--green-light)" : "var(--gray-section)",
                        transition: "border-color 160ms ease, background 160ms ease",
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Drop file here or click to browse</div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>PDF, CSV, XLSX, JPG, PNG</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Sign + submit */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 10 }}>Sign &amp; submit</div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                By submitting, you confirm this data is accurate. A receipt goes to you and Priya.
              </p>
              <input
                className="input"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Type your full name to sign"
                style={{
                  fontSize: signatureIsCursive ? 32 : 14,
                  fontFamily: signatureIsCursive ? "'Caveat', cursive" : "inherit",
                  padding: signatureIsCursive ? "18px 14px 8px" : undefined,
                  borderBottom: signatureIsCursive ? "1px solid var(--border-solid)" : undefined,
                  borderRadius: signatureIsCursive ? "8px 8px 0 0" : undefined,
                  background: signatureIsCursive ? "white" : undefined,
                  marginBottom: 12,
                }}
              />
              <button onClick={() => { setStep("done"); pushToast("Submission received; receipt emailed", "success"); }}
                className="btn btn-primary" style={{ width: "100%", padding: 14 }}>
                Submit data
              </button>
            </div>
          </div>

          {/* Right rail */}
          <div style={{ position: "sticky", top: 90 }}>
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="label" style={{ marginBottom: 8 }}>Progress</div>
              <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 6 }}>{filledCount}/{totalCount}</div>
              <div style={{ height: 6, background: "var(--border-solid)", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--green-dark)", transition: "width 300ms ease" }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Est. {Math.max(2, 10 - Math.round(filledCount * 1.2))} min remaining</div>
            </div>
            <div className="card" style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>Why we're asking</div>
              Carter's LCA for Style 225G731. Your data covers cut &amp; sew only; mill data from Arvind separately.
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>Need help?</div>
              Reply to the email or contact Priya at <span className="mono">priya.raghavan@carters.com</span>.
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 3: DONE ── */}
      {step === "done" && (
        <div className="card" style={{ padding: 32, maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", background: "var(--green-light)",
            color: "var(--green-dark)", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px", fontSize: 28,
          }}>✓</div>
          <h2 className="section-title" style={{ marginBottom: 8 }}>Thank you, Sunil.</h2>
          <p className="body-text" style={{ marginBottom: 20 }}>
            Submission received. Receipt emailed to you and Priya; no further action unless we follow up.
          </p>
          <div style={{ background: "var(--gray-section)", padding: 14, borderRadius: 10, fontSize: 13, color: "var(--text-secondary)", textAlign: "left", marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Reference</span><span className="mono">PW-225G731-SHAHI-0613</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Submitted</span><span>June 14, 2026 · 6:12pm IST</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Next refresh</span><span>~Q2 2027 (annual cycle)</span></div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 32, textAlign: "center" }}>
        <button onClick={() => go(2)} style={{ fontSize: 12, color: "var(--text-tertiary)", textDecoration: "underline" }}>
          Carter's team? Return to Pathways
        </button>
      </div>
    </div>
  );
}
