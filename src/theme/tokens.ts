export const colors = {
  blue: '#0A3D7A',
  blueDeep: '#06284F',
  blueBright: '#1B6FD4',
  blueSoft: '#E8F1FB',
  white: '#FFFFFF',
  background: '#F3F6FB',
  text: '#0E1B2E',
  muted: '#44566A',
  border: '#E3EAF2',
  success: '#0D6B38',
  successBg: '#E5F6EC',
  pending: '#8A5A00',
  pendingBg: '#FFF4DE',
  failed: '#8E1B1B',
  failedBg: '#FDECEC',
  reversed: '#4C2E78',
  reversedBg: '#F3ECFA',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const type = {
  hero: 34,
  title: 26,
  section: 18,
  body: 16,
  label: 14,
  caption: 12,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 28,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: '#0A2540',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
} as const;
