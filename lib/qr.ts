import QRCode from 'qrcode';

export async function qrDataUrl(text: string): Promise<string> {
  if (!text || text.length === 0) throw new Error('qrDataUrl: empty input');
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 6,
  });
}
