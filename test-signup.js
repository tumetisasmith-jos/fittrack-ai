const fetch = require('node-fetch');

async function testSignup() {
  try {
    const res = await fetch('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Test Render User',
        username: 'testrenderuser',
        email: 'testrender@example.com',
        password: 'password123'
      })
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Data:', data);
  } catch (err) {
    console.error(err);
  }
}

testSignup();
