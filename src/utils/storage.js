// super-lightweight local storage helpers for demo use

const KEYS = {
  INSIGHTS: "papertrail_insights",
  PAPERS: "papertrail_papers",
};

export function getInsights() {
  return JSON.parse(localStorage.getItem(KEYS.INSIGHTS) || "[]");
}

export function saveInsight(insight) {
  const all = getInsights();
  all.push({ id: crypto.randomUUID(), createdAt: Date.now(), ...insight });
  localStorage.setItem(KEYS.INSIGHTS, JSON.stringify(all));
  return all;
}

export function getPapers() {
  // demo papers
  const existing = localStorage.getItem(KEYS.PAPERS);
  if (existing) return JSON.parse(existing);
  const seed = [
    {
      id: "p1",
      title: "Smith et al. 2022 — Multimodal Ideation",
      authors: "Smith, R. et al.",
      year: 2022,
      url: "",
    },
    {
      id: "p2",
      title: "Lee & Park 2021 — Facilitation in Groups",
      authors: "Lee, H.; Park, J.",
      year: 2021,
      url: "",
    },
  ];
  localStorage.setItem(KEYS.PAPERS, JSON.stringify(seed));
  return seed;
}

export function addPaper(paper) {
  const all = getPapers();
  all.push({ id: crypto.randomUUID(), ...paper });
  localStorage.setItem(KEYS.PAPERS, JSON.stringify(all));
  return all;
}
