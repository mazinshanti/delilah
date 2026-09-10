import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'dalelah:saved-cars:v1';
const SavedContext = createContext(null);
const keyFor = car => car?.url || car?.originalUrl || car?.id || `${car?.title}:${car?.price}`;

export function SavedProvider({ children }) {
  const [saved, setSaved] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => setSaved(raw ? JSON.parse(raw) : []))
      .catch(() => setSaved([]))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch(() => {});
  }, [saved, ready]);

  const value = useMemo(() => ({
    saved,
    ready,
    isSaved: car => saved.some(item => keyFor(item) === keyFor(car)),
    toggleSaved: car => setSaved(current => {
      const key = keyFor(car);
      return current.some(item => keyFor(item) === key)
        ? current.filter(item => keyFor(item) !== key)
        : [car, ...current];
    })
  }), [saved, ready]);

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const value = useContext(SavedContext);
  if (!value) throw new Error('useSaved must be used inside SavedProvider');
  return value;
}
