'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import {
  TUNISIA_LATITUDE_MAX,
  TUNISIA_LATITUDE_MIN,
  TUNISIA_LONGITUDE_MAX,
  TUNISIA_LONGITUDE_MIN,
} from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { Input } from '@drivetn/ui/input';
import { cn } from '@drivetn/ui/lib/cn';
import { LocateFixed, MapPin, MapPinOff, Search } from 'lucide-react';
import type * as MapLibre from 'maplibre-gl';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useId, useRef, useState } from 'react';

import { prefersReducedMotion, TUNISIA_BOUNDS } from '@/components/agencies/agency-directory';

/** Mise en forme de l'arabe dans les noms de lieux de la carte. */
const RTL_TEXT_PLUGIN_URL =
  'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js';

const STYLE_URLS = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

/** Chef-lieu de chaque gouvernorat, pour ouvrir la carte au bon endroit. */
const GOVERNORATE_CENTERS: Record<string, MapPoint> = {
  '11': { latitude: 36.8065, longitude: 10.1815 },
  '12': { latitude: 36.8625, longitude: 10.1956 },
  '13': { latitude: 36.7531, longitude: 10.2282 },
  '14': { latitude: 36.808, longitude: 10.0972 },
  '21': { latitude: 36.4561, longitude: 10.7376 },
  '22': { latitude: 36.4029, longitude: 10.1429 },
  '23': { latitude: 37.2744, longitude: 9.8739 },
  '31': { latitude: 36.7256, longitude: 9.1817 },
  '32': { latitude: 36.5011, longitude: 8.7802 },
  '33': { latitude: 36.1742, longitude: 8.7049 },
  '34': { latitude: 36.0849, longitude: 9.3708 },
  '41': { latitude: 35.6781, longitude: 10.0963 },
  '42': { latitude: 35.1676, longitude: 8.8365 },
  '43': { latitude: 35.0382, longitude: 9.4849 },
  '51': { latitude: 35.8256, longitude: 10.636 },
  '52': { latitude: 35.7643, longitude: 10.8113 },
  '53': { latitude: 35.5047, longitude: 11.0622 },
  '61': { latitude: 34.7406, longitude: 10.7603 },
  '71': { latitude: 34.425, longitude: 8.7842 },
  '72': { latitude: 33.9197, longitude: 8.1335 },
  '73': { latitude: 33.7044, longitude: 8.969 },
  '81': { latitude: 33.8815, longitude: 10.0982 },
  '82': { latitude: 33.3549, longitude: 10.5055 },
  '83': { latitude: 32.9297, longitude: 10.4518 },
};

export interface MapPoint {
  latitude: number;
  longitude: number;
}

interface PlaceHit {
  id: string;
  label: string;
  detail: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    state?: string;
    countrycode?: string;
  };
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

function moveTo(map: MapLibre.Map, longitude: number, latitude: number, zoom: number): void {
  const target = { center: [longitude, latitude] as [number, number], zoom };
  if (prefersReducedMotion()) {
    map.jumpTo(target);
  } else {
    map.flyTo(target);
  }
}

function toPlaceHit(feature: PhotonFeature): PlaceHit | null {
  const coordinates = feature.geometry?.coordinates;
  if (coordinates === undefined || !inTunisia(coordinates[1], coordinates[0])) {
    return null;
  }
  const [longitude, latitude] = coordinates;
  const props = feature.properties ?? {};
  if (props.countrycode !== undefined && props.countrycode.toUpperCase() !== 'TN') {
    return null;
  }
  const street = [props.housenumber, props.street].filter(Boolean).join(' ');
  const label =
    [street, props.name, props.city, props.district].find(
      (part) => part !== undefined && part.length > 0,
    ) ?? '';
  if (label.length === 0) {
    return null;
  }
  const detail = [props.district, props.city, props.state]
    .filter((part): part is string => part !== undefined && part.length > 0 && part !== label)
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .join(', ');
  const address = [street || props.name, props.city].filter(Boolean).join(', ').slice(0, 200);
  return {
    id: String(props.osm_id ?? `${latitude},${longitude}`),
    label,
    detail,
    address,
    latitude: round6(latitude),
    longitude: round6(longitude),
  };
}

/** Carte du bureau : recherche d'une rue, clic, ou position de l'appareil. */
export function LocationPicker({
  value,
  governorateCode,
  onChange,
  onAddressSuggestion,
}: {
  value: MapPoint | null;
  governorateCode: string;
  onChange: (value: MapPoint | null) => void;
  onAddressSuggestion: (address: string) => void;
}) {
  const t = useTranslations('agency.settings.profile');
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const searchId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre.Map | null>(null);
  const markerRef = useRef<MapLibre.Marker | null>(null);
  const libRef = useRef<typeof MapLibre | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const tRef = useRef(t);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
    valueRef.current = value;
    tRef.current = t;
  }, [onChange, t, value]);

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
          setNotice(tRef.current('locationOutside'));
          return;
        }
        setNotice(null);
        setHits([]);
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
  }, [resolvedTheme]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = libRef.current;
    if (map === null || maplibre === null || !ready) {
      return;
    }
    if (value === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      const center = GOVERNORATE_CENTERS[governorateCode];
      if (center !== undefined) {
        moveTo(map, center.longitude, center.latitude, 12);
      }
      return;
    }
    const lngLat: [number, number] = [value.longitude, value.latitude];
    if (markerRef.current === null) {
      const marker = new maplibre.Marker({ color: '#059669', draggable: true })
        .setLngLat(lngLat)
        .addTo(map);
      marker.on('dragend', () => {
        const next = marker.getLngLat();
        const latitude = round6(next.lat);
        const longitude = round6(next.lng);
        if (!inTunisia(latitude, longitude)) {
          setNotice(tRef.current('locationOutside'));
          const current = valueRef.current;
          if (current !== null) {
            marker.setLngLat([current.longitude, current.latitude]);
          }
          return;
        }
        setNotice(null);
        onChangeRef.current({ latitude, longitude });
      });
      markerRef.current = marker;
      moveTo(map, value.longitude, value.latitude, 16);
    } else {
      markerRef.current.setLngLat(lngLat);
    }
  }, [governorateCode, ready, value]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const center = GOVERNORATE_CENTERS[governorateCode];
      const url = new URL('https://photon.komoot.io/api/');
      url.searchParams.set('q', text);
      url.searchParams.set('limit', '5');
      url.searchParams.set('lang', locale === 'en' ? 'en' : 'fr');
      url.searchParams.set('bbox', '7.5,30.2,11.6,37.6');
      if (center !== undefined) {
        url.searchParams.set('lat', String(center.latitude));
        url.searchParams.set('lon', String(center.longitude));
      }
      setSearching(true);
      void fetch(url, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) {
            return [];
          }
          const body = (await response.json()) as { features?: PhotonFeature[] };
          return (body.features ?? [])
            .map(toPlaceHit)
            .filter((hit): hit is PlaceHit => hit !== null)
            .slice(0, 5);
        })
        .then((next) => {
          setHits(next);
          setSearched(true);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
          setHits([]);
          setSearched(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setSearching(false);
          }
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [governorateCode, locale, query]);

  function place(point: MapPoint, address?: string): void {
    setNotice(null);
    setHits([]);
    setQuery('');
    setSearched(false);
    onChange(point);
    if (address !== undefined && address.length > 0) {
      onAddressSuggestion(address);
    }
    const map = mapRef.current;
    if (map !== null) {
      moveTo(map, point.longitude, point.latitude, 16);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="relative">
        <label className="sr-only" htmlFor={searchId}>
          {t('locationSearch')}
        </label>
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={searchId}
          type="search"
          value={query}
          autoComplete="off"
          placeholder={t('locationSearch')}
          className="ps-9"
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            if (next.trim().length < 3) {
              setHits([]);
              setSearching(false);
              setSearched(false);
            }
          }}
        />
        {query.trim().length >= 3 && hits.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-card border border-border bg-surface p-1 shadow-elevated">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  className="grid w-full gap-0.5 rounded-control px-3 py-2 text-start hover:bg-surface-muted"
                  onClick={() => {
                    place({ latitude: hit.latitude, longitude: hit.longitude }, hit.address);
                  }}
                >
                  <span className="text-sm font-medium">{hit.label}</span>
                  {hit.detail.length > 0 && (
                    <span className="text-xs text-muted-foreground">{hit.detail}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {query.trim().length >= 3 && searching && (
        <p className="text-sm text-muted-foreground">{t('locationSearching')}</p>
      )}
      {searched && !searching && hits.length === 0 && query.trim().length >= 3 && (
        <p className="text-sm text-muted-foreground">{t('locationNoResult')}</p>
      )}

      <p
        className={cn(
          'rounded-2xl px-4 py-3 text-sm',
          value === null
            ? 'bg-warning-soft text-warning-soft-foreground'
            : 'bg-primary-soft text-primary-soft-foreground',
        )}
      >
        {value === null ? t('locationMissing') : t('locationSet')}
      </p>

      <div className="relative">
        <div
          ref={containerRef}
          className="h-80 overflow-hidden rounded-card border border-border sm:h-96"
          role="application"
          aria-label={t('locationMap')}
        />
        <p className="pointer-events-none absolute bottom-3 start-3 inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1 text-xs font-medium shadow-soft">
          <MapPin className="size-3.5 text-primary" aria-hidden="true" />
          {t('locationHint')}
        </p>
      </div>

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
                place({ latitude, longitude });
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
          variant="secondary"
          size="sm"
          disabled={value === null}
          onClick={() => {
            if (value === null) {
              return;
            }
            const map = mapRef.current;
            if (map !== null) {
              moveTo(map, value.longitude, value.latitude, 16);
            }
          }}
        >
          <MapPin aria-hidden="true" />
          {t('locationSeeOffice')}
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
      </div>
      {notice !== null && (
        <p className="text-sm text-danger" role="alert">
          {notice}
        </p>
      )}
    </div>
  );
}
