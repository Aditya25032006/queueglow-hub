const test = require('node:test');
const assert = require('node:assert/strict');
const { GmailBridge, SCOPE } = require('../electron/gmail.cjs');

test('Gmail is read-only and disabled until the publisher configures its OAuth client', async () => {
  let opened = false;
  const bridge = new GmailBridge({
    clientId: '',
    file: 'unused',
    safeStorage: { isEncryptionAvailable: () => true },
    openExternal: async () => {
      opened = true;
    },
  });

  assert.equal(SCOPE, 'https://www.googleapis.com/auth/gmail.readonly');
  assert.equal(bridge.state().configured, false);
  assert.equal(bridge.state().connected, false);
  await assert.rejects(bridge.connect(), /publisher must finish Google OAuth setup/);
  assert.equal(opened, false);
});

test('desktop sign-in uses a random loopback callback and PKCE S256', async () => {
  const bridge = new GmailBridge({
    clientId: 'queueglow-test.apps.googleusercontent.com',
    file: 'unused',
    safeStorage: { isEncryptionAvailable: () => true },
    openExternal: async (href) => {
      const authorization = new URL(href);
      const redirect = new URL(authorization.searchParams.get('redirect_uri'));
      assert.equal(redirect.hostname, '127.0.0.1');
      assert.notEqual(redirect.port, '');
      assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
      assert.ok(authorization.searchParams.get('code_challenge'));
      const callback = new URL(redirect.href);
      callback.searchParams.set('state', authorization.searchParams.get('state'));
      callback.searchParams.set('code', 'test-code');
      const response = await fetch(callback);
      assert.equal(response.status, 200);
    },
  });

  const result = await bridge.authorize();
  assert.equal(result.code, 'test-code');
  assert.ok(result.verifier.length >= 43);
});

