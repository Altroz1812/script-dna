/**
 * Generates a certificate on the client side using Canvas API and triggers a download.
 * @param studentName - The name of the student.
 * @param companyName - The name of the company/institute.
 */
export interface CertificateOptions {
  duration?: string | null;
  completionDate?: string | Date | null;
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

export async function downloadCertificate(
  studentName: string,
  companyName: string,
  options: CertificateOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // Points directly to public/certificate.jpeg
    img.src = '/certificate.jpeg'; 
    img.crossOrigin = 'anonymous'; 

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get 2D context'));
        return;
      }

      // Draw standard clean template
      ctx.drawImage(img, 0, 0, img.width, img.height);

      // Render Student Name (above the underline)
      ctx.textAlign = 'left';
      ctx.fillStyle = '#2c3e50';
      ctx.font = `bold ${Math.round(img.width * 0.035)}px "Times New Roman", serif`;
      ctx.fillText(studentName.toUpperCase(), img.width * 0.05, img.height * 0.59);

      // Render Course / Company (below "training course in" line)
      ctx.font = `italic ${Math.round(img.width * 0.028)}px "Times New Roman", serif`;
      ctx.fillStyle = '#555555';
      ctx.fillText(companyName, img.width * 0.05, img.height * 0.78);

      // Render duration + completion date footer line
      const parts: string[] = [];
      if (options.duration) parts.push(`Duration: ${options.duration}`);
      parts.push(`Date of Completion: ${formatDate(options.completionDate ?? null)}`);
      ctx.font = `${Math.round(img.width * 0.016)}px "Times New Roman", serif`;
      ctx.fillStyle = '#333333';
      ctx.fillText(parts.join('    •    '), img.width * 0.05, img.height * 0.88);

      // Export file format pipeline
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas blob generation failed'));
          return;
        }
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Certificate_${studentName.replace(/\s+/g, '_')}.jpeg`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/jpeg', 0.95);
    };

    img.onerror = (err) => {
      reject(new Error('Failed to load certificate template image: ' + err));
    };
  });
}