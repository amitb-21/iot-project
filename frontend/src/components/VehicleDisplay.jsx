export default function VehicleDisplay({ tilt }) {
  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      <div
        style={{
          fontSize: "80px",
          transform: `rotate(${tilt}deg)`,
          transition: "0.2s ease",
        }}
      >
        🚗
      </div>
    </div>
  );
}
