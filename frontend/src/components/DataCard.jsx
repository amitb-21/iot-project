export default function DataCard({ title, value }) {
  return (
    <div
      style={{
        flex: 1,
        background: "#1e293b",
        padding: "20px",
        borderRadius: "10px",
      }}
    >
      <h3>{title}</h3>
      <p style={{ fontSize: "28px", fontWeight: "bold" }}>{value}</p>
    </div>
  );
}
