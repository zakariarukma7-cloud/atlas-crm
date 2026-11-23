import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function Messages({ leads = [], onActivityLogged }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [replyText, setReplyText] = useState("");
  const [channel, setChannel] = useState("Telegram");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, []);

  async function fetchMessages() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*, leads(id, full_name, company, email)")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Otomatis pilih lead pertama yang punya pesan jika belum ada yang dipilih
      if (!selectedLeadId && data && data.length > 0 && data[0].lead_id) {
        setSelectedLeadId(data[0].lead_id);
      } else if (!selectedLeadId && leads.length > 0) {
        setSelectedLeadId(leads[0].id);
      }
    } catch (error) {
      console.error("Error mengambil pesan:", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendReply(e) {
    e.preventDefault();
    if (!replyText.trim() || !selectedLeadId) return;

    try {
      setSending(true);
      const newMessage = {
        lead_id: selectedLeadId,
        sender_type: "admin",
        channel: channel,
        content: replyText.trim(),
        status: "Replied",
      };

      const { error } = await supabase.from("messages").insert([newMessage]);
      if (error) throw error;

      // Tandai pesan masuk sebelumnya dari lead ini sebagai "Replied"
      await supabase
        .from("messages")
        .update({ status: "Replied" })
        .eq("lead_id", selectedLeadId)
        .eq("sender_type", "lead");

      // Catat otomatis ke tabel activities
      const targetLead = leads.find((l) => l.id === selectedLeadId);
      await supabase.from("activities").insert([
        {
          lead_id: selectedLeadId,
          activity_type: "Message Sent",
          description: `Membalas pesan ${
            targetLead?.full_name || "prospek"
          } via ${channel}: "${replyText.trim()}"`,
          metadata: { source: "Messages Inbox" },
        },
      ]);

      setReplyText("");
      await fetchMessages();
      if (onActivityLogged) onActivityLogged();
    } catch (error) {
      alert("Gagal mengirim pesan: " + error.message);
    } finally {
      setSending(false);
    }
  }

  const formatTime = (isoString) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filter pesan untuk kontak yang sedang dipilih
  const activeConversation = messages.filter(
    (m) => m.lead_id === selectedLeadId
  );
  const activeLead = leads.find((l) => l.id === selectedLeadId);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">OMNICHANNEL INBOX</div>
          <h1>Messages</h1>
          <p>
            Manage customer conversations & reply directly synced with Supabase.
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: "16px",
          marginTop: "20px",
          minHeight: "460px",
        }}
      >
        {/* Kolom Kiri: Daftar Kontak */}
        <div
          style={{
            background: "#141414",
            border: "1px solid #262626",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "#888",
              marginBottom: "6px",
              letterSpacing: "0.05em",
            }}
          >
            CONTACTS ({leads.length})
          </div>

          {leads.length === 0 ? (
            <p style={{ color: "#777", fontSize: "13px" }}>
              Belum ada data leads.
            </p>
          ) : (
            leads.map((lead) => {
              const leadMsgs = messages.filter((m) => m.lead_id === lead.id);
              const lastMsg = leadMsgs[leadMsgs.length - 1];
              const unreadCount = leadMsgs.filter(
                (m) => m.sender_type === "lead" && m.status === "Unread"
              ).length;
              const isSelected = lead.id === selectedLeadId;

              return (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  style={{
                    textAlign: "left",
                    padding: "12px",
                    borderRadius: "10px",
                    border: isSelected
                      ? "1px solid #3B82F6"
                      : "1px solid #262626",
                    background: isSelected
                      ? "rgba(59, 130, 246, 0.12)"
                      : "#1A1A1A",
                    color: "#F5F5F5",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <strong style={{ fontSize: "14px" }}>
                      {lead.full_name}
                    </strong>
                    {unreadCount > 0 && (
                      <span
                        style={{
                          background: "#2563EB",
                          color: "#FFF",
                          fontSize: "11px",
                          padding: "1px 7px",
                          borderRadius: "999px",
                        }}
                      >
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#888",
                      marginTop: "2px",
                    }}
                  >
                    {lead.company || "No Company"}
                  </div>
                  {lastMsg && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#AAA",
                        marginTop: "6px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {lastMsg.sender_type === "admin" ? "Anda: " : ""}
                      {lastMsg.content}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Kolom Kanan: Ruang Chat & Form Balas */}
        <div
          style={{
            background: "#141414",
            border: "1px solid #262626",
            borderRadius: "14px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            overflow: "hidden",
          }}
        >
          {/* Header Chat */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #262626",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#181818",
            }}
          >
            <div>
              <strong style={{ fontSize: "15px", color: "#F5F5F5" }}>
                {activeLead ? activeLead.full_name : "Pilih Kontak"}
              </strong>
              <div style={{ fontSize: "12px", color: "#888" }}>
                {activeLead
                  ? `${activeLead.company || "-"} • ${activeLead.email}`
                  : "Klik kontak di sebelah kiri untuk membuka chat"}
              </div>
            </div>
            {activeLead && (
              <span className={`status ${(activeLead.temperature || "cold").toLowerCase()}`}>
                {(activeLead.temperature || "COLD").toUpperCase()}
              </span>
            )}
          </div>

          {/* Daftar Gelembung Pesan */}
          <div
            style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              flex: 1,
              maxHeight: "340px",
              overflowY: "auto",
            }}
          >
            {loading ? (
              <p style={{ color: "#888", fontSize: "13px" }}>
                Memuat percakapan...
              </p>
            ) : !selectedLeadId ? (
              <p style={{ color: "#888", fontSize: "13px" }}>
                Pilih prospek di daftar sebelah kiri.
              </p>
            ) : activeConversation.length === 0 ? (
              <p style={{ color: "#777", fontSize: "13px", textAlign: "center", marginTop: "40px" }}>
                Belum ada riwayat pesan dengan {activeLead?.full_name}. Mulai kirim pesan di bawah!
              </p>
            ) : (
              activeConversation.map((msg) => {
                const isAdmin = msg.sender_type === "admin";
                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isAdmin ? "flex-end" : "flex-start",
                      maxWidth: "75%",
                      background: isAdmin ? "#1D4ED8" : "#222222",
                      border: isAdmin ? "none" : "1px solid #333",
                      color: "#F5F5F5",
                      padding: "10px 14px",
                      borderRadius: "12px",
                    }}
                  >
                    <div style={{ fontSize: "13px", lineHeight: "1.45" }}>
                      {msg.content}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: isAdmin ? "#BFDBFE" : "#888",
                        marginTop: "6px",
                        textAlign: "right",
                      }}
                    >
                      {msg.channel} • {formatTime(msg.created_at)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Form Kirim Balasan */}
          {selectedLeadId && (
            <form
              onSubmit={handleSendReply}
              style={{
                padding: "14px 16px",
                borderTop: "1px solid #262626",
                background: "#181818",
                display: "flex",
                gap: "10px",
              }}
            >
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                style={{
                  background: "#0F0F0F",
                  color: "#F5F5F5",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  padding: "0 10px",
                  fontSize: "12px",
                }}
              >
                <option value="Telegram">Telegram</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
              </select>

              <input
                type="text"
                placeholder={`Tulis balasan ke ${activeLead?.full_name || "prospek"}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #333",
                  background: "#0F0F0F",
                  color: "#FFF",
                  fontSize: "13px",
                }}
              />

              <button
                type="submit"
                className="primary-button"
                disabled={sending || !replyText.trim()}
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}