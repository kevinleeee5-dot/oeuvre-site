# Oeuvre SEO audit (2026-11-01)

## Already fine
- https redirect, canonical, robots.txt, sitemap.xml, hidden h1, OG basics, Search Console verified.

## Found and fixed (local commit, not yet live)
1. Home title was only "Oeuvre" -> "Oeuvre — Brand and digital studio in Auckland".
2. Every page now has its own title and description (brand / web / digital product, Auckland).
3. Structured data added: Organization + WebSite (home), BreadcrumbList (inner pages), Service list (services). Only facts already on the site: name, legal name, email, Auckland, services.
4. OG image size/alt/locale, Twitter title/description/image added.
5. sitemap.xml has lastmod.
6. www.oeuvre.co.nz now 301s to oeuvre.co.nz (.htaccess; verify after deploy).
7. 404 page is noindex.
8. Hidden h1 on home carries the positioning line.

## Not changed (needs your decision)
- First load about 35 MB of video/assets: biggest Core Web Vitals risk. Separate version, needs your look at quality.
- Home is a full-screen WebGL figure with almost no readable text; the hidden h1 + structured data compensate.
- Work detail pages are offline, so no case-study pages to rank yet.
- Real keyword volumes need Google Keyword Planner / Search Console after a few weeks of data.
- Te reo Māori / Chinese pages not live, so no hreflang beyond English.
