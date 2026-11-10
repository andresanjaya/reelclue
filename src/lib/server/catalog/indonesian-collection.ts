import "server-only";

/**
 * RC-028: Indonesian Movie Collection Research & Familiarity Calibration
 *
 * Implements candidate coverage analysis, global 500-vote floor isolation,
 * dual-alias title resolution (Indonesian + English), and calibrated tiering
 * proposals for Indonesian cinema.
 */

export const INDONESIAN_COLLECTION_VERSION = "id-v1";
export const GLOBAL_TIERING_VERSION = "tiering-v1";

/**
 * Real empirical counts retrieved directly from TMDB for Indonesian films
 * (with_original_language = 'id').
 * Measured: November 2026.
 */
export const INDONESIAN_TMDB_CANDIDATE_COUNTS = {
  totalCatalogMovies: 7181,
  byVoteFloor: {
    gte500: 4,
    gte200: 12,
    gte100: 17,
    gte50: 34,
    gte20: 101,
    gte10: 246,
  },
} as const;

export type GlobalFloorMovie = {
  tmdb_id: number;
  title: string;
  original_title: string;
  release_year: number;
  vote_count: number;
  vote_average: number;
  popularity: number;
  global_band: "easy" | "medium" | "hard";
  global_tier: "easy" | "medium" | "hard" | null;
};

/**
 * Movies with original_language='id' meeting the global 500-vote floor.
 */
export const INDONESIAN_GLOBAL_FLOOR_MOVIES: readonly GlobalFloorMovie[] = [
  {
    tmdb_id: 94329,
    title: "The Raid",
    original_title: "Serbuan Maut",
    release_year: 2012,
    vote_count: 4117,
    vote_average: 7.4,
    popularity: 5.76,
    global_band: "medium", // Fails Easy floor (>=5000), meets Medium floor (>=1500)
    global_tier: "medium",
  },
  {
    tmdb_id: 180299,
    title: "The Raid 2",
    original_title: "The Raid 2: Berandal",
    release_year: 2014,
    vote_count: 2739,
    vote_average: 7.6,
    popularity: 5.81,
    global_band: "medium", // Meets Medium floor (>=1500)
    global_tier: "medium",
  },
  {
    tmdb_id: 449992,
    title: "The Night Comes For Us",
    original_title: "The Night Comes For Us",
    release_year: 2018,
    vote_count: 896,
    vote_average: 6.97,
    popularity: 4.12,
    global_band: "hard", // 500-9999 votes, but rating < 7.0 (6.97), fails Hard rating gate
    global_tier: null,
  },
  {
    tmdb_id: 403605,
    title: "Headshot",
    original_title: "Headshot",
    release_year: 2016,
    vote_count: 518,
    vote_average: 6.43,
    popularity: 3.01,
    global_band: "hard", // 500-9999 votes, but rating < 7.0 (6.43), fails Hard rating gate
    global_tier: null,
  },
] as const;

/**
 * Evaluates the Indonesian candidate pool under the strict global 500-vote floor.
 * Confirms that global rules produce immediate catalog shortages for an Indonesian collection.
 */
export function evaluateIndonesianUnderGlobalFloor() {
  const candidates = INDONESIAN_GLOBAL_FLOOR_MOVIES;
  const approved = candidates.filter((m) => m.global_tier !== null);

  const tiers = {
    easy: approved.filter((m) => m.global_tier === "easy").length,
    medium: approved.filter((m) => m.global_tier === "medium").length,
    hard: approved.filter((m) => m.global_tier === "hard").length,
  };

  const shortages: string[] = [];
  if (tiers.easy < 10) {
    shortages.push(`tier_easy_shortage:${tiers.easy}<10 (0 movies qualify under global 5000-vote floor)`);
  }
  if (tiers.medium < 10) {
    shortages.push(`tier_medium_shortage:${tiers.medium}<10 (only 2 movies qualify under global 1500-vote floor)`);
  }
  if (tiers.hard < 10) {
    shortages.push(`tier_hard_shortage:${tiers.hard}<10 (0 movies qualify under global 500-vote + 7.0 rating floor)`);
  }

  return {
    globalFloor: 500,
    totalCandidates: candidates.length,
    approvedCount: approved.length,
    tiers,
    shortages,
    isViableUnderGlobalRules: false,
  };
}

/**
 * Proposed Collection-Specific Tiering Policy for Indonesian Cinema (id-v1).
 * Requires explicit PRD review before database migration or activation.
 */
export const INDONESIAN_TIERING_POLICY_PROPOSAL = {
  version: INDONESIAN_COLLECTION_VERSION,
  collection_id: "indonesia",
  minimumVoteFloor: 15, // Preserves audience evidence, excludes 0-vote entries
  tiers: {
    easy: {
      name: "Easy",
      description: "Household name blockbusters and cultural staples with verified mass domestic awareness",
      criteria: "vote_count >= 30 AND popularity >= 1.0 (or domestic cultural landmark)",
      targetCount: 15,
    },
    medium: {
      name: "Medium",
      description: "Popular cinema, celebrated horror, and prominent streaming/festival releases",
      criteria: "vote_count >= 20",
      targetCount: 15,
    },
    hard: {
      name: "Hard",
      description: "Established hidden gems, indie festival darlings, and acclaimed cult classics",
      criteria: "vote_count >= 15 AND vote_average >= 6.5",
      targetCount: 15,
    },
  },
} as const;

export type IndonesianMovieEntry = {
  tmdb_id: number;
  title: string;
  original_title: string;
  release_year: number;
  vote_count: number;
  vote_average: number;
  popularity: number;
  directors: string[];
  cast_members: string[];
  genres: string[];
  approved_aliases: string[];
  proposed_tier: "easy" | "medium" | "hard";
  rationale: string;
};

/**
 * Representative Calibrated Sample of Indonesian Cinema.
 * Verified metrics directly from TMDB.
 * Zero invented local audience numbers.
 * Dual-alias resolution covering both Indonesian and international English titles.
 */
export const INDONESIAN_CALIBRATED_SAMPLE: readonly IndonesianMovieEntry[] = [
  // --- EASY TIER (High awareness cultural staples & global hits) ---
  {
    tmdb_id: 94329,
    title: "The Raid",
    original_title: "Serbuan Maut",
    release_year: 2012,
    vote_count: 4117,
    vote_average: 7.4,
    popularity: 5.76,
    directors: ["Gareth Evans"],
    cast_members: ["Iko Uwais", "Joe Taslim", "Donny Alamsyah", "Yayan Ruhian"],
    genres: ["Action", "Thriller"],
    approved_aliases: ["Serbuan Maut", "The Raid", "The Raid: Redemption"],
    proposed_tier: "easy",
    rationale: "Globally iconic martial arts action film, universally recognized in Indonesia and abroad.",
  },
  {
    tmdb_id: 180299,
    title: "The Raid 2",
    original_title: "The Raid 2: Berandal",
    release_year: 2014,
    vote_count: 2739,
    vote_average: 7.6,
    popularity: 5.81,
    directors: ["Gareth Evans"],
    cast_members: ["Iko Uwais", "Arifin Putra", "Tio Pakusadewo", "Oka Antara", "Julie Estelle"],
    genres: ["Action", "Crime", "Thriller"],
    approved_aliases: ["The Raid 2: Berandal", "The Raid 2", "The Raid 2: Retaliation"],
    proposed_tier: "easy",
    rationale: "Critically acclaimed sequel with major international and domestic popularity.",
  },
  {
    tmdb_id: 467012,
    title: "Satan's Slaves",
    original_title: "Pengabdi Setan",
    release_year: 2017,
    vote_count: 332,
    vote_average: 6.7,
    popularity: 3.54,
    directors: ["Joko Anwar"],
    cast_members: ["Tara Basro", "Bront Palarae", "Endy Arfian", "Nasar Anuz"],
    genres: ["Horror", "Mystery"],
    approved_aliases: ["Pengabdi Setan", "Satan's Slaves"],
    proposed_tier: "easy",
    rationale: "Record-breaking horror blockbuster redefining modern Indonesian genre cinema.",
  },
  {
    tmdb_id: 572468,
    title: "Impetigore",
    original_title: "Perempuan Tanah Jahanam",
    release_year: 2019,
    vote_count: 260,
    vote_average: 6.6,
    popularity: 2.04,
    directors: ["Joko Anwar"],
    cast_members: ["Tara Basro", "Marissa Anita", "Asmara Abigail", "Christine Hakim"],
    genres: ["Horror", "Mystery"],
    approved_aliases: ["Perempuan Tanah Jahanam", "Impetigore"],
    proposed_tier: "easy",
    rationale: "Widely watched folk horror and Indonesian Academy Award (FFI) winner.",
  },
  {
    tmdb_id: 22421,
    title: "The Rainbow Troops",
    original_title: "Laskar Pelangi",
    release_year: 2008,
    vote_count: 33,
    vote_average: 7.5,
    popularity: 1.1,
    directors: ["Riri Riza"],
    cast_members: ["Cut Mini Theo", "Ikranagara", "Tora Sudiro", "Slamet Rahardjo"],
    genres: ["Drama"],
    approved_aliases: ["Laskar Pelangi", "The Rainbow Troops"],
    proposed_tier: "easy",
    rationale: "One of the most culturally significant and highest-attended domestic films in Indonesian history.",
  },
  {
    tmdb_id: 39060,
    title: "What's Up with Cinta?",
    original_title: "Ada Apa dengan Cinta?",
    release_year: 2002,
    vote_count: 54,
    vote_average: 7.5,
    popularity: 1.25,
    directors: ["Rudy Soedjarwo"],
    cast_members: ["Dian Sastrowardoyo", "Nicholas Saputra", "Titi Kamal", "Ladya Cheryl"],
    genres: ["Drama", "Romance"],
    approved_aliases: ["Ada Apa dengan Cinta?", "Ada Apa Dengan Cinta", "AADC", "What's Up with Cinta?"],
    proposed_tier: "easy",
    rationale: "The landmark teen romance that revitalized the Indonesian cinema industry in 2002.",
  },
  {
    tmdb_id: 492459,
    title: "Dilan 1990",
    original_title: "Dilan 1990",
    release_year: 2018,
    vote_count: 39,
    vote_average: 7.3,
    popularity: 1.6,
    directors: ["Fajar Bustomi", "Pidi Baiq"],
    cast_members: ["Iqbaal Ramadhan", "Vanesha Prescilla", "Debo Andryos", "Gusti Rayhan"],
    genres: ["Romance", "Drama"],
    approved_aliases: ["Dilan 1990"],
    proposed_tier: "easy",
    rationale: "Phenomenal domestic box office success and ubiquitous Indonesian pop-culture staple.",
  },

  // --- MEDIUM TIER (Popular genre cinema & notable streaming releases) ---
  {
    tmdb_id: 449992,
    title: "The Night Comes For Us",
    original_title: "The Night Comes For Us",
    release_year: 2018,
    vote_count: 896,
    vote_average: 6.97,
    popularity: 4.12,
    directors: ["Timo Tjahjanto"],
    cast_members: ["Joe Taslim", "Iko Uwais", "Julie Estelle", "Sunny Pang"],
    genres: ["Action", "Thriller"],
    approved_aliases: ["The Night Comes For Us", "The Night Comes for Us"],
    proposed_tier: "medium",
    rationale: "High-octane action thriller streaming hit featuring Indonesia's top action stars.",
  },
  {
    tmdb_id: 516700,
    title: "Gundala",
    original_title: "Gundala",
    release_year: 2019,
    vote_count: 349,
    vote_average: 6.2,
    popularity: 0.69,
    directors: ["Joko Anwar"],
    cast_members: ["Abimana Aryasatya", "Tara Basro", "Bront Palarae", "Ario Bayu"],
    genres: ["Action", "Crime", "Drama"],
    approved_aliases: ["Gundala", "Gundala: Putra Petir"],
    proposed_tier: "medium",
    rationale: "Inaugural Bumilangit Cinematic Universe superhero adaptation with wide domestic following.",
  },
  {
    tmdb_id: 858815,
    title: "Photocopier",
    original_title: "Penyalin Cahaya",
    release_year: 2021,
    vote_count: 278,
    vote_average: 6.9,
    popularity: 0.89,
    directors: ["Wregas Bhanuteja"],
    cast_members: ["Shenina Cinnamon", "Lutesha", "Chicco Kurniawan", "Jerome Kurnia"],
    genres: ["Drama", "Mystery"],
    approved_aliases: ["Penyalin Cahaya", "Photocopier"],
    proposed_tier: "medium",
    rationale: "Multiple Citra Award-winning mystery drama and major international streaming premiere.",
  },
  {
    tmdb_id: 683328,
    title: "The Big 4",
    original_title: "The Big 4",
    release_year: 2022,
    vote_count: 232,
    vote_average: 6.8,
    popularity: 1.51,
    directors: ["Timo Tjahjanto"],
    cast_members: ["Abimana Aryasatya", "Putri Marino", "Arie Kriting", "Lutesha", "Kristo Immanuel"],
    genres: ["Action", "Comedy", "Crime"],
    approved_aliases: ["The Big 4", "The Big Four"],
    proposed_tier: "medium",
    rationale: "Action comedy with prominent ensemble cast and high streaming viewership.",
  },
  {
    tmdb_id: 524738,
    title: "May the Devil Take You",
    original_title: "Sebelum Iblis Menjemput",
    release_year: 2018,
    vote_count: 196,
    vote_average: 6.2,
    popularity: 0.98,
    directors: ["Timo Tjahjanto"],
    cast_members: ["Chelsea Islan", "Pevita Pearce", "Karina Suwandi", "Ray Sahetapy"],
    genres: ["Horror"],
    approved_aliases: ["Sebelum Iblis Menjemput", "May the Devil Take You"],
    proposed_tier: "medium",
    rationale: "Popular supernatural horror film with leading mainstream cast.",
  },
  {
    tmdb_id: 925786,
    title: "Satan's Slaves 2: Communion",
    original_title: "Pengabdi Setan 2: Communion",
    release_year: 2022,
    vote_count: 82,
    vote_average: 7.0,
    popularity: 2.34,
    directors: ["Joko Anwar"],
    cast_members: ["Tara Basro", "Endy Arfian", "Nasar Anuz", "Bront Palarae"],
    genres: ["Horror", "Mystery"],
    approved_aliases: ["Pengabdi Setan 2: Communion", "Pengabdi Setan 2", "Satan's Slaves 2: Communion"],
    proposed_tier: "medium",
    rationale: "Widely anticipated sequel set in a decaying apartment complex; major domestic hit.",
  },
  {
    tmdb_id: 832544,
    title: "Stealing Raden Saleh",
    original_title: "Mencuri Raden Saleh",
    release_year: 2022,
    vote_count: 39,
    vote_average: 7.6,
    popularity: 1.4,
    directors: ["Angga Dwimas Sasongko"],
    cast_members: ["Iqbaal Ramadhan", "Angga Yunanda", "Rachel Amanda", "Umay Shahab", "Aghniny Haque"],
    genres: ["Action", "Crime", "Drama"],
    approved_aliases: ["Mencuri Raden Saleh", "Stealing Raden Saleh"],
    proposed_tier: "medium",
    rationale: "Highly praised heist film with an ensemble of young Indonesian talent.",
  },

  // --- HARD TIER (Established hidden gems, indie festival darlings & cult cinema) ---
  {
    tmdb_id: 453276,
    title: "Marlina the Murderer in Four Acts",
    original_title: "Marlina si Pembunuh dalam Empat Babak",
    release_year: 2017,
    vote_count: 85,
    vote_average: 6.7,
    popularity: 0.97,
    directors: ["Mouly Surya"],
    cast_members: ["Marsha Timothy", "Egi Fedly", "Tumpal Tampubolon", "Dea Panendra"],
    genres: ["Drama", "Western"],
    approved_aliases: ["Marlina si Pembunuh dalam Empat Babak", "Marlina the Murderer in Four Acts"],
    proposed_tier: "hard",
    rationale: "Critically celebrated Sumba-set feminist neo-western screened at Cannes Directors' Fortnight.",
  },
  {
    tmdb_id: 39067,
    title: "Macabre",
    original_title: "Rumah Dara",
    release_year: 2009,
    vote_count: 93,
    vote_average: 6.3,
    popularity: 1.2,
    directors: ["Kimo Stamboel", "Timo Tjahjanto"],
    cast_members: ["Shareefa Daanish", "Julie Estelle", "Ario Bayu", "Arifin Putra"],
    genres: ["Horror", "Thriller"],
    approved_aliases: ["Rumah Dara", "Macabre", "Darah"],
    proposed_tier: "hard",
    rationale: "Cult slasher classic directed by The Mo Brothers; Shareefa Daanish's iconic role.",
  },
  {
    tmdb_id: 39024,
    title: "The Forbidden Door",
    original_title: "Pintu Terlarang",
    release_year: 2009,
    vote_count: 63,
    vote_average: 6.5,
    popularity: 0.86,
    directors: ["Joko Anwar"],
    cast_members: ["Fachri Albar", "Marsha Timothy", "Ario Bayu", "Otto Djauhari"],
    genres: ["Horror", "Mystery", "Thriller"],
    approved_aliases: ["Pintu Terlarang", "The Forbidden Door"],
    proposed_tier: "hard",
    rationale: "Early psychological thriller masterwork from Joko Anwar; award winner at Bucheon.",
  },
  {
    tmdb_id: 1119527,
    title: "Grave Torture",
    original_title: "Siksa Kubur",
    release_year: 2024,
    vote_count: 82,
    vote_average: 6.57,
    popularity: 1.67,
    directors: ["Joko Anwar"],
    cast_members: ["Faradina Mufti", "Reza Rahadian", "Widuri Puteri", "Muzakki Ramdhan"],
    genres: ["Horror", "Drama"],
    approved_aliases: ["Siksa Kubur", "Grave Torture"],
    proposed_tier: "hard",
    rationale: "Deeply philosophical psychological horror examining faith and the afterlife.",
  },
  {
    tmdb_id: 199324,
    title: "Sherina's Adventure",
    original_title: "Petualangan Sherina",
    release_year: 2000,
    vote_count: 19,
    vote_average: 7.9,
    popularity: 0.72,
    directors: ["Riri Riza"],
    cast_members: ["Sherina Munaf", "Derby Romero", "Mathias Muchus", "Utha Likumahuwa"],
    genres: ["Adventure", "Comedy", "Family", "Music"],
    approved_aliases: ["Petualangan Sherina", "Sherina's Adventure"],
    proposed_tier: "hard",
    rationale: "Cherished children's musical that ignited the resurgence of Indonesian domestic cinema in 2000.",
  },
  {
    tmdb_id: 39061,
    title: "Gie",
    original_title: "Gie",
    release_year: 2005,
    vote_count: 19,
    vote_average: 6.3,
    popularity: 0.65,
    directors: ["Riri Riza"],
    cast_members: ["Nicholas Saputra", "Wulan Guritno", "Sita Nursanti", "Lukman Sardi"],
    genres: ["Biography", "Drama", "History"],
    approved_aliases: ["Gie"],
    proposed_tier: "hard",
    rationale: "Acclaimed historical biopic of activist Soe Hok Gie starring Nicholas Saputra.",
  },
] as const;

/**
 * Returns approved aliases for an Indonesian film (both original title and international title).
 */
export function getIndonesianTitleAliases(tmdbId: number): string[] {
  const movie = INDONESIAN_CALIBRATED_SAMPLE.find((m) => m.tmdb_id === tmdbId);
  if (!movie) return [];
  return [...movie.approved_aliases];
}

/**
 * Evaluates whether a mode and tier combination is available in the Indonesian collection.
 * Upholds the principle that unavailable combinations remain clearly unavailable.
 */
export function checkIndonesianCollectionAvailability(
  mode: string,
  tier: "easy" | "medium" | "hard"
): {
  isAvailable: boolean;
  eligibleCount: number;
  minimumRequired: number;
  shortageReason?: string;
} {
  const minimumRequired = 10;
  const eligibleMovies = INDONESIAN_CALIBRATED_SAMPLE.filter((m) => {
    if (m.proposed_tier !== tier) return false;

    // Check mode eligibility
    if (mode === "poster" || mode === "title" || mode === "mixed") return true;
    if (mode === "cast") return m.directors.length > 0 && m.cast_members.length >= 3;
    if (mode === "synopsis" || mode === "genre") return m.directors.length > 0 && m.genres.length > 0;
    return true;
  });

  const count = eligibleMovies.length;
  if (count < minimumRequired) {
    return {
      isAvailable: false,
      eligibleCount: count,
      minimumRequired,
      shortageReason: `Catalog shortage: Only ${count}/${minimumRequired} calibrated Indonesian movies available for ${tier} tier (${mode} mode). Additional collection intake required.`,
    };
  }

  return {
    isAvailable: true,
    eligibleCount: count,
    minimumRequired,
  };
}
