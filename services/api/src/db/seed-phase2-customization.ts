import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { disconnectPrisma, getPrismaClient } from './prisma.js';

interface SeedOptionSpec {
  code: string;
  label: string;
  value: string;
  description?: string;
  swatchHex?: string;
  priceRuleType: 'INCLUDED' | 'FIXED_INR' | 'PER_GRAM_INR' | 'PER_CARAT_INR' | 'PERCENT_OF_BASE' | 'METAL_RATE_PURITY';
  priceRuleValue?: number;
  metalType?: string;
  metalPurity?: string;
  metalColor?: string;
  diamondShape?: string;
  diamondCaratWeight?: number;
  diamondColorGrade?: string;
  diamondClarityGrade?: string;
  isDefault?: boolean;
  sortOrder: number;
}

interface SeedGroupSpec {
  code: string;
  name: string;
  description?: string;
  stepOrder: number;
  selectionMode: 'SINGLE' | 'TEXT';
  optionCategory: string;
  isRequired: boolean;
  options: SeedOptionSpec[];
}

interface SeedProfileSpec {
  code: string;
  name: string;
  description: string;
  eligibleCategories: string[];
  isDefault: boolean;
  groups: SeedGroupSpec[];
}

const PHASE_2_PROFILES: SeedProfileSpec[] = [
  {
    code: 'BESPOKE_RINGS',
    name: 'Bespoke Ring Studio Profile',
    description: 'Configurable metal purity & tone, diamond quality, ring sizing, finish, and inside-band engraving.',
    eligibleCategories: ['Rings', 'Solitaire Rings', 'Bridal Rings', 'Engagement Rings'],
    isDefault: false,
    groups: [
      {
        code: 'metal_purity_color',
        name: 'Metal Purity & Tone',
        description: 'Select precious alloy and hallmark purity for this bespoke ring.',
        stepOrder: 1,
        selectionMode: 'SINGLE',
        optionCategory: 'METAL',
        isRequired: true,
        options: [
          {
            code: '18K_YELLOW',
            label: '18K Yellow Gold',
            value: '18K Yellow Gold',
            swatchHex: '#D4AF37',
            priceRuleType: 'METAL_RATE_PURITY',
            metalType: 'GOLD',
            metalPurity: '18K',
            metalColor: 'YELLOW',
            isDefault: true,
            sortOrder: 1,
          },
          {
            code: '18K_ROSE',
            label: '18K Rose Gold',
            value: '18K Rose Gold',
            swatchHex: '#E0A99B',
            priceRuleType: 'METAL_RATE_PURITY',
            metalType: 'GOLD',
            metalPurity: '18K',
            metalColor: 'ROSE',
            sortOrder: 2,
          },
          {
            code: '18K_WHITE',
            label: '18K White Gold',
            value: '18K White Gold',
            swatchHex: '#E5E4E2',
            priceRuleType: 'METAL_RATE_PURITY',
            metalType: 'GOLD',
            metalPurity: '18K',
            metalColor: 'WHITE',
            sortOrder: 3,
          },
          {
            code: '22K_YELLOW',
            label: '22K Royal Yellow Gold',
            value: '22K Royal Yellow Gold',
            swatchHex: '#C59B27',
            priceRuleType: 'METAL_RATE_PURITY',
            metalType: 'GOLD',
            metalPurity: '22K',
            metalColor: 'YELLOW',
            sortOrder: 4,
          },
          {
            code: 'PLATINUM_950',
            label: '950 Platinum',
            value: '950 Platinum',
            swatchHex: '#D6D8DC',
            priceRuleType: 'METAL_RATE_PURITY',
            metalType: 'PLATINUM',
            metalPurity: '950',
            metalColor: 'WHITE',
            sortOrder: 5,
          },
        ],
      },
      {
        code: 'diamond_grade',
        name: 'Diamond Quality Grade',
        description: 'Re-prices diamond components using the active diamond rate matrix.',
        stepOrder: 2,
        selectionMode: 'SINGLE',
        optionCategory: 'DIAMOND',
        isRequired: false,
        options: [
          {
            code: 'VVS1_EF',
            label: 'VVS1 / E-F (Bridal Reserve)',
            value: 'VVS1 / E-F',
            priceRuleType: 'INCLUDED',
            diamondColorGrade: 'EF',
            diamondClarityGrade: 'VVS1',
            sortOrder: 1,
          },
          {
            code: 'VS1_FG',
            label: 'VS1 / F-G (Signature)',
            value: 'VS1 / F-G',
            priceRuleType: 'INCLUDED',
            diamondColorGrade: 'FG',
            diamondClarityGrade: 'VS1',
            isDefault: true,
            sortOrder: 2,
          },
          {
            code: 'SI1_GH',
            label: 'SI1 / G-H (Classic)',
            value: 'SI1 / G-H',
            priceRuleType: 'INCLUDED',
            diamondColorGrade: 'GH',
            diamondClarityGrade: 'SI1',
            sortOrder: 3,
          },
        ],
      },
      {
        code: 'ring_size',
        name: 'Ring Size (Indian Standard)',
        description: 'Custom-sized to order before final hallmarking.',
        stepOrder: 3,
        selectionMode: 'SINGLE',
        optionCategory: 'SIZE',
        isRequired: true,
        options: [
          { code: 'IND_10', label: 'Size 10 (15.9 mm)', value: '10', priceRuleType: 'INCLUDED', sortOrder: 1 },
          { code: 'IND_12', label: 'Size 12 (16.5 mm)', value: '12', priceRuleType: 'INCLUDED', isDefault: true, sortOrder: 2 },
          { code: 'IND_14', label: 'Size 14 (17.2 mm)', value: '14', priceRuleType: 'INCLUDED', sortOrder: 3 },
          { code: 'IND_16', label: 'Size 16 (17.8 mm)', value: '16', priceRuleType: 'INCLUDED', sortOrder: 4 },
          { code: 'IND_18', label: 'Size 18 (18.5 mm)', value: '18', priceRuleType: 'FIXED_INR', priceRuleValue: 1200, sortOrder: 5 },
          { code: 'IND_20', label: 'Size 20 (19.1 mm)', value: '20', priceRuleType: 'FIXED_INR', priceRuleValue: 1800, sortOrder: 6 },
        ],
      },
      {
        code: 'finish_style',
        name: 'Surface Finish',
        stepOrder: 4,
        selectionMode: 'SINGLE',
        optionCategory: 'FINISH',
        isRequired: false,
        options: [
          { code: 'HIGH_POLISH', label: 'Mirror High Polish', value: 'Mirror High Polish', priceRuleType: 'INCLUDED', isDefault: true, sortOrder: 1 },
          { code: 'SATIN_MATTE', label: 'Brushed Satin Matte', value: 'Brushed Satin Matte', priceRuleType: 'FIXED_INR', priceRuleValue: 950, sortOrder: 2 },
          { code: 'MILGRAIN_ANTIQUE', label: 'Handcrafted Milgrain Bevel', value: 'Handcrafted Milgrain', priceRuleType: 'FIXED_INR', priceRuleValue: 1800, sortOrder: 3 },
        ],
      },
      {
        code: 'engraving_text',
        name: 'Inside-Band Engraving',
        description: 'Optional laser inscription inside the shank.',
        stepOrder: 5,
        selectionMode: 'TEXT',
        optionCategory: 'ENGRAVING',
        isRequired: false,
        options: [
          {
            code: 'ENGRAVING_STANDARD',
            label: 'Precision Laser Engraving',
            value: 'ENGRAVING',
            priceRuleType: 'FIXED_INR',
            priceRuleValue: 1500,
            sortOrder: 1,
          },
        ],
      },
    ],
  },
  {
    code: 'FINE_JEWELLERY_STANDARD',
    name: 'Fine Jewellery Standard Profile',
    description: 'Configurable alloy purity, tone, surface finish, and bespoke presentation packaging.',
    eligibleCategories: ['Necklaces', 'Earrings', 'Bracelets', 'Bangles', 'Pendants', 'Jewellery'],
    isDefault: true,
    groups: [
      {
        code: 'metal_purity_color',
        name: 'Metal Purity & Tone',
        stepOrder: 1,
        selectionMode: 'SINGLE',
        optionCategory: 'METAL',
        isRequired: true,
        options: [
          {
            code: '18K_YELLOW',
            label: '18K Yellow Gold',
            value: '18K Yellow Gold',
            swatchHex: '#D4AF37',
            priceRuleType: 'METAL_RATE_PURITY',
            metalType: 'GOLD',
            metalPurity: '18K',
            metalColor: 'YELLOW',
            isDefault: true,
            sortOrder: 1,
          },
          {
            code: '18K_ROSE',
            label: '18K Rose Gold',
            value: '18K Rose Gold',
            swatchHex: '#E0A99B',
            priceRuleType: 'METAL_RATE_PURITY',
            metalType: 'GOLD',
            metalPurity: '18K',
            metalColor: 'ROSE',
            sortOrder: 2,
          },
          {
            code: '18K_WHITE',
            label: '18K White Gold',
            value: '18K White Gold',
            swatchHex: '#E5E4E2',
            priceRuleType: 'METAL_RATE_PURITY',
            metalType: 'GOLD',
            metalPurity: '18K',
            metalColor: 'WHITE',
            sortOrder: 3,
          },
          {
            code: '22K_YELLOW',
            label: '22K Royal Yellow Gold',
            value: '22K Royal Yellow Gold',
            swatchHex: '#C59B27',
            priceRuleType: 'METAL_RATE_PURITY',
            metalType: 'GOLD',
            metalPurity: '22K',
            metalColor: 'YELLOW',
            sortOrder: 4,
          },
        ],
      },
      {
        code: 'finish_style',
        name: 'Surface Finish',
        stepOrder: 2,
        selectionMode: 'SINGLE',
        optionCategory: 'FINISH',
        isRequired: false,
        options: [
          { code: 'HIGH_POLISH', label: 'Mirror High Polish', value: 'Mirror High Polish', priceRuleType: 'INCLUDED', isDefault: true, sortOrder: 1 },
          { code: 'BRUSHED_MATTE', label: 'Soft Satin Matte', value: 'Soft Satin Matte', priceRuleType: 'FIXED_INR', priceRuleValue: 800, sortOrder: 2 },
        ],
      },
      {
        code: 'gift_packaging',
        name: 'Presentation Box',
        stepOrder: 3,
        selectionMode: 'SINGLE',
        optionCategory: 'OTHER',
        isRequired: false,
        options: [
          { code: 'ROYAL_VELVET_BOX', label: 'Signature Velvet Case (Complimentary)', value: 'Royal Velvet', priceRuleType: 'INCLUDED', isDefault: true, sortOrder: 1 },
          { code: 'BESPOKE_TIMBER_BOX', label: 'Heirloom Walnut Presentation Box', value: 'Heirloom Walnut', priceRuleType: 'FIXED_INR', priceRuleValue: 2200, sortOrder: 2 },
        ],
      },
    ],
  },
];

export async function seedPhase2CustomizationProfiles(): Promise<{
  profilesSeeded: number;
  groupsSeeded: number;
  optionsSeeded: number;
}> {
  const prisma = getPrismaClient();
  let profilesSeeded = 0;
  let groupsSeeded = 0;
  let optionsSeeded = 0;

  for (const profileSpec of PHASE_2_PROFILES) {
    const profile = await prisma.customizationProfile.upsert({
      where: { code: profileSpec.code },
      update: {
        name: profileSpec.name,
        description: profileSpec.description,
        eligibleCategories: profileSpec.eligibleCategories,
        isDefault: profileSpec.isDefault,
        isActive: true,
        updatedBy: 'system-seed@mangalroyal.local',
      },
      create: {
        code: profileSpec.code,
        name: profileSpec.name,
        description: profileSpec.description,
        eligibleCategories: profileSpec.eligibleCategories,
        isDefault: profileSpec.isDefault,
        isActive: true,
        createdBy: 'system-seed@mangalroyal.local',
      },
    });
    profilesSeeded += 1;

    for (const grpSpec of profileSpec.groups) {
      const grp = await prisma.customizationGroup.upsert({
        where: {
          profileId_code: {
            profileId: profile.id,
            code: grpSpec.code,
          },
        },
        update: {
          name: grpSpec.name,
          description: grpSpec.description ?? null,
          stepOrder: grpSpec.stepOrder,
          selectionMode: grpSpec.selectionMode,
          optionCategory: grpSpec.optionCategory,
          isRequired: grpSpec.isRequired,
          isActive: true,
        },
        create: {
          profileId: profile.id,
          code: grpSpec.code,
          name: grpSpec.name,
          description: grpSpec.description ?? null,
          stepOrder: grpSpec.stepOrder,
          selectionMode: grpSpec.selectionMode,
          optionCategory: grpSpec.optionCategory,
          isRequired: grpSpec.isRequired,
          isActive: true,
        },
      });
      groupsSeeded += 1;

      for (const optSpec of grpSpec.options) {
        await prisma.customizationOption.upsert({
          where: {
            groupId_code: {
              groupId: grp.id,
              code: optSpec.code,
            },
          },
          update: {
            label: optSpec.label,
            value: optSpec.value,
            description: optSpec.description ?? null,
            swatchHex: optSpec.swatchHex ?? null,
            priceRuleType: optSpec.priceRuleType,
            priceRuleValue: optSpec.priceRuleValue ?? 0,
            metalType: optSpec.metalType ?? null,
            metalPurity: optSpec.metalPurity ?? null,
            metalColor: optSpec.metalColor ?? null,
            diamondShape: optSpec.diamondShape ?? null,
            diamondCaratWeight: optSpec.diamondCaratWeight ?? null,
            diamondColorGrade: optSpec.diamondColorGrade ?? null,
            diamondClarityGrade: optSpec.diamondClarityGrade ?? null,
            isDefault: optSpec.isDefault ?? false,
            isActive: true,
            sortOrder: optSpec.sortOrder,
          },
          create: {
            groupId: grp.id,
            code: optSpec.code,
            label: optSpec.label,
            value: optSpec.value,
            description: optSpec.description ?? null,
            swatchHex: optSpec.swatchHex ?? null,
            priceRuleType: optSpec.priceRuleType,
            priceRuleValue: optSpec.priceRuleValue ?? 0,
            metalType: optSpec.metalType ?? null,
            metalPurity: optSpec.metalPurity ?? null,
            metalColor: optSpec.metalColor ?? null,
            diamondShape: optSpec.diamondShape ?? null,
            diamondCaratWeight: optSpec.diamondCaratWeight ?? null,
            diamondColorGrade: optSpec.diamondColorGrade ?? null,
            diamondClarityGrade: optSpec.diamondClarityGrade ?? null,
            isDefault: optSpec.isDefault ?? false,
            isActive: true,
            sortOrder: optSpec.sortOrder,
          },
        });
        optionsSeeded += 1;
      }
    }
  }

  return { profilesSeeded, groupsSeeded, optionsSeeded };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedPhase2CustomizationProfiles()
    .then(async (result) => {
      console.log('Seeded Phase 2 customization profiles:', result);
      await disconnectPrisma();
    })
    .catch(async (err) => {
      console.error('Failed to seed Phase 2 customization profiles:', err);
      await disconnectPrisma();
      process.exit(1);
    });
}
