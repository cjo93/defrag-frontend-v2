"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [inviteLink, setInviteLink] = useState("");

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus("sending");
    try {
      const res = await fetch("/api/connections/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteEmail.split("@")[0], // Fallback name
          relationship_type: "family",
        }),
      });

      if (!res.ok) {
        if (res.status === 403) {
          alert("Alignment Requests are strictly for OS subscribers.");
          // Trigger paywall logic here ideally
        }
        throw new Error("Failed to send invite");
      }

      const data = await res.json();
      setInviteLink(data.inviteLink);
      setStatus("sent");
      setInviteEmail("");
    } catch (err) {
      console.error(err);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: "#000000",
      color: "#FFFFFF",
      minHeight: "100vh",
      padding: "4rem 2rem",
      fontFamily: "system-ui, sans-serif"
    }}>
      <header style={{ marginBottom: "4rem", borderBottom: "1px solid #333", paddingBottom: "2rem" }}>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "2.5rem",
          fontWeight: 400,
          margin: 0
        }}>
          Natural Design Map
        </h1>
        <p style={{ color: "#666", marginTop: "0.5rem" }}>Stewardship Dashboard</p>
      </header>

      <main style={{ maxWidth: "800px", margin: "0 auto" }}>

        {/* User Card */}
        <section style={{ marginBottom: "4rem" }}>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.5rem",
            marginBottom: "1.5rem",
            color: "#888"
          }}>
            Your Manual
          </h2>
          <div style={{
            border: "1px solid #333",
            padding: "2rem",
            borderRadius: "4px"
          }}>
            <p style={{ margin: 0, fontSize: "1.1rem" }}>
              To unlock your full manual, please ensure your OS subscription is active.
            </p>
          </div>
        </section>

        {/* Alignment Request */}
        <section>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.5rem",
            marginBottom: "1.5rem",
            color: "#888"
          }}>
            Request Alignment
          </h2>

          <div style={{
            border: "1px solid #333",
            padding: "2rem",
            borderRadius: "4px"
          }}>
            <p style={{ marginBottom: "1.5rem", color: "#AAA" }}>
              Invite a family member to add their natural design to your map.
            </p>

            {status === "sent" ? (
              <div style={{ backgroundColor: "#111", padding: "1.5rem" }}>
                <p style={{ color: "#FFF", marginBottom: "1rem" }}>Invite created.</p>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <input
                    readOnly
                    value={inviteLink}
                    style={{
                      flex: 1,
                      backgroundColor: "#000",
                      border: "1px solid #333",
                      color: "#FFF",
                      padding: "0.75rem"
                    }}
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(inviteLink)}
                    style={{
                      backgroundColor: "#FFF",
                      color: "#000",
                      border: "none",
                      padding: "0 1.5rem",
                      cursor: "pointer",
                      fontWeight: 600
                    }}
                  >
                    Copy
                  </button>
                </div>
                <button
                  onClick={() => setStatus("idle")}
                  style={{ marginTop: "1rem", background: "none", border: "none", color: "#666", cursor: "pointer", textDecoration: "underline" }}
                >
                  Send another
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvite} style={{ display: "flex", gap: "1rem" }}>
                <input
                  type="email"
                  placeholder="Relative's Email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{
                    flex: 1,
                    backgroundColor: "transparent",
                    border: "1px solid #333",
                    color: "#FFF",
                    padding: "1rem",
                    outline: "none"
                  }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    backgroundColor: "#FFFFFF",
                    color: "#000000",
                    border: "none",
                    padding: "0 2rem",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: loading ? "wait" : "pointer",
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? "PROCESSING..." : "REQUEST ALIGNMENT"}
                </button>
              </form>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
