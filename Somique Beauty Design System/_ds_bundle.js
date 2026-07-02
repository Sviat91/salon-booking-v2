/* @ds-bundle: {"format":3,"namespace":"SomiqueBeautyDesignSystem_a3cb7b","components":[],"sourceHashes":{"ui_kits/admin/AdminSidebar.jsx":"e3956201448a","ui_kits/admin/CalendarPage.jsx":"bff182869ce4","ui_kits/admin/DashboardPage.jsx":"f1b206850860","ui_kits/admin/MastersPage.jsx":"2bf8c0e23528","ui_kits/client/BookingFlow.jsx":"152cef70c42f","ui_kits/client/BookingForm.jsx":"480a84fa91ed","ui_kits/client/BookingSuccess.jsx":"36f8187b4fb0","ui_kits/client/MasterSelector.jsx":"a3aa3e351244","ui_kits/client/pages.jsx":"effc6e153d1d","ui_kits/client/shared.jsx":"de6660aace02"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.SomiqueBeautyDesignSystem_a3cb7b = window.SomiqueBeautyDesignSystem_a3cb7b || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/admin/AdminSidebar.jsx
try { (() => {
// AdminSidebar.jsx — M3 Navigation Rail + Drawer hybrid

const NAV_SUPERADMIN = [{
  label: "Dashboard",
  href: "dashboard",
  icon: "dashboard"
}, {
  label: "Calendar",
  href: "calendar",
  icon: "calendar"
}, {
  label: "Services",
  href: "services",
  icon: "scissors"
}, {
  label: "Masters",
  href: "masters",
  icon: "people"
}, {
  label: "Settings",
  href: "settings",
  icon: "settings"
}, {
  label: "Email",
  href: "email",
  icon: "mail"
}];
const NAV_MASTER = [{
  label: "Dashboard",
  href: "dashboard",
  icon: "dashboard"
}, {
  label: "Services",
  href: "services",
  icon: "scissors"
}, {
  label: "Schedule",
  href: "schedule",
  icon: "calendar"
}];
const ICONS = {
  dashboard: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "7",
    height: "7",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "3",
    width: "7",
    height: "7",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "14",
    width: "7",
    height: "7",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "14",
    width: "7",
    height: "7",
    rx: "1"
  })),
  calendar: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "2",
    x2: "16",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "2",
    x2: "8",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "10",
    x2: "21",
    y2: "10"
  })),
  scissors: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "6",
    r: "3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "18",
    r: "3"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "20",
    y1: "4",
    x2: "8.12",
    y2: "15.88"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "14.47",
    y1: "14.48",
    x2: "20",
    y2: "20"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8.12",
    y1: "8.12",
    x2: "12",
    y2: "12"
  })),
  people: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "7",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M23 21v-2a4 4 0 0 0-3-3.87"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 3.13a4 4 0 0 1 0 7.75"
  })),
  settings: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
  })),
  mail: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "4",
    width: "20",
    height: "16",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"
  })),
  back: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "19",
    y1: "12",
    x2: "5",
    y2: "12"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "12 19 5 12 12 5"
  })),
  logout: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "16 17 21 12 16 7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    y1: "12",
    x2: "9",
    y2: "12"
  }))
};
function AdminSidebar({
  activePage,
  onNavigate,
  role = "SUPERADMIN",
  brandName = "Somique Beauty"
}) {
  const navItems = role === "MASTER" ? NAV_MASTER : NAV_SUPERADMIN;
  const railItem = item => {
    const active = activePage === item.href;
    return /*#__PURE__*/React.createElement("button", {
      key: item.href,
      onClick: () => onNavigate(item.href),
      style: {
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "12px 0",
        border: "none",
        cursor: "pointer",
        background: "transparent",
        color: active ? "#3B0017" : "#524344",
        fontFamily: "inherit",
        fontSize: 11,
        fontWeight: active ? 500 : 400,
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 64,
        height: 32,
        borderRadius: 9999,
        background: active ? "#FFD9DC" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 200ms",
        position: "relative",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: active ? "#3B0017" : "#524344"
      }
    }, ICONS[item.icon])), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        lineHeight: 1.2,
        textAlign: "center",
        whiteSpace: "nowrap"
      }
    }, item.label));
  };
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 80,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      background: "#F9E9EA",
      borderRight: "1px solid #EDE1E1",
      flexShrink: 0,
      paddingTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 9999,
      background: "#FFD9DC",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#8B4A58",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 6v6l4 2"
  }))), /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: 1,
      width: "100%",
      display: "flex",
      flexDirection: "column",
      paddingTop: 4
    }
  }, navItems.map(railItem), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "8px 12px",
      borderTop: "1px solid #D8C2C3"
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => onNavigate("site"),
    style: {
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
      padding: "12px 0",
      border: "none",
      cursor: "pointer",
      background: "transparent",
      color: "#524344",
      fontFamily: "inherit",
      fontSize: 11,
      fontWeight: 400
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 32,
      borderRadius: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, ICONS.back), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11
    }
  }, "Site"))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "12px 0",
      gap: 8,
      borderTop: "1px solid #D8C2C3"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 9999,
      background: "#8B4A58",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: 13,
      fontWeight: 500
    }
  }, "A"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {},
    style: {
      width: 64,
      height: 32,
      borderRadius: 9999,
      border: "none",
      cursor: "pointer",
      background: "transparent",
      color: "#524344",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, ICONS.logout)));
}
Object.assign(window, {
  AdminSidebar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/AdminSidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/CalendarPage.jsx
try { (() => {
// CalendarPage.jsx — M3 Calendar (week view)

const DAYS = ["Mon 28", "Tue 29", "Wed 30", "Thu 1", "Fri 2", "Sat 3", "Sun 4"];
const HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const EVENTS = [{
  day: 0,
  startH: 9,
  duration: 1,
  name: "Anna K.",
  service: "Masaż 60m",
  master: "Olga",
  bg: "#FFD9DC",
  color: "#3B0017"
}, {
  day: 0,
  startH: 11,
  duration: 1.5,
  name: "Maria W.",
  service: "Drenaż",
  master: "Yuliia",
  bg: "#FFDCCA",
  color: "#2F1509"
}, {
  day: 1,
  startH: 10,
  duration: 1,
  name: "Karolina N.",
  service: "Masaż 90m",
  master: "Olga",
  bg: "#FFD9DC",
  color: "#3B0017"
}, {
  day: 2,
  startH: 14,
  duration: 1,
  name: "Zofia D.",
  service: "Peeling",
  master: "Yuliia",
  bg: "#FFDCCA",
  color: "#2F1509"
}, {
  day: 3,
  startH: 9,
  duration: 1,
  name: "Ewa K.",
  service: "Masaż 60m",
  master: "Olga",
  bg: "#FFD9DC",
  color: "#3B0017"
}, {
  day: 3,
  startH: 11,
  duration: 1,
  name: "Natalia B.",
  service: "Drenaż",
  master: "Yuliia",
  bg: "#FFDCCA",
  color: "#2F1509"
}, {
  day: 4,
  startH: 10,
  duration: 1.5,
  name: "Julia M.",
  service: "Masaż 90m",
  master: "Olga",
  bg: "#FFD9DC",
  color: "#3B0017"
}];
const CELL_H = 56;
const START_H = 9;
function CalendarPage() {
  const [master, setMaster] = React.useState("All");
  const filtered = master === "All" ? EVENTS : EVENTS.filter(e => e.master === master);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "24px 28px",
      height: "calc(100vh - 0px)",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 400,
      color: "#211A1B"
    }
  }, "Calendar"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#524344",
      marginTop: 3
    }
  }, "Week of April 28 \u2013 May 4, 2025")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, ["All", "Olga", "Yuliia"].map(m => /*#__PURE__*/React.createElement("button", {
    key: m,
    onClick: () => setMaster(m),
    style: {
      height: 32,
      padding: "0 16px",
      borderRadius: 8,
      fontFamily: "inherit",
      fontSize: 13,
      fontWeight: 500,
      cursor: "pointer",
      border: master === m ? "none" : "1px solid #D8C2C3",
      background: master === m ? "#FFDCCA" : "transparent",
      color: master === m ? "#2F1509" : "#524344",
      transition: "all 150ms"
    }
  }, m)), /*#__PURE__*/React.createElement("button", {
    style: {
      height: 40,
      padding: "0 20px",
      borderRadius: 9999,
      border: "none",
      cursor: "pointer",
      background: "#8B4A58",
      color: "#fff",
      fontFamily: "inherit",
      fontSize: 13,
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      gap: 6,
      boxShadow: "0 2px 6px rgba(0,0,0,.15)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12"
  })), "New"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#FFF0F1",
      borderRadius: 20,
      overflow: "hidden",
      flex: 1,
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "56px repeat(7, 1fr)",
      borderBottom: "1px solid #EDE1E1",
      background: "#F9E9EA",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 0",
      borderRight: "1px solid #EDE1E1"
    }
  }), DAYS.map((d, i) => {
    const isToday = i === 3;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        padding: "10px 8px",
        textAlign: "center",
        borderRight: i < 6 ? "1px solid #EDE1E1" : "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        fontWeight: 500,
        color: isToday ? "#8B4A58" : "#857374",
        textTransform: "uppercase",
        letterSpacing: ".06em"
      }
    }, d.split(" ")[0]), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: isToday ? 600 : 400,
        marginTop: 4,
        color: isToday ? "#fff" : "#211A1B",
        width: 28,
        height: 28,
        lineHeight: "28px",
        borderRadius: "50%",
        background: isToday ? "#8B4A58" : "transparent",
        margin: "4px auto 0"
      }
    }, d.split(" ")[1]));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      position: "relative"
    }
  }, HOURS.map((h, hi) => /*#__PURE__*/React.createElement("div", {
    key: h,
    style: {
      display: "grid",
      gridTemplateColumns: "56px repeat(7, 1fr)",
      height: CELL_H,
      borderBottom: hi < HOURS.length - 1 ? "1px solid #EDE1E1" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRight: "1px solid #EDE1E1",
      padding: "4px 8px",
      fontSize: 11,
      color: "#857374",
      textAlign: "right"
    }
  }, h), DAYS.map((_, di) => /*#__PURE__*/React.createElement("div", {
    key: di,
    style: {
      borderRight: di < 6 ? "1px solid #EDE1E1" : "none",
      background: di === 3 ? "rgba(139,74,88,.04)" : "transparent"
    }
  })))), filtered.map((ev, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      position: "absolute",
      top: (ev.startH - START_H) * CELL_H + 2,
      left: `calc(56px + ${ev.day} * (100% - 56px) / 7 + 4px)`,
      width: `calc((100% - 56px) / 7 - 8px)`,
      height: ev.duration * CELL_H - 4,
      background: ev.bg,
      borderRadius: 10,
      padding: "6px 8px",
      overflow: "hidden",
      cursor: "pointer",
      borderLeft: `3px solid ${ev.color === "#3B0017" ? "#8B4A58" : "#7C5A47"}`,
      transition: "filter 150ms"
    },
    onMouseEnter: e => e.currentTarget.style.filter = "brightness(.96)",
    onMouseLeave: e => e.currentTarget.style.filter = "none"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: ev.color,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, ev.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: ev.color,
      opacity: .75,
      marginTop: 1
    }
  }, ev.service))))));
}
Object.assign(window, {
  CalendarPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/CalendarPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/DashboardPage.jsx
try { (() => {
// DashboardPage.jsx — M3 Admin Dashboard

const APPOINTMENTS = [{
  time: "09:00",
  name: "Anna Kowalska",
  service: "Masaż twarzy 60 min",
  master: "Olga",
  status: "confirmed"
}, {
  time: "10:30",
  name: "Maria Wiśniewska",
  service: "Drenaż limfatyczny",
  master: "Yuliia",
  status: "confirmed"
}, {
  time: "12:00",
  name: "Karolina Nowak",
  service: "Masaż twarzy 90 min",
  master: "Olga",
  status: "pending"
}, {
  time: "14:00",
  name: "Zofia Dąbrowska",
  service: "Peeling enzymatyczny",
  master: "Yuliia",
  status: "confirmed"
}, {
  time: "15:30",
  name: "Ewa Kamińska",
  service: "Masaż twarzy 60 min",
  master: "Olga",
  status: "cancelled"
}];
const STATUS_CHIP = {
  confirmed: {
    bg: "#B7F2DC",
    color: "#002117",
    dot: "#21A67A"
  },
  pending: {
    bg: "#FFDFA3",
    color: "#271900",
    dot: "#7A5900"
  },
  cancelled: {
    bg: "#FFDAD6",
    color: "#410002",
    dot: "#BA1A1A"
  }
};
function StatCard({
  label,
  value,
  sub,
  containerColor = "#FFF0F1",
  valueColor = "#211A1B"
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: containerColor,
      borderRadius: 16,
      padding: "20px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#524344",
      fontWeight: 400
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36,
      fontWeight: 400,
      color: valueColor,
      lineHeight: 1,
      letterSpacing: "-0.02em",
      marginTop: 4
    }
  }, value), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#857374",
      marginTop: 4
    }
  }, sub));
}
function DashboardPage() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "24px 28px",
      maxWidth: 860
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 400,
      color: "#211A1B",
      letterSpacing: 0
    }
  }, "Dashboard"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "#524344",
      marginTop: 4,
      letterSpacing: ".018em"
    }
  }, "Thursday, 24 April 2025")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 12,
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Today",
    value: "5",
    sub: "2 masters active",
    containerColor: "#FFD9DC",
    valueColor: "#3B0017"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "This week",
    value: "23",
    sub: "+4 vs last week",
    containerColor: "#FFDCCA",
    valueColor: "#2F1509"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Revenue",
    value: "1 840",
    sub: "PLN this month",
    containerColor: "#FFDFA3",
    valueColor: "#271900"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Masters",
    value: "2",
    sub: "Olga \xB7 Yuliia",
    containerColor: "#F3E3E4",
    valueColor: "#3B0017"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#FFF0F1",
      borderRadius: 16,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 24px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: "1px solid #EDE1E1"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 500,
      color: "#211A1B",
      letterSpacing: ".009em"
    }
  }, "Today's appointments"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "#524344"
    }
  }, "5 total")), /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: "1px solid #EDE1E1"
    }
  }, ["Time", "Client", "Service", "Master", "Status"].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      padding: "10px 16px",
      textAlign: "left",
      fontSize: 11,
      fontWeight: 500,
      color: "#857374",
      letterSpacing: ".045em",
      textTransform: "uppercase"
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, APPOINTMENTS.map((a, i) => {
    const s = STATUS_CHIP[a.status];
    return /*#__PURE__*/React.createElement("tr", {
      key: i,
      style: {
        borderBottom: i < APPOINTMENTS.length - 1 ? "1px solid #EDE1E1" : "none"
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "12px 16px",
        fontSize: 14,
        fontWeight: 500,
        color: "#211A1B",
        letterSpacing: ".018em"
      }
    }, a.time), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "12px 16px",
        fontSize: 14,
        color: "#211A1B"
      }
    }, a.name), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "12px 16px",
        fontSize: 13,
        color: "#524344"
      }
    }, a.service), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "12px 16px"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 500,
        background: "#FFD9DC",
        color: "#3B0017",
        padding: "4px 10px",
        borderRadius: 8
      }
    }, a.master)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "12px 16px"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 500,
        background: s.bg,
        color: s.color,
        padding: "4px 10px",
        borderRadius: 9999
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: s.dot,
        flexShrink: 0
      }
    }), a.status.charAt(0).toUpperCase() + a.status.slice(1))));
  })))));
}
Object.assign(window, {
  DashboardPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/DashboardPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/MastersPage.jsx
try { (() => {
// MastersPage.jsx — M3 Masters management

const MASTERS_DATA = [{
  name: "Olga",
  email: "olga@somique.beauty",
  bookings: 48,
  avatar: "../../assets/photo_master_olga.png",
  active: true
}, {
  name: "Yuliia",
  email: "yuliia@somique.beauty",
  bookings: 37,
  avatar: "../../assets/photo_master_yuliia.png",
  active: true
}];
function MastersPage() {
  const [showAdd, setShowAdd] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "24px 28px",
      maxWidth: 700
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 400,
      color: "#211A1B"
    }
  }, "Masters"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#524344",
      marginTop: 3
    }
  }, "Staff accounts and permissions")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowAdd(!showAdd),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: 40,
      padding: "0 24px",
      borderRadius: 9999,
      border: "none",
      background: "#8B4A58",
      color: "#fff",
      fontSize: 14,
      fontWeight: 500,
      cursor: "pointer",
      fontFamily: "inherit",
      boxShadow: "0 2px 6px rgba(0,0,0,.15)",
      letterSpacing: ".007em"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12"
  })), "Add Master")), showAdd && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#F9E9EA",
      borderRadius: 20,
      padding: 24,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 500,
      color: "#211A1B",
      marginBottom: 16,
      letterSpacing: ".009em"
    }
  }, "New master account"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16,
      marginBottom: 16
    }
  }, [["Name", "Full name"], ["Email", "work@somique.beauty"]].map(([l, p]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: " ",
    style: {
      width: "100%",
      height: 56,
      padding: "20px 16px 8px",
      background: "#EDE1E1",
      border: "none",
      borderBottom: "1px solid #524344",
      borderRadius: "4px 4px 0 0",
      fontFamily: "inherit",
      fontSize: 14,
      color: "#211A1B",
      outline: "none",
      boxSizing: "border-box"
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      position: "absolute",
      top: 8,
      left: 16,
      fontSize: 11,
      color: "#8B4A58",
      fontWeight: 500,
      pointerEvents: "none"
    }
  }, l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#857374",
      marginBottom: 16
    }
  }, "A unique UID and temporary password will be generated automatically."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowAdd(false),
    style: {
      height: 40,
      padding: "0 24px",
      borderRadius: 9999,
      border: "none",
      background: "#8B4A58",
      color: "#fff",
      fontSize: 14,
      fontWeight: 500,
      cursor: "pointer",
      fontFamily: "inherit"
    }
  }, "Create"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowAdd(false),
    style: {
      height: 40,
      padding: "0 24px",
      borderRadius: 9999,
      border: "1px solid #D8C2C3",
      background: "transparent",
      color: "#524344",
      fontSize: 14,
      cursor: "pointer",
      fontFamily: "inherit"
    }
  }, "Cancel"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, MASTERS_DATA.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: "#FFF0F1",
      borderRadius: 20,
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: m.avatar,
    alt: m.name,
    style: {
      width: 52,
      height: 52,
      borderRadius: "50%",
      objectFit: "cover",
      border: "3px solid #FFD9DC",
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 500,
      color: "#211A1B",
      letterSpacing: ".009em"
    }
  }, m.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#524344",
      marginTop: 2
    }
  }, m.email)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#524344"
    }
  }, m.bookings, " bookings"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      marginTop: 4,
      fontSize: 11,
      fontWeight: 500,
      padding: "3px 10px",
      borderRadius: 9999,
      background: "#B7F2DC",
      color: "#002117"
    }
  }, "Active")), /*#__PURE__*/React.createElement("button", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 9999,
      border: "none",
      background: "transparent",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#524344"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "5",
    r: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "19",
    r: "1"
  })))))));
}
Object.assign(window, {
  MastersPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/MastersPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client/BookingFlow.jsx
try { (() => {
// BookingFlow.jsx — M3 Service + DateTime steps

const PROCEDURES = [{
  id: "p1",
  name: "Masaż twarzy 60 min",
  price: 180,
  duration: 60
}, {
  id: "p2",
  name: "Masaż twarzy 90 min",
  price: 240,
  duration: 90
}, {
  id: "p3",
  name: "Drenaż limfatyczny",
  price: 210,
  duration: 75
}, {
  id: "p4",
  name: "Peeling enzymatyczny",
  price: 160,
  duration: 50
}];
const SLOTS = ["09:00", "10:00", "11:00", "12:30", "14:00", "15:00", "16:30", "17:00"];
const DAYS = [{
  label: "Wt",
  num: "29",
  avail: true
}, {
  label: "Śr",
  num: "30",
  avail: true
}, {
  label: "Cz",
  num: "1",
  avail: true
}, {
  label: "Pt",
  num: "2",
  avail: true
}, {
  label: "Sb",
  num: "3",
  avail: false
}, {
  label: "Nd",
  num: "4",
  avail: false
}];
function BackButton({
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 40,
      padding: "0 16px 0 8px",
      borderRadius: 9999,
      border: "none",
      background: "transparent",
      cursor: "pointer",
      color: "#8B4A58",
      fontSize: 14,
      fontWeight: 500,
      fontFamily: "inherit",
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  })), "Back");
}
function ServiceStep({
  master,
  onSelect,
  onBack
}) {
  const [hovered, setHovered] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 400,
      display: "flex",
      flexDirection: "column",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(BackButton, {
    onClick: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: master.avatar,
    alt: master.name,
    style: {
      width: 52,
      height: 52,
      borderRadius: "50%",
      objectFit: "cover",
      border: "2px solid #FFD9DC"
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 400,
      color: "#211A1B"
    }
  }, "Choose a service"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#524344",
      marginTop: 2
    }
  }, "with ", master.name))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, PROCEDURES.map(p => /*#__PURE__*/React.createElement("button", {
    key: p.id,
    onClick: () => onSelect(p),
    onMouseEnter: () => setHovered(p.id),
    onMouseLeave: () => setHovered(null),
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: hovered === p.id ? "#F3E3E4" : "#FFF0F1",
      border: "none",
      borderRadius: 16,
      padding: "14px 18px",
      cursor: "pointer",
      textAlign: "left",
      width: "100%",
      fontFamily: "inherit",
      transition: "background 150ms"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: "#211A1B",
      letterSpacing: ".009em"
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#524344",
      marginTop: 2
    }
  }, p.duration, " min")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 500,
      color: "#8B4A58"
    }
  }, p.price, " z\u0142")))));
}
function DateTimeStep({
  master,
  procedure,
  onSelect,
  onBack
}) {
  const [selDay, setSelDay] = React.useState(null);
  const [selSlot, setSelSlot] = React.useState(null);
  const ok = selDay !== null && selSlot;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 400,
      display: "flex",
      flexDirection: "column",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(BackButton, {
    onClick: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 400,
      color: "#211A1B"
    }
  }, "Pick a date & time"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      height: 32,
      padding: "0 14px",
      borderRadius: 8,
      background: "#FFD9DC",
      color: "#3B0017",
      fontSize: 13,
      fontWeight: 500,
      width: "fit-content"
    }
  }, procedure.name, " \xB7 ", procedure.duration, " min \xB7 ", procedure.price, " z\u0142"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 500,
      color: "#857374",
      letterSpacing: ".045em",
      textTransform: "uppercase",
      marginBottom: 10
    }
  }, "April 2025"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, DAYS.map((d, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    disabled: !d.avail,
    onClick: () => setSelDay(i),
    style: {
      flex: 1,
      padding: "10px 0",
      borderRadius: 12,
      border: "none",
      cursor: d.avail ? "pointer" : "not-allowed",
      background: selDay === i ? "#8B4A58" : d.avail ? "#FFF0F1" : "#F9E9EA",
      color: selDay === i ? "#fff" : d.avail ? "#211A1B" : "#D8C2C3",
      fontFamily: "inherit",
      transition: "all 150ms"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 500,
      textTransform: "uppercase",
      letterSpacing: ".04em",
      opacity: .7
    }
  }, d.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: selDay === i ? 500 : 400,
      marginTop: 2
    }
  }, d.num))))), selDay !== null && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 500,
      color: "#857374",
      letterSpacing: ".045em",
      textTransform: "uppercase",
      marginBottom: 10
    }
  }, "Available slots"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 8
    }
  }, SLOTS.map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => setSelSlot(s),
    style: {
      padding: "10px 0",
      borderRadius: 12,
      border: "none",
      cursor: "pointer",
      background: selSlot === s ? "#8B4A58" : "#FFF0F1",
      color: selSlot === s ? "#fff" : "#211A1B",
      fontSize: 13,
      fontWeight: 500,
      fontFamily: "inherit",
      transition: "all 150ms"
    }
  }, s)))), /*#__PURE__*/React.createElement("button", {
    disabled: !ok,
    onClick: () => onSelect({
      day: DAYS[selDay],
      slot: selSlot
    }),
    style: {
      height: 48,
      borderRadius: 9999,
      border: "none",
      fontFamily: "inherit",
      background: ok ? "#8B4A58" : "#EDE1E1",
      color: ok ? "#fff" : "#857374",
      fontSize: 15,
      fontWeight: 500,
      cursor: ok ? "pointer" : "not-allowed",
      letterSpacing: ".007em",
      transition: "all 200ms",
      boxShadow: ok ? "0 2px 8px rgba(139,74,88,.2)" : "none"
    }
  }, "Continue"));
}
Object.assign(window, {
  ServiceStep,
  DateTimeStep,
  PROCEDURES,
  SLOTS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client/BookingFlow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client/BookingForm.jsx
try { (() => {
// BookingForm.jsx — M3 contact details + consent

function BookingForm({
  master,
  procedure,
  dateTime,
  onSubmit,
  onBack
}) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [gdpr, setGdpr] = React.useState(false);
  const [terms, setTerms] = React.useState(false);
  const [notif, setNotif] = React.useState(false);
  const [focused, setFocused] = React.useState(null);
  const ok = name.trim().length >= 2 && phone.trim().length >= 9 && gdpr && terms;
  const fieldStyle = id => ({
    position: "relative",
    width: "100%"
  });
  const inputStyle = id => ({
    width: "100%",
    height: 56,
    padding: "20px 16px 8px",
    background: "#EDE1E1",
    border: "none",
    borderBottom: `${focused === id ? 2 : 1}px solid ${focused === id ? "#8B4A58" : "#524344"}`,
    borderRadius: "4px 4px 0 0",
    fontFamily: "Roboto, sans-serif",
    fontSize: 14,
    color: "#211A1B",
    outline: "none",
    boxSizing: "border-box",
    transition: "border 150ms"
  });
  const labelStyle = (id, hasValue) => ({
    position: "absolute",
    top: focused === id || hasValue ? 8 : 18,
    left: 16,
    fontSize: focused === id || hasValue ? 11 : 14,
    color: focused === id ? "#8B4A58" : "#524344",
    pointerEvents: "none",
    transition: "all 150ms",
    fontFamily: "Roboto, sans-serif",
    fontWeight: focused === id || hasValue ? 500 : 400
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 400,
      display: "flex",
      flexDirection: "column",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 40,
      padding: "0 16px 0 8px",
      borderRadius: 9999,
      border: "none",
      background: "transparent",
      cursor: "pointer",
      color: "#8B4A58",
      fontSize: 14,
      fontWeight: 500,
      fontFamily: "inherit"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  })), "Back"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 400,
      color: "#211A1B"
    }
  }, "Your details"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      height: 32,
      padding: "0 14px",
      borderRadius: 8,
      background: "#FFD9DC",
      color: "#3B0017",
      fontSize: 12,
      fontWeight: 500
    }
  }, master.name), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      height: 32,
      padding: "0 14px",
      borderRadius: 8,
      background: "#FFDCCA",
      color: "#2F1509",
      fontSize: 12,
      fontWeight: 500
    }
  }, procedure.name), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      height: 32,
      padding: "0 14px",
      borderRadius: 8,
      background: "#FFDFA3",
      color: "#271900",
      fontSize: 12,
      fontWeight: 500
    }
  }, dateTime.day.label, " ", dateTime.day.num, " \xB7 ", dateTime.slot)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: fieldStyle("name")
  }, /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    onFocus: () => setFocused("name"),
    onBlur: () => setFocused(null),
    style: inputStyle("name"),
    placeholder: " "
  }), /*#__PURE__*/React.createElement("label", {
    style: labelStyle("name", name.length > 0)
  }, "Full name *")), /*#__PURE__*/React.createElement("div", {
    style: fieldStyle("phone")
  }, /*#__PURE__*/React.createElement("input", {
    value: phone,
    onChange: e => setPhone(e.target.value),
    onFocus: () => setFocused("phone"),
    onBlur: () => setFocused(null),
    style: inputStyle("phone"),
    placeholder: " ",
    type: "tel"
  }), /*#__PURE__*/React.createElement("label", {
    style: labelStyle("phone", phone.length > 0)
  }, "Phone number *")), /*#__PURE__*/React.createElement("div", {
    style: fieldStyle("email")
  }, /*#__PURE__*/React.createElement("input", {
    value: email,
    onChange: e => setEmail(e.target.value),
    onFocus: () => setFocused("email"),
    onBlur: () => setFocused(null),
    style: inputStyle("email"),
    placeholder: " ",
    type: "email"
  }), /*#__PURE__*/React.createElement("label", {
    style: labelStyle("email", email.length > 0)
  }, "Email (optional)"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
      padding: "16px",
      background: "#F9E9EA",
      borderRadius: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: ".045em",
      textTransform: "uppercase",
      color: "#524344"
    }
  }, "Consents"), [[gdpr, setGdpr, "I consent to processing of my personal data", true], [terms, setTerms, "I accept the terms of service", true], [notif, setNotif, "I want to receive appointment notifications", false]].map(([val, set, label, req], i) => /*#__PURE__*/React.createElement("label", {
    key: i,
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      cursor: "pointer",
      fontSize: 13,
      color: "#211A1B",
      lineHeight: 1.5
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => set(!val),
    style: {
      width: 18,
      height: 18,
      borderRadius: 4,
      flexShrink: 0,
      marginTop: 1,
      border: val ? "none" : "1.5px solid #857374",
      background: val ? "#8B4A58" : "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 150ms",
      cursor: "pointer"
    }
  }, val && /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "3"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }))), label, req && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#BA1A1A"
    }
  }, " *")))), /*#__PURE__*/React.createElement("button", {
    disabled: !ok,
    onClick: () => onSubmit({
      name,
      phone,
      email
    }),
    style: {
      height: 48,
      borderRadius: 9999,
      border: "none",
      fontFamily: "inherit",
      background: ok ? "#8B4A58" : "#EDE1E1",
      color: ok ? "#fff" : "#857374",
      fontSize: 15,
      fontWeight: 500,
      letterSpacing: ".007em",
      cursor: ok ? "pointer" : "not-allowed",
      transition: "all 200ms",
      boxShadow: ok ? "0 2px 8px rgba(139,74,88,.2)" : "none"
    }
  }, "Book appointment"));
}
Object.assign(window, {
  BookingForm
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client/BookingForm.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client/BookingSuccess.jsx
try { (() => {
// BookingSuccess.jsx — M3 confirmation screen

function BookingSuccess({
  master,
  procedure,
  dateTime,
  clientName,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 400,
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#FFD9DC",
      borderRadius: 28,
      padding: "32px 24px",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 72,
      height: 72,
      borderRadius: "50%",
      background: "#8B4A58",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "36",
    height: "36",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 28,
      fontWeight: 400,
      color: "#3B0017",
      lineHeight: 1.28
    }
  }, "Appointment booked!"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "#8B4A58",
      marginTop: 8
    }
  }, "See you soon, ", clientName, " \uD83C\uDF38"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#FFF0F1",
      borderRadius: 20,
      overflow: "hidden"
    }
  }, [["Service", procedure.name], ["Master", master.name], ["Date", `${dateTime.day.label} ${dateTime.day.num} April 2025`], ["Time", dateTime.slot], ["Price", `${procedure.price} PLN`]].map(([k, v], i, arr) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "14px 20px",
      borderBottom: i < arr.length - 1 ? "1px solid #EDE1E1" : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "#524344"
    }
  }, k), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: "#211A1B"
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#857374",
      textAlign: "center",
      lineHeight: 1.5
    }
  }, "A confirmation will be sent to your email address."), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      height: 48,
      borderRadius: 9999,
      border: "1px solid #D8C2C3",
      fontFamily: "inherit",
      background: "transparent",
      color: "#8B4A58",
      fontSize: 15,
      fontWeight: 500,
      letterSpacing: ".007em",
      cursor: "pointer",
      transition: "background 150ms"
    },
    onMouseEnter: e => e.currentTarget.style.background = "#FFF0F1",
    onMouseLeave: e => e.currentTarget.style.background = "transparent"
  }, "Book another visit"));
}
Object.assign(window, {
  BookingSuccess
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client/BookingSuccess.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client/MasterSelector.jsx
try { (() => {
// MasterSelector.jsx — M3 client booking: choose master

const MASTERS = [{
  id: "olga",
  name: "Olga",
  avatar: "../../assets/photo_master_olga.png",
  spec: "Facial massage specialist",
  bookings: 48
}, {
  id: "yuliia",
  name: "Yuliia",
  avatar: "../../assets/photo_master_yuliia.png",
  spec: "Lymphatic drainage expert",
  bookings: 37
}];
function MasterSelector({
  onSelect
}) {
  const [hovered, setHovered] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 400,
      display: "flex",
      flexDirection: "column",
      gap: 28,
      padding: "0 4px"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      fontWeight: 400,
      color: "#211A1B",
      lineHeight: 1.25,
      letterSpacing: 0
    }
  }, "Book a visit"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "#524344",
      marginTop: 8,
      letterSpacing: ".018em"
    }
  }, "Choose your master to get started")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, MASTERS.map(m => /*#__PURE__*/React.createElement("button", {
    key: m.id,
    onClick: () => onSelect(m),
    onMouseEnter: () => setHovered(m.id),
    onMouseLeave: () => setHovered(null),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      background: hovered === m.id ? "#F3E3E4" : "#FFF0F1",
      border: "none",
      borderRadius: 20,
      padding: "16px 20px",
      cursor: "pointer",
      textAlign: "left",
      width: "100%",
      fontFamily: "inherit",
      transition: "all 200ms",
      boxShadow: hovered === m.id ? "0 2px 8px rgba(139,74,88,.12)" : "0 1px 2px rgba(0,0,0,.06)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: m.avatar,
    alt: m.name,
    style: {
      width: 60,
      height: 60,
      borderRadius: "50%",
      objectFit: "cover",
      border: "3px solid #FFD9DC",
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 500,
      color: "#211A1B",
      letterSpacing: ".009em"
    }
  }, m.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#524344",
      marginTop: 3
    }
  }, m.spec), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#857374",
      marginTop: 4
    }
  }, m.bookings, " happy clients")), /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#8B4A58",
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "9 18 15 12 9 6"
  }))))));
}
Object.assign(window, {
  MasterSelector,
  MASTERS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client/MasterSelector.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client/pages.jsx
try { (() => {
// pages.jsx — All client app pages
// Requires: shared.jsx loaded first

const {
  useState,
  useEffect,
  useMemo
} = React;
const MASTERS = [{
  id: 'olga',
  name: 'Olga',
  spec: 'Facial massage specialist',
  avatar: '../../assets/photo_master_olga.png',
  bookings: 48
}, {
  id: 'yuliia',
  name: 'Yuliia',
  spec: 'Lymphatic drainage expert',
  avatar: '../../assets/photo_master_yuliia.png',
  bookings: 37
}];
const PROCEDURES = [{
  id: 'p1',
  name: 'Masaż twarzy 60 min',
  price: 180,
  duration: 60
}, {
  id: 'p2',
  name: 'Masaż twarzy 90 min',
  price: 240,
  duration: 90
}, {
  id: 'p3',
  name: 'Drenaż limfatyczny',
  price: 210,
  duration: 75
}, {
  id: 'p4',
  name: 'Peeling enzymatyczny',
  price: 160,
  duration: 50
}];
const CAL_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_DAYS = [[null, null, null, 1, 2, 3, 4], [5, 6, 7, 8, 9, 10, 11], [12, 13, 14, 15, 16, 17, 18], [19, 20, 21, 22, 23, 24, 25], [26, 27, 28, 29, 30, null, null]];
const DISABLED = [1, 3, 10, 17, 24];
const SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
const HISTORY = [{
  date: '15 kw. 2025',
  service: 'Masaż twarzy 60 min',
  master: 'Olga',
  price: 180,
  status: 'completed'
}, {
  date: '22 mar. 2025',
  service: 'Drenaż limfatyczny',
  master: 'Yuliia',
  price: 210,
  status: 'completed'
}, {
  date: '5 lut. 2025',
  service: 'Masaż twarzy 90 min',
  master: 'Olga',
  price: 240,
  status: 'cancelled'
}];

// ── HOME PAGE ─────────────────────────────────────────────
function HomePage({
  onSelectMaster,
  onLogin,
  onProfile,
  isLoggedIn
}) {
  const {
    t,
    dark,
    toggle
  } = useTheme();
  const [hov, setHov] = useState(null);
  const reviews = ['Niesamowita Olga, polecam każdemu! ⭐⭐⭐⭐⭐', 'Yuliia to prawdziwy specjalista, efekty widoczne od razu', 'Bardzo miła atmosfera i profesjonalne podejście', 'Już 5. wizyta i jeszcze wróce! Polecam serdecznie.', 'Rewelacyjny masaż twarzy, skóra wygląda pięknie'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: t.bgGrad,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Roboto,sans-serif'
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 30,
      background: t.nav,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${t.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1200,
      margin: '0 auto',
      padding: '0 32px',
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement(LogoImg, {
    height: 30,
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(LangBtn, null), /*#__PURE__*/React.createElement(ThemeToggleBtn, null), /*#__PURE__*/React.createElement(UserAvatarBtn, {
    onLogin: onLogin,
    onProfile: onProfile,
    isLoggedIn: isLoggedIn
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 24px 32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 48
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      color: t.primary,
      marginBottom: 12
    }
  }, "Salon Somique Beauty"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'clamp(2rem,5vw,3rem)',
      fontWeight: 400,
      color: t.text,
      margin: 0,
      lineHeight: 1.2
    }
  }, "Zarezerwuj wizyt\u0119"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16,
      color: t.textSub,
      marginTop: 12,
      maxWidth: 460,
      lineHeight: 1.6
    }
  }, "Wybierz swojego mistrza i um\xF3w si\u0119 na zabieg w kilka sekund")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      flexWrap: 'wrap',
      justifyContent: 'center',
      maxWidth: 720,
      width: '100%'
    }
  }, MASTERS.map(m => /*#__PURE__*/React.createElement("button", {
    key: m.id,
    onClick: () => onSelectMaster(m),
    onMouseEnter: () => setHov(m.id),
    onMouseLeave: () => setHov(null),
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 14,
      background: hov === m.id ? t.cardHov : t.card,
      border: `1px solid ${t.border}`,
      borderRadius: 20,
      padding: '28px 32px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'all 200ms',
      boxShadow: hov === m.id ? t.shadow2 : t.shadow,
      transform: hov === m.id ? 'translateY(-2px)' : 'none',
      minWidth: 260,
      flex: 1,
      maxWidth: 320
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: m.avatar,
    alt: m.name,
    style: {
      width: 88,
      height: 88,
      borderRadius: '50%',
      objectFit: 'cover',
      border: `3px solid ${t.priCont}`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 500,
      color: t.text
    }
  }, m.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: t.textSub,
      marginTop: 4
    }
  }, m.spec), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: t.textMut,
      marginTop: 6
    }
  }, m.bookings, " clients served")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 36,
      padding: '0 16px',
      borderRadius: 9999,
      background: t.primary,
      color: t.onPri,
      fontSize: 13,
      fontWeight: 500,
      width: '100%',
      justifyContent: 'center'
    }
  }, "Book now", /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "9 18 15 12 9 6"
  }))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: 'hidden',
      padding: '20px 0',
      borderTop: `1px solid ${t.border}`,
      background: t.surface
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 32,
      animation: 'marquee 28s linear infinite',
      whiteSpace: 'nowrap',
      paddingLeft: '100%'
    }
  }, [...reviews, ...reviews].map((r, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontSize: 13,
      color: t.textSub,
      flexShrink: 0
    }
  }, "\"", r, "\"")))), /*#__PURE__*/React.createElement("style", null, `@keyframes marquee { from { transform:translateX(0) } to { transform:translateX(-50%) } }`), /*#__PURE__*/React.createElement("footer", {
    style: {
      padding: '16px 32px',
      borderTop: `1px solid ${t.border}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: 11,
      color: t.textMut,
      flexWrap: 'wrap',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2025 Somique Beauty"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16
    }
  }, ['Privacy Policy', 'Terms of Service', 'Help Center'].map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: {
      color: t.textMut,
      textDecoration: 'underline'
    }
  }, l)))));
}

// ── BOOKING PAGE (2-col desktop) ──────────────────────────
function BookingPage({
  master,
  onBack,
  onLogin,
  onProfile,
  isLoggedIn
}) {
  const {
    t,
    dark,
    toggle
  } = useTheme();
  const [month, setMonth] = useState('April 2025');
  const [selDay, setSelDay] = useState(null);
  const [selProc, setSelProc] = useState('');
  const [selSlot, setSelSlot] = useState(null);
  const [showSlots, setShowSlots] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState('booking'); // booking | success

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gdpr, setGdpr] = useState(false);
  const [terms, setTerms] = useState(false);
  const [focused, setFocused] = useState(null);
  const proc = PROCEDURES.find(p => p.id === selProc);
  const canBook = name.length >= 2 && phone.length >= 9 && gdpr && terms && selProc && selDay && selSlot;
  const iStyle = id => ({
    width: '100%',
    height: 48,
    padding: focused === id || ['name', 'phone', 'email'].includes(id) ? '14px 14px 4px' : '0 14px',
    background: t.input,
    border: 'none',
    borderBottom: `${focused === id ? 2 : 1}px solid ${focused === id ? t.primary : t.outline}`,
    borderRadius: '4px 4px 0 0',
    fontFamily: 'Roboto,sans-serif',
    fontSize: 14,
    color: t.text,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border 150ms'
  });
  const lStyle = (id, hasVal) => ({
    position: 'absolute',
    top: focused === id || hasVal ? 6 : 15,
    left: 14,
    fontSize: focused === id || hasVal ? 10 : 14,
    color: focused === id ? t.primary : t.textMut,
    pointerEvents: 'none',
    transition: 'all 150ms',
    fontFamily: 'Roboto,sans-serif',
    fontWeight: focused === id || hasVal ? 500 : 400
  });
  if (step === 'success') {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: '100vh',
        background: t.bgGrad,
        fontFamily: 'Roboto,sans-serif',
        display: 'flex',
        flexDirection: 'column'
      }
    }, /*#__PURE__*/React.createElement(BookingTopBar, {
      master: master,
      onBack: onBack,
      onLogin: onLogin,
      onProfile: onProfile,
      isLoggedIn: isLoggedIn
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 400,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: t.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: "40",
      height: "40",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "2.5"
    }, /*#__PURE__*/React.createElement("polyline", {
      points: "20 6 9 17 4 12"
    }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 28,
        fontWeight: 400,
        color: t.text
      }
    }, "Appointment booked!"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: t.textSub,
        marginTop: 8
      }
    }, "See you soon, ", name, "!")), /*#__PURE__*/React.createElement("div", {
      style: {
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        padding: '16px 20px',
        width: '100%',
        textAlign: 'left'
      }
    }, [[proc?.name, 'Service'], [master.name, 'Master'], [`${selDay} April · ${selSlot}`, 'Date & Time'], [`${proc?.price} PLN`, 'Price']].map(([v, k]) => /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: `1px solid ${t.border}`
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: t.textMut
      }
    }, k), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 500,
        color: t.text
      }
    }, v)))), /*#__PURE__*/React.createElement("button", {
      onClick: onBack,
      style: {
        height: 44,
        padding: '0 32px',
        borderRadius: 9999,
        border: `1px solid ${t.outline}`,
        background: 'transparent',
        color: t.primary,
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit'
      }
    }, "Back to home"))));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: t.bgGrad,
      fontFamily: 'Roboto,sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement(BookingTopBar, {
    master: master,
    onBack: onBack,
    onLogin: onLogin,
    onProfile: onProfile,
    isLoggedIn: isLoggedIn
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      padding: '28px 24px 20px'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: master.avatar,
    alt: master.name,
    style: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      objectFit: 'cover',
      border: `3px solid ${t.priCont}`,
      boxShadow: t.shadow
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 28,
      fontWeight: 400,
      color: t.text,
      margin: 0
    }
  }, "Book a visit")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: 20,
      padding: '0 24px 40px',
      flexWrap: 'wrap',
      maxWidth: 900,
      margin: '0 auto',
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: t.card,
      border: `1px solid ${t.border}`,
      borderRadius: 16,
      padding: '20px',
      minWidth: 320,
      flex: '0 0 340px',
      boxShadow: t.shadow
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      border: `1px solid ${t.outline}`,
      background: 'transparent',
      cursor: 'pointer',
      color: t.textSub,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 500,
      color: t.text
    }
  }, month), /*#__PURE__*/React.createElement("button", {
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      border: `1px solid ${t.outline}`,
      background: 'transparent',
      cursor: 'pointer',
      color: t.textSub,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "9 18 15 12 9 6"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7,1fr)',
      marginBottom: 4
    }
  }, CAL_DAYS.map(d => /*#__PURE__*/React.createElement("div", {
    key: d,
    style: {
      textAlign: 'center',
      fontSize: 11,
      fontWeight: 500,
      color: t.textMut,
      padding: '4px 0'
    }
  }, d))), MONTH_DAYS.map((week, wi) => /*#__PURE__*/React.createElement("div", {
    key: wi,
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7,1fr)',
      gap: 2
    }
  }, week.map((day, di) => {
    const disabled = !day || !selProc || DISABLED.includes(day);
    const selected = day !== null && selDay === day;
    return /*#__PURE__*/React.createElement("button", {
      key: di,
      disabled: disabled,
      onClick: () => {
        setSelDay(day);
        setSelSlot(null);
      },
      style: {
        width: '100%',
        aspectRatio: '1',
        borderRadius: '50%',
        border: 'none',
        background: selected ? t.primary : 'transparent',
        color: selected ? t.onPri : disabled ? t.outline : t.text,
        fontSize: 13,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        transition: 'all 150ms'
      }
    }, day || '');
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      fontSize: 12,
      color: t.textMut
    }
  }, !selProc ? 'First, select a service' : !selDay ? 'Now select a date' : 'Great! Pick a time slot')), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 300px',
      minWidth: 280,
      maxWidth: 380,
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: t.card,
      border: `1px solid ${t.border}`,
      borderRadius: 16,
      padding: '18px 20px',
      boxShadow: t.shadow
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: t.text,
      marginBottom: 12
    }
  }, "Service"), /*#__PURE__*/React.createElement("select", {
    value: selProc,
    onChange: e => {
      setSelProc(e.target.value);
      setSelDay(null);
      setSelSlot(null);
    },
    style: {
      width: '100%',
      height: 44,
      padding: '0 14px',
      border: `1px solid ${t.outline}`,
      borderRadius: 10,
      background: t.surface,
      color: t.text,
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: 'pointer',
      appearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23857374' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 14px center'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Select a service"), PROCEDURES.map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: p.id
  }, p.name, " \u2014 ", p.price, " z\u0142")))), selDay && selProc && /*#__PURE__*/React.createElement("div", {
    style: {
      background: t.card,
      border: `1px solid ${t.border}`,
      borderRadius: 16,
      padding: '18px 20px',
      boxShadow: t.shadow
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: t.text,
      marginBottom: 10
    }
  }, "Available slots \u2014 ", selDay, " April"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 8
    }
  }, SLOTS.map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    onClick: () => {
      setSelSlot(s);
      setShowForm(true);
    },
    style: {
      padding: '8px 0',
      borderRadius: 9,
      border: 'none',
      fontFamily: 'inherit',
      cursor: 'pointer',
      background: selSlot === s ? t.primary : t.surface,
      color: selSlot === s ? t.onPri : t.text,
      fontSize: 12,
      fontWeight: 500,
      transition: 'all 150ms'
    }
  }, s)))), showForm && selSlot && /*#__PURE__*/React.createElement("div", {
    style: {
      background: t.card,
      border: `1px solid ${t.border}`,
      borderRadius: 16,
      padding: '18px 20px',
      boxShadow: t.shadow
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: t.text,
      marginBottom: 14
    }
  }, "Your details"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginBottom: 14
    }
  }, [['name', 'Full name', name, setName], ['phone', 'Phone', phone, setPhone], ['email', 'Email (optional)', email, setEmail]].map(([id, label, val, setter]) => /*#__PURE__*/React.createElement("div", {
    key: id,
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: val,
    onChange: e => setter(e.target.value),
    onFocus: () => setFocused(id),
    onBlur: () => setFocused(null),
    placeholder: " ",
    type: id === 'email' ? 'email' : id === 'phone' ? 'tel' : 'text',
    style: {
      width: '100%',
      height: 48,
      padding: '14px 14px 4px',
      background: t.input,
      border: 'none',
      borderBottom: `${focused === id ? 2 : 1}px solid ${focused === id ? t.primary : t.outline}`,
      borderRadius: '4px 4px 0 0',
      fontFamily: 'Roboto,sans-serif',
      fontSize: 14,
      color: t.text,
      outline: 'none',
      boxSizing: 'border-box',
      transition: 'border 150ms'
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      position: 'absolute',
      top: focused === id || val.length > 0 ? 6 : 15,
      left: 14,
      fontSize: focused === id || val.length > 0 ? 10 : 14,
      color: focused === id ? t.primary : t.textMut,
      pointerEvents: 'none',
      transition: 'all 150ms',
      fontFamily: 'Roboto,sans-serif',
      fontWeight: focused === id || val.length > 0 ? 500 : 400
    }
  }, label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginBottom: 16
    }
  }, [[gdpr, setGdpr, 'I consent to processing of my personal data', true], [terms, setTerms, 'I accept the terms of service', true]].map(([v, s, l, req], i) => /*#__PURE__*/React.createElement("label", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      cursor: 'pointer',
      fontSize: 12,
      color: t.textSub,
      lineHeight: 1.4
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => s(!v),
    style: {
      width: 16,
      height: 16,
      borderRadius: 3,
      background: v ? t.primary : 'transparent',
      border: v ? 'none' : `1.5px solid ${t.outline}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginTop: 1,
      cursor: 'pointer'
    }
  }, v && /*#__PURE__*/React.createElement("svg", {
    width: "10",
    height: "10",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "3"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }))), l, req && /*#__PURE__*/React.createElement("span", {
    style: {
      color: t.error
    }
  }, " *")))), /*#__PURE__*/React.createElement("button", {
    disabled: !canBook,
    onClick: () => setStep('success'),
    style: {
      width: '100%',
      height: 44,
      borderRadius: 9999,
      border: 'none',
      background: canBook ? t.primary : t.surfaceHi,
      color: canBook ? t.onPri : t.textMut,
      fontSize: 14,
      fontWeight: 500,
      cursor: canBook ? 'pointer' : 'not-allowed',
      fontFamily: 'inherit',
      transition: 'all 200ms',
      letterSpacing: '.007em'
    }
  }, "Book appointment")), !showForm && /*#__PURE__*/React.createElement("div", {
    style: {
      background: t.card,
      border: `1px solid ${t.border}`,
      borderRadius: 16,
      padding: '18px 20px',
      boxShadow: t.shadow
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: t.text
    }
  }, "Manage booking"), /*#__PURE__*/React.createElement("button", {
    style: {
      fontSize: 11,
      color: t.primary,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'inherit'
    }
  }, "Close panel")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: t.textSub,
      marginBottom: 12
    }
  }, "Enter your details to find your booking:"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, [['', 'Full name'], ['', 'Phone']].map(([v, p], i) => /*#__PURE__*/React.createElement("input", {
    key: i,
    placeholder: p,
    style: {
      width: '100%',
      height: 40,
      padding: '0 14px',
      background: 'transparent',
      border: `1px solid ${t.outline}`,
      borderRadius: 8,
      fontSize: 13,
      color: t.text,
      fontFamily: 'inherit',
      outline: 'none',
      boxSizing: 'border-box'
    }
  })), /*#__PURE__*/React.createElement("button", {
    style: {
      height: 40,
      borderRadius: 9999,
      border: 'none',
      background: t.primary,
      color: t.onPri,
      fontSize: 13,
      fontWeight: 500,
      cursor: 'pointer',
      fontFamily: 'inherit',
      opacity: .6
    }
  }, "Search bookings"))))), /*#__PURE__*/React.createElement("footer", {
    style: {
      padding: '14px 32px',
      borderTop: `1px solid ${t.border}`,
      textAlign: 'center',
      fontSize: 11,
      color: t.textMut
    }
  }, "Privacy Policy \xB7 Terms of Service \xB7 Help Center | \xA9 2025 Somique Beauty. All rights reserved."));
}
function BookingTopBar({
  master,
  onBack,
  onLogin,
  onProfile,
  isLoggedIn
}) {
  const {
    t,
    dark
  } = useTheme();
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 30,
      background: t.nav,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${t.border}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 900,
      margin: '0 auto',
      padding: '0 24px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      height: 32,
      padding: '0 14px 0 8px',
      borderRadius: 9999,
      border: `1px solid ${t.outline}`,
      background: 'transparent',
      cursor: 'pointer',
      color: t.text,
      fontSize: 13,
      fontWeight: 500,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  })), "Back"), /*#__PURE__*/React.createElement(LogoImg, {
    height: 24,
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(LangBtn, null), /*#__PURE__*/React.createElement(ThemeToggleBtn, null), /*#__PURE__*/React.createElement(UserAvatarBtn, {
    onLogin: onLogin,
    onProfile: onProfile,
    isLoggedIn: isLoggedIn
  }))));
}

// ── LOGIN PAGE ────────────────────────────────────────────
function LoginPage({
  onBack,
  onRegister,
  onLoggedIn
}) {
  const {
    t,
    dark
  } = useTheme();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [focused, setFocused] = useState(null);
  const fields = [['email', 'Email', 'email', email, setEmail], ['pass', 'Password', 'password', pass, setPass]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: t.bgGrad,
      fontFamily: 'Roboto,sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 30,
      background: t.nav,
      backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${t.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 480,
      margin: '0 auto',
      padding: '0 24px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      height: 32,
      padding: '0 14px 0 8px',
      borderRadius: 9999,
      border: `1px solid ${t.outline}`,
      background: 'transparent',
      cursor: 'pointer',
      color: t.text,
      fontSize: 13,
      fontWeight: 500,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  })), "Back"), /*#__PURE__*/React.createElement(LogoImg, {
    height: 24,
    dark: dark
  }), /*#__PURE__*/React.createElement(ThemeToggleBtn, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: t.card,
      border: `1px solid ${t.border}`,
      borderRadius: 20,
      padding: '36px 32px',
      width: '100%',
      maxWidth: 400,
      boxShadow: t.shadow2
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 24,
      fontWeight: 400,
      color: t.text,
      margin: '0 0 6px'
    }
  }, "Sign in"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: t.textSub,
      margin: '0 0 28px'
    }
  }, "Welcome back to Somique Beauty"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      marginBottom: 20
    }
  }, fields.map(([id, label, type, val, setter]) => /*#__PURE__*/React.createElement("div", {
    key: id,
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: val,
    onChange: e => setter(e.target.value),
    onFocus: () => setFocused(id),
    onBlur: () => setFocused(null),
    type: type,
    placeholder: " ",
    style: {
      width: '100%',
      height: 52,
      padding: '16px 14px 6px',
      background: t.input,
      border: 'none',
      borderBottom: `${focused === id ? 2 : 1}px solid ${focused === id ? t.primary : t.outline}`,
      borderRadius: '4px 4px 0 0',
      fontFamily: 'Roboto,sans-serif',
      fontSize: 14,
      color: t.text,
      outline: 'none',
      boxSizing: 'border-box',
      transition: 'border 150ms'
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      position: 'absolute',
      top: focused === id || val.length > 0 ? 6 : 16,
      left: 14,
      fontSize: focused === id || val.length > 0 ? 10 : 14,
      color: focused === id ? t.primary : t.textMut,
      pointerEvents: 'none',
      transition: 'all 150ms'
    }
  }, label)))), /*#__PURE__*/React.createElement("button", {
    onClick: onLoggedIn,
    style: {
      width: '100%',
      height: 48,
      borderRadius: 9999,
      border: 'none',
      background: t.primary,
      color: t.onPri,
      fontSize: 15,
      fontWeight: 500,
      cursor: 'pointer',
      fontFamily: 'inherit',
      marginBottom: 16
    }
  }, "Sign in"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      fontSize: 13,
      color: t.textSub
    }
  }, "No account?", ' ', /*#__PURE__*/React.createElement("button", {
    onClick: onRegister,
    style: {
      background: 'none',
      border: 'none',
      color: t.primary,
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: 13,
      fontWeight: 500,
      textDecoration: 'underline'
    }
  }, "Create one")))));
}

// ── REGISTER PAGE ─────────────────────────────────────────
function RegisterPage({
  onBack,
  onLogin
}) {
  const {
    t,
    dark
  } = useTheme();
  const [focused, setFocused] = useState(null);
  const fields = [['name', 'Full name', 'text'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['pass', 'Password', 'password']];
  const [vals, setVals] = useState({
    name: '',
    email: '',
    phone: '',
    pass: ''
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: t.bgGrad,
      fontFamily: 'Roboto,sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 30,
      background: t.nav,
      backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${t.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 480,
      margin: '0 auto',
      padding: '0 24px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      height: 32,
      padding: '0 14px 0 8px',
      borderRadius: 9999,
      border: `1px solid ${t.outline}`,
      background: 'transparent',
      cursor: 'pointer',
      color: t.text,
      fontSize: 13,
      fontWeight: 500,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  })), "Back"), /*#__PURE__*/React.createElement(LogoImg, {
    height: 24,
    dark: dark
  }), /*#__PURE__*/React.createElement(ThemeToggleBtn, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: t.card,
      border: `1px solid ${t.border}`,
      borderRadius: 20,
      padding: '36px 32px',
      width: '100%',
      maxWidth: 400,
      boxShadow: t.shadow2
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 24,
      fontWeight: 400,
      color: t.text,
      margin: '0 0 6px'
    }
  }, "Create account"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: t.textSub,
      margin: '0 0 28px'
    }
  }, "Quick and easy \u2014 book faster next time"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      marginBottom: 20
    }
  }, fields.map(([id, label, type]) => /*#__PURE__*/React.createElement("div", {
    key: id,
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: vals[id],
    onChange: e => setVals(v => ({
      ...v,
      [id]: e.target.value
    })),
    onFocus: () => setFocused(id),
    onBlur: () => setFocused(null),
    type: type,
    placeholder: " ",
    style: {
      width: '100%',
      height: 52,
      padding: '16px 14px 6px',
      background: t.input,
      border: 'none',
      borderBottom: `${focused === id ? 2 : 1}px solid ${focused === id ? t.primary : t.outline}`,
      borderRadius: '4px 4px 0 0',
      fontFamily: 'Roboto,sans-serif',
      fontSize: 14,
      color: t.text,
      outline: 'none',
      boxSizing: 'border-box',
      transition: 'border 150ms'
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      position: 'absolute',
      top: focused === id || vals[id].length > 0 ? 6 : 16,
      left: 14,
      fontSize: focused === id || vals[id].length > 0 ? 10 : 14,
      color: focused === id ? t.primary : t.textMut,
      pointerEvents: 'none',
      transition: 'all 150ms'
    }
  }, label)))), /*#__PURE__*/React.createElement("button", {
    onClick: onLogin,
    style: {
      width: '100%',
      height: 48,
      borderRadius: 9999,
      border: 'none',
      background: t.primary,
      color: t.onPri,
      fontSize: 15,
      fontWeight: 500,
      cursor: 'pointer',
      fontFamily: 'inherit',
      marginBottom: 16
    }
  }, "Create account"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      fontSize: 13,
      color: t.textSub
    }
  }, "Have an account?", ' ', /*#__PURE__*/React.createElement("button", {
    onClick: onLogin,
    style: {
      background: 'none',
      border: 'none',
      color: t.primary,
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: 13,
      fontWeight: 500,
      textDecoration: 'underline'
    }
  }, "Sign in")))));
}

// ── PROFILE / CLIENT CABINET ──────────────────────────────
function ProfilePage({
  onBack,
  onLogout
}) {
  const {
    t
  } = useTheme();
  const [tab, setTab] = useState('history');
  const STATUS = {
    completed: {
      bg: t.sucCont,
      color: t.success,
      label: 'Completed'
    },
    cancelled: {
      bg: t.errCont,
      color: t.error,
      label: 'Cancelled'
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: t.bgGrad,
      fontFamily: 'Roboto,sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 30,
      background: t.nav,
      backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${t.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 700,
      margin: '0 auto',
      padding: '0 24px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      height: 32,
      padding: '0 14px 0 8px',
      borderRadius: 9999,
      border: `1px solid ${t.outline}`,
      background: 'transparent',
      cursor: 'pointer',
      color: t.text,
      fontSize: 13,
      fontWeight: 500,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  })), "Back"), /*#__PURE__*/React.createElement(ThemeToggleBtn, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 700,
      margin: '0 auto',
      padding: '32px 24px',
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      background: t.card,
      border: `1px solid ${t.border}`,
      borderRadius: 20,
      padding: '24px 28px',
      marginBottom: 24,
      boxShadow: t.shadow
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      background: t.primary,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: t.onPri,
      fontSize: 24,
      fontWeight: 400,
      flexShrink: 0
    }
  }, "A"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 500,
      color: t.text
    }
  }, "Anna Kowalska"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: t.textSub,
      marginTop: 2
    }
  }, "anna@example.com \xB7 +48 600 000 000")), /*#__PURE__*/React.createElement("button", {
    onClick: onLogout,
    style: {
      height: 36,
      padding: '0 16px',
      borderRadius: 9999,
      border: `1px solid ${t.outline}`,
      background: 'transparent',
      color: t.textSub,
      fontSize: 12,
      cursor: 'pointer',
      fontFamily: 'inherit'
    }
  }, "Sign out")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginBottom: 20,
      background: t.surface,
      borderRadius: 12,
      padding: 4,
      border: `1px solid ${t.border}`
    }
  }, [['history', 'Appointments'], ['gdpr', 'Privacy & GDPR']].map(([id, label]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => setTab(id),
    style: {
      flex: 1,
      height: 36,
      borderRadius: 9,
      border: 'none',
      background: tab === id ? t.card : 'transparent',
      color: tab === id ? t.text : t.textMut,
      fontSize: 13,
      fontWeight: tab === id ? 500 : 400,
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'all 150ms',
      boxShadow: tab === id ? t.shadow : 'none'
    }
  }, label))), tab === 'history' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, HISTORY.map((h, i) => {
    const s = STATUS[h.status];
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: t.shadow
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 500,
        color: t.text
      }
    }, h.service), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: t.textSub,
        marginTop: 3
      }
    }, h.master, " \xB7 ", h.date)), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'right',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 500,
        color: t.text,
        marginBottom: 4
      }
    }, h.price, " z\u0142"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 500,
        padding: '3px 10px',
        borderRadius: 9999,
        background: s.bg,
        color: s.color
      }
    }, s.label)), h.status === 'completed' && /*#__PURE__*/React.createElement("button", {
      style: {
        height: 36,
        padding: '0 14px',
        borderRadius: 9999,
        border: 'none',
        background: t.priCont,
        color: t.onPriCont,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        flexShrink: 0
      }
    }, "Repeat"));
  })), tab === 'gdpr' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, [['Export my data', 'Download a copy of all your personal data', 'Export'], ['Delete my account', 'Permanently remove all your data from our systems', 'Delete'], ['Withdraw consent', 'Manage your data processing consents', 'Manage']].map(([title, desc, action]) => /*#__PURE__*/React.createElement("div", {
    key: title,
    style: {
      background: t.card,
      border: `1px solid ${t.border}`,
      borderRadius: 16,
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      boxShadow: t.shadow
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: t.text
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: t.textSub,
      marginTop: 3
    }
  }, desc)), /*#__PURE__*/React.createElement("button", {
    style: {
      height: 36,
      padding: '0 16px',
      borderRadius: 9999,
      border: `1px solid ${action === 'Delete' ? t.error : t.outline}`,
      background: 'transparent',
      color: action === 'Delete' ? t.error : t.primary,
      fontSize: 12,
      fontWeight: 500,
      cursor: 'pointer',
      fontFamily: 'inherit',
      flexShrink: 0
    }
  }, action))))));
}
Object.assign(window, {
  HomePage,
  BookingPage,
  LoginPage,
  RegisterPage,
  ProfilePage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client/pages.jsx", error: String((e && e.message) || e) }); }

// ui_kits/client/shared.jsx
try { (() => {
// shared.jsx — Theme system + shared micro-components
// Somique Beauty — must load first

const {
  useState,
  useEffect,
  useContext,
  createContext
} = React;

// ── Theme tokens ──────────────────────────────────────────
const T = {
  light: {
    bg: '#FFF8F6',
    bgGrad: 'radial-gradient(ellipse 140% 55% at 15% -5%, #FFD9DC 0%, #FFF8F6 58%)',
    nav: 'rgba(255,248,246,.92)',
    card: '#FFFFFF',
    cardHov: '#FFF5F5',
    surface: '#FFF0F1',
    surfaceHi: '#F3E3E4',
    border: '#EDE1E1',
    text: '#211A1B',
    textSub: '#524344',
    textMut: '#857374',
    primary: '#8B4A58',
    priCont: '#FFD9DC',
    onPri: '#FFFFFF',
    onPriCont: '#3B0017',
    secCont: '#FFDCCA',
    onSecCont: '#2F1509',
    input: '#EDE1E1',
    outline: '#D8C2C3',
    shadow: '0 1px 3px rgba(0,0,0,.08)',
    shadow2: '0 2px 8px rgba(0,0,0,.1)',
    success: '#21A67A',
    sucCont: '#B7F2DC',
    error: '#BA1A1A',
    errCont: '#FFDAD6'
  },
  dark: {
    bg: '#9C6849',
    bgGrad: 'radial-gradient(ellipse 140% 55% at 15% -5%, #6A3020 0%, #9C6849 60%)',
    nav: 'rgba(26,16,10,.88)',
    card: '#221810',
    cardHov: '#2E1E14',
    surface: '#2E1E14',
    surfaceHi: '#3A2820',
    border: '#4A3028',
    text: '#FFEEE8',
    textSub: '#CCA898',
    textMut: '#906858',
    primary: '#FFB2B8',
    priCont: '#723340',
    onPri: '#3B0017',
    onPriCont: '#FFD9DC',
    secCont: '#634432',
    onSecCont: '#FFDCCA',
    input: '#3A2820',
    outline: '#5A3828',
    shadow: '0 2px 8px rgba(0,0,0,.25)',
    shadow2: '0 4px 16px rgba(0,0,0,.3)',
    success: '#6EDDAC',
    sucCont: '#003824',
    error: '#FFB4AB',
    errCont: '#93000A'
  }
};
const ThemeCtx = createContext({
  dark: false,
  toggle: () => {},
  t: T.light
});
const useTheme = () => useContext(ThemeCtx);
function ThemeProvider({
  children
}) {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('sb-theme') === 'dark';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('sb-theme', dark ? 'dark' : 'light');
    } catch {}
  }, [dark]);
  const t = dark ? T.dark : T.light;
  return /*#__PURE__*/React.createElement(ThemeCtx.Provider, {
    value: {
      dark,
      toggle: () => setDark(d => !d),
      t
    }
  }, children);
}

// ── Shared micro-components ───────────────────────────────
function ThemeToggleBtn() {
  const {
    dark,
    toggle,
    t
  } = useTheme();
  return /*#__PURE__*/React.createElement("button", {
    onClick: toggle,
    title: "Toggle theme",
    style: {
      width: 36,
      height: 36,
      borderRadius: 9999,
      border: `1px solid ${t.outline}`,
      background: 'transparent',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: t.textSub,
      flexShrink: 0
    }
  }, dark ? /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
  })) : /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  })));
}
function LangBtn() {
  const {
    t
  } = useTheme();
  return /*#__PURE__*/React.createElement("button", {
    style: {
      height: 36,
      padding: '0 12px',
      borderRadius: 9999,
      border: `1px solid ${t.outline}`,
      background: 'transparent',
      color: t.textSub,
      fontSize: 12,
      fontWeight: 500,
      cursor: 'pointer',
      fontFamily: 'inherit'
    }
  }, "PL");
}
function UserAvatarBtn({
  onLogin,
  onProfile,
  isLoggedIn
}) {
  const {
    t
  } = useTheme();
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => isLoggedIn ? onProfile() : onLogin(),
    style: {
      width: 36,
      height: 36,
      borderRadius: 9999,
      border: 'none',
      background: t.primary,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: t.onPri,
      fontSize: 13,
      fontWeight: 500,
      flexShrink: 0
    }
  }, isLoggedIn ? 'A' : /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "7",
    r: "4"
  })));
}
function Chip({
  label,
  color,
  bg
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      height: 28,
      padding: '0 12px',
      borderRadius: 8,
      background: bg,
      color: color,
      fontSize: 12,
      fontWeight: 500
    }
  }, label);
}
function Btn({
  children,
  onClick,
  disabled,
  variant = 'filled',
  style: extraStyle = {}
}) {
  const {
    t
  } = useTheme();
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    padding: '0 24px',
    borderRadius: 9999,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: '.007em',
    transition: 'all 180ms',
    opacity: disabled ? .45 : 1,
    position: 'relative',
    overflow: 'hidden',
    ...extraStyle
  };
  const styles = {
    filled: {
      ...base,
      background: t.primary,
      color: t.onPri,
      boxShadow: disabled ? 'none' : t.shadow
    },
    outlined: {
      ...base,
      background: 'transparent',
      color: t.primary,
      border: `1px solid ${t.outline}`
    },
    tonal: {
      ...base,
      background: t.priCont,
      color: t.onPriCont
    }
  };
  return /*#__PURE__*/React.createElement("button", {
    disabled: disabled,
    onClick: onClick,
    style: styles[variant] || styles.filled
  }, children);
}
function SectionLabel({
  children,
  t
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: '.05em',
      textTransform: 'uppercase',
      color: t.textMut,
      marginBottom: 10
    }
  }, children);
}
function LogoImg({
  height = 32,
  dark: isDark
}) {
  return /*#__PURE__*/React.createElement("img", {
    src: isDark ? '../../assets/head_logo_night.png' : '../../assets/head_logo.png',
    alt: "Somique Beauty",
    style: {
      height,
      width: 'auto',
      display: 'block'
    }
  });
}
Object.assign(window, {
  ThemeProvider,
  useTheme,
  ThemeToggleBtn,
  LangBtn,
  UserAvatarBtn,
  Chip,
  Btn,
  SectionLabel,
  LogoImg,
  T
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/client/shared.jsx", error: String((e && e.message) || e) }); }

})();
