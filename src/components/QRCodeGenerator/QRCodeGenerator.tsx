import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Download, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QRCodeGeneratorProps {
  data: string;
  size?: number;
  className?: string;
}

export default function QRCodeGenerator({ 
  data, 
  size = 200, 
  className = '' 
}: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && data) {
      QRCode.toCanvas(canvasRef.current, data, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }, (error) => {
        if (error) {
          console.error('QR Code generation error:', error);
        }
      });
    }
  }, [data, size]);

  const downloadQRCode = () => {
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.download = `qr-code-${Date.now()}.png`;
      link.href = canvasRef.current.toDataURL();
      link.click();
    }
  };

  const copyQRCode = async () => {
    if (canvasRef.current) {
      try {
        canvasRef.current.toBlob(async (blob) => {
          if (blob) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
          }
        });
      } catch (err) {
        console.error('Failed to copy QR code:', err);
      }
    }
  };

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      <div className="border rounded-lg p-4 bg-card">
        <canvas ref={canvasRef} />
      </div>
      
      <div className="flex gap-2">
        <Button 
          onClick={downloadQRCode} 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
        <Button 
          onClick={copyQRCode} 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
        >
          <Copy className="h-4 w-4" />
          Copy
        </Button>
      </div>
      
      <div className="text-center">
        <p className="text-sm text-muted-foreground break-all font-mono">
          {data}
        </p>
      </div>
    </div>
  );
}
