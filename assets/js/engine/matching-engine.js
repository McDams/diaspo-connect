/**
 * MatchingEngine - logique métier de mise en relation mentoré / mentor.
 *
 * Règles appliquées (cf. cahier des charges) :
 *  - un mentor ne peut pas dépasser 2 mentorés actifs (en attente
 *    non compris) simultanément ;
 *  - seul le mentoré choisit une préférence de sexe, et elle est prioritaire :
 *    si elle est renseignée, un mentor de sexe différent est écarté ;
 *  - le score de compatibilité pondère ville, école/établissement, domaine
 *    d'étude, langues parlées, budget, disponibilité et type d'accompagnement.
 */
const MatchingEngine = (() => {
  const WEIGHTS = {
    sexe: 25,
    ville: 20,
    ecole: 10,
    domaine: 15,
    langue: 10,
    disponibilite: 10,
    accompagnement: 10,
  };

  function computeScore(mentee, mentor) {
    let score = 0;
    let hardBlock = false;

    if (mentee.sexPreference && mentee.sexPreference !== "aucune") {
      if (mentor.sex === mentee.sexPreference) score += WEIGHTS.sexe;
      else hardBlock = true;
    } else {
      score += WEIGHTS.sexe * 0.6;
    }

    if (mentee.desiredCity && mentor.city && mentee.desiredCity.toLowerCase() === mentor.city.toLowerCase()) {
      score += WEIGHTS.ville;
    }

    if (mentor.school && mentee.school && mentee.school.toLowerCase().includes(mentor.city.toLowerCase())) {
      score += WEIGHTS.ecole;
    } else if (mentor.city === mentee.desiredCity) {
      score += WEIGHTS.ecole * 0.5;
    }

    if (mentor.studyField && mentee.studyField && mentor.studyField.toLowerCase() === mentee.studyField.toLowerCase()) {
      score += WEIGHTS.domaine;
    }

    const commonLangs = (mentor.languages || []).filter((l) => (mentee.languages || []).includes(l));
    if (commonLangs.length) {
      score += WEIGHTS.langue * Math.min(1, commonLangs.length / 2);
    }

    if (mentor.availability === "élevée") score += WEIGHTS.disponibilite;
    else if (mentor.availability === "moyenne") score += WEIGHTS.disponibilite * 0.55;
    else score += WEIGHTS.disponibilite * 0.2;

    const menteeNeeds = mentee.accompagnementType || [];
    const commonHelp = (mentor.helpTypes || []).filter((h) => menteeNeeds.includes(h));
    if (menteeNeeds.length && commonHelp.length) {
      score += WEIGHTS.accompagnement * Math.min(1, commonHelp.length / menteeNeeds.length);
    }

    return { score: Math.round(Math.min(100, score)), hardBlock };
  }

  function countActiveMentees(mentorId, matchings) {
    return matchings.filter((m) => m.mentorId === mentorId && ["validee", "active"].includes(m.status)).length;
  }

  function remainingQuota(mentor, matchings) {
    return Math.max(0, (mentor.maxMentees || 2) - countActiveMentees(mentor.id, matchings));
  }

  function isMentorEligible(mentor, matchings) {
    return mentor.status === "actif" && remainingQuota(mentor, matchings) > 0;
  }

  /** Classe les mentors pour un mentoré donné, du plus au moins compatible. */
  function rankMentors(mentee, mentors, matchings) {
    return mentors
      .map((mentor) => {
        const { score, hardBlock } = computeScore(mentee, mentor);
        return {
          mentor,
          score,
          hardBlock,
          quotaReached: !isMentorEligible(mentor, matchings),
          remainingQuota: remainingQuota(mentor, matchings),
        };
      })
      .filter((entry) => !entry.hardBlock)
      .sort((a, b) => b.score - a.score);
  }

  /** Tente de créer une demande de matching en respectant les règles métier. */
  function requestMatching(mentee, mentor, matchings) {
    if (mentee.matchingId) {
      const existing = matchings.find((m) => m.id === mentee.matchingId);
      if (existing && ["en_attente", "validee", "active"].includes(existing.status)) {
        return { ok: false, error: "DEJA_EN_RELATION", message: "Vous avez déjà un accompagnement en cours ou en attente." };
      }
    }
    if (!isMentorEligible(mentor, matchings)) {
      return { ok: false, error: "QUOTA_ATTEINT", message: "Ce mentor accompagne déjà 2 mentorés actifs. Choisissez un autre profil." };
    }
    if (mentee.sexPreference && mentee.sexPreference !== "aucune" && mentor.sex !== mentee.sexPreference) {
      return { ok: false, error: "INCOMPATIBLE_SEXE", message: "Ce profil ne correspond pas à votre préférence de sexe." };
    }
    const { score } = computeScore(mentee, mentor);
    const now = new Date().toISOString();
    const matching = {
      id: DataStore.nextId("match"),
      menteeId: mentee.id,
      mentorId: mentor.id,
      compatibilityScore: score,
      status: "en_attente",
      requestedAt: now,
      respondedAt: null,
      statusHistory: [{ status: "en_attente", date: now, note: "Demande envoyée par le mentoré" }],
      endReason: null,
    };
    return { ok: true, matching };
  }

  return { computeScore, countActiveMentees, remainingQuota, isMentorEligible, rankMentors, requestMatching };
})();
