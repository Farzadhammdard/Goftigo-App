import {Dimensions} from 'react-native';

const {width, height} = Dimensions.get('window');

export const Dimensions_ = {
  window: {width, height},
  isSmall: width < 375,
  isMedium: width >= 375 && width < 414,
  isLarge: width >= 414,
} as const;
