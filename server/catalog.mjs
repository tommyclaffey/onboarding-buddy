// The apps a company can connect. Logos are the official files in public/logos (never recoloured).
// The App page template reads everything app-specific from here plus the org's connected_apps row.
export const APPS = {
  slack: { key: 'slack', name: 'Slack', category: 'Team chat', tint: 'peach', icons: ['💬', '🧵', '🔔'], open: 'https://slack.com' },
  notion: { key: 'notion', name: 'Notion', category: 'Wiki and docs', tint: 'butter', icons: ['🔎', '📄', '🗂️'], open: 'https://notion.so' },
  linear: { key: 'linear', name: 'Linear', category: 'Projects and issues', tint: 'sky', icons: ['🎯', '🗓️', '🏷️'], open: 'https://linear.app' },
  figma: { key: 'figma', name: 'Figma', category: 'Design files', tint: 'sage', icons: ['🎨', '🧩', '💬'], open: 'https://figma.com' },
  github: { key: 'github', name: 'GitHub', category: 'Code and reviews', tint: 'sky', icons: ['🔀', '👀', '✅'], open: 'https://github.com' },
  google: { key: 'google', name: 'Google Workspace', category: 'Email, calendar, docs', tint: 'butter', icons: ['📧', '📅', '📝'], open: 'https://workspace.google.com' },
};

export const appInfo = (key) => APPS[key] || null;

export const OWNER_LABEL = {
  hire: 'New hire', people_ops: 'People Ops', it: 'IT', manager: 'Manager', buddy: 'Buddy',
};

export const TYPE_LABEL = {
  form: 'Form', sign: 'Read and sign', video: 'Video', app: 'App walkthrough', todo: 'To-do', meeting: 'Meeting', it: 'IT request',
};

/** Forms a new hire fills in. Only non-sensitive answers are stored (SPEC §2). */
export const FORMS = {
  w4: {
    key: 'w4',
    title: 'Fill in your W-4',
    kicker: 'Paperwork · Federal tax form',
    lede: '4 short steps. Your answers are private to you and People Ops.',
    steps: [
      { id: 1, label: 'Filing status', question: 'How will you file your taxes this year?', help: 'Pick the one you used last year if nothing changed.',
        options: [
          { value: 'single', title: 'Single or married filing separately', desc: 'The most common choice' },
          { value: 'joint', title: 'Married filing jointly', desc: 'One return with your spouse' },
          { value: 'head', title: 'Head of household', desc: 'Unmarried and paying for a home for a dependant' },
        ] },
      { id: 2, label: 'Jobs and spouse', question: 'Do you have more than one job, or does your spouse also work?',
        help: 'Pick the one that fits your household today. You can change it any time by filing a new W-4.',
        why: 'If your household has more than one income, withholding from this job alone can come out too low. Answering honestly here helps you avoid a surprise bill at tax time.',
        options: [
          { value: 'one', title: 'No, this is my only job and I’m not filing jointly', desc: 'Most people pick this one' },
          { value: 'two', title: 'Yes, I have another job', desc: 'Withholding will account for both incomes' },
          { value: 'spouse', title: 'Yes, I’m married filing jointly and my spouse works', desc: 'We’ll use the combined income' },
        ] },
      { id: 3, label: 'Dependants', question: 'Will you claim any dependants?', help: 'Children under 17 or other people you support.',
        options: [
          { value: 'none', title: 'No dependants', desc: '' },
          { value: 'kids', title: 'Yes, children under 17', desc: 'You can enter the amount with People Ops' },
          { value: 'other', title: 'Yes, other dependants', desc: 'For example, a parent you support' },
        ] },
      { id: 4, label: 'Review and sign', question: 'Check your answers and sign.', help: 'Typing your full name counts as your signature.', sign: true },
    ],
  },
};

export const DOCS = {
  handbook: {
    key: 'handbook',
    title: 'Read and sign the handbook',
    kicker: 'Paperwork · Employee handbook',
    lede: 'About 15 minutes. The short version of how Brightside works, and what we promise each other.',
    sections: [
      ['How we work', 'We’re remote-first. Core hours are 11 to 3 in your own time zone; the rest of the day is yours to arrange.'],
      ['Time off', 'Take what you need, with a minimum of 20 days a year. Tell your manager 2 weeks ahead for anything longer than 3 days.'],
      ['Your equipment', 'Your laptop and accounts are Brightside’s. Keep them locked when you step away, and never share passwords.'],
      ['Speaking up', 'If something feels wrong, tell your manager, People Ops, or use the anonymous form. Nobody is punished for raising a concern.'],
      ['Leaving', 'If you decide to leave, 2 weeks’ notice helps the team. We’ll do the same for you.'],
    ],
    agreement: 'I’ve read the Brightside employee handbook and agree to follow it.',
  },
};
