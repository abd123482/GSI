/**
 * Warp Design System Tokens & Clerk Appearance Configuration
 * Derived from Warp-Inspired-design-analysis specification
 */

export const warpColors = {
  // Brand & Surfaces
  canvas: '#2b2622',        // Warm near-charcoal page background (oklch warmth)
  canvasSoft: '#383330',    // Elevated card, tile & modal surface
  hairline: '#3f3a36',      // 1px divider & border on dark surfaces
  hairlineLight: '#4d4742', // Interactive border hover

  // Primary & Accents
  primary: '#f7f5f0',       // Warm off-white (primary CTA fill, wordmark)
  onPrimary: '#2b2622',     // Dark text on primary button
  
  // Typography
  ink: '#f7f5f0',           // Default text on canvas
  bodyStrong: '#dad2c1',    // Mid-emphasis text
  body: '#c9c0ad',          // Secondary body text
  mute: '#aea69c',          // Lowest-priority text, fine print, timestamps

  // Semantic (subtle dark tints)
  success: '#10b981',
  successSurface: '#162b22',
  successBorder: '#1e3d30',
  
  warning: '#f59e0b',
  warningSurface: '#2d2212',
  warningBorder: '#453316',

  danger: '#ef4444',
  dangerSurface: '#2d1616',
  dangerBorder: '#451e1e',
};

export const warpRadius = {
  none: '0px',
  xxs: '1px',
  xs: '2px',
  sm: '3px',   // Default CTA button radius
  md: '4px',   // Default card / chrome radius
  lg: '6px',   // Large modal / container
  full: '9999px',
};

/**
 * Clerk Appearance object matching Warp's warm near-charcoal aesthetic
 */
export const warpClerkAppearance = {
  variables: {
    colorPrimary: warpColors.primary,
    colorText: warpColors.ink,
    colorTextSecondary: warpColors.body,
    colorBackground: warpColors.canvasSoft,
    colorInputBackground: warpColors.canvas,
    colorInputText: warpColors.ink,
    borderRadius: warpRadius.md,
    fontFamily: 'var(--font-inter), system-ui, sans-serif',
  },
  elements: {
    card: {
      backgroundColor: warpColors.canvasSoft,
      border: `1px solid ${warpColors.hairline}`,
      boxShadow: 'none',
      borderRadius: warpRadius.md,
    },
    headerTitle: {
      color: warpColors.ink,
      fontFamily: 'var(--font-inter), system-ui, sans-serif',
      letterSpacing: '-0.5px',
    },
    headerSubtitle: {
      color: warpColors.body,
    },
    socialButtonsBlockButton: {
      backgroundColor: warpColors.canvas,
      border: `1px solid ${warpColors.hairline}`,
      color: warpColors.ink,
      borderRadius: warpRadius.sm,
      '&:hover': {
        backgroundColor: warpColors.hairline,
      },
    },
    formButtonPrimary: {
      backgroundColor: warpColors.primary,
      color: warpColors.onPrimary,
      borderRadius: warpRadius.sm,
      fontWeight: 500,
      '&:hover': {
        backgroundColor: warpColors.bodyStrong,
      },
    },
    formFieldInput: {
      backgroundColor: warpColors.canvas,
      border: `1px solid ${warpColors.hairline}`,
      color: warpColors.ink,
      borderRadius: warpRadius.sm,
      '&:focus': {
        borderColor: warpColors.primary,
      },
    },
    footerActionText: {
      color: warpColors.body,
    },
    footerActionLink: {
      color: warpColors.primary,
      textDecoration: 'underline',
      '&:hover': {
        color: warpColors.bodyStrong,
      },
    },
    userButtonPopoverCard: {
      backgroundColor: warpColors.canvasSoft,
      border: `1px solid ${warpColors.hairline}`,
      boxShadow: 'none',
      borderRadius: warpRadius.md,
    },
    userPreviewMainIdentifier: {
      color: warpColors.ink,
    },
    userPreviewSecondaryIdentifier: {
      color: warpColors.body,
    },
  },
};
