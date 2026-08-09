/* La Relève · mesure d'audience anonyme
   Aucune adresse IP stockée. L'identifiant visiteur est un hachage
   qui change chaque jour, donc non rattachable à une personne. */
(function () {
  var URL_API = 'https://bxdnxnwbslykpgfsdltg.supabase.co/rest/v1/lr_events';
  var CLE = 'sb_publishable_gG8DLCGoOZ1fUBBx566k1w_BlW-eZth';
  if (navigator.doNotTrack === '1' || location.hostname === 'localhost') return;

  function hachage(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  var jour = new Date().toISOString().slice(0, 10);
  var empreinte = [navigator.userAgent, screen.width + 'x' + screen.height,
                   navigator.language, new Date().getTimezoneOffset()].join('|');
  var visiteur = hachage(empreinte + jour);
  var session = sessionStorage.getItem('lr_s') ||
                (Math.random().toString(36).slice(2) + Date.now().toString(36));
  try { sessionStorage.setItem('lr_s', session); } catch (e) {}

  var ua = navigator.userAgent;
  function trouve(regles) {
    for (var i = 0; i < regles.length; i++) if (regles[i][1].test(ua)) return regles[i][0];
    return 'Autre';
  }
  var estTablette = /iPad|Tablet|PlayBook|Silk/i.test(ua) ||
                    (/Android/i.test(ua) && !/Mobile/i.test(ua));
  var appareil = estTablette ? 'tablette'
               : (/Mobi|Android|iPhone|iPod/i.test(ua) ? 'mobile' : 'ordinateur');
  var marque = trouve([['Apple', /iPhone|iPad|Macintosh/i], ['Samsung', /SM-|Samsung/i],
    ['Xiaomi', /Redmi|POCO|Xiaomi|MI /i], ['Huawei', /HUAWEI|Honor/i], ['Google', /Pixel/i],
    ['Oppo', /OPPO|CPH/i], ['OnePlus', /OnePlus/i], ['Realme', /RMX|realme/i],
    ['Motorola', /moto|Motorola/i], ['Sony', /Xperia/i], ['Microsoft', /Windows/i]]);
  var modele = 'Autre';
  var m = ua.match(/iPhone OS (\d+)/); if (m) modele = 'iPhone iOS ' + m[1];
  m = ua.match(/\((?:Linux; )?Android [\d.]+; ([^;)]+)/); if (m) modele = m[1].trim();
  if (/iPad/i.test(ua)) modele = 'iPad';
  if (/Macintosh/i.test(ua)) modele = 'Mac';
  var os = trouve([['iOS', /iPhone|iPad|iPod/i], ['Android', /Android/i], ['Windows', /Windows/i],
    ['macOS', /Macintosh/i], ['Linux', /Linux/i]]);
  var navi = trouve([['Instagram', /Instagram/i], ['Facebook', /FBAN|FBAV/i],
    ['Edge', /Edg\//i], ['Opera', /OPR\//i], ['Samsung Internet', /SamsungBrowser/i],
    ['Chrome', /Chrome|CriOS/i], ['Firefox', /Firefox|FxiOS/i], ['Safari', /Safari/i]]);

  var params = new URLSearchParams(location.search);
  var ref = document.referrer || '';
  var source = params.get('utm_source') || params.get('src') ||
    (/whatsapp/i.test(ref) ? 'whatsapp' : /linkedin/i.test(ref) ? 'linkedin' :
     /facebook/i.test(ref) ? 'facebook' : /instagram/i.test(ref) ? 'instagram' :
     /t\.co|twitter|x\.com/i.test(ref) ? 'twitter' : /google|bing|qwant|duckduck/i.test(ref) ? 'recherche' :
     ref ? 'lien' : 'direct');

  var lieu = {};
  var commun = function () {
    return {
      visitor: visiteur, session: session, page: location.pathname,
      referrer: ref.slice(0, 180), source: source,
      country: lieu.country, region: lieu.region, city: lieu.city,
      device: appareil, brand: marque, model: modele, os: os, browser: navi,
      screen: screen.width + 'x' + screen.height, lang: navigator.language,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  };

  var file = [];
  function envoyer(ev, immediat) {
    var d = commun();
    for (var k in ev) d[k] = ev[k];
    file.push(d);
    if (immediat || file.length >= 6) vider(immediat);
  }
  function vider(sync) {
    if (!file.length) return;
    var corps = JSON.stringify(file); file = [];
    if (sync && navigator.sendBeacon) {
      navigator.sendBeacon(URL_API + '?apikey=' + CLE,
        new Blob([corps], { type: 'application/json' }));
      return;
    }
    fetch(URL_API, {
      method: 'POST', keepalive: true, mode: 'cors',
      headers: { 'Content-Type': 'application/json', apikey: CLE,
                 Authorization: 'Bearer ' + CLE, Prefer: 'return=minimal' },
      body: corps
    }).catch(function () {
      if (navigator.sendBeacon) {
        try {
          navigator.sendBeacon(URL_API + '?apikey=' + CLE,
            new Blob([corps], { type: 'application/json' }));
        } catch (e) {}
      }
    });
  }

  function demarrer() {
    envoyer({ kind: 'pageview' }, true);

    var vues = {};
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entrees) {
        entrees.forEach(function (e) {
          var id = e.target.id || e.target.getAttribute('aria-label') || 'sans-nom';
          if (e.isIntersecting) { if (!vues[id]) vues[id] = Date.now(); }
          else if (vues[id]) {
            var s = Math.round((Date.now() - vues[id]) / 1000); vues[id] = 0;
            if (s > 1) envoyer({ kind: 'section', section: id, seconds: s });
          }
        });
      }, { threshold: 0.4 });
      document.querySelectorAll('section[id], section[aria-label], header[id]')
        .forEach(function (s) { obs.observe(s); });
    }

    document.addEventListener('click', function (e) {
      var a = e.target.closest('a, button');
      if (!a) return;
      var t = (a.textContent || '').trim().slice(0, 60) || a.getAttribute('href') || 'element';
      envoyer({ kind: 'click', label: t, section: (a.closest('section') || {}).id || null });
    }, true);

    var maxi = 0;
    addEventListener('scroll', function () {
      var h = document.documentElement.scrollHeight - innerHeight;
      if (h > 0) maxi = Math.max(maxi, Math.round(scrollY / h * 100));
    }, { passive: true });

    var debut = Date.now();
    setInterval(function () {
      envoyer({ kind: 'ping', depth: maxi, seconds: Math.round((Date.now() - debut) / 1000) });
    }, 30000);

    addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        for (var id in vues) if (vues[id]) {
          var s = Math.round((Date.now() - vues[id]) / 1000);
          if (s > 1) file.push(Object.assign(commun(), { kind: 'section', section: id, seconds: s }));
          vues[id] = 0;
        }
        envoyer({ kind: 'ping', depth: maxi, seconds: Math.round((Date.now() - debut) / 1000) }, true);
      }
    });
    addEventListener('pagehide', function () { vider(true); });
  }

  // La mesure démarre au plus tard après 1,2 s, même si la géolocalisation
  // est lente ou bloquée : on ne dépend jamais d'un service extérieur.
  var lance = false;
  function go() { if (lance) return; lance = true; demarrer(); }
  setTimeout(go, 1200);

  try {
    fetch('https://ipapi.co/json/')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d) lieu = { country: d.country_name, region: d.region, city: d.city };
      })
      .catch(function () {})
      .then(go, go);
  } catch (e) { go(); }
})();
