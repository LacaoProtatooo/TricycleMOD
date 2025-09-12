/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#FF7A00';
const tintColorDark = '#FFA64D';

export const Colors = {
  light: {
    text: '#1A1A1A',
    background: '#FFFFFF',
    tint: tintColorLight,
    icon: '#8A8A8A',
    tabIconDefault: '#C7C7C7',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#F2F2F2',
    background: '#0F1113',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#6B6F75',
    tabIconSelected: tintColorDark,
  },
};
