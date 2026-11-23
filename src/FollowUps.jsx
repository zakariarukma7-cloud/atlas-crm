import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function FollowUps({ leads = [], onActivityLogged }) {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    lead_id: "",
    task_title: "",
    scheduled_at: "",
    priority: "High",
    channel: "Telegram",
  });

  useEffect(() => {
    fetchFollowUps();
  }, []);

  async function fetchFollowUps() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("follow_ups")
        .select("*, leads(full_name, company)")
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      setFollowUps(data || []);
    } catch (error) {
      console.error("Error mengambil data follow_ups:", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddFollowUp(e) {
    e.preventDefault();
    if (!formData.task_title.trim() || !formData.scheduled_at) return;

    try {
      setSubmitting(true);
      const payload = {
        lead_id: formData.lead_id || null,
        task_title: formData.task_title,
        scheduled_at: new Date(formData.scheduled_at).toISOString(),
        priority: formData.priority,
        status: "Scheduled",
        channel: formData.channel,
      };

      const { error } = await supabase.from("follow_ups").insert([payload]);
      if (error) throw error;

      // Catat otomatis ke tabel activities
      const targetLead = leads.find((l) => l.id === formData.lead_id);
      await supabase.from("activities").insert([
        {
          lead_id: formData.lead_id || null,
          activity_type: "Follow-up Scheduled",
          description: `Jadwal "${formData.task_title}" untuk ${
            targetLead?.full_name || "prospek"
          } via ${formData.channel}.`,
          metadata: { source: "Follow-ups Module" },
        },
      ]);

      setFormData({
        lead_id: "",
        task_title: "",
        scheduled_at: "",
        priority: "High",
        channel: "Telegram",
      });
      setIsModalOpen(false);
      await fetchFollowUps();
      if (onActivityLogged) onActivityLogged();
    } catch (error) {
      alert("Gagal menyimpan jadwal follow-up: " + error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(item) {
    const nextStatus = item.status === "Completed" ? "Scheduled" : "Completed";

    setFollowUps((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, status: nextStatus } : f))
    );

    const { error } = await supabase
      .from("follow_ups")
      .update({ status: nextStatus })
      .eq("id", item.id);

    if (error) {
      alert("Gagal memperbarui status: " + error.message);
      await fetchFollowUps();
    } else if (nextStatus === "Completed") {
      await supabase.from("activities").insert([
        {
          lead_id: item.lead_id || null,
          activity_type: "Follow-up Completed",
          description: `Tugas follow-up "${item.task_title}" telah diselesaikan.`,
          metadata: { source: "Follow-ups Module" },
        },
      ]);
      if (onActivityLogged) onActivityLogged();
    }
  }

  async function handleDeleteFollowUp(id) {
    const confirmed = window.confirm("Hapus jadwal follow-up ini?");
    if (!confirmed) return;

    const { error } = await supabase.from("follow_ups").delete().eq("id", id);
    if (error) {
      alert("Gagal menghapus: " + error.message);
    } else {
      setFollowUps((prev) => prev.filter((f) => f.id !== id));
    }
  }

  const formatSchedule = (isoString) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return (
      date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB"
    );
  };

  const filteredList = followUps.filter((item) => {
    if (filterStatus === "All") return true;
    if (filterStatus === "Pending") return item.status !== "Completed";
    return item.status === "Completed";
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SCHEDULED AUTOMATION</div>
          <h1>Follow-ups</h1>
          <p>
            Manage scheduled prospect follow-ups synced with Supabase & n8n
            triggers.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => setIsModalOpen(true)}
        >
          + Schedule Follow-up
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        {["All", "Pending", "Completed"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterStatus(tab)}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border:
                filterStatus === tab ? "1px solid #3B82F6" : "1px solid #333",
              background:
                filterStatus === tab ? "rgba(59, 130, 246, 0.15)" : "#141414",
              color: filterStatus === tab ? "#60A5FA" : "#A3A3A3",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="table-card">
        <div className="table-heading">
          <div>
            <h3>Follow-up Queue ({filteredList.length})</h3>
            <p>Automated reminders via Telegram & Email workflows</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>CONTACT</th>
              <th>ACTION TASK</th>
              <th>SCHEDULED DATE</th>
              <th>PRIORITY</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                  Memuat jadwal follow-up dari Supabase...
                </td>
              </tr>
            ) : filteredList.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                  Belum ada jadwal follow-up pada filter ini.
                </td>
              </tr>
            ) : (
              filteredList.map((item) => {
                const prio = (item.priority || "medium").toLowerCase();
                const prioClass =
                  prio === "high" ? "hot" : prio === "medium" ? "warm" : "cold";
                const isDone = item.status === "Completed";

                return (
                  <tr
                    key={item.id}
                    style={{ opacity: isDone ? 0.6 : 1 }}
                  >
                    <td>
                      <strong>
                        {item.leads?.full_name || "General Reminder"}
                      </strong>
                      <div style={{ fontSize: "12px", color: "#888" }}>
                        {item.leads?.company || "-"}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          textDecoration: isDone ? "line-through" : "none",
                        }}
                      >
                        {item.task_title}
                      </span>
                      <div style={{ fontSize: "11px", color: "#60A5FA" }}>
                        via {item.channel || "Telegram"}
                      </div>
                    </td>
                    <td style={{ fontSize: "13px" }}>
                      {formatSchedule(item.scheduled_at)}
                    </td>
                    <td>
                      <span className={`status ${prioClass}`}>
                        {prio.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleStatus(item)}
                        style={{
                          background: isDone
                            ? "rgba(34, 197, 94, 0.15)"
                            : "#1F1F1F",
                          color: isDone ? "#4ADE80" : "#E5E5E5",
                          border: isDone
                            ? "1px solid rgba(34, 197, 94, 0.35)"
                            : "1px solid #3A3A3A",
                          borderRadius: "6px",
                          padding: "4px 10px",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        {isDone ? "✓ Completed" : item.status}
                      </button>
                    </td>
                    <td>
                      <button
                        onClick={() => handleDeleteFollowUp(item.id)}
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

      {/* POP-UP MODAL SCHEDULE FOLLOW-UP */}
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
                <h3 style={{ margin: 0, fontSize: "18px" }}>
                  Schedule Follow-up
                </h3>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "13px",
                    color: "#888",
                  }}
                >
                  Buat pengingat follow-up otomatis ke Supabase
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
              onSubmit={handleAddFollowUp}
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
                  Pilih Prospek
                </label>
                <select
                  value={formData.lead_id}
                  onChange={(e) =>
                    setFormData({ ...formData, lead_id: e.target.value })
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
                  <option value="">-- Pilih Lead / Umum --</option>
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
                  Action Task *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kirim proposal harga & jadwal meeting"
                  value={formData.task_title}
                  onChange={(e) =>
                    setFormData({ ...formData, task_title: e.target.value })
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
                  Tanggal & Jam *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.scheduled_at}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduled_at: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #333",
                    background: "#0F0F0F",
                    color: "#FFF",
                    boxSizing: "border-box",
                    colorScheme: "dark",
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
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
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
                    <option value="High">HIGH</option>
                    <option value="Medium">MEDIUM</option>
                    <option value="Low">LOW</option>
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
                    Reminder Channel
                  </label>
                  <select
                    value={formData.channel}
                    onChange={(e) =>
                      setFormData({ ...formData, channel: e.target.value })
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
                    <option value="Telegram">Telegram Bot (n8n)</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                  </select>
                </div>
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
                  {submitting ? "Saving..." : "Save Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}