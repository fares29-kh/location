import animate from 'tailwindcss-animate';
import plugin from 'tailwindcss/plugin';

/**
 * Tokens du design system DriveTN, exprimés en HSL (« H S% L% ») pour permettre
 * les modificateurs d'opacité Tailwind (ex. bg-primary/10).
 * Le thème de portail ne redéfinit que la famille --primary-*.
 */
const lightTokens = {
  '--background': '210 40% 98%',
  '--foreground': '222 47% 11%',
  '--surface': '0 0% 100%',
  '--surface-muted': '210 40% 96%',
  '--muted-foreground': '215 16% 47%',
  '--border': '214 32% 91%',
  '--input': '214 32% 91%',
  '--ring': 'var(--primary)',

  '--cta': '25 95% 53%',
  '--cta-hover': '21 90% 48%',
  '--cta-foreground': '0 0% 100%',
  '--cta-soft': '34 100% 92%',
  '--cta-soft-foreground': '21 90% 38%',

  '--success': '142 76% 36%',
  '--success-soft': '141 79% 93%',
  '--success-soft-foreground': '142 72% 26%',
  '--warning': '38 92% 50%',
  '--warning-soft': '48 96% 89%',
  '--warning-soft-foreground': '26 90% 32%',
  '--danger': '0 72% 51%',
  '--danger-soft': '0 93% 94%',
  '--danger-soft-foreground': '0 74% 38%',
  '--info': '199 89% 48%',
  '--info-soft': '204 94% 94%',
  '--info-soft-foreground': '201 90% 30%',

  '--tn-red': '355 100% 45%',
};

const darkTokens = {
  '--background': '223 49% 8%',
  '--foreground': '210 40% 96%',
  '--surface': '221 39% 11%',
  '--surface-muted': '217 33% 17%',
  '--muted-foreground': '215 20% 65%',
  '--border': '217 30% 22%',
  '--input': '217 30% 22%',

  '--cta-soft': '25 70% 16%',
  '--cta-soft-foreground': '31 97% 72%',

  '--success-soft': '142 60% 14%',
  '--success-soft-foreground': '142 69% 58%',
  '--warning-soft': '38 70% 15%',
  '--warning-soft-foreground': '43 96% 56%',
  '--danger-soft': '0 60% 18%',
  '--danger-soft-foreground': '0 91% 71%',
  '--info-soft': '199 70% 15%',
  '--info-soft-foreground': '198 93% 60%',
};

/** Couleur d'accent par portail : client (bleu), agence (émeraude), admin (violet). */
const portalThemes = {
  client: {
    light: {
      '--primary': '221 83% 53%',
      '--primary-hover': '224 76% 48%',
      '--primary-foreground': '0 0% 100%',
      '--primary-soft': '214 95% 93%',
      '--primary-soft-foreground': '224 76% 40%',
    },
    dark: {
      '--primary-soft': '221 60% 18%',
      '--primary-soft-foreground': '212 96% 78%',
    },
  },
  agency: {
    light: {
      '--primary': '161 94% 30%',
      '--primary-hover': '163 94% 24%',
      '--primary-foreground': '0 0% 100%',
      '--primary-soft': '149 80% 90%',
      '--primary-soft-foreground': '163 94% 22%',
    },
    dark: {
      '--primary-soft': '161 60% 14%',
      '--primary-soft-foreground': '156 72% 67%',
    },
  },
  admin: {
    light: {
      '--primary': '262 83% 58%',
      '--primary-hover': '263 70% 50%',
      '--primary-foreground': '0 0% 100%',
      '--primary-soft': '251 91% 95%',
      '--primary-soft-foreground': '263 70% 42%',
    },
    dark: {
      '--primary-soft': '262 50% 20%',
      '--primary-soft-foreground': '252 95% 85%',
    },
  },
};

function portalSelectors(portal) {
  return {
    light: `[data-portal="${portal}"]`,
    dark: `.dark[data-portal="${portal}"], .dark [data-portal="${portal}"]`,
  };
}

const tokensPlugin = plugin(({ addBase }) => {
  addBase({
    ':root': { ...lightTokens, ...portalThemes.client.light },
    '.dark': { ...darkTokens, ...portalThemes.client.dark, colorScheme: 'dark' },
  });
  for (const [portal, theme] of Object.entries(portalThemes)) {
    const selectors = portalSelectors(portal);
    addBase({ [selectors.light]: theme.light, [selectors.dark]: theme.dark });
  }
});

/** @param {string} name */
const hsl = (name) => `hsl(var(${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
const preset = {
  darkMode: ['class'],
  content: [],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1280px' },
    },
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      xl: ['1.5rem', { lineHeight: '2rem' }],
      '2xl': ['2rem', { lineHeight: '2.5rem' }],
      '3xl': ['3rem', { lineHeight: '1.1' }],
    },
    extend: {
      colors: {
        background: hsl('--background'),
        foreground: hsl('--foreground'),
        surface: { DEFAULT: hsl('--surface'), muted: hsl('--surface-muted') },
        muted: { DEFAULT: hsl('--surface-muted'), foreground: hsl('--muted-foreground') },
        border: hsl('--border'),
        input: hsl('--input'),
        ring: hsl('--ring'),
        primary: {
          DEFAULT: hsl('--primary'),
          hover: hsl('--primary-hover'),
          foreground: hsl('--primary-foreground'),
          soft: hsl('--primary-soft'),
          'soft-foreground': hsl('--primary-soft-foreground'),
        },
        cta: {
          DEFAULT: hsl('--cta'),
          hover: hsl('--cta-hover'),
          foreground: hsl('--cta-foreground'),
          soft: hsl('--cta-soft'),
          'soft-foreground': hsl('--cta-soft-foreground'),
        },
        success: {
          DEFAULT: hsl('--success'),
          soft: hsl('--success-soft'),
          'soft-foreground': hsl('--success-soft-foreground'),
        },
        warning: {
          DEFAULT: hsl('--warning'),
          soft: hsl('--warning-soft'),
          'soft-foreground': hsl('--warning-soft-foreground'),
        },
        danger: {
          DEFAULT: hsl('--danger'),
          soft: hsl('--danger-soft'),
          'soft-foreground': hsl('--danger-soft-foreground'),
        },
        info: {
          DEFAULT: hsl('--info'),
          soft: hsl('--info-soft'),
          'soft-foreground': hsl('--info-soft-foreground'),
        },
        'tn-red': hsl('--tn-red'),
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        control: '0.5rem',
        card: '1rem',
        panel: '1.5rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.08)',
        elevated: '0 8px 30px -12px rgb(15 23 42 / 0.25)',
      },
      minHeight: { touch: '2.75rem' },
      minWidth: { touch: '2.75rem' },
      transitionDuration: { DEFAULT: '200ms' },
    },
  },
  plugins: [animate, tokensPlugin],
};

export default preset;
