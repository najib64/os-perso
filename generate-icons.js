import sharp from 'sharp';

// Icône 192x192
await sharp({
  create: {
    width: 192,
    height: 192,
    channels: 4,
    background: { r: 13, g: 13, b: 13, alpha: 1 }
  }
})
.png()
.toFile('static/icon-192.png');

// Icône 512x512
await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: { r: 13, g: 13, b: 13, alpha: 1 }
  }
})
.png()
.toFile('static/icon-512.png');

console.log('✅ Icônes créées');