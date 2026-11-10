const origin=process.argv[2];if(!origin||!origin.startsWith('https://'))throw Error('Pass the deployment HTTPS origin.');
for(const page of ['','about','services','booking','journal','contact','privacy','story?id=sample-0']){const response=await fetch(origin+'/'+page);const html=await response.text();if(response.status!==200||!html.includes('/design.css')||!html.includes('id="main"'))throw Error(`Page failed: ${page} (${response.status})`);console.log(`OK /${page}`);}
for(const path of ['/assets/logo.png','/assets/care.png','/assets/booking.jpg','/assets/fonts/font-1.woff2','/motion.js']){const response=await fetch(origin+path);if(!response.ok)throw Error('Missing asset '+path);}
for(const path of ['/api/slots','/api/stories']){const response=await fetch(origin+path);const data=await response.json();if(!response.ok||!Array.isArray(data))throw Error('API failed: '+path);console.log(`OK ${path}`);}
const privateResponse=await fetch(origin+'/api/admin/bookings');if(privateResponse.status!==401)throw Error('Owner bookings must require authentication.');
console.log('Assets and protected API verified.');
