"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PaywallModal from "@/components/PaywallModal";

export default function Dashboard() {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [inviteLink, setInviteLink] = useState("");

  // OS Status Logic
  const [isOSUnlocked, setIsOSUnlocked] = useState(false);
  const [showPaywall, setShowPaywall] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check subscription status AND bypass code
  useEffect(() => {
    async function checkStatus() {
      // 1. Check persistent bypass
      const savedCode = localStorage.getItem("defrag_bypass_code");
      if (savedCode && process.env.NEXT_PUBLIC_BYPASS_CODE && savedCode === process.env.NEXT_PUBLIC_BYPASS_CODE) {
        setIsOSUnlocked(true);
        setShowPaywall(false);
        setCheckingStatus(false);
        return;
      }

      // 2. Check real subscription
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const data = await res.json();
          if (data.subscription === "os_active") {
            setIsOSUnlocked(true);
            setShowPaywall(false);
          }
        }
      } catch (e) {
        console.error("Subscription check failed", e);
      } finally {
        setCheckingStatus(false);
      }
    }
    checkStatus();
  }, []);

  const handleBypass = (code: string) => {
    if (process.env.NEXT_PUBLIC_BYPASS_CODE && code === process.env.NEXT_PUBLIC_BYPASS_CODE) {
      setIsOSUnlocked(true);
      setShowPaywall(false);
      localStorage.setItem("defrag_bypass_code", code);
    }
  };

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
          // If 403, our frontend state is out of sync or session expired.
          // Re-show paywall.
          setIsOSUnlocked(false);
          setShowPaywall(true);
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

  const copySMS = () => {
    const sms = `Hey, I'm using Defrag to map our family's natural dynamics. Can you add your info here so I can see our map? It takes a second: ${inviteLink}`;
    navigator.clipboard.writeText(sms);
    alert("Copied to clipboard!");
  };

  if (checkingStatus) {
    return (
      <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "grid", placeItems: "center", color: "#666" }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: "#000000",
      color: "#FFFFFF",
      minHeight: "100vh",
      fontFamily: "system-ui, sans-serif",
      position: "relative",
      overflow: isOSUnlocked ? "auto" : "hidden",
      height: isOSUnlocked ? "auto" : "100vh"
    }}>

      {!isOSUnlocked && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 50 }}>
            <PaywallModal
                isUnlocked={isOSUnlocked}
                onBypass={handleBypass}
            />
        </div>
      )}

      <div style={{
        padding: "4rem 2rem",
        filter: isOSUnlocked ? "none" : "blur(12px)",
        pointerEvents: isOSUnlocked ? "auto" : "none",
        transition: "filter 0.5s ease",
        opacity: isOSUnlocked ? 1 : 0.6
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
                Status: {isOSUnlocked ? "OS ACTIVE" : "BLUEPRINT ONLY"}
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
                      onClick={copySMS}
                      style={{
                        backgroundColor: "#FFF",
                        color: "#000",
                        border: "none",
                        padding: "0 1.5rem",
                        cursor: "pointer",
                        fontWeight: 600,
                        whiteSpace: "nowrap"
                      }}
                    >
                      COPY SMS INVITE
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
    </div>
  );
}
