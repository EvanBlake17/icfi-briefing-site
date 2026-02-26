# Briefing Format Guide

This document defines the required format for morning briefings. The briefing-writer agent MUST follow this format exactly.

---

## 1. Top summary section

Every briefing MUST begin with a summary section before the first `---` horizontal rule. This section gives readers a quick overview of the day's most important developments.

**Format:**

```markdown
## What we're covering today

- **Topic label:** One to two sentence summary of the key development. Keep it concise and informative.
- **Topic label:** Another concise summary.
- **Topic label:** Another concise summary.

---
```

**Rules:**
- Use a bulleted list (not numbered)
- Each bullet starts with a **bold topic label** followed by a colon
- Summaries should be 1-2 sentences max — just enough to convey the key development
- Include 4-8 bullets covering the most significant stories
- The topic labels should be short (1-3 words): e.g., "Immigration," "Public health," "Iran," "Labor"
- This section must end with a `---` horizontal rule before the main content begins

---

## 2. Heading case

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

## 3. Source links

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

## 4. Top stories editorial policy

Top stories MUST be the objectively most significant world events from the past 24 hours, determined by coverage across major international wire services and newspapers — NOT by what the WSWS happened to write about.

**Rules:**
- Top stories are selected based on their objective significance as world events, using bourgeois press coverage as the baseline for what happened
- If the WSWS published on a top story, include the WSWS article in the source links and integrate their analysis — but the story's inclusion is driven by its real-world significance, not the WSWS coverage
- A story that is ONLY covered by a single WSWS article does NOT belong in Top stories — it belongs in the "WSWS coverage" section
- Top stories must have at least one bourgeois press source in addition to any WSWS source
- This avoids duplication between the Top stories and WSWS coverage sections

---

## 5. Science, technology, and public health section

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

## 6. Coverage suggestions section

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

## 7. Overall briefing structure

The complete structure of a briefing should be:

```markdown
## What we're covering today

- **Topic:** Summary sentence.
- **Topic:** Summary sentence.
- **Topic:** Summary sentence.
[4-8 bullets total]

---

## Top stories

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

### Headline in sentence case

[Body paragraphs...]

<div class="source-links">...</div>

---

## United States

[Same pattern...]

---

## Science, technology, and public health

[~500 words. Major studies, disease updates, tech developments...]

---

## WSWS coverage — last 24 hours

[Same pattern...]

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

## 8. Section heading (h2) naming

Section headings (h2) should be concise, descriptive, and in sentence case:
- `## What we're covering today`
- `## Top stories`
- `## International developments`
- `## United States`
- `## Science, technology, and public health`
- `## WSWS coverage — last 24 hours`
- `## What the WSWS should cover today`

---

## 9. Research agent: source URL requirements

The briefing-research agent MUST preserve full source URLs for every article, report, or data point gathered. Each entry in the raw material should include:
- The full URL of the source article
- The publication name
- The article headline/title
- The publication date

These are essential for the writer agent to produce proper source attribution blocks with functional hyperlinks.
