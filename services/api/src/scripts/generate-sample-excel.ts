import * as fs from 'node:fs';
import * as path from 'node:path';
import * as XLSX from 'xlsx';

export interface SampleExcelRow {
  'Sr No': number;
  'Product Tag': string;
  SKU: string;
  Title: string;
  Handle: string;
  Category: string;
  'Metal Type': string;
  'Metal Purity': string;
  'Metal Color': string;
  'Ring Size': string;
  'Gross Weight (g)': number | string;
  'Net Weight (g)': number | string;
  'Making Charge Mode': string;
  'Making Charge Value': number;
  'Wastage Mode': string;
  'Wastage (%)': number;
  'Certification Fee (INR)': number;
  'Diamond 1 Shape': string;
  'Diamond 1 Quality': string;
  'Diamond 1 Sieve': string;
  'Diamond 1 Pieces': number;
  'Diamond 1 Carat': number;
  'Diamond 2 Shape': string;
  'Diamond 2 Quality': string;
  'Diamond 2 Sieve': string;
  'Diamond 2 Pieces': number;
  'Diamond 2 Carat': number;
  Hallmarked: string;
  'Stock Qty': number;
  'Image URL': string;
}

const VERIFIED_CDN_IMAGES: Record<string, string[]> = {
  Rings: [
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/a79933e475b1160a9334828e0d30c003bc131737.png',
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/0d3cd5b42c34340dd612c78835ea1c2d3b0adb38.png',
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/c04cabaf26db3873ddde6bde243cde7572ddeea8_1.jpg',
  ],
  Earrings: [
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/cfbaaa5e00a2471def9df241953eeac01f492955_1.png',
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/4ad63d14eaf4ccb8ad69310f2c516f5a96f1f8c1_1.jpg',
  ],
  Pendants: [
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/9e0729be479b73cbaecfabb3e8368e2f323323d5.png',
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/c28d5704abb507036c26701c54ae84ffc8656ea8_1.jpg',
  ],
  Necklaces: [
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/348b73957dedca68bba67b33bc0a9766b5914cd3.jpg',
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/832f60664a5381eb7addb5fef2ce71e8ae897c6f_1.jpg',
  ],
  Bracelets: [
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/6158221b28f34134f5119c8a750d12eceab5003b.png',
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/ecc2833a188c54ecfc769f015891cdb3ae75bd69.jpg',
  ],
  Bangles: [
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/1ae87b39ce7745cdb5ca5d5fb547519fe3fa790c.png',
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/bcc9181711e9062c42a1984945aa96643c4c1ac8.jpg',
  ],
  Mangalsutra: [
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/9e0729be479b73cbaecfabb3e8368e2f323323d5.png',
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/348b73957dedca68bba67b33bc0a9766b5914cd3.jpg',
  ],
  Solitaires: [
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/a79933e475b1160a9334828e0d30c003bc131737.png',
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/c04cabaf26db3873ddde6bde243cde7572ddeea8_1.jpg',
  ],
  'Nose Pins': [
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/cfbaaa5e00a2471def9df241953eeac01f492955_1.png',
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/c28d5704abb507036c26701c54ae84ffc8656ea8_1.jpg',
  ],
  Chains: [
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/348b73957dedca68bba67b33bc0a9766b5914cd3.jpg',
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/5df927a04b18c2c4c8210a32cb3a14c09e7dc4f3.jpg',
  ],
  Antique: [
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/cfbaaa5e00a2471def9df241953eeac01f492955.png',
    'https://i1dtfi-iv.myshopify.com/cdn/shop/files/1ae87b39ce7745cdb5ca5d5fb547519fe3fa790c.png',
  ],
};

const SHEET_SPECS: Array<{
  sheetName: string;
  prefix: string;
  count: number;
  baseGrossWeight: number;
  baseDiamondCarat: number;
  defaultPurity: string;
  names: string[];
}> = [
  {
    sheetName: 'Rings',
    prefix: 'RNG',
    count: 42,
    baseGrossWeight: 3.6,
    baseDiamondCarat: 0.55,
    defaultPurity: '18K',
    names: [
      'Maharani Heritage Solitaire Ring',
      'Jaipur Empress Emerald Cut Ring',
      'Royal Celeste Six-Prong Solitaire Ring',
      'Aurelia Cushion Halo Diamond Ring',
      'Noor Pear-Drop Pavé Engagement Ring',
      'Zoya Marquise Vintage Filigree Ring',
      'Veda Princess Cut Cathedral Band',
      'Tara Oval Hidden Halo Solitaire Ring',
    ],
  },
  {
    sheetName: 'Earrings',
    prefix: 'EAR',
    count: 36,
    baseGrossWeight: 4.8,
    baseDiamondCarat: 0.72,
    defaultPurity: '18K',
    names: [
      'Suryamaya Chandelier Diamond Jhumkas',
      'Lumière Classic Four-Prong Solitaire Studs',
      'Amara Pear Cascade Drop Earrings',
      'Devika Emerald-Cut Halo Huggie Hoops',
      'Kaveri Floral Cluster Diamond Tops',
      'Roshni Oval Halo Bridal Chandbalis',
    ],
  },
  {
    sheetName: 'Pendants',
    prefix: 'PND',
    count: 30,
    baseGrossWeight: 2.65,
    baseDiamondCarat: 0.42,
    defaultPurity: '18K',
    names: [
      'Arundhati Lotus Diamond Pendant',
      'Aria Pear-Drop Daily Solitaire Pendant',
      'Meera Heart Halo Lab-Grown Pendant',
      'Nandini Cushion Cut Floating Bail Pendant',
      'Ira Geometric Emerald Cut Locket',
    ],
  },
  {
    sheetName: 'Necklaces',
    prefix: 'NCK',
    count: 24,
    baseGrossWeight: 24.5,
    baseDiamondCarat: 3.1,
    defaultPurity: '18K',
    names: [
      'Rajwada Imperial Bridal Diamond Haar',
      'Regal Cascade Graduated Tennis Necklace',
      'Sitara Marquise & Pear Riviera Collar',
      'padmavati Heritage Layered Diamond Choker',
    ],
  },
  {
    sheetName: 'Bracelets',
    prefix: 'BRC',
    count: 26,
    baseGrossWeight: 9.8,
    baseDiamondCarat: 1.85,
    defaultPurity: '18K',
    names: [
      'Celestial Illusion Tennis Bracelet',
      'Eternity Riviera Four-Prong Diamond Bracelet',
      'Avani Oval & Round Station Chain Bracelet',
      'Sia Delicate Bezel Solitaire Wristlet',
    ],
  },
  {
    sheetName: 'Bangles',
    prefix: 'BNG',
    count: 24,
    baseGrossWeight: 21.4,
    baseDiamondCarat: 1.9,
    defaultPurity: '22K',
    names: [
      'Kundan Filigree Gold Kada Pair',
      'Maharani Heritage Diamond Kada Bangle',
      'Anika Pavé Stackable Hinged Bangle',
      'Vasudha Temple Motif Diamond Bracelet Kada',
    ],
  },
  {
    sheetName: 'Mangalsutra',
    prefix: 'MNG',
    count: 24,
    baseGrossWeight: 5.8,
    baseDiamondCarat: 0.52,
    defaultPurity: '18K',
    names: [
      'Ananya Evil-Eye Diamond Mangalsutra',
      'Saubhagya Twin Solitaire Black-Bead Mangalsutra',
      'Kavya Infinity Motif Everyday Mangalsutra',
      'Nitya Floral Cluster Tanmaniya Necklace',
    ],
  },
  {
    sheetName: 'Solitaires',
    prefix: 'SOL',
    count: 24,
    baseGrossWeight: 5.1,
    baseDiamondCarat: 1.05,
    defaultPurity: '18K',
    names: [
      'Royal Crown Platinum 950 Solitaire Band',
      ' Sovereign 1.50 ct IGI EF-VVS Solitaire Ring',
      'Imperial 2.00 ct Emerald Cut Solitaire Creation',
      'Celestial Oval Cut Signature Solitaire Piece',
    ],
  },
  {
    sheetName: 'Nose Pins',
    prefix: 'NSP',
    count: 22,
    baseGrossWeight: 1.15,
    baseDiamondCarat: 0.14,
    defaultPurity: '18K',
    names: [
      'Tara Delicate Seven-Stone Diamond Nath',
      'Bindu Bezel-Set Solitaire Nose Stud',
      'Chandra Crescent Floral Diamond Nose Pin',
      'Mayuri Marquise Trio Gold Nose Ring',
    ],
  },
  {
    sheetName: 'Chains',
    prefix: 'CHN',
    count: 22,
    baseGrossWeight: 12.4,
    baseDiamondCarat: 0,
    defaultPurity: '22K',
    names: [
      'Imperial Box-Link 22K Gold Chain (20 Inch)',
      'Venetian Mirror-Finish 18K Rose Gold Chain',
      'Royal Rope-Weave Hallmarked Gold Chain',
      'Classic Curb-Link Daily Wear Gold Chain',
    ],
  },
  {
    sheetName: 'Antique',
    prefix: 'ANT',
    count: 22,
    baseGrossWeight: 31.2,
    baseDiamondCarat: 1.8,
    defaultPurity: '22K',
    names: [
      'Mughal Nakshi Temple Heritage Choker',
      '1975 Founder Edition Antique Polki & Diamond Choker',
      'Deccan Heritage Peacock Jhumka Suite',
      'Travancore Royal Kasu & Diamond Mala',
    ],
  },
];

const SHAPES = ['ROUND', 'OVAL', 'EMERALD', 'CUSHION', 'PEAR', 'PRINCESS', 'MARQUISE', 'HEART'];
const COLORS = ['Rose Gold', 'Yellow Gold', 'White Gold'];
const RING_SIZES = ['10', '11', '12', '13', '14', '15', '16', '17', '18'];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function build296WorkbookData(): Record<string, SampleExcelRow[]> {
  const result: Record<string, SampleExcelRow[]> = {};
  let globalSerial = 1;

  for (const spec of SHEET_SPECS) {
    const rows: SampleExcelRow[] = [];
    const images = VERIFIED_CDN_IMAGES[spec.sheetName] || VERIFIED_CDN_IMAGES.Rings!;

    for (let i = 1; i <= spec.count; i++) {
      const numCode = 100 + i;
      const sku = `MRS-${spec.prefix}-${numCode}`;
      const baseTitle = spec.names[(i - 1) % spec.names.length]!.trim();
      const title = i <= spec.names.length ? baseTitle : `${baseTitle} — Edition ${i}`;
      const handle = slugify(`${title}-${sku}`);
      const shape = SHAPES[(i - 1) % SHAPES.length]!;
      const metalColor = COLORS[(i - 1) % COLORS.length]!;
      const purity =
        spec.sheetName === 'Solitaires' && i === 1
          ? 'PLATINUM_950'
          : i % 5 === 0 && spec.defaultPurity === '18K'
          ? '14K'
          : spec.defaultPurity;
      const metalType = purity === 'PLATINUM_950' ? 'PLATINUM' : 'GOLD';

      const d1Carat =
        spec.baseDiamondCarat > 0
          ? Number(Math.max(0.08, spec.baseDiamondCarat + ((i % 7) - 2) * 0.08).toFixed(2))
          : 0;
      const d2Carat =
        spec.baseDiamondCarat > 0 && i % 2 === 1
          ? Number((0.12 + (i % 5) * 0.04).toFixed(2))
          : 0;
      const totalCarat = d1Carat + d2Carat;
      const stoneGrams = Number((totalCarat * 0.2).toFixed(3));
      const netWeight = Number((spec.baseGrossWeight + ((i % 9) - 3) * 0.35).toFixed(3));
      const grossWeight = Number((netWeight + stoneGrams).toFixed(3));

      const row: SampleExcelRow = {
        'Sr No': globalSerial++,
        'Product Tag': `TAG-${spec.prefix}-${String(numCode).padStart(4, '0')}`,
        SKU: sku,
        Title: title,
        Handle: handle,
        Category: spec.sheetName,
        'Metal Type': metalType,
        'Metal Purity': purity,
        'Metal Color': purity === 'PLATINUM_950' ? 'Platinum' : metalColor,
        'Ring Size':
          spec.sheetName === 'Rings' || spec.sheetName === 'Solitaires'
            ? RING_SIZES[(i - 1) % RING_SIZES.length]!
            : 'Free Size',
        'Gross Weight (g)': grossWeight,
        'Net Weight (g)': netWeight,
        'Making Charge Mode':
          spec.sheetName === 'Necklaces' || spec.sheetName === 'Antique'
            ? 'PERCENTAGE_OF_METAL'
            : spec.sheetName === 'Nose Pins'
            ? 'FLAT_PER_PIECE'
            : 'PER_GRAM',
        'Making Charge Value':
          spec.sheetName === 'Necklaces' || spec.sheetName === 'Antique'
            ? 14
            : spec.sheetName === 'Nose Pins'
            ? 2400
            : 1650 + (i % 5) * 50,
        'Wastage Mode':
          spec.sheetName === 'Nose Pins' || purity === 'PLATINUM_950'
            ? 'NONE'
            : 'PERCENT_OF_METAL_VALUE',
        'Wastage (%)':
          spec.sheetName === 'Nose Pins' || purity === 'PLATINUM_950' ? 0 : 3.5,
        'Certification Fee (INR)': d1Carat > 0 ? 1500 : 0,
        'Diamond 1 Shape': d1Carat > 0 ? shape : '',
        'Diamond 1 Quality': d1Carat > 0 ? (i % 4 === 0 ? 'GH_VS_SI' : 'EF_VVS') : '',
        'Diamond 1 Sieve':
          d1Carat >= 0.5
            ? 'SOLITAIRE_015_PLUS'
            : d1Carat > 0
            ? 'PLUS_2_TO_PLUS_6'
            : '',
        'Diamond 1 Pieces': d1Carat > 0 ? (d1Carat >= 0.5 ? 1 : 12 + (i % 16)) : 0,
        'Diamond 1 Carat': d1Carat,
        'Diamond 2 Shape': d2Carat > 0 ? 'ROUND' : '',
        'Diamond 2 Quality': d2Carat > 0 ? 'EF_VVS' : '',
        'Diamond 2 Sieve': d2Carat > 0 ? 'STAR_MELEE' : '',
        'Diamond 2 Pieces': d2Carat > 0 ? 8 + (i % 10) : 0,
        'Diamond 2 Carat': d2Carat,
        Hallmarked: 'Yes',
        'Stock Qty': 2 + (i % 8),
        'Image URL': images[(i - 1) % images.length]!,
      };

      // Inject 1 intentional net-weight > gross-weight validation demo row in Rings last row
      if (spec.sheetName === 'Rings' && i === spec.count) {
        row.SKU = 'MRS-RNG-ERR-WEIGHT';
        row.Title = 'Invalid Weight Test Ring (Dry-Run Validation Demo)';
        row.Handle = 'invalid-weight-test-ring';
        row['Gross Weight (g)'] = 3.2;
        row['Net Weight (g)'] = 4.1;
      }

      // Inject 1 intentional duplicate SKU protection demo row in Antique last row
      if (spec.sheetName === 'Antique' && i === spec.count) {
        row.SKU = 'MRS-RNG-101';
        row.Title = 'Duplicate SKU Protection Test Row';
        row.Handle = 'duplicate-sku-protection-test-row';
      }

      rows.push(row);
    }

    result[spec.sheetName] = rows;
  }

  return result;
}

export const SHEET_DATA: Record<string, SampleExcelRow[]> = build296WorkbookData();

export function generateSampleWorkbookBuffer(): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(SHEET_DATA)) {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function writeSampleWorkbookToDisk(targetPath?: string): string {
  const outPath =
    targetPath ||
    path.resolve(process.cwd(), '..', '..', 'samples', 'MANGAL JEWELLERY.xlsx');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const buffer = generateSampleWorkbookBuffer();
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

if (process.argv[1] && process.argv[1].includes('generate-sample-excel')) {
  const savedSample = writeSampleWorkbookToDisk(
    path.resolve(process.cwd(), 'samples', 'MANGAL JEWELLERY.xlsx')
  );
  const savedRoot = writeSampleWorkbookToDisk(
    path.resolve(process.cwd(), 'MANGAL JEWELLERY.xlsx')
  );
  console.log(`Generated 296-record 11-sheet workbook at:\n  - ${savedRoot}\n  - ${savedSample}`);
}
