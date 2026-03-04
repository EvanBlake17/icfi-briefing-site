# Briefing Format Guide

This document defines the required format for morning briefings. The briefing-writer agent MUST follow this format exactly.

---

## 1. Heading case

All headings (h2 and h3) MUST use **sentence case**, not title case.

**Correct (sentence case):**
```markdown
## Top stories
### Pentagon issues ultimatum to Anthropic over AI safeguards
### Measles surges past 1,000 cases as South Carolina obscures data
```

**Incorrect (title case):**
```markdown
## Top Stories
### Pentagon Issues Ultimatum to Anthropic Over AI Safeguards
### Measles Surges Past 1,000 Cases as South Carolina Obscures Data
```

**Rules:**
- Capitalize the first word and proper nouns only
- Proper nouns include: names of people, organizations, countries, specific programs/operations, etc.
- Acronyms stay uppercase (ICE, CDC, WSWS, etc.)

---

## 2. Source links

Every topic section (h3) in the main briefing body MUST end with a source attribution block. This tells readers where the information came from and lets them click through to the original reporting.

**Format — use raw HTML that pandoc will pass through:**

```html
<div class="source-links">
<span class="source-label">Sources</span>
<a href="URL" target="_blank" rel="noopener"><span class="pub">Publication</span> Headline or article title</a>
<span class="sep">·</span>
<a href="URL" target="_blank" rel="noopener"><span class="pub">Publication</span> Headline or article title</a>
</div>
```

**Example:**

```html
<div class="source-links">
<span class="source-label">Sources</span>
<a href="https://www.washingtonpost.com/..." target="_blank" rel="noopener"><span class="pub">Washington Post</span> Pentagon gives Anthropic ultimatum over AI safeguards</a>
<span class="sep">·</span>
<a href="https://www.axios.com/..." target="_blank" rel="noopener"><span class="pub">Axios</span> Hegseth demands unrestricted military access to Claude AI</a>
<span class="sep">·</span>
<a href="https://www.wsws.org/..." target="_blank" rel="noopener"><span class="pub">WSWS</span> Pentagon gives Anthropic 3 days to drop AI safeguards or face blacklisting</a>
</div>
```

**Rules:**
- Place the source block immediately after the last paragraph of each topic section (before the next h3 or hr)
- Include 1-5 sources per topic — the primary sources used
- **Every `<a>` tag MUST include `target="_blank" rel="noopener"`** so links open in a new tab
- Publication name goes in `<span class="pub">` (renders bold)
- The headline/title follows the publication name (no colon separator, just a space)
- Separate multiple sources with `<span class="sep">·</span>`
- WSWS articles should always be included when they are a primary source
- For topics covered by multiple bourgeois outlets, include the 1-2 that provided the most substantive reporting
- Omit sources for analysis/commentary sections that are original synthesis (e.g., "This week in history" overviews)
- The research agent's raw material includes URLs — always use them

---

## 3. Section summary bullets

Every major section (Top stories, International developments, World economy, United States, Science/health, Pseudo-left press review) MUST open with a bulleted quick-scan summary listing each item in that section. These let ICFI leaders scan the entire briefing in under two minutes.

**Format:**

```markdown
## International developments

- [Israel stages military incursion into Syria's Quneitra province](#israel-stages-military-incursion-into-syrias-quneitra-province) — 30-vehicle convoy enters occupied territory, soldiers abduct a Syrian civilian tending sheep
- [Danish PM calls snap election](#danish-pm-calls-snap-election-amid-greenland-sovereignty-dispute) — Frederiksen's Social Democrats surging in polls after rejecting Trump's Greenland demands
- [UN sanctions RSF commanders](#un-sanctions-rsf-commanders-over-el-fasher-atrocities-in-sudan) — travel bans on four commanders including the "Butcher of el-Fasher," but measures are largely symbolic
```

**Rules:**
- Each bullet links to the full item's h3 heading using a markdown anchor
- The text after the `—` dash must provide the **most critical fact or data point** from the story — not a restatement of what is already obvious from the headline
- Aim for 1-2 sentences per bullet: enough to convey why this story matters without reading the full item
- These bullets should add value beyond the headline — a key number, a telling detail, a political implication
- Section summary bullets cover individual sections and serve as the primary quick-scan mechanism for the entire briefing

---

## 4. Editorial policy for all news sections

The following policy applies to **every news section** — Top stories, International developments, World economy, United States, and Science, technology, and public health. The ONLY section where WSWS coverage drives story selection is "WSWS coverage — last 24 hours."

**Core principle:** Stories in news sections MUST be selected based on their objective significance as real-world events, determined by coverage across major wire services, newspapers, and journals — NOT by what the WSWS happened to write about that day.

**Rules:**
- Story selection is driven by what actually happened in the world, using bourgeois press coverage as the baseline for determining the day's most significant events
- If the WSWS published on an event that independently qualifies as significant news, include the WSWS article in the source links and integrate their analysis — but the story's inclusion is driven by its real-world significance, not the WSWS coverage
- A story that is ONLY covered by a single WSWS article does NOT belong in any news section — it belongs in "WSWS coverage — last 24 hours"
- Every story in a news section must have at least one bourgeois press source (wire service, newspaper, journal) in addition to any WSWS source
- This means the United States section should cover the most significant US developments from the past 24 hours (major legislation, court rulings, executive actions, labor developments covered by mainstream press, significant incidents, economic data, etc.) — not simply echo what the WSWS wrote about US topics
- The same applies to International developments and Science/health: these sections should read as a comprehensive briefing on what happened, not a curated selection of topics the WSWS covered
- If a WSWS article overlaps with a significant news event, cite the WSWS alongside bourgeois sources and weave in the WSWS analysis — this is the ideal outcome, where the reader gets both the facts and the Marxist analysis
- WSWS-only stories (no bourgeois press source available) go exclusively in the WSWS coverage section, where their analysis is summarized in full

---

## 5. World economy section

This is a dedicated ~400-word section covering major economic and financial developments from the past 24 hours. It should appear **after International developments and before United States**.

**Must include (when available):**
- Major stock market movements (US indices, European/Asian markets) with percentage changes and key drivers
- Gold, silver, and oil prices — note significant moves and the forces behind them
- Cryptocurrency: Bitcoin, Ethereum prices and any major developments (regulatory, exchange failures, institutional moves)
- Major bankruptcies, corporate selloffs, or restructurings
- Trade deals, tariff actions, sanctions developments
- Central bank decisions (Fed, ECB, BOJ, PBOC) — rate changes, policy signals
- Key economic data releases (jobs numbers, GDP, inflation, PMI)
- Significant labor market developments with economic dimensions (mass layoffs, hiring freezes)

**Format:** Lead with the day's most market-moving story in 1-2 short paragraphs, then cover the rest in a bulleted data roundup. Each bullet should include the specific number/percentage and its source.

**Tone:** Report the data; keep analysis brief. Note class dimensions where relevant (e.g., stock rally alongside mass layoffs), but the primary function is to provide leaders with the day's key economic facts.

---

## 6. Science, technology, and public health section

This is a dedicated ~500-word section covering developments in science, technology, and public health from the past 24 hours. It should be substantive and information-dense.

**Must include (when available):**
- Major peer-reviewed studies published in the past 24 hours (Nature, Science, The Lancet, NEJM, JAMA, Cell, PNAS, BMJ, etc.) — include the journal name, key finding, and significance
- COVID-19 and flu updates: case trends, new variants, wastewater surveillance data, hospitalization numbers, vaccine developments
- Disease outbreak updates: measles, bird flu (H5N1), mpox, or any other active outbreaks
- Major technology developments with societal implications (AI policy, cybersecurity incidents, infrastructure)
- Public health policy changes (CDC/WHO guidance changes, funding cuts, regulatory actions)
- Environmental/climate science developments

**Format:** Mix of short paragraphs and bullet points. Lead with the 1-2 most significant items, then cover the rest in a bulleted roundup. Each item should include the source and key data point.

---

## 7. Arts and culture section

This is a dedicated ~500-word section covering significant developments in arts and culture from the past 24 hours. It appears **after Science, technology, and public health**.

**Must include (when available):**
- Major film releases, festival selections, or award announcements with cultural significance
- Notable book publications, literary awards, or publishing industry developments
- Theater, opera, and performing arts — significant premieres, closures, or controversies
- Music: major album releases, industry developments, censorship incidents
- Visual arts: significant exhibitions, institutional changes, restitution cases
- Deaths of significant cultural figures (brief obituary note with their contribution)
- Censorship, defunding, or political attacks on arts and cultural institutions
- Cultural developments connected to war, social inequality, or political repression

**Framework:** Analysis should follow the WSWS's approach to arts and culture: artistic works are understood in their social and historical context, not as entertainment products or lifestyle content. Note works that engage with war, class conflict, historical memory, or the human condition. Flag nationalist, militarist, or identitarian tendencies in cultural production. Recognize genuine artistic achievement regardless of the artist's politics.

**Format:** Mix of short paragraphs and bullet points. Lead with the 1-2 most culturally significant items, then cover the rest in a bulleted roundup.

---

## 8. Pseudo-left press review

This is a dedicated ~750-word section reviewing the press of the major pseudo-left tendencies that the WSWS polemicizes against. It appears **after WSWS coverage — last 24 hours** and **before What the WSWS should cover today**.

**Tendencies to monitor:**

*United States:*
- **Jacobin / DSA** (Democratic Socialists of America) — jacobin.com
- **Left Voice** (Fraction of Trotskyists / PTS) — leftvoice.org
- **Liberation News / PSL** (Party for Socialism and Liberation) — liberationnews.org
- **Socialist Alternative** (ISA / Committee for a Workers' International) — socialistalternative.org

*United Kingdom:*
- **Socialist Worker / SWP** (Socialist Workers Party / International Socialist Tendency) — socialistworker.co.uk
- **Socialist Appeal / RCP** (International Marxist Tendency / Revolutionary Communist Party) — socialist.net / communist.red

*International (check when relevant, not daily):*
- **Marx21** (Germany, IST-aligned) — marx21.de
- **NPA** (Nouveau Parti Anticapitaliste, France) — nouveaupartianticapitaliste.org
- **SAlt sections** (ISA international) — internationalsocialist.net

**Format:**

```markdown
## Pseudo-left press review

[Section summary bullets — 1 per tendency covered]

### Jacobin / DSA

[Note 2-3 of their most significant articles from the past 24 hours. For each: article title, 1-sentence summary of the political line, and identification of the specific anti-Marxist, reformist, or reactionary position. End with a brief assessment of the tendency's overall orientation as reflected in the day's output.]

### Left Voice

[Same format — 2-3 articles, political line, anti-Marxist positions identified]

[Continue for each tendency that published significant material in the past 24 hours. Skip tendencies with no notable output.]
```

**Rules:**
- Note 2-3 most significant articles per tendency — do not attempt comprehensive coverage (this must not eat up research tokens)
- Summarize the political line of each article in 1-2 sentences
- Identify specific anti-Marxist, reformist, or reactionary positions: e.g., support for Democratic Party candidates, promotion of national-reformist programs, adaptation to identity politics, failure to oppose imperialist war, apologies for trade union bureaucracy, etc.
- Flag any direct attacks on or references to the ICFI, WSWS, or Trotskyism — these are always significant
- Flag any significant convergences with the bourgeois press line on key questions (war, unions, elections)
- The tone should be analytical, not mocking — identify the class interests expressed in the political line
- Include source links to the specific articles referenced
- Skip a tendency entirely on days when they published nothing notable — better to omit than pad

---

## 9. Coverage suggestions section

Every briefing MUST end with a "What the WSWS should cover today" section. This identifies critical world events from the past 24 hours that the WSWS did NOT write about, and which the editorial board should consider assigning.

**Format:**

```markdown
## What the WSWS should cover today

### 1. [Suggested headline in sentence case]

[2-3 sentence description of the event and why it warrants WSWS coverage. Note the class dimensions, political significance, or connection to ongoing WSWS campaigns.]

<div class="source-links">
<span class="source-label">Recommended reading</span>
<a href="URL" target="_blank" rel="noopener"><span class="pub">Publication</span> Article title</a>
</div>

### 2. [Suggested headline in sentence case]

[2-3 sentence description...]

<div class="source-links">
<span class="source-label">Recommended reading</span>
<a href="URL" target="_blank" rel="noopener"><span class="pub">Publication</span> Article title</a>
</div>

[Continue for at least 5 suggestions, in order of priority]
```

**Rules:**
- At least 5 suggestions, listed in order of priority (most urgent first)
- Each suggestion includes a potential WSWS headline (sentence case)
- Each includes a 2-3 sentence description explaining why this matters
- Each includes a source link to the best article to read on the topic (use "Recommended reading" as the label instead of "Sources")
- Suggestions should cover a range of topics: labor, war, social inequality, democratic rights, science/health, etc.
- Do NOT suggest topics the WSWS already covered in the past 24 hours

---

## 10. Overall briefing structure

The complete structure of a briefing should be:

```markdown
## Top stories

- [Headline](#anchor) — most critical fact from the story
- [Headline](#anchor) — most critical fact from the story
[summary bullets for each item in this section]

### 1. Headline in sentence case

[Body paragraphs...]

<div class="source-links">
<span class="source-label">Sources</span>
<a href="URL" target="_blank" rel="noopener"><span class="pub">Publication</span> Article title</a>
</div>

### 2. Next headline in sentence case

[Body paragraphs...]

<div class="source-links">...</div>

[Continue for all top stories...]

---

## International developments

[Section summary bullets]

[Objectively most significant world events — selected by real-world
importance, not WSWS coverage. Each story must have at least one
bourgeois press source.]

### Headline in sentence case

[Body paragraphs...]

<div class="source-links">...</div>

---

## World economy

[Section summary bullets]

[~400 words. Stocks, commodities, crypto, trade, central banks,
key economic data. Lead story in paragraphs, rest in data bullets.]

---

## United States

[Section summary bullets]

[Objectively most significant US developments — selected by
real-world importance, not WSWS coverage. Each story must have
at least one bourgeois press source.]

[Same pattern...]

---

## Science, technology, and public health

[Section summary bullets]

[~500 words. Major studies, disease updates, tech developments...]

---

## Arts and culture

[~500 words. Film, literature, theater, music, visual arts.
Analyzed in social/historical context per WSWS framework.]

---

## WSWS coverage — last 24 hours

[Same pattern...]

---

## Pseudo-left press review

[Section summary bullets — 1 per tendency covered]

[~750 words. 2-3 articles per tendency. Political line + specific
anti-Marxist positions identified. Jacobin/DSA, Left Voice, PSL,
Socialist Alternative, SWP, IMT, others as relevant.]

---

## What the WSWS should cover today

### 1. Suggested headline

[2-3 sentence description...]

<div class="source-links">
<span class="source-label">Recommended reading</span>
<a href="URL" target="_blank" rel="noopener"><span class="pub">Publication</span> Article title</a>
</div>

[At least 5 suggestions in priority order...]
```

---

## 11. Section heading (h2) naming

Section headings (h2) should be concise, descriptive, and in sentence case:
- `## Top stories`
- `## International developments`
- `## World economy`
- `## United States`
- `## Science, technology, and public health`
- `## Arts and culture`
- `## WSWS coverage — last 24 hours`
- `## Pseudo-left press review`
- `## What the WSWS should cover today`

---

## 12. Research agent: source URL requirements

The briefing-research agent MUST preserve full source URLs for every article, report, or data point gathered. Each entry in the raw material should include:
- The full URL of the source article
- The publication name
- The article headline/title
- The publication date

These are essential for the writer agent to produce proper source attribution blocks with functional hyperlinks.
