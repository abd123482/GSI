/**
 * Notion Design System tokens & Clerk Appearance configuration
 * Derived from Notion-design-analysis specification
 */

export const notionColors = {
  primary: '#5645d4',
  primaryPressed: '#4534b3',
  primaryDeep: '#3a2a99',
  onPrimary: '#ffffff',
  brandNavy: '#0a1530',
  brandNavyDeep: '#070f24',
  brandNavyMid: '#1a2a52',
  linkBlue: '#0075de',
  linkBluePressed: '#005bab',
  canvas: '#ffffff',
  surface: '#f6f5f4',
  surfaceSoft: '#fafaf9',
  hairline: '#e5e3df',
  hairlineSoft: '#ede9e4',
  hairlineStrong: '#c8c4be',
  ink: '#1a1a1a',
  charcoal: '#37352f',
  slate: '#5d5b54',
  steel: '#787671',
  stone: '#a4a097',
  muted: '#bbb8b1',
  onDark: '#ffffff',
  semanticSuccess: '#1aae39',
  semanticWarning: '#dd5b00',
  semanticError: '#e03131',
};

export const notionClerkAppearance = {
  variables: {
    colorPrimary: notionColors.primary,
    colorText: notionColors.charcoal,
    colorTextSecondary: notionColors.slate,
    colorBackground: notionColors.canvas,
    colorInputBackground: notionColors.canvas,
    colorInputText: notionColors.ink,
    borderRadius: '8px',
    fontFamily:
      "var(--font-sans, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
    fontSize: '14px',
  },
  elements: {
    // Hide social logins & divider per project requirements
    socialButtons: '!hidden',
    socialButtonsBlockButton: '!hidden',
    socialButtonsProviderIcon: '!hidden',
    dividerRow: '!hidden',
    dividerText: '!hidden',
    dividerLine: '!hidden',

    // Notion Card Surface (12px rounded, 1px solid #e5e3df hairline, subtle elevation)
    card: {
      backgroundColor: notionColors.canvas,
      borderRadius: '12px',
      border: `1px solid ${notionColors.hairline}`,
      boxShadow: 'rgba(15, 15, 15, 0.05) 0px 4px 16px 0px',
      padding: '32px',
      maxWidth: '440px',
      width: '100%',
    },
    rootBox: {
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
    },

    // Notion Typography Header
    headerTitle: {
      color: notionColors.ink,
      fontSize: '22px',
      fontWeight: '600',
      letterSpacing: '-0.4px',
    },
    headerSubtitle: {
      color: notionColors.slate,
      fontSize: '14px',
      fontWeight: '400',
      marginTop: '4px',
      lineHeight: '1.5',
    },

    // Form inputs (Notion text-input: 8px radius, hairline border, focus primary purple)
    formFieldLabel: {
      color: notionColors.charcoal,
      fontSize: '13px',
      fontWeight: '500',
      marginBottom: '4px',
    },
    formFieldInput: {
      backgroundColor: notionColors.canvas,
      color: notionColors.ink,
      border: `1px solid ${notionColors.hairlineStrong}`,
      borderRadius: '8px',
      fontSize: '14px',
      height: '42px',
      padding: '8px 12px',
      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      '&:focus': {
        borderColor: notionColors.primary,
        boxShadow: '0 0 0 2px rgba(86, 69, 212, 0.2)',
      },
    },

    // Notion Signature Primary Button (button-primary: 8px radius, #5645d4 Notion purple)
    formButtonPrimary: {
      backgroundColor: notionColors.primary,
      color: notionColors.onPrimary,
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      height: '42px',
      padding: '10px 18px',
      boxShadow: 'none',
      transition: 'background-color 0.15s ease',
      '&:hover': {
        backgroundColor: notionColors.primaryPressed,
      },
      '&:active': {
        backgroundColor: notionColors.primaryDeep,
      },
    },

    // Footer actions & inline links (link-blue: #0075de)
    footerActionLink: {
      color: notionColors.linkBlue,
      fontSize: '13px',
      fontWeight: '500',
      '&:hover': {
        color: notionColors.linkBluePressed,
        textDecoration: 'underline',
      },
    },
    footerActionText: {
      color: notionColors.slate,
      fontSize: '13px',
    },

    // Identity preview (e.g. during verification)
    identityPreviewText: {
      color: notionColors.ink,
      fontWeight: '500',
    },
    identityPreviewEditButton: {
      color: notionColors.linkBlue,
    },
  },
};
