// DashboardPage.jsx — M3 Admin Dashboard

const APPOINTMENTS = [
  { time: "09:00", name: "Anna Kowalska",    service: "Masaż twarzy 60 min", master: "Olga",   status: "confirmed" },
  { time: "10:30", name: "Maria Wiśniewska", service: "Drenaż limfatyczny",  master: "Yuliia", status: "confirmed" },
  { time: "12:00", name: "Karolina Nowak",   service: "Masaż twarzy 90 min", master: "Olga",   status: "pending"   },
  { time: "14:00", name: "Zofia Dąbrowska",  service: "Peeling enzymatyczny",master: "Yuliia", status: "confirmed" },
  { time: "15:30", name: "Ewa Kamińska",     service: "Masaż twarzy 60 min", master: "Olga",   status: "cancelled" },
];

const STATUS_CHIP = {
  confirmed: { bg: "#B7F2DC", color: "#002117", dot: "#21A67A" },
  pending:   { bg: "#FFDFA3", color: "#271900", dot: "#7A5900" },
  cancelled: { bg: "#FFDAD6", color: "#410002", dot: "#BA1A1A" },
};

function StatCard({ label, value, sub, containerColor = "#FFF0F1", valueColor = "#211A1B" }) {
  return (
    <div style={{
      background: containerColor, borderRadius: 16, padding: "20px 24px",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ fontSize: 13, color: "#524344", fontWeight: 400 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 400, color: valueColor, lineHeight: 1, letterSpacing: "-0.02em", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#857374", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function DashboardPage() {
  return (
    <div style={{ padding: "24px 28px", maxWidth: 860 }}>
      {/* Top app bar area */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 400, color: "#211A1B", letterSpacing: 0 }}>Dashboard</div>
        <div style={{ fontSize: 14, color: "#524344", marginTop: 4, letterSpacing: ".018em" }}>Thursday, 24 April 2025</div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        <StatCard label="Today" value="5" sub="2 masters active" containerColor="#FFD9DC" valueColor="#3B0017" />
        <StatCard label="This week" value="23" sub="+4 vs last week" containerColor="#FFDCCA" valueColor="#2F1509" />
        <StatCard label="Revenue" value="1 840" sub="PLN this month" containerColor="#FFDFA3" valueColor="#271900" />
        <StatCard label="Masters" value="2" sub="Olga · Yuliia" containerColor="#F3E3E4" valueColor="#3B0017" />
      </div>

      {/* Today's appointments */}
      <div style={{ background: "#FFF0F1", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #EDE1E1" }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: "#211A1B", letterSpacing: ".009em" }}>Today's appointments</span>
          <span style={{ fontSize: 13, color: "#524344" }}>5 total</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #EDE1E1" }}>
              {["Time", "Client", "Service", "Master", "Status"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#857374", letterSpacing: ".045em", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {APPOINTMENTS.map((a, i) => {
              const s = STATUS_CHIP[a.status];
              return (
                <tr key={i} style={{ borderBottom: i < APPOINTMENTS.length - 1 ? "1px solid #EDE1E1" : "none" }}>
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 500, color: "#211A1B", letterSpacing: ".018em" }}>{a.time}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14, color: "#211A1B" }}>{a.name}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#524344" }}>{a.service}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, background: "#FFD9DC", color: "#3B0017", padding: "4px 10px", borderRadius: 8 }}>
                      {a.master}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, background: s.bg, color: s.color, padding: "4px 10px", borderRadius: 9999 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, flexShrink: 0 }}></span>
                      {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardPage });
