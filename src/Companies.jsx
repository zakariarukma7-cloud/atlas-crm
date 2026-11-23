import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function Companies({ leads = [] }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    industry: "",
    website: "",
    city: "",
    employees_count: "11-50",
    status: "Active",
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  async function fetchCompanies() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error("Error mengambil data companies:", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCompany(e) {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setSubmitting(true);
      const { data, error } = await supabase
        .from("companies")
        .insert([formData])
        .select();

      if (error) throw error;

      setCompanies([data[0], ...companies]);
      setFormData({
        name: "",
        industry: "",
        website: "",
        city: "",
        employees_count: "11-50",
        status: "Active",
      });
      setIsModalOpen(false);
    } catch (error) {
      alert("Gagal menyimpan data perusahaan: " + error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCompany(id, name) {
    const confirmDelete = window.confirm(
      `Yakin ingin menghapus perusahaan "${name}"?`
    );
    if (!confirmDelete) return;

    try {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;

      setCompanies(companies.filter((company) => company.id !== id));
    } catch (error) {
      alert("Gagal menghapus: " + error.message);
    }
  }

  const filteredCompanies = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.industry &&
        c.industry.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.city && c.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ACCOUNTS & ORGANIZATIONS</div>
          <h1>Companies</h1>
          <p>Track organizations and associated contacts in your CRM.</p>
        </div>
        <button
          className="primary-button"
          onClick={() => setIsModalOpen(true)}
        >
          + Add Company
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="Cari nama perusahaan, industri, atau kota..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "380px",
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid #333",
            background: "#141414",
            color: "#F5F5F5",
            fontSize: "13px",
          }}
        />
      </div>

      <div className="table-card">
        <div className="table-heading">
          <div>
            <h3>All Companies ({filteredCompanies.length})</h3>
            <p>Organizations synced with Supabase database</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>COMPANY NAME</th>
              <th>INDUSTRY</th>
              <th>CITY</th>
              <th>CONTACTS</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                  Memuat data perusahaan dari Supabase...
                </td>
              </tr>
            ) : filteredCompanies.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                  Belum ada data perusahaan ditemukan.
                </td>
              </tr>
            ) : (
              filteredCompanies.map((company) => {
                // Hitung otomatis jumlah leads yang bekerja di perusahaan ini
                const linkedContacts = leads.filter(
                  (l) =>
                    (l.company || "").trim().toLowerCase() ===
                    company.name.trim().toLowerCase()
                ).length;

                const statusClass =
                  (company.status || "").toLowerCase() === "active"
                    ? "hot"
                    : "warm";

                return (
                  <tr key={company.id}>
                    <td>
                      <strong>{company.name}</strong>
                      {company.website && (
                        <div style={{ fontSize: "12px", marginTop: "2px" }}>
                          <a
                            href={`https://${company.website.replace(
                              /^https?:\/\//,
                              ""
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#60A5FA", textDecoration: "none" }}
                          >
                            {company.website}
                          </a>
                        </div>
                      )}
                    </td>
                    <td>{company.industry || "-"}</td>
                    <td>{company.city || "-"}</td>
                    <td>
                      <strong>{linkedContacts}</strong>{" "}
                      {linkedContacts === 1 ? "Contact" : "Contacts"}
                      <div style={{ fontSize: "11px", color: "#888" }}>
                        Size: {company.employees_count || "-"}
                      </div>
                    </td>
                    <td>
                      <span className={`status ${statusClass}`}>
                        {(company.status || "ACTIVE").toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() =>
                          handleDeleteCompany(company.id, company.name)
                        }
                        title="Hapus Company"
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

      {/* POP-UP MODAL ADD COMPANY */}
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
                <h3 style={{ margin: 0, fontSize: "18px" }}>Add New Company</h3>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "13px",
                    color: "#888",
                  }}
                >
                  Simpan data perusahaan baru ke database Supabase
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
              onSubmit={handleAddCompany}
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
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Marlong"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
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
                    Industry
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Technology"
                    value={formData.industry}
                    onChange={(e) =>
                      setFormData({ ...formData, industry: e.target.value })
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
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Purwakarta"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
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

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    marginBottom: "6px",
                    color: "#CCC",
                  }}
                >
                  Website
                </label>
                <input
                  type="text"
                  placeholder="Contoh: perusahaan.co.id"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData({ ...formData, website: e.target.value })
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
                    Company Size
                  </label>
                  <select
                    value={formData.employees_count}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        employees_count: e.target.value,
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
                    <option value="1-10">1-10 Karyawan</option>
                    <option value="11-50">11-50 Karyawan</option>
                    <option value="51-200">51-200 Karyawan</option>
                    <option value="201-500">201-500 Karyawan</option>
                    <option value="500+">500+ Karyawan</option>
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
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
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
                    <option value="Active">ACTIVE</option>
                    <option value="Prospect">PROSPECT</option>
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
                  {submitting ? "Saving..." : "Save Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}