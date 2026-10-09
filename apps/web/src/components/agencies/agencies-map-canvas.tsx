'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import type { GeoPoint, Locale, PublicAgency } from '@drivetn/types';
import { cn } from '@drivetn/ui/lib/cn';
import {
  LoaderCircle,
  LocateFixed,
  Map as MapIcon,
  MapPinOff,
  Minus,
  Plus,
  Scan,
} from 'lucide-react';
import type * as MapLibre from 'maplibre-gl';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  agenciesBounds,
  distanceKm,
  prefersReducedMotion,
  TUNISIA_BOUNDS,
} from './agency-directory';

/** Mise en forme de l'arabe (liaisons, sens de lecture) dans les libellés de la carte. */
const RTL_TEXT_PLUGIN_URL =
  'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js';

const STYLE_URLS = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

const SOURCE_ID = 'agencies';
const PIN_IMAGE = 'agency-pin';
const PIN_ACTIVE_IMAGE = 'agency-pin-active';
const CLUSTER_HALO_LAYER = 'agency-clusters-halo';
const CLUSTER_LAYER = 'agency-clusters';
const CLUSTER_COUNT_LAYER = 'agency-cluster-count';
const PIN_LAYER = 'agency-pins';
const PIN_ACTIVE_LAYER = 'agency-pins-active';
const INTERACTIVE_LAYERS = [PIN_ACTIVE_LAYER, PIN_LAYER, CLUSTER_LAYER];

const LABEL_FIELDS: Record<Locale, MapLibre.ExpressionSpecification> = {
  fr: ['coalesce', ['get', 'name:fr'], ['get', 'name:latin'], ['get', 'name']],
  en: ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']],
  ar: ['coalesce', ['get', 'name:ar'], ['get', 'name']],
};

/** Pictogramme « car » de Lucide, dessiné en blanc dans l'épingle. */
const CAR_ICON =
  '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>';

function pinSvg(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="104" viewBox="0 0 44 52"><defs><filter id="s" x="-40%" y="-30%" width="180%" height="170%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#0f172a" flood-opacity="0.35"/></filter></defs><path filter="url(#s)" d="M22 49s-16-14.6-16-28a16 16 0 1 1 32 0c0 13.4-16 28-16 28z" fill="${fill}" stroke="#fff" stroke-width="2.5"/><g transform="translate(12.4 11) scale(0.8)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${CAR_ICON}</g></svg>`;
}

async function loadImage(svg: string): Promise<HTMLImageElement> {
  const image = new Image(88, 104);
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  return image;
}

/** Les tokens du thème sont au format « H S% L% » (voir le preset Tailwind). */
function readColors(element: Element) {
  const style = getComputedStyle(element);
  const color = (name: string, fallback: string) => {
    const value = style.getPropertyValue(name).trim();
    return value === '' ? fallback : `hsl(${value.split(/\s+/).join(', ')})`;
  };
  return {
    primary: color('--primary', '#2563eb'),
    cta: color('--cta', '#f97316'),
    text: color('--foreground', '#0f172a'),
    halo: color('--surface', '#ffffff'),
  };
}

function toCollection(agencies: readonly PublicAgency[]) {
  return {
    type: 'FeatureCollection' as const,
    features: agencies.map((agency) => ({
      type: 'Feature' as const,
      properties: { id: agency.id, name: agency.name },
      geometry: {
        type: 'Point' as const,
        coordinates: [agency.longitude, agency.latitude],
      },
    })),
  };
}

function idIn(ids: readonly string[]): MapLibre.ExpressionSpecification {
  return ['in', ['get', 'id'], ['literal', [...ids]]];
}

function localizeLabels(map: MapLibre.Map, locale: Locale) {
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol' || layer.id.startsWith('agency-')) {
      continue;
    }
    const field: unknown = map.getLayoutProperty(layer.id, 'text-field');
    if (field !== undefined && JSON.stringify(field).includes('name')) {
      map.setLayoutProperty(layer.id, 'text-field', LABEL_FIELDS[locale]);
    }
  }
}

function addAgencyLayers(
  map: MapLibre.Map,
  agencies: readonly PublicAgency[],
  activeIds: readonly string[],
  colors: ReturnType<typeof readColors>,
) {
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: toCollection(agencies),
    cluster: true,
    clusterRadius: 52,
    clusterMaxZoom: 10,
  });
  const clustered: MapLibre.FilterSpecification = ['has', 'point_count'];
  map.addLayer({
    id: CLUSTER_HALO_LAYER,
    type: 'circle',
    source: SOURCE_ID,
    filter: clustered,
    paint: {
      'circle-color': colors.primary,
      'circle-opacity': 0.18,
      'circle-radius': ['step', ['get', 'point_count'], 28, 5, 34, 15, 42],
    },
  });
  map.addLayer({
    id: CLUSTER_LAYER,
    type: 'circle',
    source: SOURCE_ID,
    filter: clustered,
    paint: {
      'circle-color': colors.primary,
      'circle-radius': ['step', ['get', 'point_count'], 19, 5, 24, 15, 30],
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
    },
  });
  map.addLayer({
    id: CLUSTER_COUNT_LAYER,
    type: 'symbol',
    source: SOURCE_ID,
    filter: clustered,
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 14,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff' },
  });
  map.addLayer({
    id: PIN_LAYER,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['all', ['!', clustered], ['!', idIn(activeIds)]],
    layout: {
      'icon-image': PIN_IMAGE,
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 10, 1],
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      'text-anchor': 'top',
      'text-offset': [0, 0.35],
      'text-max-width': 10,
      'text-optional': true,
    },
    paint: {
      'text-color': colors.text,
      'text-halo-color': colors.halo,
      'text-halo-width': 1.5,
      'text-opacity': ['step', ['zoom'], 0, 9, 1],
    },
  });
  map.addLayer({
    id: PIN_ACTIVE_LAYER,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['all', ['!', clustered], idIn(activeIds)],
    layout: {
      'icon-image': PIN_ACTIVE_IMAGE,
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-size': 1.15,
      'symbol-sort-key': 1,
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 13,
      'text-anchor': 'top',
      'text-offset': [0, 0.35],
      'text-max-width': 10,
      'text-optional': true,
    },
    paint: {
      'text-color': colors.text,
      'text-halo-color': colors.halo,
      'text-halo-width': 2,
    },
  });
}

type MapStatus = 'loading' | 'ready' | 'error';

export interface AgenciesMapCanvasProps {
  agencies: readonly PublicAgency[];
  selectedId: string | null;
  highlightedId: string | null;
  userPosition: GeoPoint | null;
  locating: boolean;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onLocate: () => void;
  renderPopup: (agency: PublicAgency) => ReactNode;
  className?: string;
}

export function AgenciesMapCanvas({
  agencies,
  selectedId,
  highlightedId,
  userPosition,
  locating,
  onSelect,
  onHover,
  onLocate,
  renderPopup,
  className,
}: AgenciesMapCanvasProps) {
  const t = useTranslations('client.agencies.map');
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre.Map | null>(null);
  const libRef = useRef<typeof MapLibre | null>(null);
  const popupRef = useRef<MapLibre.Popup | null>(null);
  const userMarkerRef = useRef<MapLibre.Marker | null>(null);
  const suppressCloseRef = useRef(false);
  const fittedKeyRef = useRef<string | null>(null);
  const themeRef = useRef<keyof typeof STYLE_URLS>(theme);
  const activeIds = [selectedId, highlightedId].filter((id): id is string => id !== null);
  const activeKey = activeIds.join(',');
  const latest = useRef({ agencies, activeIds, onSelect, onHover });
  useEffect(() => {
    latest.current = {
      agencies,
      activeIds: activeKey === '' ? [] : activeKey.split(','),
      onSelect,
      onHover,
    };
  });

  const [status, setStatus] = useState<MapStatus>('loading');
  const [styleRevision, setStyleRevision] = useState(0);
  const [popupNode, setPopupNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedId === null) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onSelect(null);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedId, onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const lifecycle = new AbortController();
    let map: MapLibre.Map | null = null;
    let resizeObserver: ResizeObserver | null = null;

    void (async () => {
      try {
        const maplibre = await import('maplibre-gl');
        const colors = readColors(container);
        const [pin, pinActive] = await Promise.all([
          loadImage(pinSvg(colors.primary)),
          loadImage(pinSvg(colors.cta)),
        ]);
        if (lifecycle.signal.aborted) {
          return;
        }
        libRef.current = maplibre;
        if (maplibre.getRTLTextPluginStatus() === 'unavailable') {
          maplibre.setRTLTextPlugin(RTL_TEXT_PLUGIN_URL, true).catch(() => undefined);
        }
        const rtl = document.documentElement.dir === 'rtl';
        map = new maplibre.Map({
          container,
          style: STYLE_URLS[themeRef.current],
          bounds: TUNISIA_BOUNDS,
          fitBoundsOptions: { padding: 24 },
          minZoom: 4.5,
          maxZoom: 17,
          maxBounds: [
            [2, 27],
            [17, 40.5],
          ],
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          attributionControl: false,
        });
        mapRef.current = map;
        map.touchZoomRotate.disableRotation();
        map.addControl(
          new maplibre.AttributionControl({ compact: true }),
          rtl ? 'bottom-left' : 'bottom-right',
        );

        const instance = map;
        instance.on('style.load', () => {
          localizeLabels(instance, locale);
          if (!instance.hasImage(PIN_IMAGE)) {
            instance.addImage(PIN_IMAGE, pin, { pixelRatio: 2 });
          }
          if (!instance.hasImage(PIN_ACTIVE_IMAGE)) {
            instance.addImage(PIN_ACTIVE_IMAGE, pinActive, { pixelRatio: 2 });
          }
          addAgencyLayers(
            instance,
            latest.current.agencies,
            latest.current.activeIds,
            readColors(container),
          );
          setStyleRevision((revision) => revision + 1);
        });
        instance.on('load', () => {
          setStatus('ready');
        });
        instance.on('error', (event: { error?: Error }) => {
          if (!instance.loaded() && event.error?.message.includes('style') === true) {
            setStatus('error');
          }
        });

        const featureAt = (point: MapLibre.PointLike) =>
          instance.queryRenderedFeatures(point, {
            layers: INTERACTIVE_LAYERS.filter((id) => instance.getLayer(id) !== undefined),
          })[0];

        let hovered: string | null = null;
        instance.on('mousemove', (event) => {
          const feature = featureAt(event.point);
          instance.getCanvas().style.cursor = feature === undefined ? '' : 'pointer';
          const id =
            feature === undefined || feature.properties.cluster_id !== undefined
              ? null
              : String(feature.properties.id);
          if (id !== hovered) {
            hovered = id;
            latest.current.onHover(id);
          }
        });
        instance.on('mouseout', () => {
          if (hovered !== null) {
            hovered = null;
            latest.current.onHover(null);
          }
        });
        instance.on('click', (event) => {
          const feature = featureAt(event.point);
          if (feature === undefined) {
            latest.current.onSelect(null);
            return;
          }
          const clusterId: unknown = feature.properties.cluster_id;
          if (typeof clusterId !== 'number') {
            latest.current.onSelect(String(feature.properties.id));
            return;
          }
          void instance
            .getSource<MapLibre.GeoJSONSource>(SOURCE_ID)
            ?.getClusterExpansionZoom(clusterId)
            .then((zoom) => {
              instance.easeTo({
                center: event.lngLat,
                zoom: zoom + 0.5,
                duration: prefersReducedMotion() ? 0 : 600,
              });
            });
        });

        const node = document.createElement('div');
        const popup = new maplibre.Popup({
          closeButton: false,
          closeOnClick: false,
          focusAfterOpen: false,
          maxWidth: 'none',
          className: 'agency-map-popup',
          offset: {
            top: [0, 10],
            'top-left': [0, 10],
            'top-right': [0, 10],
            bottom: [0, -66],
            'bottom-left': [0, -66],
            'bottom-right': [0, -66],
            left: [18, -32],
            right: [-18, -32],
            center: [0, 0],
          },
        }).setDOMContent(node);
        popup.on('close', () => {
          if (!suppressCloseRef.current) {
            latest.current.onSelect(null);
          }
        });
        popupRef.current = popup;
        setPopupNode(node);

        resizeObserver = new ResizeObserver(() => {
          instance.resize();
        });
        resizeObserver.observe(container);
      } catch {
        if (!lifecycle.signal.aborted) {
          setStatus('error');
        }
      }
    })();

    return () => {
      lifecycle.abort();
      resizeObserver?.disconnect();
      popupRef.current?.remove();
      popupRef.current = null;
      userMarkerRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
    // La carte est créée une seule fois ; la langue est figée par la route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (themeRef.current === theme) {
      return;
    }
    themeRef.current = theme;
    map?.setStyle(STYLE_URLS[theme], { diff: false });
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource<MapLibre.GeoJSONSource>(SOURCE_ID);
    if (map === null || source === undefined) {
      return;
    }
    void source.setData(toCollection(agencies));

    const key = agencies.map((agency) => agency.id).join(',');
    if (key === fittedKeyRef.current) {
      return;
    }
    fittedKeyRef.current = key;
    const { width, height } = map.getContainer().getBoundingClientRect();
    const padding = Math.max(24, Math.min(72, Math.min(width, height) / 6));
    map.fitBounds(agenciesBounds(agencies) ?? TUNISIA_BOUNDS, {
      padding: { top: padding + 24, bottom: padding, left: padding, right: padding },
      maxZoom: 11,
      duration: prefersReducedMotion() ? 0 : 800,
    });
  }, [agencies, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer(PIN_LAYER) === undefined) {
      return;
    }
    const ids = activeKey === '' ? [] : activeKey.split(',');
    map.setFilter(PIN_LAYER, ['all', ['!', ['has', 'point_count']], ['!', idIn(ids)]]);
    map.setFilter(PIN_ACTIVE_LAYER, ['all', ['!', ['has', 'point_count']], idIn(ids)]);
  }, [activeKey, styleRevision]);

  const selected = agencies.find((agency) => agency.id === selectedId) ?? null;
  useEffect(() => {
    const map = mapRef.current;
    const popup = popupRef.current;
    if (map === null || popup === null || status !== 'ready') {
      return;
    }
    if (selected === null) {
      suppressCloseRef.current = true;
      popup.remove();
      suppressCloseRef.current = false;
      return;
    }
    const center: [number, number] = [selected.longitude, selected.latitude];
    const height = map.getContainer().clientHeight;
    map.flyTo({
      center,
      zoom: Math.max(map.getZoom(), 11.5),
      offset: [0, Math.max(0, Math.min(180, height / 2 - 32))],
      duration: prefersReducedMotion() ? 0 : 900,
      essential: true,
    });
    popup.setLngLat(center);
    if (!popup.isOpen()) {
      popup.addTo(map);
    }
    // Ne recentre la carte que lorsque l'agence choisie change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, status]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = libRef.current;
    if (map === null || maplibre === null || status !== 'ready') {
      return;
    }
    if (userPosition === null) {
      userMarkerRef.current?.remove();
      return;
    }
    if (userMarkerRef.current === null) {
      const element = document.createElement('div');
      element.className = 'agency-map-user';
      element.setAttribute('role', 'img');
      element.setAttribute('aria-label', t('you'));
      userMarkerRef.current = new maplibre.Marker({ element });
    }
    userMarkerRef.current.setLngLat([userPosition.longitude, userPosition.latitude]).addTo(map);

    const nearest = [...latest.current.agencies]
      .sort((a, b) => distanceKm(userPosition, a) - distanceKm(userPosition, b))
      .slice(0, 3);
    const bounds = agenciesBounds([userPosition, ...nearest]);
    if (bounds !== null) {
      map.fitBounds(bounds, {
        padding: 80,
        maxZoom: 12,
        duration: prefersReducedMotion() ? 0 : 900,
      });
    }
  }, [userPosition, status, t]);

  const controlClass =
    'flex size-10 items-center justify-center text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50';

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-panel border border-border bg-surface-muted shadow-soft',
        className,
      )}
    >
      <div ref={containerRef} role="region" aria-label={t('mapLabel')} className="size-full" />

      {status === 'loading' && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-surface-muted">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-muted via-surface to-surface-muted" />
          <p className="relative flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium text-muted-foreground shadow-soft">
            <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />
            {t('loading')}
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-surface-muted p-6 text-center">
          <div className="grid max-w-xs justify-items-center gap-2">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-surface text-muted-foreground shadow-soft">
              <MapPinOff className="size-6" aria-hidden="true" />
            </span>
            <p className="font-bold">{t('unsupportedTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('unsupportedText')}</p>
          </div>
        </div>
      )}

      {status === 'ready' && (
        <>
          <div className="pointer-events-none absolute start-3 top-3 z-[1] flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs font-semibold shadow-soft backdrop-blur">
              <MapIcon className="size-3.5 text-primary" aria-hidden="true" />
              {agencies.length === 0 ? t('noResults') : t('results', { count: agencies.length })}
            </span>
          </div>

          <div className="absolute end-3 top-3 z-[1] grid gap-2">
            <div className="grid divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface/95 shadow-soft backdrop-blur">
              <button
                type="button"
                className={controlClass}
                aria-label={t('zoomIn')}
                title={t('zoomIn')}
                onClick={() => mapRef.current?.zoomIn()}
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={controlClass}
                aria-label={t('zoomOut')}
                title={t('zoomOut')}
                onClick={() => mapRef.current?.zoomOut()}
              >
                <Minus className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface/95 shadow-soft backdrop-blur">
              <button
                type="button"
                className={cn(controlClass, userPosition !== null && 'text-info')}
                aria-label={t('locate')}
                title={t('locate')}
                disabled={locating}
                onClick={onLocate}
              >
                {locating ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <LocateFixed className="size-4" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                className={controlClass}
                aria-label={t('resetView')}
                title={t('resetView')}
                onClick={() => {
                  onSelect(null);
                  mapRef.current?.fitBounds(TUNISIA_BOUNDS, {
                    padding: 24,
                    duration: prefersReducedMotion() ? 0 : 800,
                  });
                }}
              >
                <Scan className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}

      {popupNode !== null && selected !== null && createPortal(renderPopup(selected), popupNode)}
    </div>
  );
}
