// Keep Render service alive by pinging it every 14 minutes
// Add this to your server.js or run as a separate service

const axios = require('axios');

const RENDER_URL = 'https://soccerprediction-backend.onrender.com';
const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes

function keepAlive() {
  setInterval(async () => {
    try {
      const response = await axios.get(`${RENDER_URL}/health`);
      console.log(`Keep-alive ping: ${response.status} at ${new Date().toISOString()}`);
    } catch (error) {
      console.log(`Keep-alive ping failed: ${error.message}`);
    }
  }, PING_INTERVAL);
}

// Only run keep-alive in production
if (process.env.NODE_ENV === 'production') {
  // Wait 2 minutes after startup before starting keep-alive
  setTimeout(() => {
    console.log('Starting keep-alive service...');
    keepAlive();
  }, 2 * 60 * 1000);
}

module.exports = { keepAlive };