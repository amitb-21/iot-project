import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export default function Charts({ history }) {
  const chartData = history.map((e, i) => ({
    idx: i,
    tilt: e.tilt,
    accel: e.accel,
    impact: e.impact,
  }));

  return (
    <div style={{ marginTop: "30px" }}>
      <h2>Live Telemetry</h2>

      <LineChart width={850} height={300} data={chartData}>
        <CartesianGrid stroke="#444" />
        <XAxis dataKey="idx" />
        <YAxis />
        <Tooltip />
        <Legend />

        <Line type="monotone" dataKey="tilt" stroke="#22c55e" />
        <Line type="monotone" dataKey="accel" stroke="#3b82f6" />
        <Line type="monotone" dataKey="impact" stroke="#ef4444" />
      </LineChart>
    </div>
  );
}
