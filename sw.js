// Service worker mínimo para hacer instalable la Agenda de Psicología Pro+.
// Objetivo: habilitar "Agregar a pantalla de inicio" / instalación de escritorio.
// No cachea datos de Firebase/Firestore ni CDNs externos: solo el "cascarón" estático,
// para evitar mostrar citas/pacientes/finanzas desactualizados u obsoletos.

const CACHE_VERSION = 'agenda-psico-v1';
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './ui.js',
  './style.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo interceptamos peticiones GET del mismo origen (el app shell).
  // Todo lo demás (Firebase Auth, Firestore, Tailwind CDN, Google Fonts,
  // html2canvas, etc.) se deja pasar directo a la red sin tocar.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Para la navegación (carga de index.html): red primero, con caché como respaldo
  // offline. Así siempre se sirve la versión más reciente de la app cuando hay internet.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Para el resto de archivos estáticos del shell: caché primero, actualizando
  // en segundo plano (stale-while-revalidate).
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
