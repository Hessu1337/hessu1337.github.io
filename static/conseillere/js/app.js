/* Interface : formulaire « Données de base », onglets de résultats, graphique SVG et tableau. */
(function () {
  'use strict';

  const E = window.PrevEngine;
  const P = window.PrevParams;
  const DEFAUT = window.PrevDefaults;
  const CLE_STOCKAGE = 'bilan-prevoyance-dossier';

  // ---------------------------------------------------------------- Utilitaires

  const chf = (n) => {
    const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    return (n < -0.5 ? '-' : '') + s;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const get = (o, chemin) => chemin.split('.').reduce((x, k) => x[k], o);
  function set(o, chemin, v) {
    const k = chemin.split('.');
    const dernier = k.pop();
    k.reduce((x, c) => x[c], o)[dernier] = v;
  }
  // Complète un dossier importé avec les clés manquantes (versions antérieures).
  function fusionner(base, src) {
    const out = clone(base);
    for (const k in src) {
      if (!(k in base)) continue;
      out[k] = base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? fusionner(base[k], src[k]) : src[k];
    }
    return out;
  }

  function charger() {
    try {
      const s = localStorage.getItem(CLE_STOCKAGE);
      if (s) return fusionner(DEFAUT, JSON.parse(s));
    } catch (e) { /* stockage indisponible */ }
    return clone(DEFAUT);
  }
  function sauver() {
    try { localStorage.setItem(CLE_STOCKAGE, JSON.stringify(dossier)); } catch (e) { /* ignoré */ }
  }

  let dossier = charger();

  // ---------------------------------------------------------------- Formulaire

  const CANTONS = [['AG', 'Argovie'], ['AI', 'Appenzell Rhodes-Intérieures'], ['AR', 'Appenzell Rhodes-Extérieures'],
    ['BE', 'Berne'], ['BL', 'Bâle-Campagne'], ['BS', 'Bâle-Ville'], ['FR', 'Fribourg'], ['GE', 'Genève'], ['GL', 'Glaris'],
    ['GR', 'Grisons'], ['JU', 'Jura'], ['LU', 'Lucerne'], ['NE', 'Neuchâtel'], ['NW', 'Nidwald'], ['OW', 'Obwald'],
    ['SG', 'Saint-Gall'], ['SH', 'Schaffhouse'], ['SO', 'Soleure'], ['SZ', 'Schwytz'], ['TG', 'Thurgovie'], ['TI', 'Tessin'],
    ['UR', 'Uri'], ['VD', 'Vaud'], ['VS', 'Valais'], ['ZG', 'Zoug'], ['ZH', 'Zurich']]
    .map(([c, nom]) => [c, c + ' — ' + nom]);

  const SECTIONS = [
    { titre: 'Personne', ouvert: true, champs: [
      { k: 'personne.nom', l: 'Nom du client', t: 'text' },
      { k: 'personne.naissance', l: 'Date de naissance', t: 'date' },
      { k: 'personne.ageRetraite', l: 'Âge de la retraite', t: 'num', min: 63, max: 70, step: 1, aide: 'Âge de référence 65 ans ; anticipation dès 63, ajournement jusqu’à 70.' },
      { k: 'personne.enfants', l: 'Obligation d’entretien envers des enfants (< 25 ans)', t: 'bool' },
    ] },
    { titre: 'Revenu', ouvert: true, champs: [
      { k: 'revenu.brut', l: 'Revenu brut annuel', t: 'chf' },
      { k: 'revenu.maintienMode', l: 'Maintien du salaire par l’employeur', t: 'select', options: [['echelle', 'Selon l’échelle cantonale (CO 324a)'], ['manuel', 'Selon le contrat / la CCT']] },
      { k: 'revenu.canton', l: 'Canton du lieu de travail', t: 'select', options: CANTONS, si: (d) => d.revenu.maintienMode === 'echelle', aide: 'Échelle bâloise : BS, BL. Zurichoise : ZH, SH, TG, GR. Bernoise : autres cantons.' },
      { k: 'revenu.anneesService', l: 'Année de service en cours', t: 'num', min: 1, step: 1, si: (d) => d.revenu.maintienMode === 'echelle' },
      { k: 'revenu.maintienJours', l: 'Durée du maintien du salaire', t: 'num', u: 'jours', si: (d) => d.revenu.maintienMode === 'manuel' },
    ] },
    { titre: 'Besoin de prévoyance', champs: [
      { k: 'besoin.igCourt', l: 'Incapacité de gain — court terme', t: 'pct', aide: 'Pendant le maintien du salaire et les indemnités journalières.' },
      { k: 'besoin.igLong', l: 'Incapacité de gain — long terme', t: 'pct' },
      { k: 'besoin.retraite', l: 'Retraite', t: 'pct' },
      { k: 'besoin.chomage', l: 'Perte d’emploi', t: 'pct' },
      { k: 'besoin.inflation', l: 'Tenir compte du renchérissement (retraite)', t: 'bool' },
      { k: 'besoin.tauxInflation', l: 'Renchérissement des prix', t: 'pct', step: 0.1, si: (d) => d.besoin.inflation },
    ] },
    { titre: '1er pilier — AVS / AI', champs: [
      { k: 'avs.ram', l: 'Revenu annuel moyen déterminant (RAM)', t: 'chf', aide: 'Rente maximale dès CHF ' + chf(72 * P.avs.renteMin) + '. Voir extrait de compte individuel (CI).' },
      { k: 'avs.anneesManquantes', l: 'Années de cotisation manquantes', t: 'num', min: 0, max: 44, step: 1 },
    ] },
    { titre: '2e pilier — LPP', champs: [
      { k: 'lpp.renteCertificat', l: 'Rente de vieillesse projetée (certificat)', t: 'chf', aide: 'Si renseignée, remplace le calcul de projection ci-dessous.' },
      { k: 'lpp.avoir', l: 'Avoir de vieillesse actuel', t: 'chf' },
      { k: 'lpp.modeSalaire', l: 'Salaire assuré', t: 'select', options: [['lpp', 'Minimum LPP (avec déduction de coordination)'], ['complet', 'Salaire complet, sans déduction'], ['manuel', 'Montant selon certificat']] },
      { k: 'lpp.salaireAssure', l: 'Salaire assuré (certificat)', t: 'chf', si: (d) => d.lpp.modeSalaire === 'manuel' },
      { k: 'lpp.bonifMode', l: 'Bonifications de vieillesse', t: 'select', options: [['lpp', 'Minimum LPP (7 / 10 / 15 / 18 %)'], ['plan', 'Selon le plan de prévoyance']] },
      { k: 'lpp.bonifs', l: 'Bonifications 25-34 / 35-44 / 45-54 / 55+ (%)', t: 'bonifs', si: (d) => d.lpp.bonifMode === 'plan' },
      { k: 'lpp.tauxInteret', l: 'Taux d’intérêt projeté', t: 'pct', step: 0.05 },
      { k: 'lpp.tauxConversion', l: 'Taux de conversion', t: 'pct', step: 0.05 },
      { k: 'lpp.rachatAnnuel', l: 'Rachat annuel', t: 'chf' },
      { k: 'lpp.partCapital', l: 'Part retirée en capital à la retraite', t: 'pct' },
      { k: 'lpp.invMode', l: 'Rente d’invalidité LPP', t: 'select', options: [['pct', '% du salaire'], ['montant', 'Montant selon certificat'], ['lppmin', 'Minimum LPP (calculé)']] },
      { k: 'lpp.invPct', l: 'Rente d’invalidité en % du salaire', t: 'pct', si: (d) => d.lpp.invMode === 'pct' },
      { k: 'lpp.invMontant', l: 'Rente d’invalidité annuelle', t: 'chf', si: (d) => d.lpp.invMode === 'montant' },
    ] },
    { titre: 'Perte de gain maladie', champs: [
      { k: 'ij.taux', l: 'Indemnité journalière', t: 'pct' },
      { k: 'ij.finJour', l: 'Fin des indemnités journalières', t: 'num', u: 'jour', aide: 'Généralement 720 ou 730 jours. S’applique aussi aux IJ LAA.' },
      { k: 'ij.plafond', l: 'Salaire maximal assuré (0 = sans plafond)', t: 'chf' },
    ] },
    { titre: '3e pilier', champs: [
      { k: 'p3.affilieLPP', l: 'Affilié à une caisse de pension (LPP)', t: 'bool' },
      { k: 'p3.capital', l: 'Capital 3a actuel', t: 'chf' },
      { k: 'p3.versement', l: 'Versement 3a annuel', t: 'chf', aide: 'Maximum 2026 : CHF ' + chf(P.p3a.maxAvecLPP) + ' (avec LPP) / CHF ' + chf(P.p3a.maxSansLPP) + ' (sans LPP).' },
      { k: 'p3.rendement', l: 'Rendement 3a projeté', t: 'pct', step: 0.1 },
      { k: 'p3.tauxMarginal', l: 'Taux marginal d’imposition', t: 'pct' },
      { k: 'p3.autresRevenus', l: 'Autres revenus à la retraite (CHF/an)', t: 'chf' },
      { k: 'p3.renteIG', l: 'Rente d’incapacité de gain privée (CHF/an)', t: 'chf' },
      { k: 'p3.delaiIG', l: 'Délai d’attente de la rente IG privée', t: 'num', u: 'jours', si: (d) => d.p3.renteIG > 0 },
    ] },
    { titre: 'Perte d’emploi', champs: [
      { k: 'chomage.moisCotisation', l: 'Mois de cotisation (2 dernières années)', t: 'num', min: 0, max: 24, step: 1 },
      { k: 'chomage.preavisMois', l: 'Délai de congé', t: 'num', u: 'mois', step: 1 },
      { k: 'chomage.horizonMois', l: 'Durée analysée', t: 'num', u: 'mois', step: 1 },
    ] },
    { titre: 'Hypothèses', champs: [
      { k: 'hyp.degreInv', l: 'Degré d’invalidité', t: 'pct', step: 1, aide: 'AI/LPP : dès 40 %, rente entière dès 70 %. LAA : proportionnelle dès 10 %.' },
      { k: 'hyp.esperanceVie', l: 'Durée de la retraite (espérance de vie)', t: 'num', u: 'ans', step: 0.1, aide: 'Espérance de vie à 65 ans (OFS, 2024) : hommes 20,4 ans, femmes 23,0 ans.' },
      { k: 'hyp.tauxActualisation', l: 'Taux d’actualisation du besoin en capital', t: 'pct', step: 0.1 },
    ] },
  ];

  const UNITES = { chf: 'CHF', pct: '%' };

  function htmlChamp(c) {
    const id = 'f-' + c.k.replace('.', '-');
    const v = get(dossier, c.k);
    const aide = c.aide ? `<div class="aide">${esc(c.aide)}</div>` : '';
    if (c.t === 'bool') {
      return `<div class="champ bool" data-k="${c.k}"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}><label for="${id}">${esc(c.l)}</label>${aide}</div>`;
    }
    if (c.t === 'select') {
      const opts = c.options.map(([val, txt]) => `<option value="${val}" ${val === v ? 'selected' : ''}>${esc(txt)}</option>`).join('');
      return `<div class="champ" data-k="${c.k}"><label for="${id}">${esc(c.l)}</label><select id="${id}">${opts}</select>${aide}</div>`;
    }
    if (c.t === 'bonifs') {
      const inputs = v.map((x, i) => `<input type="number" step="0.5" min="0" data-i="${i}" value="${x}" aria-label="Tranche ${i + 1}">`).join('');
      return `<div class="champ" data-k="${c.k}"><label>${esc(c.l)}</label><div class="grille4">${inputs}</div>${aide}</div>`;
    }
    if (c.t === 'text' || c.t === 'date') {
      return `<div class="champ" data-k="${c.k}"><label for="${id}">${esc(c.l)}</label><input type="${c.t}" id="${id}" value="${esc(v)}">${aide}</div>`;
    }
    const unite = c.u || UNITES[c.t] || '';
    const step = c.step != null ? c.step : (c.t === 'chf' ? 100 : 1);
    const bornes = (c.min != null ? ` min="${c.min}"` : ' min="0"') + (c.max != null ? ` max="${c.max}"` : '');
    return `<div class="champ" data-k="${c.k}"><label for="${id}">${esc(c.l)}</label>` +
      `<div class="unite"><input type="number" id="${id}" step="${step}"${bornes} value="${v}"><span>${unite}</span></div>${aide}</div>`;
  }

  function construireFormulaire() {
    const el = document.getElementById('formulaire');
    el.innerHTML = SECTIONS.map((s) =>
      `<details ${s.ouvert ? 'open' : ''}><summary>${esc(s.titre)}</summary><div class="champs">${s.champs.map(htmlChamp).join('')}</div></details>`
    ).join('');
    majVisibilite();
  }

  function majVisibilite() {
    for (const s of SECTIONS) for (const c of s.champs) {
      if (!c.si) continue;
      const el = document.querySelector(`.champ[data-k="${c.k}"]`);
      if (el) el.hidden = !c.si(dossier);
    }
  }

  function champDe(k) {
    for (const s of SECTIONS) for (const c of s.champs) if (c.k === k) return c;
    return null;
  }

  document.getElementById('formulaire').addEventListener('input', (ev) => {
    const bloc = ev.target.closest('.champ');
    if (!bloc) return;
    const c = champDe(bloc.dataset.k);
    const t = ev.target;
    if (c.t === 'bool') set(dossier, c.k, t.checked);
    else if (c.t === 'select' || c.t === 'text') set(dossier, c.k, t.value);
    else if (c.t === 'date') { if (!t.value) return; set(dossier, c.k, t.value); }
    else if (c.t === 'bonifs') get(dossier, c.k)[Number(t.dataset.i)] = Number(t.value) || 0;
    else set(dossier, c.k, Number(t.value) || 0);
    sauver();
    majVisibilite();
    rendre();
  });

  // ---------------------------------------------------------------- Résultats

  const GROUPES = [
    { id: 'p1', nom: 'Rentes 1er pilier', couleur: 'var(--c-p1)' },
    { id: 'emp', nom: 'Employeur', couleur: 'var(--c-emp)' },
    { id: 'p2', nom: 'Rentes 2e pilier', couleur: 'var(--c-p2)' },
    { id: 'p3', nom: 'Rentes 3e pilier', couleur: 'var(--c-p3)' },
  ];

  const ONGLETS = [
    { id: 'igMaladie', titre: 'IG maladie', h: 'Incapacité de gain par maladie' },
    { id: 'igAccident', titre: 'IG accident', h: 'Incapacité de gain par accident' },
    { id: 'chomage', titre: 'Perte d’emploi', h: 'Perte d’emploi' },
    { id: 'retraite', titre: 'Retraite', h: 'Retraite' },
  ];
  let ongletActif = 'igMaladie';
  try { ongletActif = localStorage.getItem(CLE_STOCKAGE + '-onglet') || ongletActif; } catch (e) { /* ignoré */ }
  const ancre = location.hash.slice(1);
  if (ONGLETS.some((o) => o.id === ancre)) ongletActif = ancre;

  function montantGroupe(seg, g) {
    return seg.lignes.filter((l) => l.groupe === g).reduce((s, l) => s + l.montant, 0);
  }

  function graphique(sc) {
    const W = 760, H = 320, m = { l: 70, r: 18, t: 34, b: 30 };
    const segs = sc.segments;
    const n = segs.length;

    // Largeurs : racine de la durée, avec un minimum pour rendre les phases courtes lisibles.
    let poids = segs.map((s) => Math.sqrt(Math.max(s.t1 - s.t0, 0.01)));
    const somme = poids.reduce((a, b) => a + b, 0);
    poids = poids.map((p) => Math.max(p / somme, n > 1 ? 0.14 : 1));
    const s2 = poids.reduce((a, b) => a + b, 0);
    const largeur = W - m.l - m.r;
    const xs = [m.l];
    poids.forEach((p) => xs.push(xs[xs.length - 1] + p / s2 * largeur));

    const ymax = Math.max(sc.revenuActuel, ...segs.map((s) => Math.max(s.total, s.besoin))) * 1.06 || 1;
    const y = (v) => m.t + (H - m.t - m.b) * (1 - v / ymax);

    let svg = '';
    const ticks = new Set([0, sc.revenuActuel]);

    segs.forEach((s, i) => {
      const x0 = xs[i], x1 = xs[i + 1];
      let cumul = 0;
      for (const g of GROUPES) {
        const v = montantGroupe(s, g.id);
        if (v <= 0.5) continue;
        svg += `<rect x="${x0}" y="${y(cumul + v)}" width="${x1 - x0}" height="${y(cumul) - y(cumul + v)}" fill="${g.couleur}"/>`;
        cumul += v;
        ticks.add(Math.round(cumul));
      }
      if (s.besoin > s.total + 0.5) {
        svg += `<rect x="${x0}" y="${y(s.besoin)}" width="${x1 - x0}" height="${y(s.total) - y(s.besoin)}" fill="var(--c-lacune)"/>`;
      }
      ticks.add(Math.round(s.besoin));
      if (i > 0) svg += `<line x1="${x0}" x2="${x0}" y1="${m.t}" y2="${H - m.b}" stroke="#fff" stroke-width="1"/>`;
      svg += `<text x="${x0 + 3}" y="${H - m.b + 16}" font-size="11" fill="var(--muted)">${esc(s.debut)}</text>`;
    });

    // Besoin (ligne rouge en escalier) et revenu actuel (ligne bleue)
    let chemin = '';
    segs.forEach((s, i) => { chemin += (i ? 'L' : 'M') + xs[i] + ' ' + y(s.besoin) + 'L' + xs[i + 1] + ' ' + y(s.besoin); });
    svg += `<path d="${chemin}" fill="none" stroke="var(--c-besoin)" stroke-width="2.5"/>`;
    svg += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(sc.revenuActuel)}" y2="${y(sc.revenuActuel)}" stroke="var(--c-revenu)" stroke-width="2"/>`;

    // Axes
    svg += `<line x1="${m.l}" x2="${m.l}" y1="${m.t - 6}" y2="${H - m.b}" stroke="#333"/>`;
    svg += `<line x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}" stroke="#333"/>`;
    let dernierY = Infinity;
    [...ticks].sort((a, b) => a - b).forEach((v) => {
      const yy = y(v);
      if (dernierY - yy < 13) return;
      dernierY = yy;
      svg += `<line x1="${m.l - 4}" x2="${m.l}" y1="${yy}" y2="${yy}" stroke="#333"/>`;
      svg += `<text x="${m.l - 7}" y="${yy + 4}" font-size="11" text-anchor="end" fill="var(--text)">${chf(v)}</text>`;
    });

    // Accolades de phases (segments consécutifs de même phase regroupés)
    let debut = 0;
    for (let i = 1; i <= n; i++) {
      if (i < n && segs[i].phase === segs[debut].phase) continue;
      const x0 = xs[debut], x1 = xs[i];
      const yb = m.t - 16;
      svg += `<line x1="${x0 + 2}" x2="${x1 - 2}" y1="${yb}" y2="${yb}" stroke="#555"/>`;
      svg += `<line x1="${x0 + 2}" x2="${x0 + 2}" y1="${yb - 4}" y2="${yb + 4}" stroke="#555"/><line x1="${x1 - 2}" x2="${x1 - 2}" y1="${yb - 4}" y2="${yb + 4}" stroke="#555"/>`;
      const label = (x1 - x0) > 7 * segs[debut].phase.length ? segs[debut].phase : segs[debut].phase.split(' ')[0] + '…';
      svg += `<text x="${(x0 + x1) / 2}" y="${yb - 5}" font-size="11" text-anchor="middle" fill="var(--text)"><title>${esc(segs[debut].phase)}</title>${esc(label)}</text>`;
      debut = i;
    }

    const legende = [
      `<span><i class="ligne" style="background:var(--c-revenu)"></i>Revenu actuel</span>`,
      `<span><i class="ligne" style="background:var(--c-besoin)"></i>Besoin de prévoyance</span>`,
      `<span><i style="background:var(--c-lacune)"></i>Lacune</span>`,
      ...GROUPES.filter((g) => segs.some((s) => montantGroupe(s, g.id) > 0.5)).map((g) => `<span><i style="background:${g.couleur}"></i>${g.nom}</span>`),
    ].join('');

    return `<div class="graph"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Graphique des prestations">${svg}</svg><div class="legende">${legende}</div></div>`;
  }

  function tableau(sc) {
    const segs = sc.segments;
    const entete = segs.map((s) => `<th>${esc(s.debut)}${s.fin ? '<br>' + esc(s.fin) : ''}</th>`).join('');
    const cell = (v, signe) => {
      if (Math.abs(v) < 0.5) return '<td></td>';
      const cls = signe ? (v < 0 ? 'neg' : 'pos') : '';
      return `<td class="${cls}">${chf(v)}</td>`;
    };
    let corps = '';
    for (const g of GROUPES) {
      const libelles = [...new Set(segs.flatMap((s) => s.lignes.filter((l) => l.groupe === g.id).map((l) => l.libelle)))];
      if (!libelles.length) continue;
      corps += `<tr class="groupe"><td><span class="swatch" style="background:${g.couleur}"></span>${g.nom}</td>${segs.map((s) => cell(montantGroupe(s, g.id))).join('')}</tr>`;
      for (const lib of libelles) {
        corps += `<tr class="detail"><td>${esc(lib)}</td>${segs.map((s) => cell(s.lignes.filter((l) => l.libelle === lib).reduce((a, l) => a + l.montant, 0))).join('')}</tr>`;
      }
    }
    corps += `<tr class="total"><td>Total prestations</td>${segs.map((s) => `<td>${chf(s.total)}</td>`).join('')}</tr>`;
    corps += `<tr><td><span class="swatch" style="background:var(--c-besoin)"></span>Besoin de prévoyance</td>${segs.map((s) => `<td>${chf(s.besoin)}</td>`).join('')}</tr>`;
    corps += `<tr><td><span class="swatch" style="background:var(--c-lacune)"></span>Lacune / excédent</td>${segs.map((s) => cell(s.ecart, true)).join('')}</tr>`;
    return `<div class="table-wrap"><table class="rentes"><thead><tr><th>Rentes annuelles (CHF)</th>${entete}</tr></thead><tbody>${corps}</tbody></table></div>`;
  }

  const info = (label, valeur) => `<div class="info"><div class="label">${esc(label)}</div><div class="valeur">${valeur}</div></div>`;

  function details(id, sc) {
    if (id === 'igMaladie' || id === 'igAccident') {
      return [
        info('Maintien du salaire', sc.maintien.jours + ' jours' + (sc.maintien.echelle ? ' (échelle ' + sc.maintien.echelle + ')' : '')),
        info('Échelle AI', sc.avs.echelleAI + ' / 44'),
        info('Rente AI entière', 'CHF ' + chf(sc.avs.renteAIMensuelle) + ' / mois'),
        info('Degré d’invalidité', dossier.hyp.degreInv + ' % → quote-part ' + Math.round(E.quotePartRente(dossier.hyp.degreInv) * 1000) / 10 + ' %'),
        info('Rente LPP d’invalidité (plan)', 'CHF ' + chf(sc.lpp.renteInvalidite) + ' / an'),
      ].join('');
    }
    if (id === 'chomage') {
      const c = sc.droit;
      return [
        info('Gain assuré', 'CHF ' + chf(c.gainAnnuel) + ' / an'),
        info('Taux d’indemnisation', Math.round(c.taux * 100) + ' %'),
        info('Indemnités journalières', c.indemnites + ' IJ (≈ ' + Math.round(c.indemnites / P.laci.joursParMois * 10) / 10 + ' mois)'),
        info('Délai d’attente', c.delaiAttente + ' jours'),
      ].join('');
    }
    return [
      info('Échelle AVS', sc.avs.echelleRetraite + ' / 44'),
      info('Rente AVS', 'CHF ' + chf(sc.avs.renteVieillesseMensuelle) + ' / mois × ' + sc.avs.nbRentes),
      info('Avoir LPP à la retraite', 'CHF ' + chf(sc.lpp.avoirRetraite) + (sc.lpp.selonCertificat ? ' (déduit du certificat)' : '')),
      info('Rente LPP', 'CHF ' + chf(sc.lpp.renteVieillesse) + ' / an'),
      info('Capital 3a à la retraite', 'CHF ' + chf(sc.p3.capitalRetraite)),
      info('Économie d’impôt 3a', 'CHF ' + chf(sc.p3.economieFiscaleAnnuelle) + ' / an'),
    ].join('');
  }

  function panneau(o, sc) {
    const okLacune = sc.lacune < 0.5;
    return `<div class="panneau ${o.id === ongletActif ? 'actif' : ''}" id="p-${o.id}" role="tabpanel">
      <div class="carte">
        <h2>${esc(o.h)}${dossier.personne.nom ? ' — ' + esc(dossier.personne.nom) : ''}</h2>
        <div class="kpis">
          <div class="kpi"><div class="label">Votre lacune</div><div class="valeur ${okLacune ? 'ok' : ''}">CHF ${chf(sc.lacune)}${okLacune ? '' : ' / an'}</div></div>
          <div class="kpi"><div class="label">Besoin en capital</div><div class="valeur ${okLacune ? 'ok' : ''}">CHF ${chf(sc.besoinCapital)}</div></div>
        </div>
        ${graphique(sc)}
      </div>
      <div class="carte">${tableau(sc)}</div>
      <div class="carte"><h3>Détails du calcul</h3><div class="infos">${details(o.id, sc)}</div></div>
      <div class="carte"><h3>Remarques</h3><ul class="notes">${sc.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>
    </div>`;
  }

  function rendre() {
    let res;
    try {
      res = E.calculerTout(dossier, new Date());
    } catch (e) {
      document.getElementById('panneaux').innerHTML = `<div class="carte">Données incomplètes : ${esc(e.message)}</div>`;
      return;
    }
    document.getElementById('onglets').innerHTML = ONGLETS.map((o) =>
      `<button type="button" role="tab" data-id="${o.id}" aria-selected="${o.id === ongletActif}">${esc(o.titre)}</button>`).join('');
    document.getElementById('panneaux').innerHTML = ONGLETS.map((o) => panneau(o, res[o.id])).join('');
    document.getElementById('titre-rapport').textContent = 'Bilan de prévoyance' + (dossier.personne.nom ? ' — ' + dossier.personne.nom : '');
  }

  document.getElementById('onglets').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-id]');
    if (!b) return;
    ongletActif = b.dataset.id;
    try { localStorage.setItem(CLE_STOCKAGE + '-onglet', ongletActif); } catch (e) { /* ignoré */ }
    rendre();
  });

  // ---------------------------------------------------------------- Actions

  document.getElementById('btn-exporter').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dossier-prevoyance' + (dossier.personne.nom ? '-' + dossier.personne.nom.replace(/\s+/g, '-') : '') + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('btn-importer').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    try {
      dossier = fusionner(DEFAUT, JSON.parse(await f.text()));
      sauver();
      construireFormulaire();
      rendre();
    } catch (e) {
      alert('Fichier de dossier invalide : ' + e.message);
    }
    ev.target.value = '';
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!confirm('Réinitialiser le dossier avec les valeurs par défaut ?')) return;
    dossier = clone(DEFAUT);
    sauver();
    construireFormulaire();
    rendre();
  });

  document.getElementById('btn-imprimer').addEventListener('click', () => window.print());

  document.getElementById('annee-params').textContent = 'Paramètres légaux ' + P.annee;
  construireFormulaire();
  rendre();
})();
