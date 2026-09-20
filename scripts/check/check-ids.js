/* Cross-check: every DOM id referenced by a page's JS exists in that page's HTML. */
const fs = require("fs");
const dir = "/home/z/my-project/download/smart-attendance-system/";

/* page -> which script drives it */
const MAP = [
  { html: "login.html",   js: ["auth.js"] },
  { html: "teacher.html", js: ["teacher.js"] },
  { html: "student.html", js: ["student.js"] }
];

let missing = [];
for (const page of MAP) {
  const html = fs.readFileSync(dir + page.html, "utf8");
  const defined = new Set();
  for (const m of html.matchAll(/id="([^"]+)"/g)) defined.add(m[1]);

  for (const jsFile of page.js) {
    const src = fs.readFileSync(dir + "js/" + jsFile, "utf8");
    const used = new Set();
    for (const m of src.matchAll(/\$\("([^"]+)"\)/g)) used.add(m[1]);
    for (const m of src.matchAll(/getElementById\("([^"]+)"\)/g)) used.add(m[1]);
    for (const id of used) {
      if (!defined.has(id)) missing.push(`${page.html} <- js/${jsFile} needs #${id}`);
    }
  }
}

if (missing.length) {
  console.log("MISSING IDS:");
  missing.forEach((x) => console.log("  " + x));
  process.exit(1);
}
console.log("DOM ID CHECK PASSED — every id referenced by each page's JS exists in its HTML.");
