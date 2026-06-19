import React, { useEffect, useState, useRef } from 'react';
import { Text, StyleSheet } from 'react-native';

interface Props {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export function StreamingText({ text, speed = 20, onComplete }: Props) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    if (indexRef.current >= text.length) {
      setDisplayed(text);
      return;
    }
    const timer = setInterval(() => {
      indexRef.current++;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) {
        clearInterval(timer);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, onComplete]);

  return (
    <Text style={styles.text}>
      {displayed}
      {indexRef.current < text.length && <Text style={styles.cursor}>|</Text>}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 15, lineHeight: 22, color: '#e5e5e7' },
  cursor: { color: '#0a84ff', fontWeight: 'bold' },
});
