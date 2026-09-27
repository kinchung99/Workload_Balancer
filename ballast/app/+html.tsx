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
          makes an installed app look installed rather than like a page.
        */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
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
      </head>
      <body>{children}</body>
    </html>
  );
}
