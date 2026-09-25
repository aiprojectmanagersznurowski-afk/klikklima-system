/**
 * Tokeny kolorystyczne dla aplikacji terenowej (React Native)
 * Odpowiadają palecie Tailwind CSS v4, zgodnie z ui_ux_guidelines.md §2.
 */
export const theme = {
  colors: {
    // Slate
    slate50: '#f8fafc',
    slate100: '#f1f5f9',
    slate200: '#e2e8f0',
    slate300: '#cbd5e1',
    slate400: '#94a3b8',
    slate500: '#64748b',
    slate600: '#475569',
    slate700: '#334155',
    slate800: '#1e293b',
    slate900: '#0f172a',

    // Sky / Primary Brand
    sky100: '#e0f2fe',
    sky200: '#bae6fd',
    sky600: '#0284c7',
    sky700: '#0369a1',
    sky900: '#0c4a6e',

    // Green / Success (neutral badges only)
    green50: '#f0fdf4',
    green700: '#15803d',

    // Amber / Warning
    amber100: '#fef3c7',
    amber500: '#f59e0b',
    amber700: '#b45309',
    amber800: '#92400e',

    // Red / Danger
    red50: '#fef2f2',
    red500: '#ef4444',
    red700: '#b91c1c',

    // Neutral
    white: '#ffffff',
    black: '#000000',
  },
} as const;

export const colors = theme.colors;
export default theme;
