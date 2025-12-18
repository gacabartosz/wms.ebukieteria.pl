import { v4 as uuidv4 } from 'uuid';

export const generateDocumentNumber = (type: string, year: number, sequence: number): string => {
  const paddedSequence = String(sequence).padStart(4, '0');
  return `${type}/${year}/${paddedSequence}`;
};

export const parseLocationBarcode = (barcode: string): {
  warehouse: string;
  rack: string;
  shelf: string;
  level: string;
} | null => {
  const regex = /^([A-Z0-9]{2,4})-(\d{2})-(\d{2})-(\d{2})$/;
  const match = barcode.match(regex);

  if (!match) {
    return null;
  }

  return {
    warehouse: match[1],
    rack: match[2],
    shelf: match[3],
    level: match[4],
  };
};

export const validateLocationBarcode = (barcode: string): boolean => {
  const regex = /^[A-Z0-9]{2,4}-\d{2}-\d{2}-\d{2}$/;
  return regex.test(barcode);
};

export const validateEAN = (ean: string): boolean => {
  if (!ean) return true; // EAN is optional
  const regex = /^\d{8}$|^\d{13}$/;
  return regex.test(ean);
};

export const generateUUID = (): string => {
  return uuidv4();
};

export const sanitizePhone = (phone: string): string => {
  // Remove spaces and dashes, preserve + prefix and digits
  return phone.replace(/[\s-]/g, '').trim();
};

export const paginationHelper = (page: number, limit: number) => {
  const skip = (page - 1) * limit;
  return { skip, take: limit };
};

export const formatPagination = (
  page: number,
  limit: number,
  total: number
) => {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};
