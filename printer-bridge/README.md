# Smart Queue — Thermal Printer Bridge

A lightweight Node.js server that runs locally on your kiosk machine. It receives print requests from the Smart Queue web application and sends ESC/POS commands to your connected thermal printer.

## Requirements

- **Node.js** 18 or later
- **USB Thermal Printer** (58mm or 80mm) — or a **Network Thermal Printer**
- The kiosk machine must be running this bridge alongside the Smart Queue web app

## Quick Start

```bash
cd printer-bridge
npm install
npm start
```

The server will start on `http://127.0.0.1:3210`.

## Configuration

Set these environment variables before running:

| Variable       | Default        | Description                            |
|----------------|----------------|----------------------------------------|
| `PORT`         | `3210`         | Server port                            |
| `PRINTER_TYPE` | `usb`          | `usb` or `network`                     |
| `PRINTER_HOST` | `192.168.1.100`| Network printer IP (if type=network)   |
| `PRINTER_PORT` | `9100`         | Network printer port                   |
| `PAPER_WIDTH`  | `48`           | Characters per line: 32, 42, or 48     |

### Example: USB Printer (most common)

```bash
PRINTER_TYPE=usb npm start
```

### Example: Network Printer

```bash
PRINTER_TYPE=network PRINTER_HOST=192.168.1.50 npm start
```

## Setting the Bridge URL in the Kiosk

If the bridge runs on a different port or machine, open the kiosk in your browser and run this in the developer console:

```javascript
localStorage.setItem("kioskPrinterBridgeUrl", "http://192.168.1.100:3210/print-token");
```

## Endpoints

| Method | Path           | Description                |
|--------|----------------|----------------------------|
| GET    | `/health`      | Health check & printer info|
| POST   | `/print-token` | Print a queue ticket       |

## Print Payload (POST /print-token)

```json
{
  "organizationName": "My Company",
  "tokenNumber": "A001",
  "serviceName": "Customer Service",
  "priorityLevel": "normal",
  "createdAtIso": "2026-04-05T10:30:00Z",
  "customerName": "John Doe",
  "customerPhone": "+1234567890",
  "visitReason": "Account inquiry",
  "trackingUrl": "https://myapp.com/track/org123/A001",
  "estimatedWait": 12
}
```

## Troubleshooting

- **"No USB printer found"** — Make sure the printer is connected and powered on. On Linux, you may need `libusb` permissions.
- **Windows**: You may need to install [Zadig](https://zadig.akeo.ie/) to set the USB driver to WinUSB for the printer.
- **macOS**: USB printers should work out of the box with `escpos-usb`.

## Running as a Windows Service

To auto-start the bridge on boot:

```bash
npm install -g pm2
pm2 start server.js --name printer-bridge
pm2 save
pm2 startup
```
