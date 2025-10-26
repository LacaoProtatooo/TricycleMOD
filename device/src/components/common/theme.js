export const colors = {
    // Primary and accent colors set to Orange shades
    primary: '#ff8c00',        // Dark Orange (primary)
    secondary: '#ff7f00',      // Bright Orange (secondary)
  
    // Background and surface colors using Ivory
    background: '#fffff0',     // Ivory (main background)
    surface: '#f8f2dd',        // A softer Ivory tone for panels
  
    // Text and other UI elements (using darker Orange for contrast)
    text: '#cc5500',           // Dark Orange for text
    error: '#B00020',
    disabled: '#f1f1f1',
    placeholder: '#a1a1a1',
  
    // Additional Orange shades (from lighter to darker)
    orangeShade1: '#ffb347',   // Light Orange
    orangeShade2: '#ffa500',   // Standard Orange
    orangeShade3: '#ff9500',
    orangeShade4: '#ff8c00',   // Dark Orange (primary)
    orangeShade5: '#ff7f00',   // Bright Orange
    orangeShade6: '#ff6f00',
    orangeShade7: '#ff5f00',
    orangeShade8: '#cc5500',   // Darker Orange (text)
    orangeShade9: '#993d00',
    orangeShade10: '#662900',
  
    // Ivory variations (from warm cream to pure ivory)
    ivory1: '#fffff0',
    ivory2: '#f5eccf',
    ivory3: '#f6eed4',
    ivory4: '#f8f2dd',
    ivory5: '#f7f0d9',
    ivory6: '#f9f4e2',

    // Star color
    starYellow: '#FFD700',
  };
  
  export const spacing = {
    small: 8,
    medium: 16,
    large: 24,
  };
  
  export const fonts = {
    regular: 'System',
    medium: 'System',
    light: 'System',
    thin: 'System',
  };
  
  export const globalStyles = {
    container: {
      flex: 1,
      backgroundColor: colors.background, // Ivory background
      padding: spacing.medium,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primary, // Orange primary for titles
      marginBottom: spacing.medium,
    },
    // A sample panel style using Orange shades for layout panels
    panel: {
      backgroundColor: colors.orangeShade4,
      padding: spacing.medium,
      borderRadius: 8,
    },
    panelText: {
      color: colors.ivory6, // Ivory text on an Orange background for contrast
    },
  };