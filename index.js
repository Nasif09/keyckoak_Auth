require('dotenv').config();
const express = require('express');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const axios = require('axios');

const app = express();
const port = 3000;

const memoryStore = new session.MemoryStore();

app.use(session({
  secret: process.env.SESSION_SECRET || 'defaultsecret',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));

const keycloakConfig = {
  clientId: process.env.KEYCLOAK_CLIENT_ID,
  bearerOnly: false,
  serverUrl: process.env.KEYCLOAK_AUTH_SERVER_URL,
  realm: process.env.KEYCLOAK_REALM,
  credentials: {
    secret: process.env.KEYCLOAK_CLIENT_SECRET,
  },
};

const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

app.use(keycloak.middleware({
  logout: '/logout',
  admin: '/'
}));

//Custom logout redirect example:
// app.get('/logout', (req, res) => {
//   const logoutRedirectUrl = encodeURIComponent('http://localhost:3000/');
//   res.redirect(`http://localhost:8080/realms/oriboshitest/protocol/openid-connect/logout?redirect_uri=${logoutRedirectUrl}`);
// });


app.get('/', (req, res) => {
  res.send('Welcome! This page is public.');
});

app.get('/dashboard', keycloak.protect(), (req, res) => {
  const tokenContent = req.kauth.grant.access_token.content;
  // User info like username, email, roles are here:
  const username = tokenContent.preferred_username;
  const email = tokenContent.email;
  const roles = tokenContent.realm_access.roles;

  res.json({ username, email, roles });
});


app.get('/admin', keycloak.protect('realm:admin'), (req, res) => {
  res.send('Hello Admin, you have access to this admin route!');
});

app.get('/account', (req, res) => {
  // Redirect user to Keycloak account management console
  const keycloakAccountUrl = `http://localhost:8080/realms/oriboshitest/account`;
  res.redirect(keycloakAccountUrl);
});

app.get('/reset-password', (req, res) => {
  const resetUrl = `http://localhost:8080/realms/oriboshitest/login-actions/reset-credentials?client_id=myclient`;
  res.redirect(resetUrl);
});


// Admin REST API helper functions
async function getAdminToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', process.env.KEYCLOAK_ADMIN_CLIENT_ID);
  params.append('client_secret', process.env.KEYCLOAK_ADMIN_CLIENT_SECRET);

  const response = await axios.post(`${process.env.KEYCLOAK_AUTH_SERVER_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`, params);
  return response.data.access_token;
}


app.get('/admin/users', keycloak.protect('realm:admin'), async (req, res) => {
  try {
    const token = await getAdminToken();
    const usersResponse = await axios.get(`${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    res.json(usersResponse.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
