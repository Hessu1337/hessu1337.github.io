/* Valeurs légales 2026 (sources : OFAS / admin.ch). À mettre à jour chaque année. */
(function (root, factory) {
  const p = factory();
  if (typeof module === 'object' && module.exports) module.exports = p;
  else root.PrevParams = p;
})(this, function () {
  return {
    annee: 2026,

    avs: {
      renteMin: 1260,          // CHF/mois, échelle 44
      renteMax: 2520,
      echelleComplete: 44,
      ageReference: 65,
      treiziemeRente: true,    // dès déc. 2026, rentes de vieillesse uniquement (pas AI ni survivants)
      reductionAnticipation: 0.068, // par année d'anticipation (max. 2 ans)
      supplementAjournement: [0, 0.052, 0.108, 0.171, 0.24, 0.315], // 0 à 5 ans
    },

    lpp: {
      seuilEntree: 22680,
      deductionCoordination: 26460,
      salaireMax: 90720,
      salaireCoordonneMin: 3780,
      tauxInteretMin: 0.0125,
      tauxConversionMin: 0.068,
      bonifications: [
        { de: 25, a: 34, taux: 0.07 },
        { de: 35, a: 44, taux: 0.10 },
        { de: 45, a: 54, taux: 0.15 },
        { de: 55, a: 70, taux: 0.18 },
      ],
      plafondSurindemnisation: 0.9,
    },

    laa: {
      gainMax: 148200,
      seuilRente: 10,          // degré minimal donnant droit à une rente LAA (%)
      tauxIJ: 0.8,
      tauxRente: 0.8,
      plafondCoordination: 0.9, // AI + LAA ≤ 90 % du gain assuré
    },

    laci: {
      gainMax: 148200,
      tauxBase: 0.7,
      tauxMajore: 0.8,
      seuilTauxMajore: 3797,   // gain assuré mensuel
      joursParMois: 21.7,
      delaiGeneral: 5,
      // Délais d'attente spéciaux sans obligation d'entretien (OACI 6a)
      delaisSansEnfants: [
        { des: 60001, jours: 10 },
        { des: 90001, jours: 15 },
        { des: 125001, jours: 20 },
      ],
    },

    // Maintien du salaire en cas de maladie (CO 324a) : échelles jurisprudentielles cantonales.
    // Source : Portail PME de la Confédération (kmu.admin.ch), « Skalen zur Lohnfortzahlung bei Krankheit ».
    // Chaque ligne s'applique dès l'année de service `des` ; `parAn` ajoute des semaines par année suivante.
    maintien: {
      joursParMois: 30,
      echelles: {
        berne: { nom: 'bernoise', lignes: [
          { des: 1, semaines: 3 }, { des: 2, mois: 1 }, { des: 3, mois: 2 }, { des: 5, mois: 3 },
          { des: 10, mois: 4 }, { des: 15, mois: 5 }, { des: 20, mois: 6 },
        ] },
        bale: { nom: 'bâloise', lignes: [
          { des: 1, semaines: 3 }, { des: 2, mois: 2 }, { des: 4, mois: 3 },
          { des: 11, mois: 4 }, { des: 16, mois: 5 }, { des: 21, mois: 6 },
        ] },
        zurich: { nom: 'zurichoise', lignes: [
          { des: 1, semaines: 3 }, { des: 2, semaines: 8, parAn: 1 },
        ] },
      },
      // Cantons hors échelle bernoise (appliquée partout ailleurs, dont toute la Suisse romande).
      cantons: { BS: 'bale', BL: 'bale', ZH: 'zurich', SH: 'zurich', TG: 'zurich', GR: 'zurich' },
    },

    p3a: {
      maxAvecLPP: 7258,
      maxSansLPP: 36288,
    },
  };
});
