/**
 * Smart Queue — Thermal Printer Bridge Server
 *
 * Runs locally on the kiosk machine. Receives print requests from the web app
 * and sends ESC/POS commands to the connected thermal printer.
 *
 * Usage:
 *   cd printer-bridge
 *   npm install
 *   npm start
 *
 * Environment Variables:
 *   PORT             — Server port (default: 3210)
 *   PRINTER_TYPE     — "usb" or "network" (default: "usb")
 *   PRINTER_HOST     — Network printer IP (if PRINTER_TYPE=network)
 *   PRINTER_PORT     — Network printer port (default: 9100)
 *   PAPER_WIDTH      — Paper width in chars: 32 | 42 | 48 (default: 48)
 */

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3210;
const PRINTER_TYPE = process.env.PRINTER_TYPE || "usb";
const PRINTER_HOST = process.env.PRINTER_HOST || "192.168.1.100";
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || "9100", 10);
const PAPER_WIDTH = parseInt(process.env.PAPER_WIDTH || "48", 10);

app.use(cors());
app.use(express.json());

/* ──────────────────── Printer Connection ──────────────────── */

let printerDevice = null;
let printerName = "Thermal Printer";

function getDevice() {
  if (PRINTER_TYPE === "network") {
    try {
      const escposNetwork = require("escpos-network");
      const device = new escposNetwork(PRINTER_HOST, PRINTER_PORT);
      printerName = `Network (${PRINTER_HOST}:${PRINTER_PORT})`;
      return device;
    } catch (err) {
      console.error("Failed to create network device:", err.message);
      return null;
    }
  }

  // USB
  try {
    const escposUsb = require("escpos-usb");
    const device = new escposUsb();
    printerName = "USB Thermal Printer";
    return device;
  } catch (err) {
    console.error("No USB printer found:", err.message);
    return null;
  }
}

/* ──────────────────── ESC/POS Print Logic ──────────────────── */

function printTicket(payload) {
  return new Promise((resolve, reject) => {
    const escpos = require("escpos");
    const device = getDevice();
    if (!device) {
      return reject(new Error("No printer device available"));
    }

    const printer = new escpos.Printer(device, { encoding: "GB18030", width: PAPER_WIDTH });

    device.open((err) => {
      if (err) return reject(err);

      try {
        const {
          organizationName,
          tokenNumber,
          serviceName,
          priorityLevel,
          createdAtIso,
          customerName,
          visitReason,
          trackingUrl,
          estimatedWait,
          customerPhone,
        } = payload;

        const date = createdAtIso
          ? new Date(createdAtIso).toLocaleDateString()
          : new Date().toLocaleDateString();
        const time = createdAtIso
          ? new Date(createdAtIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        const sep = "-".repeat(PAPER_WIDTH);

        printer
          .align("CT")
          .style("B")
          .size(1, 1)
          .text(organizationName || "Smart Queue")
          .style("NORMAL")
          .text(sep)
          .feed(1)
          .align("CT")
          .style("B")
          .size(2, 2)
          .text(tokenNumber || "---")
          .size(1, 1)
          .feed(1)
          .text(sep)
          .align("LT")
          .style("NORMAL");

        printer.text(`Service:  ${serviceName || "General"}`);
        printer.text(`Priority: ${(priorityLevel || "Normal").toUpperCase()}`);

        if (customerName) {
          printer.text(`Name:     ${customerName}`);
        }
        if (customerPhone) {
          printer.text(`Phone:    ${customerPhone}`);
        }
        if (visitReason) {
          printer.text(`Reason:   ${visitReason}`);
        }
        if (estimatedWait) {
          printer.text(`Est Wait: ~${estimatedWait} minutes`);
        }

        printer.text(sep);
        printer.text(`Date: ${date}    Time: ${time}`);
        printer.text(sep);

        if (trackingUrl) {
          printer
            .align("CT")
            .feed(1)
            .text("Scan QR to track your queue:")
            .feed(1);

          // Print QR code if supported
          try {
            printer.qrimage(trackingUrl, { type: "png", mode: "dhdw", size: 6 }, (qrErr) => {
              if (qrErr) {
                // Fallback: print URL as text
                printer.text(trackingUrl);
              }
              finishPrint(printer, device, resolve, reject);
            });
            return; // qrimage is async
          } catch {
            printer.text(trackingUrl);
          }
        }

        finishPrint(printer, device, resolve, reject);
      } catch (printErr) {
        try { device.close(); } catch {}
        reject(printErr);
      }
    });
  });
}

function finishPrint(printer, device, resolve, reject) {
  try {
    printer
      .feed(1)
      .align("CT")
      .style("B")
      .text("Thank you for waiting!")
      .style("NORMAL")
      .feed(3)
      .cut()
      .close();

    resolve({ ok: true, printerName });
  } catch (err) {
    try { device.close(); } catch {}
    reject(err);
  }
}

/* ──────────────────── HTTP Endpoints ──────────────────── */

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    printerName,
    printerType: PRINTER_TYPE,
    paperWidth: PAPER_WIDTH,
    uptime: process.uptime(),
  });
});

app.post("/print-token", async (req, res) => {
  try {
    const result = await printTicket(req.body);
    res.json(result);
  } catch (err) {
    console.error("Print failed:", err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
});

/* ──────────────────── Start Server ──────────────────── */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║   Smart Queue — Printer Bridge v1.0.0        ║
  ║   Listening on http://127.0.0.1:${PORT}        ║
  ║   Printer: ${PRINTER_TYPE.padEnd(34)}║
  ║   Paper:   ${String(PAPER_WIDTH).padEnd(34)}║
  ╚══════════════════════════════════════════════╝
  `);
});
