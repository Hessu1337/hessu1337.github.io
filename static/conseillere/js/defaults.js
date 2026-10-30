/* Dossier par défaut — cas d'exemple fictif : départ à la retraite à 65 ans. */
(function (root, factory) {
  const p = factory();
  if (typeof module === 'object' && module.exports) module.exports = p;
  else root.PrevDefaults = p;
})(this, function () {
  return {
    personne: { nom: '', naissance: '1962-03-15', ageRetraite: 65, enfants: false },
    revenu: { brut: 85000, maintienMode: 'echelle', canton: 'VD', anneesService: 10, maintienJours: 30 },
    besoin: { igCourt: 100, igLong: 80, retraite: 70, chomage: 100, inflation: false, tauxInflation: 1 },
    avs: { ram: 85000, anneesManquantes: 0 },
    lpp: {
      avoir: 380000,
      modeSalaire: 'lpp', salaireAssure: 0,
      bonifMode: 'lpp', bonifs: [7, 10, 15, 18],
      tauxInteret: 1.25, tauxConversion: 6.8,
      renteCertificat: 0,
      rachatAnnuel: 0, partCapital: 0,
      invMode: 'lppmin', invPct: 40, invMontant: 0,
    },
    ij: { taux: 80, finJour: 720, plafond: 0 },
    p3: { affilieLPP: true, capital: 60000, versement: 7258, rendement: 1, tauxMarginal: 25, renteIG: 0, delaiIG: 720, autresRevenus: 0 },
    chomage: { moisCotisation: 24, preavisMois: 3, horizonMois: 24 },
    hyp: { degreInv: 100, esperanceVie: 20.4, tauxActualisation: 0 },
  };
});
