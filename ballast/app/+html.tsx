import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * The HTML shell every web page is served inside.
 *
 * This exists for one reason: **installing without an app store.** Ballast is
 * distributed as a link. A judge scans a QR code, the page opens, and two taps
 * later there is an icon on their home screen that opens full screen with no
 * address bar. No review queue, no developer programme, no ninety-nine dollars a
 * year — and the same build serves the browser and the installed app.
 *
 * Rendered once at export time, so nothing here is interactive.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/*
          `viewport-fit=cover` lets the layout reach under a notch, which is what
          makes an installed app look installed rather than like a page. Pinch
          zoom stays on: blocking it fails exactly the people who need it.
        */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />

        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FFF7EC" />

        {/* iOS reads its own tags rather than the manifest for these three. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Ballast" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" href="/favicon.png" />

        <meta name="description" content="Plan your week by how much it takes out of you, not how many hours it fills." />

        {/* Keeps body scroll from fighting the app's own scroll containers. */}
        <ScrollViewStyleReset />
        {/*
          iPhone Safari zooms into any field under 16px when it is tapped, and
          with pinch zoom allowed it stays zoomed. 16px on iOS only, so a tap
          types instead of jumping.
        */}
        <style dangerouslySetInnerHTML={{ __html: '@supports (-webkit-touch-callout: none) { input, textarea, select { font-size: 16px !important; } }' }} />
      </head>
      <body>
        {children}
        {/*
          Render, don't hydrate. Every page is prerendered from the sample week,
          and the first thing the app draws is this device's own state - the two
          never match, so hydrating them made React throw away the page and log
          an error on every load. Drawing fresh behind the cover below is the
          same picture with nothing to reconcile. Runs after the flag Expo sets
          in the head, and before the app's script.
        */}
        <script type="module" dangerouslySetInnerHTML={{ __html: 'globalThis.__EXPO_ROUTER_HYDRATE__=false;' }} />
        {/*
          The moment before the app is running. Outside React on purpose: the
          prerendered pages are built from the sample week, and this keeps it
          out of sight until the app has read this device's own state and
          lifts it (see app/_layout).
        */}
        <div
          id="boot-cover"
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}
        >
          <img src="/icon-192.png" alt="" width={96} height={96} style={{ borderRadius: 22 }} />
        </div>
      </body>
    </html>
  );
}
