import prisma from '../config/prisma';
import { UserOrganizationRole } from '../models/UserOrganizationRole';
import { saasService } from './saas.service';
import logger from '../utils/logger';

export class TenantSchemaService {
  /**
   * Sanitizes an organization ID to a valid PostgreSQL schema identifier
   */
  getSchemaName(organizationId: string): string {
    const cleanId = String(organizationId).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    return `tenant_${cleanId}`;
  }

  /**
   * Provisions a dedicated PostgreSQL schema for an organization
   */
  async createTenantSchema(organizationId: string): Promise<string> {
    const schemaName = this.getSchemaName(organizationId);
    try {
      await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      logger.info(`PostgreSQL tenant schema provisioned: ${schemaName}`);
      return schemaName;
    } catch (error) {
      logger.error(`Failed to provision tenant schema "${schemaName}":`, error);
      throw error;
    }
  }

  /**
   * Sets PostgreSQL search_path for schema-per-tenant request isolation
   */
  async setTenantSearchPath(organizationId: string): Promise<void> {
    const schemaName = this.getSchemaName(organizationId);
    try {
      await prisma.$executeRawUnsafe(`SET search_path TO "${schemaName}", public`);
    } catch (error) {
      logger.warn(`Failed to set search_path for schema "${schemaName}", falling back to public:`, error);
    }
  }

  /**
   * Returns the count of registered employees/members in a tenant organization
   */
  async getTenantEmployeeCount(organizationId: string): Promise<number> {
    try {
      const count = await UserOrganizationRole.countDocuments({ organizationId: String(organizationId) });
      return count;
    } catch (error) {
      logger.error(`Error calculating employee count for tenant ${organizationId}:`, error);
      return 1;
    }
  }

  /**
   * Verifies if organization has available employee quota on their subscription
   */
  async checkEmployeeQuota(organizationId: string): Promise<{
    allowed: boolean;
    currentCount: number;
    maxLimit: number;
    planName: string;
  }> {
    const currentCount = await this.getTenantEmployeeCount(organizationId);
    const { subscription } = await saasService.getOrganizationSubscription(organizationId);
    
    // Default 10 employees for standard SaaS plans unless custom
    const maxLimit = subscription.maxUsersAtPurchase ?? 10;
    const allowed = maxLimit === -1 || maxLimit === 99999 || currentCount < maxLimit;

    return {
      allowed,
      currentCount,
      maxLimit,
      planName: subscription.planName || 'Starter'
    };
  }
}

export const tenantSchemaService = new TenantSchemaService();
