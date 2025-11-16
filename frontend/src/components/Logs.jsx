export default function Logs({ history }) {
  return (
    <div style={{ marginTop: "30px" }}>
      <h2>Event Logs</h2>
      <div
        style={{
          background: "#1e293b",
          padding: "15px",
          borderRadius: "10px",
          maxHeight: "200px",
          overflowY: "auto",
        }}
      >
        {history.map((e, i) => (
          <p key={i}>
            <b>{i}:</b> Tilt {e.tilt.toFixed(2)}°, Acc {e.accel.toFixed(2)}g,
            Impact {e.impact.toFixed(2)} → {e.crash ? "CRASH" : "OK"}
          </p>
        ))}
      </div>
    </div>
  );
}
