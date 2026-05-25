// Generador automático de códigos de barras para MotoStock
// Genera códigos EAN-13 válidos cuando se ingresa un producto

export interface BarcodeGeneratorOptions {
  prefix?: string; // Prefijo para el producto (ej: "770" para Colombia)
  useChecksum?: boolean; // Incluir dígito de verificación
  format?: "EAN13" | "UPC" | "CODE128"; // Formato del código
}

export class BarcodeGenerator {
  private static readonly DEFAULT_PREFIX = "770"; // Colombia

  /**
   * Genera un código de barras EAN-13 válido automáticamente
   */
  static generateBarcode(productId: string, options: BarcodeGeneratorOptions = {}): string {
    const {
      prefix = this.DEFAULT_PREFIX,
      useChecksum = true,
      format = "EAN13"
    } = options;

    switch (format) {
      case "EAN13":
        return this.generateEAN13(productId, prefix, useChecksum);
      case "UPC":
        return this.generateUPC(productId);
      case "CODE128":
        return this.generateCode128(productId);
      default:
        return this.generateEAN13(productId, prefix, useChecksum);
    }
  }

  /**
   * Genera código EAN-13 (13 dígitos)
   * Formato: [3 dígitos país] + [4-6 dígitos empresa] + [3-5 dígitos producto] + [1 dígito verificador]
   */
  private static generateEAN13(productId: string, prefix: string, useChecksum: boolean): string {
    // Limpiar y convertir el productId a números
    const cleanProductId = this.sanitizeProductId(productId);
    
    // Construir el código base sin el dígito de verificación
    let baseCode = prefix;
    
    // Agregar código de empresa (basado en timestamp para unicidad)
    const companyCode = this.generateCompanyCode();
    baseCode += companyCode;
    
    // Agregar código de producto
    const productCode = this.padNumber(cleanProductId, 5); // Máximo 5 dígitos para producto
    baseCode += productCode.slice(0, 5); // Asegurar que no exceda 5 dígitos
    
    // Ajustar a 12 dígitos (sin el checksum)
    baseCode = baseCode.padEnd(12, '0').slice(0, 12);
    
    // Calcular y agregar dígito de verificación
    if (useChecksum) {
      const checksum = this.calculateEAN13Checksum(baseCode);
      return baseCode + checksum;
    }
    
    return baseCode;
  }

  /**
   * Genera código UPC (12 dígitos)
   */
  private static generateUPC(productId: string): string {
    const cleanProductId = this.sanitizeProductId(productId);
    const baseCode = this.padNumber(cleanProductId, 11);
    const checksum = this.calculateUPCChecksum(baseCode);
    return baseCode + checksum;
  }

  /**
   * Genera código Code128 (alfanumérico)
   */
  private static generateCode128(productId: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const cleanId = this.sanitizeProductId(productId);
    return `MS${cleanId}${timestamp}`.slice(0, 20);
  }

  /**
   * Calcula el dígito de verificación EAN-13
   */
  private static calculateEAN13Checksum(code: string): string {
    let sum = 0;
    
    // Sumar dígitos en posiciones impares (de derecha a izquierda)
    for (let i = 0; i < 6; i++) {
      const char = code[11 - i * 2];
      const digit = char ? parseInt(char, 10) : 0;
      sum += isNaN(digit) ? 0 : digit;
    }
    
    // Sumar dígitos en posiciones pares (de derecha a izquierda) y multiplicar por 3
    for (let i = 0; i < 6; i++) {
      const char = code[10 - i * 2];
      const digit = char ? parseInt(char, 10) : 0;
      sum += (isNaN(digit) ? 0 : digit) * 3;
    }
    
    // Calcular dígito de verificación
    const checksum = (10 - (sum % 10)) % 10;
    return checksum.toString();
  }

  /**
   * Calcula el dígito de verificación UPC
   */
  private static calculateUPCChecksum(code: string): string {
    let sum = 0;
    
    // Sumar dígitos en posiciones impares
    for (let i = 0; i < 6; i++) {
      const char = code[i * 2];
      const digit = char ? parseInt(char, 10) : 0;
      sum += isNaN(digit) ? 0 : digit;
    }
    
    // Sumar dígitos en posiciones pares y multiplicar por 3
    for (let i = 0; i < 5; i++) {
      const char = code[i * 2 + 1];
      const digit = char ? parseInt(char, 10) : 0;
      sum += (isNaN(digit) ? 0 : digit) * 3;
    }
    
    // Calcular dígito de verificación
    const checksum = (10 - (sum % 10)) % 10;
    return checksum.toString();
  }

  /**
   * Genera código de empresa basado en timestamp
   */
  private static generateCompanyCode(): string {
    const timestamp = Date.now();
    const companyCode = (timestamp % 10000).toString();
    return this.padNumber(companyCode, 4);
  }

  /**
   * Limpia el productId para usar solo números
   */
  private static sanitizeProductId(productId: string): string {
    // Extraer solo números del productId
    const numbers = productId.replace(/\D/g, '');
    
    // Si no hay números, usar un valor base
    if (numbers.length === 0) {
      return Date.now().toString().slice(-4);
    }
    
    return numbers;
  }

  /**
   * Rellena con ceros a la izquierda
   */
  private static padNumber(num: string, length: number): string {
    return num.padStart(length, '0').slice(-length);
  }

  /**
   * Valida si un código de barras EAN-13 es válido
   */
  static validateEAN13(barcode: string): boolean {
    if (!/^\d{13}$/.test(barcode)) {
      return false;
    }

    const code = barcode.slice(0, 12);
    const lastChar = barcode[12];
    if (lastChar === undefined) return false;
    
    const checksum = parseInt(lastChar, 10);
    const calculatedChecksum = parseInt(this.calculateEAN13Checksum(code), 10);
    
    return checksum === calculatedChecksum;
  }

  /**
   * Genera múltiples códigos para un lote de productos
   */
  static generateBatchBarcodes(productIds: string[], options?: BarcodeGeneratorOptions): Record<string, string> {
    const barcodes: Record<string, string> = {};
    
    productIds.forEach(productId => {
      barcodes[productId] = this.generateBarcode(productId, options);
    });
    
    return barcodes;
  }

  /**
   * Genera representación SVG del código de barras para visualización
   */
  static generateBarcodeSVG(barcode: string, width: number = 200, height: number = 60): string {
    const barWidth = width / barcode.length;
    const bars = barcode.split('').map((digit) => {
      const pattern = this.getBarPattern(parseInt(digit, 10));
      return pattern.split('').map(bar => bar === '1' ? 'black' : 'white');
    }).flat();

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="${width}" height="${height}" fill="white"/>`;
    
    bars.forEach((color, index) => {
      if (color === 'black') {
        svg += `<rect x="${index * barWidth}" y="0" width="${barWidth}" height="${height}" fill="black"/>`;
      }
    });
    
    svg += `</svg>`;
    return svg;
  }

  /**
   * Obtiene el patrón de barras para un dígito (simplificado)
   */
  private static getBarPattern(digit: number): string {
    // Patrones simplificados para EAN-13
    const patterns: Record<number, string> = {
      0: '0001101',
      1: '0011001',
      2: '0010011',
      3: '0111101',
      4: '0100011',
      5: '0110001',
      6: '0101111',
      7: '0111011',
      8: '0110111',
      9: '0001011'
    };
    const pattern = patterns[digit];
    return pattern !== undefined ? pattern : (patterns[0] ?? '0001101');
  }
}

// Hook para usar el generador de códigos de barras
export function useBarcodeGenerator() {
  const generateBarcode = (productId: string, options?: BarcodeGeneratorOptions) => {
    return BarcodeGenerator.generateBarcode(productId, options);
  };

  const validateBarcode = (barcode: string) => {
    return BarcodeGenerator.validateEAN13(barcode);
  };

  const generateBatch = (productIds: string[], options?: BarcodeGeneratorOptions) => {
    return BarcodeGenerator.generateBatchBarcodes(productIds, options);
  };

  const generateSVG = (barcode: string, width?: number, height?: number) => {
    return BarcodeGenerator.generateBarcodeSVG(barcode, width, height);
  };

  return {
    generateBarcode,
    validateBarcode,
    generateBatch,
    generateSVG
  };
}

// Utilidades para formato y visualización
export const BarcodeUtils = {
  /**
   * Formatea un código de barras para visualización
   */
  formatForDisplay(barcode: string): string {
    if (barcode.length === 13) {
      return `${barcode.slice(0, 1)} ${barcode.slice(1, 7)} ${barcode.slice(7, 13)}`;
    }
    return barcode;
  },

  /**
   * Extraer información de un código de barras
   */
  parseBarcode(barcode: string): {
    countryCode?: string;
    companyCode?: string;
    productCode?: string;
    checksum?: string;
  } {
    if (barcode.length === 13) {
      return {
        countryCode: barcode.slice(0, 3),
        companyCode: barcode.slice(3, 8),
        productCode: barcode.slice(8, 12),
        checksum: barcode.slice(12, 13)
      };
    }
    return {};
  },

  /**
   * Genera código human-readable para mostrar junto al barcode
   */
  generateHumanReadable(barcode: string): string {
    const parsed = this.parseBarcode(barcode);
    if (parsed.countryCode && parsed.companyCode && parsed.productCode) {
      return `PAÍS: ${parsed.countryCode} | EMP: ${parsed.companyCode} | PROD: ${parsed.productCode}`;
    }
    return barcode;
  }
};
