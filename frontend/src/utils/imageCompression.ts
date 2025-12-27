/**
 * Kompresja obrazu do mniejszego rozmiaru
 * Cel: < 100KB dla szybkiego uploadu
 */

interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.7,
  maxSizeKB: 100,
};

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Oblicz nowe wymiary zachowując proporcje
        let { width, height } = img;
        const maxW = opts.maxWidth!;
        const maxH = opts.maxHeight!;

        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Utwórz canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Rysuj obraz
        ctx.drawImage(img, 0, 0, width, height);

        // Kompresuj iteracyjnie do docelowego rozmiaru
        let quality = opts.quality!;
        let result = canvas.toDataURL('image/jpeg', quality);

        // Zmniejszaj jakosc az osiagniemy cel
        while (result.length / 1024 > opts.maxSizeKB! && quality > 0.1) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }

        // Jesli nadal za duze, zmniejsz wymiary
        if (result.length / 1024 > opts.maxSizeKB!) {
          const scale = 0.7;
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL('image/jpeg', 0.6);
        }

        console.log(`Image compressed: ${Math.round(result.length / 1024)} KB`);
        resolve(result);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Szybka kompresja dla aparatu mobilnego
 */
export async function compressCameraImage(file: File): Promise<string> {
  return compressImage(file, {
    maxWidth: 640,
    maxHeight: 640,
    quality: 0.6,
    maxSizeKB: 80,
  });
}
