/**
 * Picking a profile photo.
 *
 * On the web this is the browser's own file picker, and the picture is
 * squared and shrunk on the device before it goes anywhere - a 12-megapixel
 * phone photo as a 44px circle is four megabytes of nothing. Native builds
 * need an image-picker module this prototype does not ship, so they get the
 * emoji faces instead and `canPickPhoto` says so.
 */
import { Platform } from 'react-native';

/** The longest side a profile photo is kept at. Twice the largest place it is drawn. */
const SIDE = 192;

export const canPickPhoto = Platform.OS === 'web' && typeof document !== 'undefined';

/** Ask for an image, square it from the centre, and hand back a small JPEG data URI. */
export function pickPhoto(): Promise<string | null> {
  if (!canPickPhoto) return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    /*
     * In the page, not floating free. Safari on an iPhone opens the photo
     * picker for a detached input and then never tells it which photo was
     * chosen - the picture silently never arrived. Hidden, and gone after.
     */
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    document.body.appendChild(input);
    const done = (result: string | null) => { input.remove(); resolve(result); };
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return done(null);
      const reader = new FileReader();
      reader.onerror = () => done(null);
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => done(null);
        image.onload = () => {
          const side = Math.min(image.width, image.height);
          const canvas = document.createElement('canvas');
          canvas.width = SIDE;
          canvas.height = SIDE;
          const context = canvas.getContext('2d');
          if (!context) return done(null);
          context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, SIDE, SIDE);
          done(canvas.toDataURL('image/jpeg', 0.82));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

/** Faces to pick from when a photo is not wanted. */
export const FACES = ['🧑🏻‍🎓', '👩🏽‍💻', '🧑🏾‍🎨', '👨🏻‍🔬', '🧕🏻', '🧑🏼‍🚀', '🦊', '🐼', '🐸', '🌻', '🍄', '⚡'];
