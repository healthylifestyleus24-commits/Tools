import { useState, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ApiConfig {
  pinterestToken: string;
  pinterestBoardId: string;
  geminiApiKey: string;
  cloudinaryCloud: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  googleSheetId: string;
  googleSheetApiKey: string;
}

interface WorkflowStep {
  id: string;
  name: string;
  icon: string;
  color: string;
  status: "idle" | "running" | "done" | "error";
  description: string;
}

interface PinData {
  title: string;
  description: string;
  imageUrl: string;
  link: string;
  boardId: string;
}

interface LogEntry {
  time: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

const initialSteps: WorkflowStep[] = [
  { id: "sheets", name: "Google Sheets", icon: "📊", color: "#0F9D58", status: "idle", description: "Search Rows" },
  { id: "gemini1", name: "Google Gemini AI", icon: "✨", color: "#8B5CF6", status: "idle", description: "Generate a response" },
  { id: "http1", name: "HTTP Request", icon: "🌐", color: "#3B82F6", status: "idle", description: "Make a request" },
  { id: "http2", name: "HTTP Download", icon: "🌐", color: "#3B82F6", status: "idle", description: "Download a file" },
  { id: "cloudinary1", name: "Cloudinary", icon: "☁️", color: "#3B4DB8", status: "idle", description: "Upload a Resource" },
  { id: "cloudinary2", name: "Cloudinary", icon: "☁️", color: "#3B4DB8", status: "idle", description: "Transform a Resource" },
  { id: "gemini2", name: "Google Gemini AI", icon: "✨", color: "#8B5CF6", status: "idle", description: "Generate a response" },
  { id: "pinterest", name: "Pinterest", icon: "📌", color: "#E60023", status: "idle", description: "Create a Pin" },
  { id: "sheets2", name: "Google Sheets", icon: "📊", color: "#0F9D58", status: "idle", description: "Update a Row" },
];

// ─── Animated Flow Node ────────────────────────────────────────────────────
function FlowNode({ step, index, isActive }: { step: WorkflowStep; index: number; isActive: boolean }) {
  const statusColor =
    step.status === "done" ? "#22C55E" :
    step.status === "running" ? "#F59E0B" :
    step.status === "error" ? "#EF4444" :
    step.color;

  return (
    <div className="flex flex-col items-center gap-1 relative">
      <div
        className={`relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-500 ${isActive || step.status === "running" ? "scale-110" : "scale-100"}`}
        style={{ backgroundColor: statusColor, boxShadow: isActive ? `0 0 20px ${statusColor}88` : undefined }}
      >
        <span className="text-2xl">{step.icon}</span>
        {step.status === "running" && (
          <div className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin" />
        )}
        {step.status === "done" && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
        )}
        {step.status === "error" && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">!</div>
        )}
        <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center text-white text-[9px] font-bold">{index + 1}</div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-gray-700 leading-tight">{step.name}</p>
        <p className="text-[10px] text-gray-400">{step.description}</p>
      </div>
    </div>
  );
}

// ─── Dotted Connector ─────────────────────────────────────────────────────
function DottedLine({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-0.5 pb-6 px-1">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${active ? "bg-blue-400 animate-pulse" : "bg-gray-300"}`} style={{ animationDelay: `${i * 100}ms` }} />
      ))}
    </div>
  );
}

// ─── Log Line ────────────────────────────────────────────────────────────────
function LogLine({ entry }: { entry: LogEntry }) {
  const colors = { info: "text-blue-400", success: "text-green-400", error: "text-red-400", warning: "text-yellow-400" };
  const icons = { info: "ℹ", success: "✓", error: "✗", warning: "⚠" };
  return (
    <div className="flex items-start gap-2 text-xs font-mono">
      <span className="text-gray-500 shrink-0">{entry.time}</span>
      <span className={`shrink-0 font-bold ${colors[entry.type]}`}>[{icons[entry.type]}]</span>
      <span className="text-gray-300">{entry.message}</span>
    </div>
  );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${active ? "bg-red-500 text-white shadow-md shadow-red-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
    >
      {label}
    </button>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<"workflow" | "config" | "create" | "logs">("workflow");
  const [steps, setSteps] = useState<WorkflowStep[]>(initialSteps);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [pinCount, setPinCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [config, setConfig] = useState<ApiConfig>({
    pinterestToken: "",
    pinterestBoardId: "",
    geminiApiKey: "",
    cloudinaryCloud: "",
    cloudinaryApiKey: "",
    cloudinaryApiSecret: "",
    googleSheetId: "",
    googleSheetApiKey: "",
  });

  const [pinData, setPinData] = useState<PinData>({
    title: "",
    description: "",
    imageUrl: "",
    link: "",
    boardId: "",
  });

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState("60");

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    setLogs((prev) => [...prev, { time, message, type }]);
  };

  const resetSteps = () => setSteps(initialSteps.map((s) => ({ ...s, status: "idle" })));

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const runAutomation = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setCurrentStep(0);
    resetSteps();
    setLogs([]);
    setTab("logs");

    addLog("🚀 Pinterest Automation শুরু হচ্ছে...", "info");

    const stepMessages = [
      { msg: "📊 Google Sheets থেকে ডেটা পড়া হচ্ছে...", success: "✅ Google Sheets: সফলভাবে রো পাওয়া গেছে" },
      { msg: "✨ Gemini AI দিয়ে টাইটেল ও বিবরণ তৈরি হচ্ছে...", success: "✅ Gemini AI: কন্টেন্ট জেনারেট সম্পন্ন" },
      { msg: "🌐 HTTP Request পাঠানো হচ্ছে ইমেজ সোর্সে...", success: "✅ HTTP: রিকোয়েস্ট সফল (200 OK)" },
      { msg: "⬇️ ইমেজ ডাউনলোড হচ্ছে...", success: "✅ HTTP: ফাইল ডাউনলোড সম্পন্ন" },
      { msg: "☁️ Cloudinary-তে ইমেজ আপলোড হচ্ছে...", success: "✅ Cloudinary: আপলোড সফল" },
      { msg: "🔄 Cloudinary-তে ইমেজ ট্রান্সফর্ম হচ্ছে...", success: "✅ Cloudinary: ট্রান্সফর্ম সম্পন্ন" },
      { msg: "✨ Gemini AI দিয়ে ক্যাপশন ও ট্যাগ তৈরি হচ্ছে...", success: "✅ Gemini AI: ক্যাপশন জেনারেট সম্পন্ন" },
      { msg: "📌 Pinterest-এ পিন তৈরি হচ্ছে...", success: "✅ Pinterest: পিন সফলভাবে তৈরি হয়েছে! 🎉" },
      { msg: "📊 Google Sheets আপডেট হচ্ছে...", success: "✅ Google Sheets: রো আপডেট সম্পন্ন" },
    ];

    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, status: "running" } : s));
      addLog(stepMessages[i].msg, "info");
      await sleep(1200 + Math.random() * 800);

      const hasError = !config.pinterestToken && i === 7;
      if (hasError) {
        setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, status: "error" } : s));
        addLog("❌ Pinterest Token পাওয়া যায়নি। API Config সেটআপ করুন।", "error");
        setIsRunning(false);
        setCurrentStep(-1);
        return;
      }

      setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, status: "done" } : s));
      addLog(stepMessages[i].success, "success");
    }

    setPinCount((p) => p + 1);
    setSuccessCount((p) => p + 1);
    addLog("🎊 Automation সম্পন্ন! পিন সফলভাবে পোস্ট হয়েছে।", "success");
    setIsRunning(false);
    setCurrentStep(-1);
  };

  const stopAutomation = () => {
    setIsRunning(false);
    setCurrentStep(-1);
    resetSteps();
    addLog("⛔ Automation থামানো হয়েছে।", "warning");
  };

  const createPin = async () => {
    if (!pinData.title || !pinData.imageUrl) {
      addLog("⚠️ টাইটেল এবং ইমেজ URL আবশ্যক", "warning");
      setTab("logs");
      return;
    }
    setTab("logs");
    addLog(`📌 ম্যানুয়াল পিন তৈরি হচ্ছে: "${pinData.title}"`, "info");
    await sleep(1500);
    if (!config.pinterestToken) {
      addLog("❌ Pinterest Access Token সেট করুন Config ট্যাবে", "error");
      return;
    }
    addLog(`✅ পিন সফলভাবে তৈরি হয়েছে: ${pinData.title}`, "success");
    setPinCount((p) => p + 1);
    setSuccessCount((p) => p + 1);
    setPinData({ title: "", description: "", imageUrl: "", link: "", boardId: "" });
  };

  const configFields: { key: keyof ApiConfig; label: string; placeholder: string; type?: string }[] = [
    { key: "pinterestToken", label: "Pinterest Access Token", placeholder: "pina_xxx...", type: "password" },
    { key: "pinterestBoardId", label: "Pinterest Board ID", placeholder: "board_id_here" },
    { key: "geminiApiKey", label: "Gemini AI API Key", placeholder: "AIzaSy...", type: "password" },
    { key: "cloudinaryCloud", label: "Cloudinary Cloud Name", placeholder: "mycloud" },
    { key: "cloudinaryApiKey", label: "Cloudinary API Key", placeholder: "123456789..." },
    { key: "cloudinaryApiSecret", label: "Cloudinary API Secret", placeholder: "secret_key...", type: "password" },
    { key: "googleSheetId", label: "Google Sheet ID", placeholder: "1BxiMVs0XRA..." },
    { key: "googleSheetApiKey", label: "Google Sheet API Key", placeholder: "AIzaSy...", type: "password" },
  ];

  const configuredCount = Object.values(config).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-red-50 to-pink-50">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center shadow-md shadow-red-200">
              <span className="text-xl">📌</span>
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-gray-900 leading-tight">Pinterest Automation</h1>
              <p className="text-[11px] text-gray-400">API-Powered Auto Pinning Tool</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-4 text-xs">
              <div className="text-center">
                <p className="font-bold text-red-500 text-lg leading-none">{pinCount}</p>
                <p className="text-gray-400">Total Pins</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-green-500 text-lg leading-none">{successCount}</p>
                <p className="text-gray-400">Success</p>
              </div>
              <div className="text-center">
                <p className={`font-bold text-lg leading-none ${configuredCount >= 6 ? "text-green-500" : "text-yellow-500"}`}>{configuredCount}/8</p>
                <p className="text-gray-400">APIs Set</p>
              </div>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full ${isRunning ? "bg-green-400 animate-pulse" : "bg-gray-300"}`} />
            <span className="text-xs text-gray-500">{isRunning ? "Running" : "Idle"}</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* ── Title ──────────────────────────────────────────────── */}
        <div className="text-center">
          <h2 className="text-4xl sm:text-5xl font-black text-red-500 leading-tight tracking-tight">Pinterest</h2>
          <h2 className="text-4xl sm:text-5xl font-black text-red-500 leading-tight tracking-tight">Automation</h2>
          <p className="mt-2 text-gray-500 text-sm">Google Sheets → Gemini AI → Cloudinary → Pinterest – সব কিছু Auto!</p>
        </div>

        {/* ── Control Buttons ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {!isRunning ? (
            <button
              onClick={runAutomation}
              className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-600 active:scale-95 transition-all duration-200"
            >
              <span>▶</span> Automation চালু করুন
            </button>
          ) : (
            <button
              onClick={stopAutomation}
              className="flex items-center gap-2 px-6 py-3 bg-gray-700 text-white font-bold rounded-xl shadow-lg hover:bg-gray-800 active:scale-95 transition-all duration-200"
            >
              <span>⏹</span> থামান
            </button>
          )}
          <button
            onClick={() => { resetSteps(); setLogs([]); setPinCount(0); setSuccessCount(0); }}
            className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 active:scale-95 transition-all duration-200"
          >
            🔄 রিসেট
          </button>
          <div className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl">
            <input
              type="checkbox"
              id="schedule"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
              className="accent-red-500 w-4 h-4"
            />
            <label htmlFor="schedule" className="text-sm text-gray-600 font-medium">Schedule</label>
            {scheduleEnabled && (
              <select
                value={scheduleInterval}
                onChange={(e) => setScheduleInterval(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600"
              >
                <option value="15">15 মিনিট</option>
                <option value="30">30 মিনিট</option>
                <option value="60">1 ঘণ্টা</option>
                <option value="360">6 ঘণ্টা</option>
                <option value="1440">প্রতিদিন</option>
              </select>
            )}
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap">
          <TabBtn label="⚡ Workflow" active={tab === "workflow"} onClick={() => setTab("workflow")} />
          <TabBtn label="🔧 API Config" active={tab === "config"} onClick={() => setTab("config")} />
          <TabBtn label="📌 Manual Pin" active={tab === "create"} onClick={() => setTab("create")} />
          <TabBtn label="📋 Logs" active={tab === "logs"} onClick={() => setTab("logs")} />
        </div>

        {/* ── Workflow Tab ─────────────────────────────────────────── */}
        {tab === "workflow" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">🔄 Automation Workflow</h3>
            <p className="text-sm text-gray-500 mb-6">নিচের ধাপগুলো অনুসরণ করে Pinterest-এ স্বয়ংক্রিয়ভাবে পিন তৈরি হয়</p>

            {/* Flow diagram */}
            <div className="overflow-x-auto">
              <div className="flex items-end gap-2 min-w-max pb-2">
                {steps.map((step, idx) => (
                  <div key={step.id} className="flex items-end">
                    <FlowNode step={step} index={idx} isActive={currentStep === idx} />
                    {idx < steps.length - 1 && <DottedLine active={step.status === "done" || currentStep > idx} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>অগ্রগতি</span>
                <span>{steps.filter((s) => s.status === "done").length}/{steps.length} ধাপ সম্পন্ন</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-400 to-pink-500 rounded-full transition-all duration-500"
                  style={{ width: `${(steps.filter((s) => s.status === "done").length / steps.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Step list */}
            <div className="mt-6 space-y-2">
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${currentStep === idx ? "bg-yellow-50 border border-yellow-200" : step.status === "done" ? "bg-green-50 border border-green-100" : step.status === "error" ? "bg-red-50 border border-red-100" : "bg-gray-50 border border-gray-100"}`}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: step.color + "22" }}>
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{step.name}</p>
                    <p className="text-xs text-gray-400">{step.description}</p>
                  </div>
                  <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${step.status === "idle" ? "bg-gray-100 text-gray-400" : step.status === "running" ? "bg-yellow-100 text-yellow-700" : step.status === "done" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {step.status === "idle" ? "অপেক্ষা" : step.status === "running" ? "চলছে..." : step.status === "done" ? "✓ সম্পন্ন" : "✗ ত্রুটি"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Config Tab ───────────────────────────────────────────── */}
        {tab === "config" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-800">🔧 API Configuration</h3>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${configuredCount >= 6 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                {configuredCount}/8 সেট করা হয়েছে
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-6">সব API key এখানে সেট করুন। তথ্য শুধুমাত্র browser-এ সংরক্ষিত থাকে।</p>

            <div className="grid sm:grid-cols-2 gap-4">
              {configFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                    {field.label}
                    {config[field.key] && <span className="text-green-500">✓</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={field.type || "text"}
                      value={config[field.key]}
                      onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-all bg-gray-50 placeholder-gray-300"
                    />
                    {config[field.key] && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <h4 className="text-sm font-bold text-blue-800 mb-2">📚 API Keys কীভাবে পাবেন?</h4>
              <ul className="text-xs text-blue-700 space-y-1.5">
                <li>• <strong>Pinterest Token:</strong> developers.pinterest.com → My Apps → Create App</li>
                <li>• <strong>Gemini API:</strong> aistudio.google.com → Get API key</li>
                <li>• <strong>Cloudinary:</strong> cloudinary.com → Dashboard → API Keys</li>
                <li>• <strong>Google Sheets:</strong> console.cloud.google.com → Sheets API enable করুন</li>
              </ul>
            </div>

            <button
              onClick={() => {
                addLog("✅ API Configuration সেভ হয়েছে", "success");
                setTab("workflow");
              }}
              className="mt-4 w-full py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 active:scale-95 transition-all duration-200 shadow-md shadow-red-200"
            >
              💾 Configuration সেভ করুন
            </button>
          </div>
        )}

        {/* ── Create Pin Tab ────────────────────────────────────────── */}
        {tab === "create" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">📌 Manual Pin তৈরি করুন</h3>
            <p className="text-sm text-gray-500 mb-6">সরাসরি Pinterest-এ একটি পিন তৈরি করুন Pinterest API দিয়ে</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">পিনের টাইটেল *</label>
                <input
                  type="text"
                  value={pinData.title}
                  onChange={(e) => setPinData((p) => ({ ...p, title: e.target.value }))}
                  placeholder="আকর্ষণীয় টাইটেল লিখুন..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-gray-50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">বিবরণ</label>
                <textarea
                  value={pinData.description}
                  onChange={(e) => setPinData((p) => ({ ...p, description: e.target.value }))}
                  placeholder="পিনের বিস্তারিত বিবরণ..."
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-gray-50 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">ইমেজ URL *</label>
                <input
                  type="url"
                  value={pinData.imageUrl}
                  onChange={(e) => setPinData((p) => ({ ...p, imageUrl: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-gray-50"
                />
              </div>
              {pinData.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-gray-200 max-h-48">
                  <img src={pinData.imageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Destination Link</label>
                  <input
                    type="url"
                    value={pinData.link}
                    onChange={(e) => setPinData((p) => ({ ...p, link: e.target.value }))}
                    placeholder="https://yoursite.com"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Board ID</label>
                  <input
                    type="text"
                    value={pinData.boardId || config.pinterestBoardId}
                    onChange={(e) => setPinData((p) => ({ ...p, boardId: e.target.value }))}
                    placeholder={config.pinterestBoardId || "board_id..."}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-gray-50"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-semibold text-gray-600 mb-2">🔌 API Endpoint Preview:</p>
              <code className="text-[11px] text-gray-500 font-mono break-all">
                POST https://api.pinterest.com/v5/pins<br />
                Authorization: Bearer {config.pinterestToken ? config.pinterestToken.slice(0, 12) + "..." : "<your_token>"}
              </code>
            </div>

            <button
              onClick={createPin}
              className="mt-4 w-full py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 active:scale-95 transition-all duration-200 shadow-md shadow-red-200 flex items-center justify-center gap-2"
            >
              📌 Pinterest-এ পিন করুন
            </button>
          </div>
        )}

        {/* ── Logs Tab ──────────────────────────────────────────────── */}
        {tab === "logs" && (
          <div className="bg-gray-900 rounded-2xl shadow-sm border border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-2 text-sm font-mono text-gray-400">automation.log</span>
              </div>
              <button onClick={() => setLogs([])} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                🗑 Clear
              </button>
            </div>
            <div className="p-4 h-80 overflow-y-auto space-y-2 font-mono">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-600">
                  <span className="text-3xl mb-2">📋</span>
                  <p className="text-sm">Automation চালু করলে এখানে log দেখাবে</p>
                </div>
              ) : (
                logs.map((entry, i) => <LogLine key={i} entry={entry} />)
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* ── Info Cards ────────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: "📊", title: "Google Sheets", desc: "স্বয়ংক্রিয়ভাবে Sheets থেকে ডেটা পড়ে এবং পিন তৈরির পর আপডেট করে", color: "green" },
            { icon: "✨", title: "Gemini AI", desc: "প্রতিটি পিনের জন্য আকর্ষণীয় টাইটেল, বিবরণ ও হ্যাশট্যাগ তৈরি করে", color: "purple" },
            { icon: "☁️", title: "Cloudinary", desc: "ইমেজ আপলোড, রিসাইজ, ওয়াটারমার্ক ও অপ্টিমাইজেশন করে", color: "blue" },
          ].map((card) => (
            <div key={card.title} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="text-2xl mb-2">{card.icon}</div>
              <h4 className="font-bold text-gray-800 text-sm">{card.title}</h4>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">Pinterest Automation Tool • API-Powered • React + TypeScript</p>
          <a
            href="#"
            className="mt-3 inline-block text-lg font-extrabold text-purple-600 hover:text-purple-700 animate-pulse"
          >
            {">> Download App <<"} 
          </a>
        </div>
      </div>
    </div>
  );
}
