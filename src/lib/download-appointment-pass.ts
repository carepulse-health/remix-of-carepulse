import { passDownloadFileName } from "@/lib/appointment-pass";

type PassImageDetails = {
  qrCanvas: HTMLCanvasElement;
  referenceCode: string;
  clinicName: string;
  visitDate: string;
  visitTime: string;
  doctorName: string;
};

/** Builds a printable pass image in the browser and downloads it. Nothing is uploaded. */
export async function downloadAppointmentPass(details: PassImageDetails) {
  const width = 640;
  const height = 900;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Pass image could not be created");

  // Printed pass colours (fixed so the file looks the same on any device).
  const paper = "#ffffff";
  const ink = "#0f2e3d";
  const muted = "#5b6b73";
  const accent = "#0f766e";

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, 14);

  ctx.textAlign = "center";
  ctx.fillStyle = ink;
  ctx.font = "bold 34px system-ui, sans-serif";
  ctx.fillText("carepulse.", width / 2, 76);
  ctx.fillStyle = muted;
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillText("APPOINTMENT PASS", width / 2, 110);

  const qrSize = 360;
  ctx.drawImage(details.qrCanvas, (width - qrSize) / 2, 140, qrSize, qrSize);

  ctx.fillStyle = ink;
  ctx.font = "bold 30px ui-monospace, monospace";
  ctx.fillText(details.referenceCode, width / 2, 552);

  const rows: [string, string][] = [
    ["Date", details.visitDate],
    ["Time", details.visitTime],
    ["Doctor", details.doctorName],
    ["Clinic", details.clinicName],
  ];
  ctx.textAlign = "left";
  rows.forEach(([label, value], index) => {
    const y = 620 + index * 52;
    ctx.fillStyle = muted;
    ctx.font = "500 18px system-ui, sans-serif";
    ctx.fillText(label, 70, y);
    ctx.fillStyle = ink;
    ctx.font = "600 20px system-ui, sans-serif";
    ctx.fillText(value.length > 38 ? `${value.slice(0, 37)}…` : value, 190, y);
  });

  ctx.textAlign = "center";
  ctx.fillStyle = muted;
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillText("Show this pass at the clinic front desk. Keep it private.", width / 2, 860);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Pass image could not be created");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = passDownloadFileName(details.referenceCode);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
