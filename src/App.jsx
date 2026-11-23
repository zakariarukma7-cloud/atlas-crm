import { useState, useEffect } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import Companies from "./Companies";
import FollowUps from "./FollowUps";
import Messages from "./Messages";

const menu = [
  { name: "Overview", icon: "◫" },
  { name: "Leads", icon: "♙" },
  { name: "Companies", icon: "▦" },
  { name: "Pipeline", icon: "◈" },
  { name: "Activities", icon: "◷" },
  { name: "Follow-ups", icon: "↗️" },
  { name: "Messages", icon: "💬" },
];

const STAGES = ["New", "Contacted", "Qualified", "Proposal"];

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [active, setActive] = useState("Overview");
  const [leads, setLeads] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // State untuk Modal Add Lead
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    company: "",
    email: "",
    phone: "",
    lead_score: 50,
    temperature: "warm",
    pipeline_stage: "New",
  });

  // State untuk Modal Log Activity Manual
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({
    lead_id: "",
    activity_type: "Manual Follow-up",
    description: "",
  });

  // Cek status login saat aplikasi dibuka & dengarkan perubahan login/logout
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Ambil data leads & activities dari Supabase setelah user login
  const fetchAllData = async () => {
    setLoading(true);

    const [leadsRes, activitiesRes] = await Promise.all([
      supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("activities")
        .select("*, leads(full_name, company)")
        .order("created_at", { ascending: false }),
    ]);

    if (leadsRes.error) {
      console.error("Gagal mengambil leads:", leadsRes.error.message);
    } else {
      setLeads(leadsRes.data || []);
    }

    if (activitiesRes.error) {
      console.error("Gagal mengambil activities:", activitiesRes.error.message);
    } else {
      setActivities(activitiesRes.data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (session) {
      fetchAllData();
    }
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Helper mencatat aktivitas ke tabel public.activities
  const logActivityToDb = async (
    leadId,
    activityType,
    description,
    source = "Atlas CRM UI"
  ) => {
    await supabase.from("activities").insert([
      {
        lead_id: leadId || null,
        activity_type: activityType,
        description: description,
        metadata: { source },
      },
    ]);
  };

  // CREATE: Simpan lead baru + catat aktivitas otomatis
  const handleAddLead = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const newLead = {
      full_name: formData.full_name,
      company: formData.company,
      email: formData.email,
      phone: formData.phone || null,
      lead_score: Number(formData.lead_score),
      temperature: formData.temperature,
      pipeline_stage: formData.pipeline_stage,
      source: "manual_crm",
    };

    const { data, error } = await supabase
      .from("leads")
      .insert([newLead])
      .select()
      .single();

    if (error) {
      alert("Gagal menyimpan lead: " + error.message);
    } else {
      if (data?.id) {
        await logActivityToDb(
          data.id,
          "New Lead Created",
          `Prospek baru "${data.full_name}" dari ${
            data.company || "-"
          } ditambahkan ke stage ${data.pipeline_stage}.`,
          "Atlas CRM UI"
        );
      }

      setFormData({
        full_name: "",
        company: "",
        email: "",
        phone: "",
        lead_score: 50,
        temperature: "warm",
        pipeline_stage: "New",
      });
      setIsModalOpen(false);
      await fetchAllData();
    }
    setSubmitting(false);
  };

  // UPDATE: Ubah pipeline_stage + catat log perubahan stage
  const handleUpdateStage = async (id, newStage) => {
    const targetLead = leads.find((l) => l.id === id);

    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === id ? { ...lead, pipeline_stage: newStage } : lead
      )
    );

    const { error } = await supabase
      .from("leads")
      .update({ pipeline_stage: newStage })
      .eq("id", id);

    if (error) {
      alert("Gagal memperbarui stage: " + error.message);
      await fetchAllData();
    } else {
      await logActivityToDb(
        id,
        "Pipeline Stage Updated",
        `Tahapan ${targetLead?.full_name || "prospek"} dipindahkan ke "${newStage}".`,
        "Pipeline Board"
      );
      const { data } = await supabase
        .from("activities")
        .select("*, leads(full_name, company)")
        .order("created_at", { ascending: false });
      if (data) setActivities(data);
    }
  };

  // DELETE: Hapus data lead
  const handleDeleteLead = async (id, fullName) => {
    const confirmed = window.confirm(
      `Yakin ingin menghapus data prospek "${fullName}"?`
    );
    if (!confirmed) return;

    const { error } = await supabase.from("leads").delete().eq("id", id);

    if (error) {
      alert("Gagal menghapus lead: " + error.message);
    } else {
      setLeads((prev) => prev.filter((lead) => lead.id !== id));
      setActivities((prev) => prev.filter((act) => act.lead_id !== id));
    }
  };

  // Simpan log aktivitas manual dari modal + Log Activity
  const handleAddManualActivity = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const { error } = await supabase.from("activities").insert([
      {
        lead_id: activityForm.lead_id || null,
        activity_type: activityForm.activity_type,
        description: activityForm.description,
        metadata: { source: "Manual Entry" },
      },
    ]);

    if (error) {
      alert("Gagal menyimpan aktivitas: " + error.message);
    } else {
      setActivityForm({
        lead_id: "",
        activity_type: "Manual Follow-up",
        description: "",
      });
      setIsActivityModalOpen(false);
      await fetchAllData();
    }
    setSubmitting(false);
  };

  // Format waktu agar rapi dibaca
  const formatTime = (isoString) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Tampilkan loading singkat saat memeriksa sesi login
  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0B0B0B",
          color: "#888",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Memeriksa sesi workspace...
      </div>
    );
  }

  // Jika belum login, tampilkan halaman Login
  if (!session) {
    return <Login />;
  }

  // Hitung statistik dinamis
  const hotLeadsCount = leads.filter(
    (l) => (l.temperature || "").toLowerCase() === "hot"
  ).length;
  const qualifiedLeadsCount = leads.filter(
    (l) => (l.pipeline_stage || "").toLowerCase() === "qualified"
  ).length;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">A</span>
          <span>
            atlas<span className="brand-light">.crm</span>
          </span>
        </div>

        <div className="workspace">
          <div className="workspace-avatar">Z</div>
          <div>
            <strong>My Workspace</strong>
            <small>Business account</small>
          </div>
          <span className="arrow">⌄</span>
        </div>

        <p className="nav-label">WORKSPACE</p>

        <nav>
          {menu.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${active === item.name ? "active" : ""}`}
              onClick={() => setActive(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
            <div className="profile-avatar">Z</div>
            <div style={{ overflow: "hidden" }}>
              <strong style={{ display: "block", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                Zakaria Rukma
              </strong>
              <small style={{ display: "block", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                {session.user?.email || "Administrator"}
              </small>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Keluar dari akun"
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              color: "#F87171",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "11px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span className="breadcrumb">Workspace / {active}</span>
          <div className="top-actions">
            <span>⌕</span>
            <span>?</span>
            <div className="top-avatar">Z</div>
          </div>
        </header>

        <section className="content">
          {active === "Overview" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR BUSINESS</div>
                  <h1>{active}</h1>
                  <p>Monitor and manage your customer relationships.</p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setIsModalOpen(true)}
                >
                  + Add Lead
                </button>
              </div>

              <div className="date-filter">
                Last 30 days <span>⌄</span>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <span>Total Leads</span>
                  <h2>{loading ? "..." : leads.length}</h2>
                  <small className="positive">↗️ Live Supabase records</small>
                </div>

                <div className="stat-card">
                  <span>Hot Leads</span>
                  <h2>{loading ? "..." : hotLeadsCount}</h2>
                  <small>High-intent prospects</small>
                </div>

                <div className="stat-card">
                  <span>Qualified Leads</span>
                  <h2>{loading ? "..." : qualifiedLeadsCount}</h2>
                  <small>Pipeline opportunities</small>
                </div>

                <div className="stat-card">
                  <span>Activity Logs</span>
                  <h2>{loading ? "..." : activities.length}</h2>
                  <small>Recorded CRM events</small>
                </div>
              </div>

              <div className="table-card">
                <div className="table-heading">
                  <div>
                    <h3>Recent Leads</h3>
                    <p>Your latest customer prospects from Supabase</p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => setActive("Leads")}
                  >
                    View all leads →
                  </button>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>CONTACT</th>
                      <th>COMPANY</th>
                      <th>LEAD SCORE</th>
                      <th>TEMPERATURE</th>
                      <th>STAGE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan="5"
                          style={{ textAlign: "center", padding: "20px" }}
                        >
                          Memuat data dari Supabase...
                        </td>
                      </tr>
                    ) : leads.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          style={{ textAlign: "center", padding: "20px" }}
                        >
                          Belum ada data leads di database.
                        </td>
                      </tr>
                    ) : (
                      leads.map((lead, index) => {
                        const temp = (lead.temperature || "cold").toLowerCase();
                        return (
                          <tr key={lead.id || lead.email || index}>
                            <td>
                              <strong>{lead.full_name}</strong>
                            </td>
                            <td>{lead.company || "-"}</td>
                            <td>
                              <strong>{lead.lead_score ?? 0}</strong>
                            </td>
                            <td>
                              <span className={`status ${temp}`}>
                                {temp.toUpperCase()}
                              </span>
                            </td>
                            <td>{lead.pipeline_stage || "New"}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {active === "Leads" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">CRM DIRECTORY</div>
                  <h1>Leads</h1>
                  <p>Manage, score, and track all your incoming prospects.</p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setIsModalOpen(true)}
                >
                  + Add Lead
                </button>
              </div>

              <div className="table-card">
                <div className="table-heading">
                  <div>
                    <h3>All Leads ({leads.length})</h3>
                    <p>Complete list of prospects synced with Supabase</p>
                  </div>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>CONTACT</th>
                      <th>COMPANY</th>
                      <th>EMAIL</th>
                      <th>LEAD SCORE</th>
                      <th>TEMPERATURE</th>
                      <th>STAGE</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan="7"
                          style={{ textAlign: "center", padding: "20px" }}
                        >
                          Memuat data dari Supabase...
                        </td>
                      </tr>
                    ) : leads.length === 0 ? (
                      <tr>
                        <td
                          colSpan="7"
                          style={{ textAlign: "center", padding: "20px" }}
                        >
                          Belum ada data leads di database.
                        </td>
                      </tr>
                    ) : (
                      leads.map((lead, index) => {
                        const temp = (lead.temperature || "cold").toLowerCase();
                        const currentStage =
                          STAGES.find(
                            (s) =>
                              s.toLowerCase() ===
                              (lead.pipeline_stage || "new").toLowerCase()
                          ) || "New";

                        return (
                          <tr key={lead.id || lead.email || index}>
                            <td>
                              <strong>{lead.full_name}</strong>
                            </td>
                            <td>{lead.company || "-"}</td>
                            <td>{lead.email}</td>
                            <td>
                              <strong>{lead.lead_score ?? 0}</strong>
                            </td>
                            <td>
                              <span className={`status ${temp}`}>
                                {temp.toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <select
                                value={currentStage}
                                onChange={(e) =>
                                  handleUpdateStage(lead.id, e.target.value)
                                }
                                style={{
                                  background: "#1C1C1C",
                                  color: "#F5F5F5",
                                  border: "1px solid #333",
                                  borderRadius: "6px",
                                  padding: "4px 8px",
                                  fontSize: "12px",
                                  cursor: "pointer",
                                }}
                              >
                                {STAGES.map((stageOption) => (
                                  <option key={stageOption} value={stageOption}>
                                    {stageOption}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <button
                                onClick={() =>
                                  handleDeleteLead(lead.id, lead.full_name)
                                }
                                title="Hapus Lead"
                                style={{
                                  background: "rgba(239, 68, 68, 0.12)",
                                  color: "#F87171",
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                  borderRadius: "6px",
                                  padding: "4px 10px",
                                  fontSize: "12px",
                                  cursor: "pointer",
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {active === "Companies" && <Companies leads={leads} />}

          {active === "Pipeline" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">SALES FUNNEL</div>
                  <h1>Pipeline</h1>
                  <p>Visualize deal stages and track prospect progression.</p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setIsModalOpen(true)}
                >
                  + Add Lead
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "16px",
                  marginTop: "20px",
                }}
              >
                {STAGES.map((stage, stageIndex) => {
                  const stageLeads = leads.filter(
                    (l) =>
                      (l.pipeline_stage || "new").toLowerCase() ===
                      stage.toLowerCase()
                  );
                  return (
                    <div
                      key={stage}
                      style={{
                        background: "#141414",
                        border: "1px solid #262626",
                        borderRadius: "14px",
                        padding: "16px",
                        minHeight: "340px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "16px",
                          paddingBottom: "12px",
                          borderBottom: "1px solid #262626",
                        }}
                      >
                        <strong style={{ color: "#F5F5F5", fontSize: "14px" }}>
                          {stage}
                        </strong>
                        <span
                          style={{
                            background: "#222",
                            color: "#A3A3A3",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            fontSize: "12px",
                          }}
                        >
                          {stageLeads.length}
                        </span>
                      </div>

                      <div style={{ display: "grid", gap: "12px" }}>
                        {stageLeads.map((lead, index) => {
                          const temp = (
                            lead.temperature || "cold"
                          ).toLowerCase();
                          return (
                            <div
                              key={lead.id || lead.email || index}
                              style={{
                                background: "#1C1C1C",
                                border: "1px solid #2E2E2E",
                                borderRadius: "10px",
                                padding: "14px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: "6px",
                                }}
                              >
                                <strong
                                  style={{ color: "#F5F5F5", fontSize: "14px" }}
                                >
                                  {lead.full_name}
                                </strong>
                                <span className={`status ${temp}`}>
                                  {temp.toUpperCase()}
                                </span>
                              </div>
                              <p
                                style={{
                                  color: "#999",
                                  fontSize: "13px",
                                  margin: "0 0 10px 0",
                                }}
                              >
                                {lead.company || "-"}
                              </p>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  fontSize: "12px",
                                  color: "#777",
                                }}
                              >
                                <span>
                                  Score:{" "}
                                  <strong style={{ color: "#E5E5E5" }}>
                                    {lead.lead_score ?? 0}
                                  </strong>
                                </span>

                                <div style={{ display: "flex", gap: "4px" }}>
                                  {stageIndex > 0 && (
                                    <button
                                      onClick={() =>
                                        handleUpdateStage(
                                          lead.id,
                                          STAGES[stageIndex - 1]
                                        )
                                      }
                                      title={`Pindah ke ${STAGES[stageIndex - 1]}`}
                                      style={{
                                        background: "#262626",
                                        color: "#DDD",
                                        border: "1px solid #3A3A3A",
                                        borderRadius: "4px",
                                        padding: "2px 6px",
                                        cursor: "pointer",
                                        fontSize: "11px",
                                      }}
                                    >
                                      ←
                                    </button>
                                  )}
                                  {stageIndex < STAGES.length - 1 && (
                                    <button
                                      onClick={() =>
                                        handleUpdateStage(
                                          lead.id,
                                          STAGES[stageIndex + 1]
                                        )
                                      }
                                      title={`Pindah ke ${STAGES[stageIndex + 1]}`}
                                      style={{
                                        background: "#262626",
                                        color: "#DDD",
                                        border: "1px solid #3A3A3A",
                                        borderRadius: "4px",
                                        padding: "2px 6px",
                                        cursor: "pointer",
                                        fontSize: "11px",
                                      }}
                                    >
                                      →
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {active === "Activities" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">CRM & AUTOMATION LOGS</div>
                  <h1>Activities</h1>
                  <p>
                    Real-time customer interactions and automated workflow logs
                    from Supabase.
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setIsActivityModalOpen(true)}
                >
                  + Log Activity
                </button>
              </div>

              <div className="table-card">
                <div className="table-heading">
                  <div>
                    <h3>Activity Stream ({activities.length})</h3>
                    <p>Synced with public.activities table in Supabase</p>
                  </div>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>ACTIVITY & DETAILS</th>
                      <th>CONTACT</th>
                      <th>SOURCE</th>
                      <th>STATUS</th>
                      <th>TIME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan="5"
                          style={{ textAlign: "center", padding: "20px" }}
                        >
                          Memuat log aktivitas dari Supabase...
                        </td>
                      </tr>
                    ) : activities.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          style={{ textAlign: "center", padding: "20px" }}
                        >
                          Belum ada aktivitas tercatat. Coba ubah stage lead
                          atau klik + Log Activity.
                        </td>
                      </tr>
                    ) : (
                      activities.map((act, index) => (
                        <tr key={act.id || index}>
                          <td>
                            <strong>{act.activity_type}</strong>
                            {act.description && (
                              <div
                                style={{
                                  color: "#888",
                                  fontSize: "12px",
                                  marginTop: "4px",
                                }}
                              >
                                {act.description}
                              </div>
                            )}
                          </td>
                          <td>{act.leads?.full_name || "System / General"}</td>
                          <td>{act.metadata?.source || "n8n / CRM"}</td>
                          <td>
                            <span className="status hot">LOGGED</span>
                          </td>
                          <td style={{ color: "#999", fontSize: "12px" }}>
                            {formatTime(act.created_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {active === "Follow-ups" && (
            <FollowUps leads={leads} onActivityLogged={fetchAllData} />
          )}

          {active === "Messages" && (
            <Messages leads={leads} onActivityLogged={fetchAllData} />
          )}
        </section>
      </main>

      {/* POP-UP MODAL FORM ADD LEAD */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#161616",
              border: "1px solid #2E2E2E",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "460px",
              padding: "24px",
              color: "#F5F5F5",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "18px" }}>Add New Lead</h3>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "13px",
                    color: "#888",
                  }}
                >
                  Simpan prospek baru langsung ke database Supabase
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#888",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleAddLead}
              style={{ display: "grid", gap: "14px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    marginBottom: "6px",
                    color: "#CCC",
                  }}
                >
                  Contact Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Reza Rahadian"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #333",
                    background: "#0F0F0F",
                    color: "#FFF",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    marginBottom: "6px",
                    color: "#CCC",
                  }}
                >
                  Company *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Nusantara Digital"
                  value={formData.company}
                  onChange={(e) =>
                    setFormData({ ...formData, company: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #333",
                    background: "#0F0F0F",
                    color: "#FFF",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      marginBottom: "6px",
                      color: "#CCC",
                    }}
                  >
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="reza@perusahaan.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #333",
                      background: "#0F0F0F",
                      color: "#FFF",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      marginBottom: "6px",
                      color: "#CCC",
                    }}
                  >
                    Phone (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="081234567890"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #333",
                      background: "#0F0F0F",
                      color: "#FFF",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      marginBottom: "6px",
                      color: "#CCC",
                    }}
                  >
                    Lead Score (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={formData.lead_score}
                    onChange={(e) =>
                      setFormData({ ...formData, lead_score: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #333",
                      background: "#0F0F0F",
                      color: "#FFF",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      marginBottom: "6px",
                      color: "#CCC",
                    }}
                  >
                    Temperature
                  </label>
                  <select
                    value={formData.temperature}
                    onChange={(e) =>
                      setFormData({ ...formData, temperature: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #333",
                      background: "#0F0F0F",
                      color: "#FFF",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="hot">HOT</option>
                    <option value="warm">WARM</option>
                    <option value="cold">COLD</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    marginBottom: "6px",
                    color: "#CCC",
                  }}
                >
                  Pipeline Stage
                </label>
                <select
                  value={formData.pipeline_stage}
                  onChange={(e) =>
                    setFormData({ ...formData, pipeline_stage: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #333",
                    background: "#0F0F0F",
                    color: "#FFF",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Proposal">Proposal</option>
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP MODAL LOG ACTIVITY MANUAL */}
      {isActivityModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#161616",
              border: "1px solid #2E2E2E",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "440px",
              padding: "24px",
              color: "#F5F5F5",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "18px" }}>Log Activity</h3>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "13px",
                    color: "#888",
                  }}
                >
                  Catat interaksi manual dengan prospek ke Supabase
                </p>
              </div>
              <button
                onClick={() => setIsActivityModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#888",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleAddManualActivity}
              style={{ display: "grid", gap: "14px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    marginBottom: "6px",
                    color: "#CCC",
                  }}
                >
                  Pilih Prospek (Opsional)
                </label>
                <select
                  value={activityForm.lead_id}
                  onChange={(e) =>
                    setActivityForm({ ...activityForm, lead_id: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #333",
                    background: "#0F0F0F",
                    color: "#FFF",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="">-- Umum / Tanpa Prospek --</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.full_name} ({l.company || "No Company"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    marginBottom: "6px",
                    color: "#CCC",
                  }}
                >
                  Jenis Aktivitas *
                </label>
                <select
                  value={activityForm.activity_type}
                  onChange={(e) =>
                    setActivityForm({
                      ...activityForm,
                      activity_type: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #333",
                    background: "#0F0F0F",
                    color: "#FFF",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="Manual Follow-up">Manual Follow-up</option>
                  <option value="Discovery Call">Discovery Call</option>
                  <option value="Proposal Sent">Proposal Sent</option>
                  <option value="WhatsApp / Telegram Chat">
                    WhatsApp / Telegram Chat
                  </option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    marginBottom: "6px",
                    color: "#CCC",
                  }}
                >
                  Catatan Detail *
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Contoh: Klien tertarik paket Enterprise, minta dikirimkan penawaran resmi besok pagi."
                  value={activityForm.description}
                  onChange={(e) =>
                    setActivityForm({
                      ...activityForm,
                      description: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #333",
                    background: "#0F0F0F",
                    color: "#FFF",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsActivityModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Activity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;