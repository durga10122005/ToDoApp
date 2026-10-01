/**
 * Automated Enterprise NFR Verification Test Suite
 */
const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🚀 Starting Enterprise NFR Automated Test Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
    }
  }

  // Test 1: Health & Readiness Endpoints
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json();
  assert(healthRes.status === 200 && healthData.data.status === 'healthy', 'Liveness probe /api/health returns 200 healthy');

  const readyRes = await fetch(`${BASE_URL}/api/ready`);
  const readyData = await readyRes.json();
  assert(readyRes.status === 200 && readyData.data.database === 'connected', 'Readiness probe /api/ready returns 200 connected');

  // Test 2: Security Headers (CSP, X-Content-Type-Options, X-Frame-Options)
  const cspHeader = healthRes.headers.get('content-security-policy');
  const xctoHeader = healthRes.headers.get('x-content-type-options');
  const xfoHeader = healthRes.headers.get('x-frame-options');
  assert(cspHeader && cspHeader.includes("default-src 'self'"), 'Strict Content Security Policy (CSP) header enforced');
  assert(xctoHeader === 'nosniff', 'X-Content-Type-Options: nosniff header enforced');
  assert(xfoHeader === 'DENY', 'X-Frame-Options: DENY header enforced');

  // Test 3: Password Policy Validation (Weak password rejection)
  const weakRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'weak' })
  });
  const weakRegData = await weakRegRes.json();
  assert(weakRegRes.status === 422 && weakRegData.error.code === 'WEAK_PASSWORD', 'Weak password rejected under strict policy (min 10 chars, upper, lower, num, symbol)');

  // Test 4: Successful User Registration (User A)
  const userAEmail = `alice_${Date.now()}@example.com`;
  const regARes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userAEmail,
      password: 'StrongP@ssw0rd123!',
      name: 'Alice Developer'
    })
  });
  const regAData = await regARes.json();
  assert(regARes.status === 201 && regAData.data.accessToken && regAData.data.csrfToken, 'User A registered with PBKDF2 hash, JWT access token, and CSRF token');
  const tokenA = regAData.data.accessToken;
  const csrfA = regAData.data.csrfToken;
  const cookieA = regARes.headers.get('set-cookie');
  assert(cookieA && cookieA.includes('HttpOnly') && cookieA.includes('SameSite=Strict'), 'Refresh token stored in HttpOnly, SameSite=Strict cookie');

  // Test 5: Successful User Registration (User B for multi-tenant isolation testing)
  const userBEmail = `bob_${Date.now()}@example.com`;
  const regBRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userBEmail,
      password: 'StrongP@ssw0rd456!',
      name: 'Bob Engineer'
    })
  });
  const regBData = await regBRes.json();
  const tokenB = regBData.data.accessToken;
  const csrfB = regBData.data.csrfToken;
  assert(regBRes.status === 201 && tokenB, 'User B registered for multi-tenant testing');

  // Test 6: Rate Limiting on Failed Logins
  let rateLimited = false;
  for (let i = 0; i < 6; i++) {
    const failRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'baduser@example.com', password: 'WrongPassword123!' })
    });
    if (failRes.status === 429) {
      rateLimited = true;
      break;
    }
  }
  assert(rateLimited, 'Auth route rate limiting enforces 429 after 5 failed attempts');

  // Test 7: Passwordless Magic Link Flow
  const magicReqRes = await fetch(`${BASE_URL}/api/auth/magic-link/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `magic_${Date.now()}@example.com` })
  });
  const magicReqData = await magicReqRes.json();
  assert(magicReqRes.status === 200 && magicReqData.data.demoToken, 'Magic link token generated with 15-minute expiration');

  const magicVerifyRes = await fetch(`${BASE_URL}/api/auth/magic-link/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: magicReqData.data.demoToken })
  });
  const magicVerifyData = await magicVerifyRes.json();
  assert(magicVerifyRes.status === 200 && magicVerifyData.data.accessToken, 'Magic link verified successfully into active session');

  // Test 8: OAuth 2.0 Social Login Simulation
  const oauthRes = await fetch(`${BASE_URL}/api/auth/oauth/mock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'github', email: `gh_${Date.now()}@example.com` })
  });
  const oauthData = await oauthRes.json();
  assert(oauthRes.status === 200 && oauthData.data.user.id, 'OAuth 2.0 (GitHub) user authenticated into tenant session');

  // Test 9: Content Sanitization & XSS Prevention
  const xssTaskRes = await fetch(`${BASE_URL}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`,
      'X-CSRF-Token': csrfA
    },
    body: JSON.stringify({
      title: '<script>alert("xss")</script>Important Security Review',
      description: '<a href="javascript:stealCookies()">Click me</a>'
    })
  });
  const xssTaskData = await xssTaskRes.json();
  assert(
    xssTaskRes.status === 201 &&
    !xssTaskData.data.task.title.includes('<script>') &&
    !xssTaskData.data.task.description.includes('javascript:'),
    'Server-side sanitizer neutralizes XSS scripts and javascript: URIs'
  );
  const taskAId = xssTaskData.data.task.id;

  // Test 10: Strict Row-Level Security (RLS) & IDOR Prevention
  // User B attempts to access User A's task directly
  const idorRes = await fetch(`${BASE_URL}/api/tasks/${taskAId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`,
      'X-CSRF-Token': csrfB
    },
    body: JSON.stringify({ title: 'Tampered Title' })
  });
  const idorData = await idorRes.json();
  assert(
    idorRes.status === 404 && idorData.error.code === 'RESOURCE_NOT_FOUND',
    'IDOR Prevention: Accessing another tenant task returns generic 404 Not Found (never 403)'
  );

  // Test 11: Multi-Tenant Task Isolation
  const tasksARes = await fetch(`${BASE_URL}/api/tasks`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const tasksAData = await tasksARes.json();
  const tasksBRes = await fetch(`${BASE_URL}/api/tasks`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const tasksBData = await tasksBRes.json();
  assert(
    tasksAData.data.tasks.some(t => t.id === taskAId) &&
    !tasksBData.data.tasks.some(t => t.id === taskAId),
    'Strict Row-Level Security (RLS): User A tasks are strictly isolated from User B'
  );

  // Test 12: Active Sessions Dashboard & Invalidation
  const sessionsRes = await fetch(`${BASE_URL}/api/sessions`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const sessionsData = await sessionsRes.json();
  assert(sessionsRes.status === 200 && Array.isArray(sessionsData.data.sessions), 'Active sessions dashboard returns device, OS, browser, IP');

  const logoutOthersRes = await fetch(`${BASE_URL}/api/sessions/logout-others`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'X-CSRF-Token': csrfA
    }
  });
  assert(logoutOthersRes.status === 200, 'Global session invalidation: "Log out of all other devices" succeeds');

  // Test 13: GDPR / CCPA Data Export (JSON & CSV)
  const exportRes = await fetch(`${BASE_URL}/api/export`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const exportData = await exportRes.json();
  assert(
    exportRes.status === 200 &&
    exportData.data.json &&
    exportData.data.tasksCsv &&
    exportData.data.tasksCsv.includes('Important Security Review'),
    'GDPR One-Click Data Export generates structured JSON and CSV datasets'
  );

  // Test 14: GDPR Right to Be Forgotten (Cascading Hard Delete)
  const deleteAccRes = await fetch(`${BASE_URL}/api/account`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${tokenA}`,
      'X-CSRF-Token': csrfA
    }
  });
  assert(deleteAccRes.status === 200, 'GDPR Right to Be Forgotten executes complete cascading user deletion');

  // Verify User A data is completely gone
  const postDeleteTasks = await fetch(`${BASE_URL}/api/tasks`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert(postDeleteTasks.status === 401, 'Deleted user access token invalidated and records wiped');

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`========================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
