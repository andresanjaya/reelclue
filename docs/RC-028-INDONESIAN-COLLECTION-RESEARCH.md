# RC-028: Indonesian Movie Collection Research & Familiarity Calibration

## Executive Summary
Ticket **RC-028** investigates the viability, empirical candidate coverage, and familiarity calibration required to introduce an Indonesian Movie Collection to ReelClue.

ReelClue's core promise is **fairness**: clues must feel solvable, difficulty tiers must reflect genuine audience familiarity rather than arbitrary obscurity, and movie selection must be grounded in verified evidence.

This research report documents real counts from The Movie Database (TMDB), analyzes why applying global familiarity thresholds to domestic cinema fails, upholds the strict non-negotiable boundary that the **global 500-vote floor must never be lowered**, and proposes a collection-specific calibration policy (`id-v1`) with representative sample movies and dual-alias resolution for Andre's review.

---

## 1. Empirical Candidate Coverage on TMDB

### Provider Query Methodology
In November 2026, we queried the official TMDB `/discover/movie` API filtered by `with_original_language=id` across progressive vote count thresholds to measure the candidate pool.

### Real Candidate Distribution

| TMDB Vote Floor | Real Candidate Count | % of Indonesian Catalog | Viability Assessment |
| :--- | :---: | :---: | :--- |
| **`vote_count >= 0`** | 7,181 | 100.0% | Entire raw catalog (includes unfinished, unreleased, student shorts, 0-vote entries) |
| **`vote_count >= 10`** | 246 | 3.43% | Movies with minimal international/domestic rating evidence |
| **`vote_count >= 20`** | 101 | 1.41% | Established domestic releases with consistent rating presence |
| **`vote_count >= 50`** | 34 | 0.47% | Popular domestic hits and festival darlings |
| **`vote_count >= 100`** | 17 | 0.24% | Major cross-over titles (prominent horror & action) |
| **`vote_count >= 200`** | 12 | 0.17% | Prominent international streaming and theatrical releases |
| **`vote_count >= 500`** *(Global Floor)* | **4** | **0.05%** | **Only 4 films qualify for candidate consideration** |

---

## 2. Global 500-Vote Floor Analysis

Under ReelClue's global catalog rules (`base-v1` and `tiering-v1`):
1. **Candidate Pool**: Requires `vote_count >= 500` and `runtime >= 60`.
2. **Easy Tier**: Requires `vote_count >= 5,000` (top 30% band).
3. **Medium Tier**: Requires `vote_count >= 1,500` (middle 40% band).
4. **Hard Tier**: Requires `500 <= vote_count <= 9,999` AND `vote_average >= 7.0` (bottom 30% band).
5. **Catalog Quota**: Requires 100 approved movies per tier and 30 per mode to avoid catalog shortages.

### The 4 Indonesian Movies Meeting the Global Floor

| TMDB ID | Title | Original Title | Year | Votes | Rating | Popularity | Global Tier Evaluation |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **94329** | *The Raid* | *Serbuan Maut* | 2012 | 4,117 | 7.41 | 5.76 | **Medium** (Fails Easy floor >=5,000; meets Medium >=1,500) |
| **180299** | *The Raid 2* | *The Raid 2: Berandal* | 2014 | 2,739 | 7.61 | 5.81 | **Medium** (Meets Medium floor >=1,500) |
| **449992** | *The Night Comes For Us* | *The Night Comes For Us* | 2018 | 896 | 6.97 | 4.12 | **Unassigned** (500–9999 votes, but rating 6.97 fails Hard >=7.0 gate) |
| **403605** | *Headshot* | *Headshot* | 2016 | 518 | 6.43 | 3.01 | **Unassigned** (500–9999 votes, but rating 6.43 fails Hard >=7.0 gate) |

### Key Finding
Under current global rules:
- **Easy Tier**: 0 approved movies (shortage: 0/100).
- **Medium Tier**: 2 approved movies (shortage: 2/100).
- **Hard Tier**: 0 approved movies (shortage: 0/100).
- **Total Approved**: **2 movies**.

Because a single ReelClue game session requires **10 distinct movies**, an Indonesian collection **cannot function under global familiarity rules**.

---

## 3. Policy Boundary: No Lowering of the Global 500-Vote Floor

> [!IMPORTANT]
> **Strict PRD Constraint (Acceptance Criterion 2)**:
> *"No automatic lowering of global 500-vote floor; any collection-specific policy change requires explicit PRD review."*

The global 500-vote floor serves a critical role in ReelClue's global catalog:
- It guarantees that any movie appearing in the global game has substantial international audience validation.
- Lowering the global floor to 50 or 20 votes would flood the global pool with thousands of obscure, low-information titles across all languages, destroying clue quality and game fairness.
- Therefore, **the global floor remains untouched at 500 votes**.
- The Indonesian collection must be implemented as an **isolated, collection-specific configuration** (`collection_id: "indonesia"`, version `id-v1`), never modifying the global catalog pipeline.

---

## 4. Proposed Calibrated Collection Policy (`id-v1`)

To make familiarity genuinely relevant to Indonesian players while preserving rigor, we propose the following collection-specific tiering rules:

### Calibration Rules

1. **Collection Minimum Floor (`vote_count >= 15`)**:
   - Excludes unverified entries, student shorts, or unreleased titles.
   - Provides a base pool of ~150 vetted titles.
2. **Easy Tier (Cultural Staples & Domestic Blockbusters)**:
   - Movies with massive domestic household recognition (e.g., *Laskar Pelangi*, *Ada Apa dengan Cinta?*, *Dilan 1990*, *Pengabdi Setan*, *The Raid*).
   - Minimum criteria: `vote_count >= 30` AND high domestic cultural status.
3. **Medium Tier (Popular Genre Cinema & Prominent Streaming Hits)**:
   - Widely watched action, horror, and comedy films with regular audience recognition (e.g., *The Night Comes for Us*, *Gundala*, *Penyalin Cahaya*, *The Big 4*, *Sebelum Iblis Menjemput*, *Mencuri Raden Saleh*).
   - Minimum criteria: `vote_count >= 20`.
4. **Hard Tier (Acclaimed Hidden Gems & Cult Classics)**:
   - Established indie festival darlings, auteur works, and celebrated cult cinema (e.g., *Marlina si Pembunuh dalam Empat Babak*, *Rumah Dara / Macabre*, *Pintu Terlarang*, *Siksa Kubur*, *Petualangan Sherina*, *Gie*).
   - Minimum criteria: `vote_count >= 15` AND `vote_average >= 6.5`.

---

## 5. Representative Calibrated Sample (20 Films)

The following 20 representative films were verified on TMDB. All metrics are authentic TMDB data. In accordance with Acceptance Criterion 3, **no invented local audience numbers** are used.

| TMDB ID | International Title | Original Indonesian Title | Year | Votes | Rating | Director(s) | Proposed Tier | Approved Aliases | Rationale |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- | :---: | :--- | :--- |
| **94329** | *The Raid* | *Serbuan Maut* | 2012 | 4,117 | 7.4 | Gareth Evans | **Easy** | *Serbuan Maut*, *The Raid*, *The Raid: Redemption* | Globally iconic martial arts action; universal recognition. |
| **180299** | *The Raid 2* | *The Raid 2: Berandal* | 2014 | 2,739 | 7.6 | Gareth Evans | **Easy** | *The Raid 2: Berandal*, *The Raid 2*, *The Raid: Retaliation* | Critically acclaimed action sequel with major domestic popularity. |
| **467012** | *Satan's Slaves* | *Pengabdi Setan* | 2017 | 332 | 6.7 | Joko Anwar | **Easy** | *Pengabdi Setan*, *Satan's Slaves* | Horror blockbuster redefining modern Indonesian genre cinema. |
| **572468** | *Impetigore* | *Perempuan Tanah Jahanam* | 2019 | 260 | 6.6 | Joko Anwar | **Easy** | *Perempuan Tanah Jahanam*, *Impetigore* | FFI Best Picture winner with widespread domestic recognition. |
| **22421** | *The Rainbow Troops* | *Laskar Pelangi* | 2008 | 33 | 7.5 | Riri Riza | **Easy** | *Laskar Pelangi*, *The Rainbow Troops* | Historic domestic cultural touchstone based on Andrea Hirata's novel. |
| **39060** | *What's Up with Cinta?* | *Ada Apa dengan Cinta?* | 2002 | 54 | 7.5 | Rudy Soedjarwo | **Easy** | *Ada Apa dengan Cinta?*, *AADC*, *What's Up with Cinta?* | Landmark romance that revived modern Indonesian cinema. |
| **492459** | *Dilan 1990* | *Dilan 1990* | 2018 | 39 | 7.3 | Fajar Bustomi, Pidi Baiq | **Easy** | *Dilan 1990* | Phenomenal domestic box office success and pop-culture staple. |
| **449992** | *The Night Comes For Us* | *The Night Comes For Us* | 2018 | 896 | 7.0 | Timo Tjahjanto | **Medium** | *The Night Comes For Us*, *The Night Comes for Us* | High-octane action thriller streaming hit with Indonesia's top stars. |
| **516700** | *Gundala* | *Gundala* | 2019 | 349 | 6.2 | Joko Anwar | **Medium** | *Gundala*, *Gundala: Putra Petir* | BCU superhero franchise starter with dedicated domestic following. |
| **858815** | *Photocopier* | *Penyalin Cahaya* | 2021 | 278 | 6.9 | Wregas Bhanuteja | **Medium** | *Penyalin Cahaya*, *Photocopier* | Citra Award record holder and prominent streaming premiere. |
| **683328** | *The Big 4* | *The Big 4* | 2022 | 232 | 6.8 | Timo Tjahjanto | **Medium** | *The Big 4*, *The Big Four* | High-profile action comedy featuring leading comedic and action talent. |
| **524738** | *May the Devil Take You* | *Sebelum Iblis Menjemput* | 2018 | 196 | 6.2 | Timo Tjahjanto | **Medium** | *Sebelum Iblis Menjemput*, *May the Devil Take You* | Popular supernatural horror film starring Chelsea Islan and Pevita Pearce. |
| **925786** | *Satan's Slaves 2: Communion* | *Pengabdi Setan 2: Communion* | 2022 | 82 | 7.0 | Joko Anwar | **Medium** | *Pengabdi Setan 2: Communion*, *Pengabdi Setan 2* | Highly anticipated apartment-block horror sequel; massive domestic hit. |
| **832544** | *Stealing Raden Saleh* | *Mencuri Raden Saleh* | 2022 | 39 | 7.6 | Angga Dwimas Sasongko | **Medium** | *Mencuri Raden Saleh*, *Stealing Raden Saleh* | Stylish heist film with popular ensemble of young Indonesian talent. |
| **453276** | *Marlina the Murderer in Four Acts* | *Marlina si Pembunuh dalam Empat Babak* | 2017 | 85 | 6.7 | Mouly Surya | **Hard** | *Marlina si Pembunuh dalam Empat Babak*, *Marlina the Murderer in Four Acts* | Cannes Directors' Fortnight feminist western set in Sumba. |
| **39067** | *Macabre* | *Rumah Dara* | 2009 | 93 | 6.3 | The Mo Brothers | **Hard** | *Rumah Dara*, *Macabre*, *Darah* | Cult slasher landmark featuring Shareefa Daanish's iconic performance. |
| **39024** | *The Forbidden Door* | *Pintu Terlarang* | 2009 | 63 | 6.5 | Joko Anwar | **Hard** | *Pintu Terlarang*, *The Forbidden Door* | Auteur psychological thriller and Bucheon Fantastic winner. |
| **1119527** | *Grave Torture* | *Siksa Kubur* | 2024 | 82 | 6.6 | Joko Anwar | **Hard** | *Siksa Kubur*, *Grave Torture* | Philosophical psychological horror exploring faith and the afterlife. |
| **199324** | *Sherina's Adventure* | *Petualangan Sherina* | 2000 | 19 | 7.9 | Riri Riza | **Hard** | *Petualangan Sherina*, *Sherina's Adventure* | Beloved musical that catalyzed the 2000s Indonesian cinema revival. |
| **39061** | *Gie* | *Gie* | 2005 | 19 | 6.3 | Riri Riza | **Hard** | *Gie* | Acclaimed historical biopic of activist Soe Hok Gie. |

---

## 6. Dual Title Alias Matching Strategy

### The Title Divergence Problem
On TMDB, Indonesian films commonly have:
- `title`: An English translation used for international distribution (e.g. *"The Rainbow Troops"*, *"Satan's Slaves"*, *"Impetigore"*, *"What's Up with Cinta?"*).
- `original_title`: The authentic Indonesian title known by domestic audiences (e.g. *"Laskar Pelangi"*, *"Pengabdi Setan"*, *"Perempuan Tanah Jahanam"*, *"Ada Apa dengan Cinta?"*).

### Resolution Strategy
1. **Search Integration**: The search endpoint indexes `title`, `original_title`, and all entries in `approved_aliases`.
2. **Guess Matching**: When a player inputs either *"Pengabdi Setan"* or *"Satan's Slaves"*, both resolve to TMDB ID `467012`.
3. **No Spoilers**: The clue display uses whichever title format the player searched for, without prematurely revealing alternative titles.

---

## 7. Availability Gating & Shortage Enforcement

In accordance with Acceptance Criterion 4:
- **Unavailable combinations remain clearly unavailable**.
- For an Indonesian game to be playable in a given mode and tier, the collection must contain **at least 10 eligible movies** (to supply a complete 10-round session without repetition).
- If an unavailable combination is requested (e.g. Easy tier when only 7 titles are staged), the API returns `400 CATALOG_SHORTAGE` and the UI shows:
  *"Not enough eligible movies in catalog for this mode and difficulty combination yet."*
- Existing global sessions and daily challenge sessions remain completely isolated and unaffected.

---

## 8. Summary of Recommendations for Andre

1. **Do not lower the global 500-vote floor**: Retain `vote_count >= 500` for the global game.
2. **Adopt the proposed `id-v1` collection tiering**:
   - Easy: Domestic staples (vote_count >= 30).
   - Medium: Popular genre & streaming hits (vote_count >= 20).
   - Hard: Acclaimed auteur & cult gems (vote_count >= 15, rating >= 6.5).
3. **Target Intake Size**: Expand the calibrated sample from 20 to 45 movies (15 per tier) before activating the Indonesian Collection in the UI to ensure 10-round session diversity.
