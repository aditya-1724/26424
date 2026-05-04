const axios = require('axios');

let tokenCache = null;
let tokenExpiry = 0;

async function getFreshToken() {
  const response = await axios.post('http://20.207.122.201/evaluation-service/auth', {
    email: "aditya.26424@ggnindia.dronacharya.info",
    name: "aditya gupta",
    rollNo: "26424",
    accessCode: "uksdWT",
    clientID: "39c772b8-cd74-40e2-bd41-39db0ac94a08",
    clientSecret: "YKVzetTKkeNESCxv"
  });
  return response.data.access_token;
}

async function getValidToken() {
  if (tokenCache && Date.now() < tokenExpiry) return tokenCache;
  tokenCache = await getFreshToken();
  tokenExpiry = Date.now() + 55 * 60 * 1000; 
  return tokenCache;
}

async function log(stack, level, packageName, message) {
  try {
    const token = await getValidToken();
    await axios.post('http://20.207.122.201/evaluation-service/logs', {
      stack: stack,
      level: level,
      package: packageName,
      message: message
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (err) {
    
    if (err.response && err.response.status === 401) {
      
      tokenCache = null;
    }
  }
}

module.exports = { log };