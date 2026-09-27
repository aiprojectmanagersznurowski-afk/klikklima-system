import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  type GestureResponderEvent,
} from 'react-native';
import { theme } from '../../theme';

// @REQ: FLD-SIGN-CAPTURE
// Komponent przechwytywania podpisu palcem na ekranie telefonu

export interface Point {
  x: number;
  y: number;
}

export interface SignaturePadProps {
  onSignatureChange: (signatureData: {
    dataUrl: string;
    isEmpty: boolean;
    strokeCount: number;
  }) => void;
  height?: number;
}

export function SignaturePad({
  onSignatureChange,
  height = 200,
}: SignaturePadProps) {
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const currentStrokeRef = useRef<Point[]>([]);

  const generateSvgDataUrl = (allStrokes: Point[][]): string => {
    if (allStrokes.length === 0) return '';
    let paths = '';
    for (const stroke of allStrokes) {
      if (stroke.length === 0) continue;
      const start = stroke[0]!;
      let d = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`;
      for (let i = 1; i < stroke.length; i++) {
        const pt = stroke[i]!;
        d += ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
      }
      paths += `<path d="${d}" fill="none" stroke="${theme.colors.slate900}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 ${height}" width="400" height="${height}"><rect width="100%" height="100%" fill="white"/>${paths}</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const notifyChange = (updatedStrokes: Point[][]) => {
    const totalPoints = updatedStrokes.reduce((acc, s) => acc + s.length, 0);
    const isEmpty = totalPoints < 5;
    const dataUrl = isEmpty ? '' : generateSvgDataUrl(updatedStrokes);
    onSignatureChange({
      dataUrl,
      isEmpty,
      strokeCount: updatedStrokes.length,
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentStrokeRef.current = [{ x: locationX, y: locationY }];
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentStrokeRef.current.push({ x: locationX, y: locationY });
        // Odświeżamy stan dla płynnego rysowania
        setStrokes((prev) => [...prev.slice(0, -1), [...currentStrokeRef.current]]);
      },
      onPanResponderRelease: () => {
        if (currentStrokeRef.current.length > 0) {
          const finalStrokes = [...strokes, [...currentStrokeRef.current]];
          setStrokes(finalStrokes);
          currentStrokeRef.current = [];
          notifyChange(finalStrokes);
        }
      },
    })
  ).current;

  const handleClear = () => {
    setStrokes([]);
    currentStrokeRef.current = [];
    notifyChange([]);
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const nextStrokes = strokes.slice(0, -1);
    setStrokes(nextStrokes);
    notifyChange(nextStrokes);
  };

  const totalPoints = strokes.reduce((acc, s) => acc + s.length, 0);
  const hasStrokes = totalPoints >= 5;

  return (
    <View style={styles.container}>
      <View
        style={[styles.padArea, { height }]}
        {...panResponder.panHandlers}
      >
        {!hasStrokes && (
          <View style={styles.placeholderOverlay} pointerEvents="none">
            <Text style={styles.placeholderText}>
              Podpisz tutaj palcem na ekranie
            </Text>
            <View style={styles.baseline} />
          </View>
        )}

        {/* Wizualizacja narysowanych segmentów */}
        {strokes.map((stroke, sIdx) => (
          <React.Fragment key={`stroke-${sIdx}`}>
            {stroke.map((pt, pIdx) => {
              if (pIdx === 0) return null;
              const prev = stroke[pIdx - 1]!;
              const dx = pt.x - prev.x;
              const dy = pt.y - prev.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              return (
                <View
                  key={`pt-${sIdx}-${pIdx}`}
                  style={[
                    styles.lineSegment,
                    {
                      left: prev.x,
                      top: prev.y,
                      width: length,
                      transform: [
                        { translateX: 0 },
                        { translateY: -1.5 },
                        { rotate: `${angle}deg` },
                        { translateX: 0 },
                        { translateY: 1.5 },
                      ],
                    },
                  ]}
                />
              );
            })}
          </React.Fragment>
        ))}
      </View>

      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.clearBtn]}
          onPress={handleClear}
          disabled={strokes.length === 0}
        >
          <Text style={styles.clearBtnText}>Wyczyść</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.undoBtn]}
          onPress={handleUndo}
          disabled={strokes.length === 0}
        >
          <Text style={styles.undoBtnText}>Cofnij ruch</Text>
        </TouchableOpacity>

        <View style={styles.statusIndicator}>
          <Text style={hasStrokes ? styles.statusTextActive : styles.statusTextEmpty}>
            {hasStrokes ? '✓ Podpis złożony' : 'Wymagany podpis'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  padArea: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.slate300,
    borderWidth: 2,
    borderRadius: 12,
    borderStyle: 'dashed',
    position: 'relative',
    overflow: 'hidden',
  },
  placeholderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: theme.colors.slate400,
    fontWeight: '500',
    marginBottom: 40,
  },
  baseline: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    height: 1,
    backgroundColor: theme.colors.slate200,
  },
  lineSegment: {
    position: 'absolute',
    height: 3,
    backgroundColor: theme.colors.slate900,
    borderRadius: 1.5,
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  clearBtn: {
    backgroundColor: theme.colors.slate100,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.slate700,
  },
  undoBtn: {
    backgroundColor: theme.colors.slate100,
  },
  undoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.slate700,
  },
  statusIndicator: {
    marginLeft: 'auto',
  },
  statusTextActive: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.green700,
  },
  statusTextEmpty: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.slate400,
  },
});
