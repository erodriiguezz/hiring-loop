// The rejection email you get after each death. Painfully familiar, never cruel to the player.
const EARLY = [
  "we've decided to move forward with other candidates.",
  "the position has been filled internally.",
  "you're overqualified.",
  "you're underqualified.",
  "we'll keep your resume on file.",
  "the role has been put on hold.",
  "we went with a referral.",
  "after careful consideration... no.",
  "we're looking for 10 yrs of AI experience.",
  "great culture add. not a culture fit.",
  "unfortunately...",
  "(no reply. you've been ghosted.)",
  "we've paused hiring for this role.",
  "thanks for your interest in Company™.",
  "we had over 4,000 applicants.",
];
const BY_CAUSE = {
  fell: ["you fell through the cracks.", "lost in the pipeline.", "your application could not be found."],
  spikes: ["red flags detected.", "failed the background check.", "concerns about the gap in your resume."],
  crushed: ["crushed by the hiring freeze.", "layoffs came down from above.", "the reorg landed on you."],
  deadline: ["time's up. the role closed.", "the req expired.", "we needed someone yesterday."],
  restart: ["you withdrew your application.", "rage quit counts as a no.", "a fresh start. same market."],
};

let last = "";
export function pickTaunt(deaths, cause) {
  if (deaths === 5) return "5 rejections. some people get that in one day.";
  if (deaths === 10) return "10 rejections. \"the market is fine,\" they said.";
  if (deaths === 25) return "25. at this point it's a full-time job.";
  if (deaths === 50) return "50 rejections. HR is genuinely impressed.";
  const pool = Math.random() < 0.45 && BY_CAUSE[cause] ? BY_CAUSE[cause] : EARLY;
  let s;
  do s = pool[Math.floor(Math.random() * pool.length)]; while (s === last && pool.length > 1);
  return (last = s);
}

export function verdict(deaths) {
  if (deaths < 20) return "suspiciously few rejections. are you a referral?";
  if (deaths < 80) return "a perfectly normal job search.";
  return "you deserve this job more than anyone.";
}
