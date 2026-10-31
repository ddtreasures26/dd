// Account that owns the shop data (products, images, orders) on Google Drive.
export const ADMIN_EMAIL = 'ddtreasures26@gmail.com';

// Google OAuth Web client ID (public value). Set VITE_GOOGLE_CLIENT_ID in .env.local
// for local work and in the Cloudflare build variables for production.
// When empty the app runs in guest/test mode: no sign-in, admin protected by PIN.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const AUTH_ENABLED = Boolean(GOOGLE_CLIENT_ID);

// Deployed Google Apps Script web app (see backend/README.md). When empty the app stays in
// local-only mode: data lives in this browser and is not shared.
export const API_URL = import.meta.env.VITE_API_URL || '';
