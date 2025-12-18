import prisma from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { validateEAN, paginationHelper, formatPagination } from '../../utils/helpers.js';

export const getProducts = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  owner?: string;
  zone?: string;
  category?: string;
  isActive?: boolean;
}) => {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const { skip, take } = paginationHelper(page, limit);

  const where: any = {};

  if (params.isActive !== undefined) {
    where.isActive = params.isActive;
  } else {
    where.isActive = true;
  }

  if (params.owner) {
    where.owner = params.owner;
  }

  if (params.zone) {
    where.zone = { contains: params.zone, mode: 'insensitive' };
  }

  if (params.category) {
    where.category = { contains: params.category, mode: 'insensitive' };
  }

  if (params.search) {
    where.OR = [
      { sku: { contains: params.search, mode: 'insensitive' } },
      { ean: { contains: params.search } },
      { name: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      include: {
        stocks: {
          select: { qty: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    data: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      ean: p.ean,
      name: p.name,
      description: p.description,
      unit: p.unit,
      zone: p.zone,
      category: p.category,
      owner: p.owner,
      imageUrl: p.imageUrl,
      priceNetto: p.priceNetto ? Number(p.priceNetto) : null,
      priceBrutto: p.priceBrutto ? Number(p.priceBrutto) : null,
      vatRate: p.vatRate,
      isActive: p.isActive,
      totalStock: p.stocks.reduce((sum, s) => sum + s.qty, 0),
    })),
    pagination: formatPagination(page, limit, total),
  };
};

export const getProductById = async (id: string) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      stocks: {
        include: {
          location: {
            select: { id: true, barcode: true, zone: true },
          },
        },
        where: { qty: { gt: 0 } },
      },
    },
  });

  if (!product) {
    throw new AppError('Produkt nie istnieje', 404);
  }

  return {
    ...product,
    totalStock: product.stocks.reduce((sum, s) => sum + s.qty, 0),
  };
};

export const getProductByCode = async (code: string) => {
  // Try to find by EAN first, then by SKU
  let product = await prisma.product.findFirst({
    where: { ean: code, isActive: true },
    include: {
      stocks: {
        include: {
          location: { select: { id: true, barcode: true } },
        },
        where: { qty: { gt: 0 } },
      },
    },
  });

  if (!product) {
    product = await prisma.product.findFirst({
      where: { sku: { equals: code, mode: 'insensitive' }, isActive: true },
      include: {
        stocks: {
          include: {
            location: { select: { id: true, barcode: true } },
          },
          where: { qty: { gt: 0 } },
        },
      },
    });
  }

  if (!product) {
    throw new AppError('Produkt nie istnieje', 404, 'PRODUCT_NOT_FOUND');
  }

  return {
    ...product,
    totalStock: product.stocks.reduce((sum, s) => sum + s.qty, 0),
  };
};

export const createProduct = async (data: {
  sku: string;
  ean?: string;
  name: string;
  unit?: string;
  zone?: string;
  owner?: string;
}) => {
  // Validate EAN if provided
  if (data.ean && !validateEAN(data.ean)) {
    throw new AppError('Nieprawidłowy format EAN', 400, 'INVALID_EAN');
  }

  // Check for duplicate SKU
  const existingSku = await prisma.product.findUnique({
    where: { sku: data.sku },
  });

  if (existingSku) {
    throw new AppError('Produkt z tym SKU już istnieje', 400, 'DUPLICATE_SKU');
  }

  // Check for duplicate EAN
  if (data.ean) {
    const existingEan = await prisma.product.findFirst({
      where: { ean: data.ean },
    });

    if (existingEan) {
      throw new AppError('EAN przypisany do innego produktu', 400, 'DUPLICATE_EAN');
    }
  }

  const product = await prisma.product.create({
    data: {
      sku: data.sku,
      ean: data.ean || null,
      name: data.name,
      unit: data.unit || 'szt',
      zone: data.zone,
      owner: data.owner,
    },
  });

  return product;
};

export const updateProduct = async (
  id: string,
  data: {
    ean?: string;
    name?: string;
    unit?: string;
    zone?: string;
    owner?: string;
  }
) => {
  const existing = await prisma.product.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Produkt nie istnieje', 404);
  }

  if (data.ean && !validateEAN(data.ean)) {
    throw new AppError('Nieprawidłowy format EAN', 400, 'INVALID_EAN');
  }

  if (data.ean) {
    const existingEan = await prisma.product.findFirst({
      where: { ean: data.ean, id: { not: id } },
    });

    if (existingEan) {
      throw new AppError('EAN przypisany do innego produktu', 400, 'DUPLICATE_EAN');
    }
  }

  const product = await prisma.product.update({
    where: { id },
    data,
  });

  return product;
};

export const updateProductImage = async (id: string, imageUrl: string) => {
  const existing = await prisma.product.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Produkt nie istnieje', 404);
  }

  const product = await prisma.product.update({
    where: { id },
    data: { imageUrl },
  });

  return { imageUrl: product.imageUrl };
};

export const deactivateProduct = async (id: string) => {
  const existing = await prisma.product.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Produkt nie istnieje', 404);
  }

  await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });

  return { message: 'Produkt został dezaktywowany' };
};

export const getAllProductsForExport = async () => {
  return prisma.product.findMany({
    orderBy: { sku: 'asc' },
  });
};
