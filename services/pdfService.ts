
import heic2any from 'heic2any';

/**
 * Result of the file processing: images for the vision model and original canvases for cropping.
 */
export interface PdfImageData {
  base64: string;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  extractedText?: string;
  textSource?: 'pdfplumber';
}

const extractPdfTextWithPdfPlumber = async (file: File): Promise<{
  pageNumber: number;
  text: string;
}[]> => {
  try {
    const response = await fetch('/api/pdf/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: await file.arrayBuffer()
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const detail = {
        error: payload.error || response.statusText,
        message: payload.message,
        hint: payload.hint
      };
      console.warn('pdfplumber extraction unavailable:', JSON.stringify(detail, null, 2));
      return [];
    }

    const payload = await response.json();
    return Array.isArray(payload.pages) ? payload.pages : [];
  } catch (error) {
    console.warn('pdfplumber extraction failed; falling back to image-only PDF processing.', error);
    return [];
  }
};

export const pdfToImageData = async (file: File, optimize: boolean = false): Promise<PdfImageData[]> => {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  const scale = optimize ? 1.6 : 2.5;
  const quality = optimize ? 0.7 : 0.85;

  // Handle PDF
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer();
    const [pdf, extractedPages] = await Promise.all([
      window.pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise,
      extractPdfTextWithPdfPlumber(file)
    ]);
    const extractedByPage = new Map(extractedPages.map(page => [page.pageNumber, page]));
    
    const pageIndices = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
    
    const data = await Promise.all(pageIndices.map(async (i) => {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale }); 
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) throw new Error('Could not create canvas context');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;
      
      const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
      const extracted = extractedByPage.get(i);
      return { 
        base64, 
        canvas, 
        width: viewport.width, 
        height: viewport.height,
        orientation: (viewport.width > viewport.height ? 'landscape' : 'portrait') as 'landscape' | 'portrait',
        extractedText: extracted?.text,
        textSource: extracted ? 'pdfplumber' as const : undefined
      };
    }));

    return data;
  }

  // Handle Images (JPG, PNG, HEIC)
  if (fileType.startsWith('image/') || fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
    let imageBlob: Blob = file;

    // Convert HEIC to PNG if needed
    if (fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
      const converted = await heic2any({ blob: file, toType: 'image/png' });
      imageBlob = Array.isArray(converted) ? converted[0] : converted;
    }

    const url = URL.createObjectURL(imageBlob);
    const img = new Image();
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create canvas context');

    // Scale image to a reasonable size if it's too large
    const maxDim = optimize ? 1600 : 2000;
    let width = img.width;
    let height = img.height;
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width *= ratio;
      height *= ratio;
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);

    const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
    return [{
      base64,
      canvas,
      width,
      height,
      orientation: (width > height ? 'landscape' : 'portrait') as 'landscape' | 'portrait'
    }];
  }

  // Handle Text Files (.txt)
  if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
    const text = await file.text();
    
    // Render text to a canvas to keep the pipeline consistent
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create canvas context');

    const width = 1200;
    const padding = 60;
    const fontSize = 24;
    const lineHeight = 32;
    
    context.font = `${fontSize}px "Inter", sans-serif`;
    const lines = text.split('\n');
    
    // Measure total height needed
    const height = Math.max(800, lines.length * lineHeight + padding * 2);
    canvas.width = width;
    canvas.height = height;

    // Background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    // Text
    context.fillStyle = '#1e293b';
    context.textBaseline = 'top';
    lines.forEach((line, i) => {
      context.fillText(line, padding, padding + i * lineHeight);
    });

    const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
    return [{
      base64,
      canvas,
      width,
      height,
      orientation: (width > height ? 'landscape' : 'portrait') as 'landscape' | 'portrait'
    }];
  }

  throw new Error('Unsupported file type. Please upload a PDF, image (JPG, PNG, HEIC), or a text file.');
};
