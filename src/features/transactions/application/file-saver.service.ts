import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

export interface SaveAndShareOptions {
  fileName: string;
  data: string;
  mimeType: string;
  isPdfHtml?: boolean;
  isBase64?: boolean;
}

export interface SaveAndShareResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export class FileSaverService {
  /**
   * Save and trigger native download / share dialog on device
   */
  public static async saveAndShare(options: SaveAndShareOptions): Promise<SaveAndShareResult> {
    try {
      const { fileName, data, mimeType, isPdfHtml, isBase64 } = options;

      // 1. Web browser fallback (download via blob link)
      if (Platform.OS === 'web') {
        if (typeof document !== 'undefined') {
          let blob: Blob;
          if (isPdfHtml) {
            // On web, open print dialog or download html
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.write(data);
              printWindow.document.close();
              printWindow.focus();
              printWindow.print();
              return { success: true };
            }
            blob = new Blob([data], { type: 'text/html;charset=utf-8' });
          } else if (isBase64) {
            const byteCharacters = atob(data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            blob = new Blob([byteArray], { type: mimeType });
          } else {
            blob = new Blob([data], { type: mimeType });
          }

          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = fileName;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          URL.revokeObjectURL(url);
          return { success: true };
        }
        return { success: false, error: 'Web environment document not available' };
      }

      // 2. Native Mobile (Android & iOS)
      const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!cacheDir) {
        return { success: false, error: 'Penyimpanan lokal perangkat tidak tersedia' };
      }

      let targetUri: string;

      if (isPdfHtml) {
        // Generate PDF from HTML using expo-print with base64 enabled
        const printResult = await Print.printToFileAsync({
          html: data,
          base64: true,
        });

        const safeFileName = fileName.replace(/[/\\?%*:|"<>]/g, '_');
        const pdfFileName = safeFileName.endsWith('.pdf') ? safeFileName : `${safeFileName}.pdf`;
        const normalizedCacheDir = cacheDir.endsWith('/') ? cacheDir : `${cacheDir}/`;
        targetUri = `${normalizedCacheDir}${pdfFileName}`;

        // Ensure target is clean if it already exists
        const existingInfo = await FileSystem.getInfoAsync(targetUri);
        if (existingInfo.exists) {
          await FileSystem.deleteAsync(targetUri, { idempotent: true });
        }

        // On Android / Expo Go, printToFileAsync produces a file in an internal spooler directory
        // (cache/Print/...) which FileSystem.copyAsync rejects with "Location isn't readable".
        // By requesting base64 from Print, we write directly to the app cache directory via
        // FileSystem.writeAsStringAsync, completely bypassing the unreadable print spooler path.
        if (printResult.base64) {
          await FileSystem.writeAsStringAsync(targetUri, printResult.base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } else {
          await FileSystem.copyAsync({
            from: printResult.uri,
            to: targetUri,
          });
        }
      } else {
        const safeFileName = fileName.replace(/[/\\?%*:|"<>]/g, '_');
        const normalizedCacheDir = cacheDir.endsWith('/') ? cacheDir : `${cacheDir}/`;
        targetUri = `${normalizedCacheDir}${safeFileName}`;

        const existingInfo = await FileSystem.getInfoAsync(targetUri);
        if (existingInfo.exists) {
          await FileSystem.deleteAsync(targetUri, { idempotent: true });
        }

        if (isBase64) {
          await FileSystem.writeAsStringAsync(targetUri, data, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } else {
          await FileSystem.writeAsStringAsync(targetUri, data, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        }
      }

      // 3. Open native share / save dialog
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(targetUri, {
          mimeType,
          dialogTitle: `Unduh / Simpan ${fileName}`,
          UTI: isPdfHtml ? 'com.adobe.pdf' : undefined,
        });
      }

      return { success: true, filePath: targetUri };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan dan mengunduh file';
      return { success: false, error: message };
    }
  }
}
