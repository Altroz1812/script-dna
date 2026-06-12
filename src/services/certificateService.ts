/**
 * Generates a certificate on the client side using Canvas API and triggers a download.
 * @param studentName - The name of the student.
 * @param companyName - The name of the company/institute.
 */
export async function downloadCertificate(studentName: string, companyName: string): Promise<void> {
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

      // Render Student Name
      ctx.textAlign = 'center';
      ctx.fillStyle = '#2c3e50'; 
      ctx.font = 'bold 42px "Times New Roman", serif';
      
      const nameX = img.width * 0.34; 
      const nameY = img.height * 0.55; 
      ctx.fillText(studentName.toUpperCase(), nameX, nameY);

      // Render Company details
      ctx.font = 'italic 32px "Times New Roman", serif';
      ctx.fillStyle = '#555555';
      
      const companyX = img.width * 0.34;
      const companyY = img.height * 0.67;
      ctx.fillText(companyName, companyX, companyY);

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