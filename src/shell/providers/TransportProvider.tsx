import React, {createContext, useContext, useEffect} from 'react';
import {useTransportStore} from '../../store/transportStore';

interface TransportContextValue {
  isOnline: boolean;
  connectionType: string;
  websocketConnected: boolean;
}

const TransportContext = createContext<TransportContextValue>({
  isOnline: false,
  connectionType: 'unknown',
  websocketConnected: false,
});

export function TransportProvider({children}: {children: React.ReactNode}) {
  const {isOnline, connectionType, websocketConnected, setOnline, setConnectionType, setWebSocketConnected} =
    useTransportStore();

  useEffect(() => {
    setOnline(true);
    setConnectionType('wifi');
  }, [setOnline, setConnectionType, setWebSocketConnected]);

  return (
    <TransportContext.Provider
      value={{isOnline, connectionType, websocketConnected}}>
      {children}
    </TransportContext.Provider>
  );
}

export function useTransportContext(): TransportContextValue {
  return useContext(TransportContext);
}
