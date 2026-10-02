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
const SIDE = 256;

export const canPickPhoto = Platform.OS === 'web' && typeof document !== 'undefined';

/** Ask for an image, square it from the centre, and hand back a small JPEG data URI. */
export function pickPhoto(): Promise<string | null> {
  if (!canPickPhoto) return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => resolve(null);
        image.onload = () => {
          const side = Math.min(image.width, image.height);
          const canvas = document.createElement('canvas');
          canvas.width = SIDE;
          canvas.height = SIDE;
          const context = canvas.getContext('2d');
          if (!context) return resolve(null);
          context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, SIDE, SIDE);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
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
