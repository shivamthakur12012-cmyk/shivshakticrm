import { z } from 'zod';

export const onboardSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  businessType: z.enum(['general', 'loan', 'registration', 'certification', 'custom']),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  email: z.string().email('Invalid email address'),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  gstin: z.string().length(15, 'GSTIN must be exactly 15 characters').optional().or(z.literal('')),
  pan: z.string().length(10, 'PAN must be exactly 10 characters').optional().or(z.literal('')),
  bankName: z.string().optional().or(z.literal('')),
  bankAccount: z.string().optional().or(z.literal('')),
  bankIfsc: z.string().optional().or(z.literal('')),
  bankUpi: z.string().optional().or(z.literal(''))
});

export const updateOrgSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  email: z.string().email('Invalid email address'),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zip: z.string().optional()
  }).optional(),
  gstin: z.string().optional().or(z.literal('')),
  pan: z.string().optional().or(z.literal('')),
  bankName: z.string().optional().or(z.literal('')),
  bankAccount: z.string().optional().or(z.literal('')),
  bankIfsc: z.string().optional().or(z.literal('')),
  bankUpi: z.string().optional().or(z.literal('')),
  currency: z.string().default('INR'),
  timezone: z.string().default('Asia/Kolkata')
});
