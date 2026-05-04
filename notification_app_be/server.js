const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { log } = require('../logging_middleware');

const app = express();
app.use(cors());
app.use(express.json());

const USER = {
  name: "Aditya Gupta",
  rollNo: "26424",
  email: "aditya.26424@ggnindia.dronacharya.info",
  github: "aditya-1724"
};

let tokenCache = null;
let tokenExpiry = 0;

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

async function getValidToken() {
  if (tokenCache && Date.now() < tokenExpiry) return tokenCache;
  const res = await axios.post('http://20.207.122.201/evaluation-service/auth', {
    email: USER.email,
    name: USER.name,
    rollNo: USER.rollNo,
    accessCode: "uksdWT",
    clientID: "39c772b8-cd74-40e2-bd41-39db0ac94a08",
    clientSecret: "YKVzetTKkeNESCxv"
  });
  tokenCache = res.data.access_token;
  tokenExpiry = Date.now() + (res.data.expires_in * 1000);
  await log('backend', 'info', 'auth', 'Token refreshed');
  return tokenCache;
}

async function fetchExternalNotifications(limit, page, type) {
  const token = await getValidToken();
  const url = `http://20.207.122.201/evaluation-service/notifications?limit=${limit}&page=${page}&notification_type=${type}`;
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data.notifications || [];
}

const typeWeight = { Placement: 3, Result: 2, Event: 1 };
function parseTimestamp(ts) {
  return new Date(ts.replace(' ', 'T'));
}

function getTopPriority(notifications, n) {
  return [...notifications]
    .sort((a, b) => {
      if (a.Type !== b.Type) return typeWeight[b.Type] - typeWeight[a.Type];
      return parseTimestamp(b.Timestamp) - parseTimestamp(a.Timestamp);
    })
    .slice(0, n);
}

const cache = new Map();
const CACHE_TTL = 30 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

app.get('/api/user', async (req, res) => {
  await log('backend', 'info', 'controller', 'User profile fetched');
  res.json(USER);
});

app.get('/api/notifications', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const type = req.query.type || '';
  const cacheKey = `notif_${limit}_${page}_${type}`;

  const cached = getCached(cacheKey);
  if (cached) {
    await log('backend', 'info', 'cache', 'Serving from cache');
    return res.json(cached);
  }

  try {
    await log('backend', 'info', 'controller', `Fetch page ${page}, type ${type}`);
    const raw = await fetchExternalNotifications(limit, page, type);
    const notifications = raw.map(n => ({
      ID: n.ID,
      Type: capitalize(n.Type),
      Message: n.Message,
      Timestamp: n.Timestamp
    }));
    const response = { notifications, page, limit, total: notifications.length };
    setCache(cacheKey, response);
    res.json(response);
  } catch (err) {
    await log('backend', 'error', 'controller', err.message);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.get('/api/priority', async (req, res) => {
  const n = parseInt(req.query.n) || 10;
  try {
    await log('backend', 'info', 'service', `Computing top ${n} priority`);
    let all = [];
    for (let pg = 1; pg <= 3; pg++) {
      const batch = await fetchExternalNotifications(20, pg, '');
      all.push(...batch);
      if (all.length >= 200) break;
    }
    const normalized = all.map(n => ({ ...n, Type: capitalize(n.Type) }));
    const top = getTopPriority(normalized, n);
    res.json({ top });
  } catch (err) {
    await log('backend', 'error', 'service', err.message);
    res.status(500).json({ error: 'Priority calculation failed' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', user: USER.rollNo });
});

const PORT = 3001;
app.listen(PORT, async () => {
  await log('backend', 'info', 'service', `Server started on port ${PORT}`);
  console.log(`Backend running on http://localhost:${PORT}`);
});