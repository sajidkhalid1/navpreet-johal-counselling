// Neon SQL-over-HTTP. All values are sent as bind parameters, never interpolated.
export async function query(query, params = []) {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('Scheduling is being set up. Please call to arrange a consultation.'), {status:503});
  const connection = new URL(process.env.DATABASE_URL);
  const response = await fetch(`https://${connection.hostname}/sql`, {
    method:'POST', headers:{'Content-Type':'application/json','Neon-Connection-String':process.env.DATABASE_URL,'Neon-Raw-Text-Output':'false','Neon-Array-Mode':'false'},
    body:JSON.stringify({query,params}), signal:AbortSignal.timeout(15000)
  });
  const data = await response.json();
  if (!response.ok) { const error = new Error('Database request failed'); error.code=data.code; throw error; }
  return data.rows;
}
