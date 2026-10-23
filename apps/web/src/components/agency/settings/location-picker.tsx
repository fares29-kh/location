'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import {
  TUNISIA_LATITUDE_MAX,
  TUNISIA_LATITUDE_MIN,
  TUNISIA_LONGITUDE_MAX,
  TUNISIA_LONGITUDE_MIN,
} from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { LocateFixed, MapPinOff } from 'lucide-react';
import type * as MapLibre from 'maplibre-gl';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';

import { TUNISIA_BOUNDS } from '@/components/agencies/agency-directory';

/** Mise en forme de l'arabe dans les noms de lieux de la carte. */
const RTL_TEXT_PLUGIN_URL =
  'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js';

const STYLE_URLS = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

export interface MapPoint {
  latitude: number;
  longitude: number;
}

function inTunisia(latitude: number, longitude: number): boolean {
  return (
    latitude >= TUNISIA_LATITUDE_MIN &&
    latitude <= TUNISIA_LATITUDE_MAX &&
    longitude >= TUNISIA_LONGITUDE_MIN &&
    longitude <= TUNISIA_LONGITUDE_MAX
  );
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** Carte cliquable : l'agence pose le point exact de son local. */
export function LocationPicker({
  value,
  onChange,
}: {
  value: MapPoint | null;
  onChange: (value: MapPoint | null) => void;
}) {
  const t = useTranslations('agency.settings.profile');
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre.Map | null>(null);
  const markerRef = useRef<MapLibre.Marker | null>(null);
  const libRef = useRef<typeof MapLibre | null>(null);
  const onChangeRef = useRef(onChange);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const lifecycle = new AbortController();
    let map: MapLibre.Map | null = null;

    void (async () => {
      const maplibre = await import('maplibre-gl');
      if (lifecycle.signal.aborted) {
        return;
      }
      libRef.current = maplibre;
      maplibre.setRTLTextPlugin(RTL_TEXT_PLUGIN_URL, true).catch(() => undefined);
      map = new maplibre.Map({
        container,
        style: STYLE_URLS[resolvedTheme === 'dark' ? 'dark' : 'light'],
        bounds: TUNISIA_BOUNDS,
        fitBoundsOptions: { padding: 24 },
        minZoom: 5,
        maxZoom: 18,
        maxBounds: [
          [2, 27],
          [17, 40.5],
        ],
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      map.on('click', (event) => {
        const latitude = round6(event.lngLat.lat);
        const longitude = round6(event.lngLat.lng);
        if (!inTunisia(latitude, longitude)) {
          setNotice(t('locationOutside'));
          return;
        }
        setNotice(null);
        onChangeRef.current({ latitude, longitude });
      });
      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      lifecycle.abort();
      markerRef.current?.remove();
      markerRef.current = null;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [resolvedTheme, t]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = libRef.current;
    if (map === null || maplibre === null || !ready) {
      return;
    }
    if (value === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const lngLat: [number, number] = [value.longitude, value.latitude];
    if (markerRef.current === null) {
      const marker = new maplibre.Marker({ color: '#2563eb', draggable: true })
        .setLngLat(lngLat)
        .addTo(map);
      marker.on('dragend', () => {
        const next = marker.getLngLat();
        const latitude = round6(next.lat);
        const longitude = round6(next.lng);
        if (!inTunisia(latitude, longitude)) {
          setNotice(t('locationOutside'));
          return;
        }
        setNotice(null);
        onChangeRef.current({ latitude, longitude });
      });
      markerRef.current = marker;
      map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), 14) });
    } else {
      markerRef.current.setLngLat(lngLat);
    }
  }, [ready, t, value]);

  return (
    <div className="grid gap-3">
      <div
        ref={containerRef}
        className="h-72 overflow-hidden rounded-card border border-border"
        role="application"
        aria-label={t('locationMap')}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setNotice(null);
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const latitude = round6(position.coords.latitude);
                const longitude = round6(position.coords.longitude);
                if (!inTunisia(latitude, longitude)) {
                  setNotice(t('locationOutside'));
                  return;
                }
                onChange({ latitude, longitude });
                mapRef.current?.flyTo({
                  center: [longitude, latitude],
                  zoom: Math.max(mapRef.current.getZoom(), 14),
                });
              },
              () => {
                setNotice(t('locationDenied'));
              },
              { enableHighAccuracy: true, timeout: 10_000 },
            );
          }}
        >
          <LocateFixed aria-hidden="true" />
          {t('locationUseMine')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={value === null}
          onClick={() => {
            setNotice(null);
            onChange(null);
          }}
        >
          <MapPinOff aria-hidden="true" />
          {t('locationClear')}
        </Button>
        <p className="text-sm text-muted-foreground">
          {value === null
            ? t('locationMissing')
            : t('locationSet', {
                latitude: value.latitude.toFixed(5),
                longitude: value.longitude.toFixed(5),
              })}
        </p>
      </div>
      {notice !== null && (
        <p className="text-sm text-destructive" role="alert">
          {notice}
        </p>
      )}
    </div>
  );
}
