// CalendarPage.jsx — M3 Calendar (week view)

const DAYS = ["Mon 28", "Tue 29", "Wed 30", "Thu 1", "Fri 2", "Sat 3", "Sun 4"];
const HOURS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"];

const EVENTS = [
  { day: 0, startH: 9,  duration: 1,   name: "Anna K.",    service: "Masaż 60m",  master: "Olga",   bg: "#FFD9DC", color: "#3B0017" },
  { day: 0, startH: 11, duration: 1.5, name: "Maria W.",   service: "Drenaż",    master: "Yuliia", bg: "#FFDCCA", color: "#2F1509" },
  { day: 1, startH: 10, duration: 1,   name: "Karolina N.",service: "Masaż 90m",  master: "Olga",   bg: "#FFD9DC", color: "#3B0017" },
  { day: 2, startH: 14, duration: 1,   name: "Zofia D.",   service: "Peeling",   master: "Yuliia", bg: "#FFDCCA", color: "#2F1509" },
  { day: 3, startH: 9,  duration: 1,   name: "Ewa K.",     service: "Masaż 60m",  master: "Olga",   bg: "#FFD9DC", color: "#3B0017" },
  { day: 3, startH: 11, duration: 1,   name: "Natalia B.", service: "Drenaż",    master: "Yuliia", bg: "#FFDCCA", color: "#2F1509" },
  { day: 4, startH: 10, duration: 1.5, name: "Julia M.",   service: "Masaż 90m",  master: "Olga",   bg: "#FFD9DC", color: "#3B0017" },
];

const CELL_H = 56;
const START_H = 9;

function CalendarPage() {
  const [master, setMaster] = React.useState("All");
  const filtered = master === "All" ? EVENTS : EVENTS.filter(e => e.master === master);

  return (
    <div style={{ padding: "24px 28px", height: "calc(100vh - 0px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 400, color: "#211A1B" }}>Calendar</div>
          <div style={{ fontSize: 13, color: "#524344", marginTop: 3 }}>Week of April 28 – May 4, 2025</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Master chips */}
          {["All","Olga","Yuliia"].map(m => (
            <button key={m} onClick={() => setMaster(m)} style={{
              height: 32, padding: "0 16px", borderRadius: 8, fontFamily: "inherit",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              border: master === m ? "none" : "1px solid #D8C2C3",
              background: master === m ? "#FFDCCA" : "transparent",
              color: master === m ? "#2F1509" : "#524344",
              transition: "all 150ms",
            }}>{m}</button>
          ))}
          {/* FAB-style add */}
          <button style={{
            height: 40, padding: "0 20px", borderRadius: 9999, border: "none", cursor: "pointer",
            background: "#8B4A58", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            display: "flex", alignItems: "center", gap: 6,
            boxShadow: "0 2px 6px rgba(0,0,0,.15)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ background: "#FFF0F1", borderRadius: 20, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)", borderBottom: "1px solid #EDE1E1", background: "#F9E9EA", flexShrink: 0 }}>
          <div style={{ padding: "12px 0", borderRight: "1px solid #EDE1E1" }}></div>
          {DAYS.map((d, i) => {
            const isToday = i === 3;
            return (
              <div key={i} style={{
                padding: "10px 8px", textAlign: "center",
                borderRight: i < 6 ? "1px solid #EDE1E1" : "none",
              }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: isToday ? "#8B4A58" : "#857374", textTransform: "uppercase", letterSpacing: ".06em" }}>{d.split(" ")[0]}</div>
                <div style={{
                  fontSize: 14, fontWeight: isToday ? 600 : 400, marginTop: 4,
                  color: isToday ? "#fff" : "#211A1B",
                  width: 28, height: 28, lineHeight: "28px", borderRadius: "50%",
                  background: isToday ? "#8B4A58" : "transparent",
                  margin: "4px auto 0",
                }}>{d.split(" ")[1]}</div>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {HOURS.map((h, hi) => (
            <div key={h} style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)", height: CELL_H, borderBottom: hi < HOURS.length - 1 ? "1px solid #EDE1E1" : "none" }}>
              <div style={{ borderRight: "1px solid #EDE1E1", padding: "4px 8px", fontSize: 11, color: "#857374", textAlign: "right" }}>{h}</div>
              {DAYS.map((_, di) => (
                <div key={di} style={{ borderRight: di < 6 ? "1px solid #EDE1E1" : "none", background: di === 3 ? "rgba(139,74,88,.04)" : "transparent" }}></div>
              ))}
            </div>
          ))}

          {/* Events */}
          {filtered.map((ev, i) => (
            <div key={i} style={{
              position: "absolute",
              top: (ev.startH - START_H) * CELL_H + 2,
              left: `calc(56px + ${ev.day} * (100% - 56px) / 7 + 4px)`,
              width: `calc((100% - 56px) / 7 - 8px)`,
              height: ev.duration * CELL_H - 4,
              background: ev.bg, borderRadius: 10,
              padding: "6px 8px", overflow: "hidden", cursor: "pointer",
              borderLeft: `3px solid ${ev.color === "#3B0017" ? "#8B4A58" : "#7C5A47"}`,
              transition: "filter 150ms",
            }}
            onMouseEnter={e => e.currentTarget.style.filter = "brightness(.96)"}
            onMouseLeave={e => e.currentTarget.style.filter = "none"}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: ev.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.name}</div>
              <div style={{ fontSize: 10, color: ev.color, opacity: .75, marginTop: 1 }}>{ev.service}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CalendarPage });
