# What We Built: A Complete Technical Walkthrough

*Last updated: February 25, 2026*
*Covers: Initial site build through UX enhancement round*

---

## The Big Picture

At its core, your briefing site is a **static website** — a collection of plain files (HTML, CSS, JavaScript) sitting in a folder on GitHub's servers. When someone visits your URL, GitHub simply hands their browser those files. There's no "app server" running somewhere processing requests, no database powering the pages, no monthly hosting bill. This is important because it means the site is fast, free to host, and almost impossible to break.

On top of that static foundation, we layered two "dynamic" capabilities: **authentication** (so only approved people can read it) and **user features** (highlighting, notes, bookmarks) that run entirely in each visitor's browser. And upstream of all of it, an **automated pipeline** wakes up every morning, generates a fresh briefing using AI, and publishes it — no human intervention required.

Here's a mental model:

```
6:00 AM every day:
  Claude Code sub-agents (research → write) → Markdown file
       ↓
  publish.sh (Bash script) → converts to HTML → pushes to GitHub
       ↓
  GitHub Pages serves it to the world
       ↓
  Visitor's browser:
    Supabase checks: "Are you logged in and approved?"
       ↓ yes
    app.js activates: highlighting, notes, TOC, focus mode, etc.
```

---

## The Languages

We used **four languages** in this project. Each serves a distinct purpose.

### 1. HTML (HyperText Markup Language)

HTML is the **skeleton** of every web page. It's not really a "programming" language — it's a markup language that describes the *structure* of content. When you write:

```html
<h2>World News</h2>
<p>Something happened today.</p>
```

You're telling the browser: "This is a heading, and this is a paragraph." HTML doesn't *do* anything — it just labels what things are. Every web page you've ever visited is, at its foundation, an HTML document.

**Where we use it:** The `templates/briefing.html` file is a template that defines the page structure — where the title goes, where the content goes, where scripts load. Pandoc (more on that below) fills in the actual briefing content.

### 2. CSS (Cascading Style Sheets)

If HTML is the skeleton, CSS is the **skin and clothing**. It controls how things look: colors, fonts, spacing, layout, animations. When you write:

```css
h2 {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #888;
}
```

You're saying: "Make all h2 elements small, uppercase, and gray." The "cascading" part means rules can layer on top of each other — a general rule can be overridden by a more specific one. This is how dark mode works: we define one set of colors normally, then override them when dark mode is active.

**Where we use it:** `assets/style.css` is a single ~988-line file controlling the entire site's appearance. It handles light/dark theming, the notes panel, focus mode dimming, the progress bar, print layout, mobile responsiveness, and the archive accordion.

**Key concept — CSS Custom Properties (Variables):** Instead of writing `color: #1a1a18` in fifty places, we define `--text: #1a1a18` once, then use `color: var(--text)` everywhere. To switch to dark mode, we just redefine `--text: #e8e4dc` and every element updates automatically. This is why theme switching works so cleanly.

### 3. JavaScript (JS)

JavaScript is the **brain and muscles** — the actual programming language that makes the page interactive. HTML says "here's a button," CSS says "make it blue," and JavaScript says "when someone clicks it, do this thing." It's the only true programming language that runs natively in web browsers.

**Where we use it:** Three JavaScript files work together:

- **`config.js`** — A tiny file holding settings: is auth enabled? What's the Supabase URL? Think of it as a control panel with switches.
- **`auth.js`** (~303 lines) — The bouncer at the door. It checks whether auth is turned on, whether you're logged in, and whether your account is approved. If not, it shows the login/signup overlay and blocks everything else.
- **`app.js`** (~1,122 lines) — The main engine. Once you're past the bouncer, this file activates *everything*: table of contents, progress bar, reading time estimate, focus mode, highlighting, the notes panel, bookmarks, search, and the archive accordion.

**Key concept — the DOM (Document Object Model):** When your browser loads an HTML page, it builds an internal tree structure called the DOM. JavaScript can read and modify this tree in real time. When you highlight text and a yellow mark appears, JavaScript is inserting a new `<mark>` element into the DOM. When focus mode dims other sections, JavaScript is toggling CSS classes on section elements. The page never reloads — JS is surgically modifying the live document.

**Key concept — Event Listeners:** Most of app.js works by saying "when X happens, do Y." Scroll the page? Update the progress bar and check which section is focused. Select text? Show the highlight prompt. Press Shift+N? Open the notes panel. These are event listeners — JavaScript watching for specific user actions and responding.

### 4. Bash (Shell Scripting)

Bash is the language of the **terminal/command line** on Mac and Linux. It's not for building user-facing things — it's for automating tasks, moving files around, and gluing programs together. Think of it as writing down the steps you'd manually type into Terminal, so a computer can repeat them.

**Where we use it:** `publish.sh` is a ~300-line Bash script that:
1. Takes a Markdown briefing file
2. Runs Pandoc to convert it to HTML
3. Generates the archive page (with year/month groupings)
4. Generates the search page
5. Commits everything to Git and pushes to GitHub

It's the assembly line that turns a raw text document into a published website.

---

## The Tools and Services

### Pandoc — The Universal Document Converter

**What it is:** A command-line program that converts documents between formats. Give it Markdown, get HTML. Give it HTML, get a PDF. It's like a universal translator for document formats.

**Why we use it:** Your daily briefing is written in **Markdown** — a simple text format where `## Heading` becomes a heading and `**bold**` becomes **bold**. Markdown is easy for the AI agents to write and easy for humans to read. But browsers need HTML. Pandoc bridges that gap.

**The key command:**
```bash
pandoc briefing.md --template=templates/briefing.html -o output.html
```
This says: "Take the Markdown file, pour its content into our HTML template, and save the result." The template has placeholders like `$body$` and `$title$` that Pandoc fills in — a system called **Mustache templating**.

**Why this approach:** Many sites use complex build tools (Webpack, Vite, Next.js). We deliberately avoided all of that. Pandoc gives us exactly what we need — Markdown to HTML conversion with templates — without introducing hundreds of dependencies or a build system that could break. It's a single, stable, well-maintained program.

### Git and GitHub

**Git** is a **version control system** — it tracks every change you make to your files, who made it, and when. Think of it as an infinitely deep "undo" history for your entire project. Every saved snapshot is called a **commit**.

**GitHub** is a website that hosts Git repositories (projects) online and adds collaboration features. It's where your code lives on the internet.

**Key concepts:**

- **Repository (repo):** Your project folder, tracked by Git. Yours is `icfi-briefing-site`.
- **Commit:** A snapshot of your files at a point in time, with a message describing what changed. Example: `"Fix focus mode section tracking algorithm"`.
- **Push:** Uploading your local commits to GitHub so they're backed up and (in our case) published.
- **Branch:** Git lets you maintain parallel versions of your code. Your site publishes from the `main` branch.

**Why Git matters for this project:** Every morning when a new briefing publishes, `publish.sh` creates a commit and pushes it. That means you have a complete history of every briefing ever published, and you could roll back to any previous version if something went wrong.

### GitHub Pages

**What it is:** A free service from GitHub that turns a repository into a website. You push HTML files to your repo, and GitHub serves them at `yourusername.github.io/repo-name/`.

**Why we chose it:**
- **Free** — no hosting costs, ever
- **Automatic** — push new files, the site updates within seconds
- **Reliable** — GitHub has essentially 100% uptime
- **No server to maintain** — no security patches, no server crashes, no scaling worries

**The tradeoff:** GitHub Pages only serves *static* files. It can't run server-side code (like Python or Node.js). That's fine for us — our page content is pre-generated by Pandoc, and interactivity runs in the browser via JavaScript. The only thing we needed server-side was authentication, which is why we brought in Supabase.

### Supabase — Authentication and Data

**What it is:** An open-source "Backend as a Service." It gives you a **PostgreSQL database** and an **authentication system** without you having to set up or manage a server. You interact with it through JavaScript in the browser.

**Why we need it:** GitHub Pages can't check passwords or manage user accounts — it just serves files to anyone who asks. Supabase fills that gap. When someone visits your site:

1. `auth.js` asks Supabase: "Is this person logged in?"
2. If not → show the login/signup screen
3. If yes → check the database: "Is this account approved?"
4. If approved → let them through and load the briefing

**Key concepts:**

- **Authentication (AuthN):** Verifying *who* someone is. "You say you're Jane — prove it with your password." Supabase handles password hashing, session tokens, email verification — all the security-critical stuff you never want to build yourself.

- **Authorization (AuthZ):** Determining *what* someone is allowed to do. "OK, you're Jane, but has Evan approved your account?" This is the `approved` column in your `profiles` table.

- **Row Level Security (RLS):** A PostgreSQL feature where the database itself enforces access rules. Even if someone tried to directly query your Supabase database from their browser console, the RLS policies would prevent them from seeing other users' highlights or modifying other accounts. The security lives in the database, not in your JavaScript (which could be tampered with).

- **Anon Key vs. Service Key:** Your config.js contains the **anon key** — this is a *public* key that's safe to expose in browser code. It can only do what your RLS policies allow. The **service key** (which you keep secret) can bypass RLS and is only used for admin tasks in the Supabase dashboard.

**The free tier:** Supabase's free plan gives you 50,000 monthly active users and 500MB of database storage. For a team briefing site, you'd never come close to these limits.

**Why Supabase over alternatives:** Firebase (Google) is the main competitor. Supabase was chosen because: it uses standard PostgreSQL (the world's most trusted open-source database) rather than a proprietary format; it has simpler, more transparent pricing; and the JavaScript client library is clean and easy to work with.

### Claude Code and Sub-Agents — The AI Pipeline

**What it is:** Claude Code is Anthropic's tool for running Claude directly in your terminal, where it can read files, write code, execute commands, and manage projects. Sub-agents are specialized "roles" you define that Claude can switch into for specific tasks.

**How the morning pipeline works:**

Your `.claude/` directory contains agent definitions. Each morning at 6 AM, a **launchd agent** (Mac's built-in task scheduler — like a cron job) triggers the pipeline:

1. **Research Agent** runs first — it searches the web, gathers news, reads sources, and saves structured raw material to an intermediate file
2. **Writer Agent** runs next — it reads that raw material and synthesizes it into a coherent daily briefing in Markdown format
3. **publish.sh** runs last — converts the Markdown to HTML and pushes to GitHub

Each agent has a specific persona and set of instructions so the output is consistent day to day. The research agent knows what topics to cover and how to structure its findings. The writer agent knows the tone, format, and structure of the final briefing.

**launchd** (the scheduler): This is macOS's system for running tasks on a schedule. You define a `.plist` file (XML configuration) that says "run this command at this time every day." It's the Mac equivalent of Linux's `cron`. The key requirement: your Mac needs to be on and awake at 6 AM for the pipeline to run.

---

## Architecture Decisions — Why We Built It This Way

### Why static instead of a web app?

A "real" web application (built with React, Django, Rails, etc.) would require:
- A server running 24/7 ($5-50+/month)
- Regular security updates and maintenance
- A deployment pipeline
- Monitoring for downtime
- Database backups

Our static approach requires **none of that**. The only running cost is Supabase's free tier. The site can't go down unless GitHub goes down (extremely rare). There's nothing to hack because there's no server running your code.

**The tradeoff:** We can't do anything that requires server-side logic — no server-rendered pages, no API endpoints, no real-time collaboration. For a read-only briefing site with client-side interactivity, this tradeoff is very much in our favor.

### Why no JavaScript framework (React, Vue, etc.)?

Modern web development heavily uses frameworks — React, Vue, Svelte, Angular — which provide structure for building complex interactive UIs. We deliberately used **vanilla JavaScript** (plain JS, no framework).

**Reasons:**
- **Simplicity:** Frameworks add layers of abstraction. Our needs are straightforward enough that vanilla JS handles them cleanly.
- **No build step:** Frameworks typically require a "build" process that compiles your code. Our JS files are served directly — what you write is what the browser runs. This eliminates an entire category of potential problems.
- **Longevity:** Frameworks come and go. jQuery dominated, then Angular, then React — each with breaking changes between versions. Vanilla JavaScript is standardized and permanent. Your site will work in a browser 10 years from now without modification.
- **File size:** Your entire site (HTML + CSS + JS) is smaller than most frameworks' boilerplate. Pages load nearly instantly.

**The tradeoff:** As app.js grew to 1,100+ lines, a framework would have helped organize the code more cleanly (separating concerns into components). If the site's interactivity grew significantly more complex, this might become a real issue. For now, the simplicity wins.

### Why Markdown as the source format?

Markdown is a lightweight formatting syntax:
```markdown
## This is a heading
This is a paragraph with **bold** and *italic* text.
- This is a list item
```

We chose it because:
1. **AI agents write it easily** — it's closer to natural language than HTML
2. **Human-readable** — you can open the raw file and read it comfortably
3. **Git-friendly** — text diffs show exactly what changed between briefings
4. **Universal** — Pandoc, GitHub, and hundreds of other tools understand it natively

### The AUTH_ENABLED toggle

We built a switch in `config.js` that turns authentication on or off:

```javascript
var AUTH_ENABLED = true;  // flip to false to disable login requirement
```

When `false`, the auth overlay never appears and highlights save to **localStorage** (your browser's local storage — data that persists between visits but only exists on that specific browser on that specific computer).

When `true`, Supabase handles everything and highlights save to the **database** (accessible from any browser you log into).

**Why this matters:** During development, you don't want to log in every time you test a change. In production, you want the gate. One variable controls the entire behavior. This pattern — a **feature flag** — is common in professional software development.

---

## Architecture Decisions — Specific Features

### Focus Mode: A Debugging Story

Focus mode dims all sections except the one you're currently reading. Getting it to work correctly required three attempts — a useful lesson in how debugging works:

**Attempt 1 — "Center of section closest to viewport center":** For each section, calculate the distance from its vertical center to the center of the screen. Focus the closest one. **Problem:** Section 0 (before the first `<hr>`) was ~8,300 pixels tall. Its center was always relatively close to the viewport center, so it "won" even when you'd scrolled thousands of pixels past it.

**Attempt 2 — "Viewport center is inside section":** Check which section the center of the screen is physically inside. **Problem:** When the viewport center was at pixel 4,000 and section 0 ran from pixel 0 to 8,300, the viewport center was still *inside* section 0. Same result.

**Attempt 3 (final) — "Threshold-based tracking":** Track the last section whose top edge has scrolled past a threshold line near the top of the screen (150px from the top). As you scroll down, each section's top eventually crosses that line, and it becomes the "current" section. **This works** because it doesn't care about section height — only about where the top edge is.

**The lesson:** The "obvious" solution often fails with real-world data. Section 0 being unexpectedly tall broke two reasonable algorithms. The fix came from switching to a fundamentally different approach rather than tweaking the broken one.

### Text Highlighting: The Restoration Problem

Saving highlights is easy — wrap selected text in a `<mark>` tag. The hard part is *restoring* them when the page reloads, because the page is regenerated from Markdown each time and all DOM modifications are lost.

**Our approach:** Save the highlighted text string itself (not its position in the document). On page load, search the page content for each saved string and re-wrap it.

**Why not save positions?** If we saved "highlight starts at character 4,521," a single comma added during editing would shift every position after it. Text-based search is resilient to minor document changes.

**The tradeoff:** If the exact same sentence appears twice, both get highlighted. In practice, this virtually never happens with natural-language briefing content.

### The Archive Accordion

The archive page groups past briefings by year and month in collapsible sections. This is generated entirely in Bash (`publish.sh`) — no JavaScript needed for the grouping logic.

**How it works:** The script loops through briefing files sorted by date. It tracks the "previous year" and "previous month." When either changes, it closes the old HTML group and opens a new one. The current year starts expanded; older years start collapsed.

**Why generate in Bash instead of JavaScript?** Because the archive page is static HTML. Generating the accordion server-side (in publish.sh) means the page works even with JavaScript disabled, loads faster, and is indexable by search engines. JavaScript just handles the expand/collapse click behavior.

---

## Key Concepts to Be Aware Of

### Client-Side vs. Server-Side

This is the most fundamental distinction in web development:

- **Server-side:** Code runs on a remote computer before the page reaches your browser. The server does the work and sends you the finished result. Examples: a search engine processing your query, a bank verifying your login.

- **Client-side:** Code runs in *your* browser, on *your* computer, after the page has loaded. Examples: all of app.js — highlighting, notes, focus mode.

Your site is **almost entirely client-side**. The only server-side component is Supabase's authentication service (which runs on Supabase's servers, not yours).

**Implication:** If someone opens their browser's Developer Tools (F12), they can see all your JavaScript code, modify it, and even disable the auth overlay *in their own browser*. This is why RLS on Supabase matters — even if someone bypasses the client-side auth gate, the database still won't give them data they're not authorized to see.

### localStorage vs. Database Storage

Two places user data (like highlights) can be saved:

**localStorage:**
- Lives in the browser on one specific device
- Cleared if the user clears browser data
- No login required
- Can't sync across devices
- Zero infrastructure needed

**Supabase (database):**
- Lives on Supabase's servers
- Persists regardless of browser/device
- Requires authentication
- Syncs everywhere you log in
- Requires the Supabase service

Your site uses both — `AUTH_ENABLED` determines which one is active.

### How Highlighting Works (Text Search Restoration)

This is one of the cleverer parts of the system. When you highlight text:

1. JavaScript captures the **exact text** you selected
2. It wraps that text in a `<mark class="user-highlight">` element (a yellow highlight)
3. It saves the text string to storage (localStorage or Supabase)

When you reload the page:

1. JavaScript loads your saved highlight strings
2. It searches the page content for each string
3. When found, it wraps that text in a `<mark>` element again

**Why text-search instead of position-based?** We could have saved "highlight starts at character 4,521 and ends at character 4,589." But if the briefing content ever shifted by even one character (a typo fix, a formatting change), every saved highlight would point to the wrong text. By saving the *actual text*, highlights reconnect correctly even if the document changes around them.

**The tradeoff:** If the same exact sentence appears twice in a briefing, both instances would get highlighted. In practice, this almost never happens with natural-language content.

### The DOM Manipulation Pattern

Almost all of app.js follows one pattern:

1. **Query the DOM** — find existing elements (`document.querySelectorAll('hr')`)
2. **Create new elements** — build new HTML nodes in JavaScript (`document.createElement('section')`)
3. **Insert/modify** — place new elements into the page or change existing ones
4. **Listen for events** — watch for user actions and respond

The `wrapSections()` function is a perfect example: it finds all `<hr>` elements (horizontal rules that separate briefing sections), then wraps the content between each pair into a `<section>` element. This gives us something to target with focus mode (dim all sections except the current one) and alternating background colors.

### Responsive Design

The site works on phones, tablets, and desktops. This is done through **CSS media queries**:

```css
@media (max-width: 600px) {
  .notes-panel { width: 100%; }
}
```

This says: "When the screen is less than 600 pixels wide, make the notes panel full-width instead of a sidebar." We don't build separate mobile and desktop versions — one set of HTML/CSS/JS adapts to any screen size.

### The Print Stylesheet

A section of the CSS specifically targets printing (`@media print`). It hides interactive elements (progress bar, buttons, notes panel), removes background colors (saves ink), and optimizes the layout for paper. This means your colleagues can Ctrl+P any briefing and get a clean printed version.

---

## Summary of the Technology Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Content authoring | Markdown | Human/AI-readable source format |
| Content conversion | Pandoc | Markdown → HTML with templates |
| Structure | HTML | Page skeleton |
| Appearance | CSS | Styling, themes, responsive layout |
| Interactivity | JavaScript (vanilla) | All browser-side features |
| Automation | Bash + launchd | Daily publish pipeline + scheduling |
| Hosting | GitHub Pages | Free static file serving |
| Version control | Git + GitHub | Change tracking and deployment |
| Authentication | Supabase Auth | Login, signup, session management |
| Data persistence | Supabase PostgreSQL | Highlights, user profiles |
| Content generation | Claude Code sub-agents | Automated daily research + writing |

The whole system is intentionally **low-dependency and low-maintenance**. There's no package.json with 200 npm modules. No build pipeline that breaks when a dependency updates. No server to reboot at 3 AM. The most complex moving part is the morning AI pipeline, and even that is just two Claude Code agents running sequentially followed by a Bash script.

---

## Change Log

| Date | Changes |
|------|---------|
| Feb 25, 2026 | Initial document covering full site architecture, UX enhancements (focus mode, notes panel, bookmarks, reading time, archive accordion), auth system, and automated pipeline |
