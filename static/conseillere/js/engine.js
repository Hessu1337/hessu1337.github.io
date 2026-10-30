/* Moteur de calcul — fonctions pures, sans DOM.
   Navigateur : window.PrevEngine ; Node : require('./engine.js'). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./params.js'));
  else root.PrevEngine = factory(root.PrevParams);
})(this, function (P) {
  'use strict';

  const JOUR_MS = 86400000;
  const ANNEE_JOURS = 365.25;

  function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
  function parseDate(s) {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  }
  function addYears(date, n) {
    const d = new Date(date.getTime());
    const entier = Math.floor(n);
    d.setUTCFullYear(d.getUTCFullYear() + entier);
    return new Date(d.getTime() + (n - entier) * ANNEE_JOURS * JOUR_MS);
  }
  function yearsBetween(a, b) { return (b - a) / (JOUR_MS * ANNEE_JOURS); }

  function contexte(d, today) {
    const naissance = parseDate(d.personne.naissance);
    const dateRetraite = addYears(naissance, d.personne.ageRetraite);
    return {
      today,
      naissance,
      age: yearsBetween(naissance, today),
      dateRetraite,
      anneesAvantRetraite: Math.max(0, yearsBetween(today, dateRetraite)),
    };
  }

  // Facteur d'actualisation d'un flux annuel constant versé entre t0 et t1 (années).
  function facteurCapital(t0, t1, taux) {
    if (t1 <= t0) return 0;
    if (!taux) return t1 - t0;
    const v = Math.log(1 + taux);
    return (Math.exp(-v * t0) - Math.exp(-v * t1)) / v;
  }

  // ---------------------------------------------------------------- AVS / AI

  // Rente mensuelle complète (échelle 44), non arrondie, selon le revenu annuel moyen déterminant
  // (LAVS 34). Le RAM est d'abord porté au palier supérieur des tables OFAS (pas de 1,2 × rente min.).
  function renteAVSComplete(ram) {
    const mn = P.avs.renteMin, mx = P.avs.renteMax;
    const b1 = 12 * mn, b2 = 36 * mn, b3 = 72 * mn, pas = 1.2 * mn;
    if (ram <= b1) return mn;
    if (ram >= b3) return mx;
    const r = Math.min(b3, b1 + Math.ceil((ram - b1) / pas - 1e-9) * pas);
    if (r <= b2) return 0.74 * mn + r * 13 / 600;
    return Math.min(mx, 1.04 * mn + r * 8 / 600);
  }

  function echelleRetraite(anneesManquantes) {
    return clamp(P.avs.echelleComplete - anneesManquantes, 0, P.avs.echelleComplete);
  }

  // Échelle AI : années cotisées / années de la classe d'âge jusqu'à la survenance, arrondi
  // à l'échelle supérieure (RAVS 52, indicateur d'échelles OFAS : 10 ans sur 39 → échelle 12).
  function echelleAI(naissance, dateRef, anneesManquantes) {
    const cohorte = dateRef.getUTCFullYear() - naissance.getUTCFullYear() - 21;
    if (cohorte <= 0) return P.avs.echelleComplete;
    if (cohorte >= P.avs.echelleComplete) return echelleRetraite(anneesManquantes);
    const cotisees = Math.max(0, cohorte - anneesManquantes);
    if (cotisees === 0) return 0;
    return clamp(Math.ceil(cotisees / cohorte * 44 - 1e-9), 1, 44);
  }

  // Rente partielle : rente complète non arrondie × pourcentage de l'échelle arrondi au centième de %,
  // puis arrondi au franc (conforme aux tables des rentes OFAS 2025 : échelle 13 → 29,55 %, 745 au RAM max.).
  function renteMensuelle(ram, echelle) {
    const pct = Math.round(echelle / P.avs.echelleComplete * 10000) / 10000;
    return Math.round(renteAVSComplete(ram) * pct);
  }

  function facteurAgeAVS(ageRetraite) {
    const diff = ageRetraite - P.avs.ageReference;
    if (diff < 0) return 1 - P.avs.reductionAnticipation * Math.min(2, -diff);
    const s = P.avs.supplementAjournement;
    const n = Math.min(s.length - 1, diff);
    const i = Math.floor(n);
    const sup = i >= s.length - 1 ? s[i] : s[i] + (s[i + 1] - s[i]) * (n - i);
    return 1 + sup;
  }

  // Quote-part de rente selon le degré d'invalidité (LAI 28b / LPP 24a).
  function quotePartRente(degre) {
    if (degre < 40) return 0;
    if (degre < 50) return 0.25 + 0.025 * (degre - 40);
    if (degre < 70) return degre / 100;
    return 1;
  }

  function calculAVS(d, ctx) {
    const echRet = echelleRetraite(d.avs.anneesManquantes);
    const echAI = echelleAI(ctx.naissance, ctx.today, d.avs.anneesManquantes);
    const mensRet = renteMensuelle(d.avs.ram, echRet);
    const mensRetAjustee = Math.round(mensRet * facteurAgeAVS(d.personne.ageRetraite));
    const nbRentes = P.avs.treiziemeRente ? 13 : 12;
    const mensAI = renteMensuelle(d.avs.ram, echAI);
    return {
      echelleRetraite: echRet,
      echelleAI: echAI,
      renteVieillesseMensuelle: mensRetAjustee,
      renteVieillesseAnnuelle: mensRetAjustee * nbRentes,
      nbRentes,
      renteAIMensuelle: mensAI,
      renteAIAnnuelle: Math.round(mensAI * 12 * quotePartRente(d.hyp.degreInv)),
    };
  }

  // ---------------------------------------------------------------- LPP

  function salaireCoordonneLPPMin(brut) {
    const L = P.lpp;
    if (brut < L.seuilEntree) return 0;
    return Math.max(L.salaireCoordonneMin, Math.min(brut, L.salaireMax) - L.deductionCoordination);
  }

  function salaireCoordonne(d) {
    if (d.lpp.modeSalaire === 'manuel') return d.lpp.salaireAssure;
    if (d.lpp.modeSalaire === 'complet') return d.revenu.brut;
    return salaireCoordonneLPPMin(d.revenu.brut);
  }

  function tauxBonification(age, tauxPlan) {
    const b = P.lpp.bonifications;
    for (let i = 0; i < b.length; i++) {
      if (age >= b[i].de && age <= b[i].a) return tauxPlan ? tauxPlan[i] : b[i].taux;
    }
    return 0;
  }

  function projectionLPP(d, ctx) {
    const L = d.lpp;
    const coord = salaireCoordonne(d);
    const coordMin = salaireCoordonneLPPMin(d.revenu.brut);
    const plan = L.bonifMode === 'plan' ? L.bonifs.map((x) => x / 100) : null;
    const r = L.tauxInteret / 100;
    const conv = L.tauxConversion / 100;
    const n = ctx.anneesAvantRetraite;

    let avoir = L.avoir;
    let avoirSansInteret = L.avoir; // base de la rente d'invalidité minimale LPP
    for (let t = 0; t < n - 1e-9;) {
      const frac = Math.min(1, n - t);
      const age = Math.floor(ctx.age + t);
      avoir = avoir * Math.pow(1 + r, frac) + (coord * tauxBonification(age, plan) + L.rachatAnnuel) * frac;
      avoirSansInteret += coordMin * tauxBonification(age, null) * frac;
      t += frac;
    }

    const renteCalculee = avoir * conv;
    const selonCertificat = L.renteCertificat > 0;
    const renteVieillesse = selonCertificat ? L.renteCertificat : renteCalculee;
    const avoirRetraite = selonCertificat && conv > 0 ? L.renteCertificat / conv : avoir;

    let renteInvPlan;
    if (L.invMode === 'pct') renteInvPlan = d.revenu.brut * L.invPct / 100;
    else if (L.invMode === 'montant') renteInvPlan = L.invMontant;
    else renteInvPlan = avoirSansInteret * P.lpp.tauxConversionMin;

    return {
      salaireCoordonne: coord,
      avoirRetraite,
      renteCalculee,
      selonCertificat,
      renteVieillesse,
      renteInvalidite: renteInvPlan * quotePartRente(d.hyp.degreInv),
    };
  }

  // ---------------------------------------------------------------- 3e pilier

  function projection3a(d, ctx) {
    const r = d.p3.rendement / 100;
    const n = ctx.anneesAvantRetraite;
    let capital = d.p3.capital;
    let verse = 0;
    for (let t = 0; t < n - 1e-9;) {
      const frac = Math.min(1, n - t);
      capital = capital * Math.pow(1 + r, frac) + d.p3.versement * frac;
      verse += d.p3.versement * frac;
      t += frac;
    }
    const max = d.p3.affilieLPP ? P.p3a.maxAvecLPP : P.p3a.maxSansLPP;
    return {
      capitalRetraite: capital,
      totalVerse: verse,
      economieFiscaleAnnuelle: Math.min(d.p3.versement, max) * d.p3.tauxMarginal / 100,
      versementMax: max,
      depassement: d.p3.versement > max,
    };
  }

  // ---------------------------------------------------------------- Maintien du salaire

  // Durée du maintien du salaire par l'employeur (jours), selon l'échelle du canton ou le contrat.
  function maintienSalaire(d) {
    const r = d.revenu;
    if (r.maintienMode === 'manuel') return { jours: r.maintienJours, echelle: null };
    const M = P.maintien;
    const echelle = M.echelles[M.cantons[r.canton] || 'berne'];
    const annee = Math.max(1, Math.floor(r.anneesService));
    let ligne = echelle.lignes[0];
    for (const l of echelle.lignes) if (annee >= l.des) ligne = l;
    const jours = ligne.semaines != null
      ? (ligne.semaines + (ligne.parAn || 0) * (annee - ligne.des)) * 7
      : ligne.mois * M.joursParMois;
    return { jours, echelle: echelle.nom };
  }

  // ---------------------------------------------------------------- Scénarios

  function segment(o) {
    const lignes = o.lignes.filter((l) => l.montant > 0.5);
    const total = lignes.reduce((s, l) => s + l.montant, 0);
    return Object.assign({}, o, { lignes, total, ecart: total - o.besoin });
  }

  function resumer(segments, taux, decalage) {
    let besoinCapital = 0;
    let lacune = 0;
    for (const s of segments) {
      const manque = Math.max(0, s.besoin - s.total);
      lacune = Math.max(lacune, manque);
      besoinCapital += manque * facteurCapital(s.t0 - (decalage || 0), s.t1 - (decalage || 0), taux);
    }
    return { lacune, besoinCapital };
  }

  function scenarioIG(d, cause, today) {
    const ctx = contexte(d, today);
    const brut = d.revenu.brut;
    const ms = maintienSalaire(d);
    const maintien = ms.jours;
    const finIJ = d.ij.finJour;
    const avs = calculAVS(d, ctx);
    const lpp = projectionLPP(d, ctx);
    const jourFin = ctx.anneesAvantRetraite * 365 + 1;
    const gainLAA = Math.min(brut, P.laa.gainMax);
    // LAA : rente proportionnelle au degré, dès 10 % (contrairement à l'AI/LPP, dès 40 %).
    const degre = d.hyp.degreInv >= P.laa.seuilRente ? d.hyp.degreInv / 100 : 0;

    const ruptures = [1, maintien + 1, finIJ + 1];
    if (d.p3.renteIG > 0) ruptures.push(d.p3.delaiIG + 1);
    const jours = [...new Set(ruptures)].filter((j) => j >= 1 && j < jourFin).sort((a, b) => a - b);

    function revenus(jour) {
      const l = [];
      if (jour <= maintien) {
        l.push({ groupe: 'emp', libelle: 'Maintien du salaire (employeur)', montant: brut });
      } else if (jour <= finIJ) {
        if (cause === 'maladie') {
          const base = d.ij.plafond > 0 ? Math.min(brut, d.ij.plafond) : brut;
          l.push({ groupe: 'p2', libelle: 'Perte de gain maladie, indemnité journalière', montant: base * d.ij.taux / 100 });
        } else {
          l.push({ groupe: 'p2', libelle: 'LAA, indemnité journalière', montant: gainLAA * P.laa.tauxIJ });
        }
      } else {
        const ai = avs.renteAIAnnuelle;
        l.push({ groupe: 'p1', libelle: "AI, rente d'invalidité", montant: ai });
        let laa = 0;
        if (cause === 'accident') {
          const plein = gainLAA * P.laa.tauxRente * degre;
          laa = Math.min(plein, Math.max(0, gainLAA * P.laa.plafondCoordination * degre - ai));
          l.push({ groupe: 'p2', libelle: "LAA, rente d'invalidité complémentaire", montant: laa });
        }
        const plafond = brut * P.lpp.plafondSurindemnisation;
        const lppInv = Math.min(lpp.renteInvalidite, Math.max(0, plafond - ai - laa));
        l.push({ groupe: 'p2', libelle: "LPP, rente d'invalidité", montant: lppInv });
      }
      if (d.p3.renteIG > 0 && jour > d.p3.delaiIG) {
        l.push({ groupe: 'p3', libelle: 'Assurance privée, rente IG', montant: d.p3.renteIG });
      }
      return l;
    }

    const segments = jours.map((j, i) => {
      const fin = i + 1 < jours.length ? jours[i + 1] - 1 : null;
      const court = j <= finIJ;
      return segment({
        phase: court ? 'Inc. gain à court terme' : 'Incapacité de gain à long terme',
        debut: 'Jour ' + j,
        fin: fin ? 'Jour ' + fin : 'Âge ' + d.personne.ageRetraite,
        t0: (j - 1) / 365,
        t1: fin ? fin / 365 : ctx.anneesAvantRetraite,
        lignes: revenus(j),
        besoin: brut * (court ? d.besoin.igCourt : d.besoin.igLong) / 100,
      });
    });

    const notes = [
      ms.echelle
        ? 'Maintien du salaire : ' + maintien + ' jours (échelle ' + ms.echelle + ', canton ' + d.revenu.canton + ', ' + Math.max(1, Math.floor(d.revenu.anneesService)) + 'e année de service, CO 324a). Un contrat, une CCT ou une assurance IJM peut prévoir mieux.'
        : 'Maintien du salaire : ' + maintien + ' jours selon le contrat.',
      "Rentes d'enfant AI/LPP/LAA non incluses.",
      'Rente LPP plafonnée à 90 % du revenu (surindemnisation), après AI' + (cause === 'accident' ? ' et LAA.' : '.'),
    ];
    if (cause === 'accident') notes.push('Gain assuré LAA plafonné à CHF ' + P.laa.gainMax.toLocaleString('fr-CH') + '. Assurance complémentaire LAA non incluse.');
    if (lpp.renteInvalidite === 0) notes.push("Aucune rente d'invalidité LPP saisie.");

    return Object.assign({ segments, revenuActuel: brut, notes, avs, lpp, maintien: ms },
      resumer(segments, d.hyp.tauxActualisation / 100));
  }

  function scenarioRetraite(d, today) {
    const ctx = contexte(d, today);
    const avs = calculAVS(d, ctx);
    const lpp = projectionLPP(d, ctx);
    const p3 = projection3a(d, ctx);
    const duree = d.hyp.esperanceVie;
    const part = d.lpp.partCapital / 100;
    const capitalLPP = lpp.avoirRetraite * part;

    const lignes = [
      { groupe: 'p1', libelle: 'AVS, rente de vieillesse (' + avs.nbRentes + ' rentes)', montant: avs.renteVieillesseAnnuelle },
      { groupe: 'p2', libelle: 'LPP, rente de vieillesse', montant: lpp.renteVieillesse * (1 - part) },
      { groupe: 'p2', libelle: 'LPP, capital (équivalent rente)', montant: duree > 0 ? capitalLPP / duree : 0 },
      { groupe: 'p3', libelle: '3e pilier a, capital (équivalent rente)', montant: duree > 0 ? p3.capitalRetraite / duree : 0 },
    ];
    if (d.p3.autresRevenus > 0) lignes.push({ groupe: 'p3', libelle: 'Autres revenus (3b, fortune, immobilier)', montant: d.p3.autresRevenus });

    const inflation = d.besoin.inflation ? Math.pow(1 + d.besoin.tauxInflation / 100, ctx.anneesAvantRetraite) : 1;
    const t0 = ctx.anneesAvantRetraite;
    const segments = [segment({
      phase: 'Retraite',
      debut: 'Âge ' + d.personne.ageRetraite,
      fin: '',
      t0, t1: t0 + duree,
      lignes,
      besoin: d.revenu.brut * d.besoin.retraite / 100 * inflation,
    })];

    const notes = [
      'Besoin en capital calculé à la date de la retraite sur ' + duree.toLocaleString('fr-CH') + ' ans.',
      'Les capitaux (LPP, 3a) sont convertis en équivalent rente sur la même durée, sans rendement.',
      'Plafonnement des rentes AVS de couple (150 %) non pris en compte.',
    ];
    if (lpp.selonCertificat) notes.push('Rente LPP reprise du certificat de prévoyance.');
    if (d.personne.ageRetraite !== P.avs.ageReference) notes.push("Rente AVS ajustée pour l'anticipation/ajournement ; taux de conversion LPP non ajusté.");
    if (p3.depassement) notes.push('Versement 3a supérieur au maximum déductible (CHF ' + p3.versementMax.toLocaleString('fr-CH') + ').');

    return Object.assign({ segments, revenuActuel: d.revenu.brut, notes, avs, lpp, p3, capitalLPP },
      resumer(segments, d.hyp.tauxActualisation / 100, t0));
  }

  function droitChomage(d, ctx) {
    const L = P.laci;
    const gainAnnuel = Math.min(d.revenu.brut, L.gainMax);
    const gainMensuel = gainAnnuel / 12;
    const enfants = d.personne.enfants;
    const taux = (enfants || gainMensuel <= L.seuilTauxMajore) ? L.tauxMajore : L.tauxBase;
    const mois = d.chomage.moisCotisation;
    const age = ctx.age;

    let ij;
    if (mois < 12) ij = 0;
    else if (age < 25 && !enfants) ij = 200;
    else if (age >= 55 && mois >= 22) ij = 520;
    else if (mois >= 18) ij = 400;
    else ij = 260;
    const ageRef = P.avs.ageReference;
    if (ij > 0 && age >= ageRef - 4) ij += 120;

    let delai = L.delaiGeneral;
    if (!enfants) for (const s of L.delaisSansEnfants) if (gainAnnuel >= s.des) delai = s.jours;

    return { gainAnnuel, taux, indemnites: ij, delaiAttente: delai, montantAnnuel: gainAnnuel * taux };
  }

  function scenarioChomage(d, today) {
    const ctx = contexte(d, today);
    const L = P.laci;
    const droit = droitChomage(d, ctx);
    const brut = d.revenu.brut;
    const besoin = brut * d.besoin.chomage / 100;
    const horizon = d.chomage.horizonMois;

    const phases = [];
    if (d.chomage.preavisMois > 0) phases.push({ phase: 'Délai de congé', mois: d.chomage.preavisMois, lignes: [{ groupe: 'emp', libelle: 'Salaire (délai de congé)', montant: brut }] });
    if (droit.indemnites > 0) {
      phases.push({ phase: "Délai d'attente", mois: droit.delaiAttente / L.joursParMois, lignes: [] });
      phases.push({ phase: 'Indemnités de chômage', mois: droit.indemnites / L.joursParMois, lignes: [{ groupe: 'p1', libelle: 'Assurance chômage (LACI), indemnités', montant: droit.montantAnnuel }] });
    }
    const utilise = phases.reduce((s, p) => s + p.mois, 0);
    if (horizon > utilise) phases.push({ phase: 'Fin de droit', mois: horizon - utilise, lignes: [] });

    let m = 0;
    const segments = [];
    for (const p of phases) {
      const fin = Math.min(m + p.mois, Math.max(horizon, m));
      if (fin <= m) break;
      segments.push(segment({
        phase: p.phase,
        debut: 'Mois ' + Math.round(m * 10) / 10,
        fin: 'Mois ' + Math.round(fin * 10) / 10,
        t0: m / 12, t1: fin / 12,
        lignes: p.lignes,
        besoin,
      }));
      m = fin;
    }

    const notes = [
      "Indemnité versée sur " + L.joursParMois + ' jours ouvrables par mois en moyenne ; gain assuré plafonné à CHF ' + L.gainMax.toLocaleString('fr-CH') + '.',
      "Pendant le chômage, l'épargne LPP s'arrête ; seuls les risques décès/invalidité sont couverts (Fondation institution supplétive).",
      "Délai d'attente et nombre d'indemnités estimés selon les règles générales (LACI 18, 27) — à confirmer par la caisse de chômage.",
    ];
    if (droit.indemnites === 0) notes.push('Période de cotisation inférieure à 12 mois : pas de droit aux indemnités (hors cas de libération).');

    return Object.assign({ segments, revenuActuel: brut, notes, droit },
      resumer(segments, d.hyp.tauxActualisation / 100));
  }

  function calculerTout(d, today) {
    today = today || new Date();
    return {
      igMaladie: scenarioIG(d, 'maladie', today),
      igAccident: scenarioIG(d, 'accident', today),
      chomage: scenarioChomage(d, today),
      retraite: scenarioRetraite(d, today),
    };
  }

  return {
    P,
    renteAVSComplete, renteMensuelle, echelleRetraite, echelleAI, facteurAgeAVS, quotePartRente,
    salaireCoordonne, salaireCoordonneLPPMin, projectionLPP, projection3a, droitChomage,
    maintienSalaire, scenarioIG, scenarioRetraite, scenarioChomage, calculerTout, contexte, facteurCapital,
  };
});
