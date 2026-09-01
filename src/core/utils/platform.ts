import {Platform} from 'react-native';

export function isAndroid(): boolean {
  return Platform.OS === 'android';
}

export function isIOS(): boolean {
  return Platform.OS === 'ios';
}

export function isWeb(): boolean {
  return Platform.OS === 'web';
}

export function getOSVersion(): string {
  return Platform.Version.toString();
}

export function isRTL(): boolean {
  return I18nManager.isRTL;
}

import {I18nManager} from 'react-native';
