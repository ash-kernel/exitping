const fs = require('fs');
const path = require('path');

function createSolidBMP(width, height, r, g, b) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;

  const header = Buffer.alloc(54);
  
  // File Header (14 bytes)
  header.write('BM', 0); // Signature
  header.writeUInt32LE(fileSize, 2); // File Size
  header.writeUInt32LE(54, 10); // Offset to pixel data

  // DIB Header (40 bytes)
  header.writeUInt32LE(40, 14); // DIB Header Size
  header.writeInt32LE(width, 18); // Width
  header.writeInt32LE(height, 22); // Height
  header.writeUInt16LE(1, 26); // Color Planes
  header.writeUInt16LE(24, 28); // Bits per Pixel
  header.writeUInt32LE(0, 30); // Compression (BI_RGB)
  header.writeUInt32LE(pixelDataSize, 34); // Image Size

  const pixelData = Buffer.alloc(pixelDataSize);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = y * rowSize + x * 3;
      pixelData[offset] = b;     // Blue component
      pixelData[offset + 1] = g; // Green component
      pixelData[offset + 2] = r; // Red component
    }
  }

  return Buffer.concat([header, pixelData]);
}

const dir = path.join(__dirname);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Generate valid placeholder BMPs to prevent compiler errors
// installerHeader.bmp: 150x57
fs.writeFileSync(path.join(dir, 'installerHeader.bmp'), createSolidBMP(150, 57, 10, 10, 12)); // Deep Blackish gray
// installerSidebar.bmp: 164x314
fs.writeFileSync(path.join(dir, 'installerSidebar.bmp'), createSolidBMP(164, 314, 15, 15, 18)); // Slightly lighter gray

console.log("Installer banner placeholders generated successfully!");
