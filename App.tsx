import React from 'react';
import {StatusBar} from 'react-native';
import {useTheme} from './src/shell/providers/ThemeProvider';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {ThemeProvider} from './src/shell/providers/ThemeProvider';
import {AuthProvider} from './src/shell/providers/AuthProvider';
import {TransportProvider} from './src/shell/providers/TransportProvider';
import {RootNavigator} from './src/shell/navigation/RootNavigator';

function App(): React.JSX.Element {
  const ThemedStatusBar = () => {
    const {isDark, colors} = useTheme();
    return <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />;
  };
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <TransportProvider>
              <NavigationContainer>
                <ThemedStatusBar />
                <RootNavigator />
              </NavigationContainer>
            </TransportProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
