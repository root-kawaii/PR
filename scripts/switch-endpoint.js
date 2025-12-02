#!/usr/bin/env node

/**
 * Switch API endpoint between production and localhost
 * Usage:
 *   node scripts/switch-endpoint.js production
 *   node scripts/switch-endpoint.js localhost
 */

const fs = require('fs');
const path = require('path');

const APP_JSON_PATH = path.join(__dirname, '../pierre_two/app.json');

const ENDPOINTS = {
  production: 'https://pierre-two-backend.fly.dev',
  localhost: 'http://172.20.10.5:3000',
  local: 'http://172.20.10.5:3000', // Alias
  prod: 'https://pierre-two-backend.fly.dev', // Alias
};

function switchEndpoint(target) {
  if (!ENDPOINTS[target]) {
    console.error(`❌ Invalid target: ${target}`);
    console.error(`Available targets: ${Object.keys(ENDPOINTS).join(', ')}`);
    process.exit(1);
  }

  const targetUrl = ENDPOINTS[target];

  try {
    // Read app.json
    const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));

    // Update apiUrl
    const currentUrl = appJson.expo.extra.apiUrl;
    appJson.expo.extra.apiUrl = targetUrl;

    // Write back to app.json
    fs.writeFileSync(APP_JSON_PATH, JSON.stringify(appJson, null, 2) + '\n');

    console.log(`✅ API endpoint switched`);
    console.log(`   From: ${currentUrl}`);
    console.log(`   To:   ${targetUrl}`);
  } catch (error) {
    console.error(`❌ Failed to switch endpoint:`, error.message);
    process.exit(1);
  }
}

// Main
const target = process.argv[2];

if (!target) {
  console.error('❌ Missing target argument');
  console.error('Usage: node scripts/switch-endpoint.js [production|localhost]');
  process.exit(1);
}

switchEndpoint(target);
