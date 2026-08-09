// Fonction serveur : reçoit les mesures du navigateur et écrit en base.
// Même architecture que Maison Brand Paris : le navigateur ne parle jamais
// directement à la base, donc aucun bloqueur ne peut interférer.
const URL_BASE = 'https://bxdnxnwbslykpgfsdltg.supabase.co/rest/v1/lr_events';
const CLE = process.env.SUPABASE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4ZG54bndic2x5a3BnZnNkbHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTc5MTgsImV4cCI6MjEwMDY3MzkxOH0.C1U1vuG3ep0GriLAMKPBDec6v2q0H1QTEiQDeauncAU';

const CHAMPS = ['visitor','session','kind','page','section','label','seconds','depth',
  'referrer','source','country','region','city','device','brand','model','os',
  'browser','screen','lang','tz'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'methode' });

  try {
    let corps = req.body;
    if (typeof corps === 'string') corps = JSON.parse(corps);
    const liste = Array.isArray(corps) ? corps : [corps];
    if (!liste.length || liste.length > 40) return res.status(400).json({ erreur: 'taille' });

    // Le pays et la ville viennent des en-têtes Vercel : aucune requête
    // vers un service tiers, et l'adresse IP n'est jamais enregistrée.
    const pays = req.headers['x-vercel-ip-country'] || null;
    const region = req.headers['x-vercel-ip-country-region'] || null;
    const ville = req.headers['x-vercel-ip-city']
      ? decodeURIComponent(req.headers['x-vercel-ip-city']) : null;

    const propres = liste.map(e => {
      const o = {};
      for (const c of CHAMPS) if (e[c] !== undefined && e[c] !== null) o[c] = e[c];
      if (pays)   o.country = o.country || pays;
      if (region) o.region  = o.region  || region;
      if (ville)  o.city    = o.city    || ville;
      if (typeof o.referrer === 'string') o.referrer = o.referrer.slice(0, 180);
      if (!o.visitor || !o.session || !o.kind) return null;
      return o;
    }).filter(Boolean);

    if (!propres.length) return res.status(400).json({ erreur: 'vide' });

    const r = await fetch(URL_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CLE,
                 Authorization: 'Bearer ' + CLE, Prefer: 'return=minimal' },
      body: JSON.stringify(propres)
    });
    if (!r.ok) return res.status(502).json({ erreur: await r.text() });
    return res.status(204).end();
  } catch (e) {
    return res.status(500).json({ erreur: String(e && e.message || e) });
  }
}
