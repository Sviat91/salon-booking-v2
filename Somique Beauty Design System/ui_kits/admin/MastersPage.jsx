// MastersPage.jsx — M3 Masters management

const MASTERS_DATA = [
  { name: "Olga",   email: "olga@somique.beauty",   bookings: 48, avatar: "../../assets/photo_master_olga.png",   active: true  },
  { name: "Yuliia", email: "yuliia@somique.beauty",  bookings: 37, avatar: "../../assets/photo_master_yuliia.png", active: true  },
];

function MastersPage() {
  const [showAdd, setShowAdd] = React.useState(false);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 400, color: "#211A1B" }}>Masters</div>
          <div style={{ fontSize: 13, color: "#524344", marginTop: 3 }}>Staff accounts and permissions</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 24px",
          borderRadius: 9999, border: "none", background: "#8B4A58", color: "#fff",
          fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
          boxShadow: "0 2px 6px rgba(0,0,0,.15)", letterSpacing: ".007em",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Master
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ background: "#F9E9EA", borderRadius: 20, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: "#211A1B", marginBottom: 16, letterSpacing: ".009em" }}>New master account</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {[["Name","Full name"],["Email","work@somique.beauty"]].map(([l,p]) => (
              <div key={l} style={{ position: "relative" }}>
                <input placeholder=" " style={{
                  width: "100%", height: 56, padding: "20px 16px 8px", background: "#EDE1E1",
                  border: "none", borderBottom: "1px solid #524344", borderRadius: "4px 4px 0 0",
                  fontFamily: "inherit", fontSize: 14, color: "#211A1B", outline: "none", boxSizing: "border-box",
                }} />
                <label style={{ position: "absolute", top: 8, left: 16, fontSize: 11, color: "#8B4A58", fontWeight: 500, pointerEvents: "none" }}>{l}</label>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#857374", marginBottom: 16 }}>A unique UID and temporary password will be generated automatically.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowAdd(false)} style={{ height: 40, padding: "0 24px", borderRadius: 9999, border: "none", background: "#8B4A58", color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Create</button>
            <button onClick={() => setShowAdd(false)} style={{ height: 40, padding: "0 24px", borderRadius: 9999, border: "1px solid #D8C2C3", background: "transparent", color: "#524344", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Master cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {MASTERS_DATA.map((m, i) => (
          <div key={i} style={{ background: "#FFF0F1", borderRadius: 20, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
            <img src={m.avatar} alt={m.name} style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: "3px solid #FFD9DC", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: "#211A1B", letterSpacing: ".009em" }}>{m.name}</div>
              <div style={{ fontSize: 13, color: "#524344", marginTop: 2 }}>{m.email}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 13, color: "#524344" }}>{m.bookings} bookings</div>
              <span style={{ display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 9999, background: "#B7F2DC", color: "#002117" }}>Active</span>
            </div>
            <button style={{ width: 36, height: 36, borderRadius: 9999, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#524344" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { MastersPage });
