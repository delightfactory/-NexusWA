const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pino = require('pino');

async function test() {
  try {
    const sessionPath = path.resolve('./wa-sessions/test-debug');
    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });
    
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    console.log('✅ Auth state OK');
    
    const { version } = await fetchLatestBaileysVersion();
    console.log('✅ Version:', version);

    const logger = pino({ level: 'silent' });
    
    const socket = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: true,
      browser: ['NexusWA', 'Chrome', '120.0.0'],
    });

    console.log('✅ Socket created successfully');

    socket.ev.on('connection.update', async (update) => {
      console.log('Connection update:', JSON.stringify(update, null, 2));
      if (update.qr) {
        console.log('✅ QR Code received!');
        const qrDataUrl = await QRCode.toDataURL(update.qr);
        console.log('✅ QR DataURL generated, length:', qrDataUrl.length);
      }
    });

    // Wait 10 seconds then exit
    setTimeout(() => {
      console.log('⏱️ Test complete, cleaning up...');
      socket.end(undefined);
      fs.rmSync(sessionPath, { recursive: true, force: true });
      process.exit(0);
    }, 10000);

  } catch (e) {
    console.log('❌ ERROR:', e.message);
    console.log('STACK:', e.stack);
    process.exit(1);
  }
}
test();
